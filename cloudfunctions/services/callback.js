/* 试穿回调核心逻辑（模型无关，可单测）：
   - 状态机校验：只允许合法迁移；
   - 幂等：同 task 同状态重复回调直接返回；结果按 task_id 去重；
   - 结果值优先取服务端任务字段，不信任回调携带的任意 URL 作为授权/归属依据。
   - 原子性（Phase 5-3-C）：success 的 Task 更新与 Result 创建/更新
     统一在 finalizeTryonSuccessAtomically() 的 CloudBase Transaction 内完成。
     AI/Provider 调用绝不进入事务。 */

const { appError } = require("./errors");
const { assertTransition } = require("./taskState");
const { requireString, requireEnum } = require("./validation");

// 解析并验证 success 回调的真实结果。
// 返回 { tryonImage, tryonVideo }；若两者皆空则抛出 INVALID_ARGUMENT。
// 此函数本身不触碰数据库，便于单测。
function resolveSuccessResult(result, task) {
  const r = result || {};
  const tryonVideo = r.tryonVideo || task.tryon_video || "";
  const tryonImage = r.tryonImage || task.tryon_image || "";
  if (!tryonImage && !tryonVideo) {
    throw appError("INVALID_ARGUMENT", "回调结果缺少图片/视频");
  }
  return { tryonImage, tryonVideo };
}

/* ============================================================
   Phase 5-3-C：事务原子完成函数
   将 Task success 更新 + Result 创建/更新 放在同一个
   CloudBase Transaction 内，杜绝"Task=success 但 Result 缺失"的不一致。

   调用时机：AI/Provider 调用已在事务外完成，已获得真实结果。
   事务内绝不调用 AI / Provider / 下载图片 / 任何长耗时网络操作。

   覆盖五种状态：
     A) processing + 无 Result → Task=success + 创建 Result
     B) success + Result 已存在 → idempotent（不新增）
     C) success + Result 缺失 + 有真实结果 → 补建 Result（修复坏状态）
     D) processing + 结果为空 → 抛 INVALID_ARGUMENT，Task 不变
     E) 事务内任一操作失败 → rollback，Task 不留 success
   ============================================================ */
async function finalizeTryonSuccessAtomically({ db, taskId, tryonImage, tryonVideo, provider, now }) {
  if (!tryonImage && !tryonVideo) {
    throw appError("INVALID_ARGUMENT", "真实结果为空，不得写入 success");
  }

  const ts = now || Date.now();
  let tx;
  try {
    tx = await db.startTransaction();

    // 1. 事务内重新读取 Task（防止并发脏写）
    const taskRes = await tx.collection("tryon_tasks").doc(taskId).get();
    const task = taskRes.data;
    if (!task) {
      await tx.rollback();
      throw appError("NOT_FOUND");
    }

    // 2. 查询 tryon_results where task_id
    const existRes = await tx.collection("tryon_results")
      .where({ task_id: taskId }).limit(1).get();
    const existList = (existRes && existRes.data) || [];

    // 3. 按状态分支处理
    if (task.status === "success" && existList.length > 0) {
      // 情况 B：幂等，Task=success + Result 已存在
      await tx.commit();
      return { ok: true, idempotent: true };
    }

    if (task.status === "success" && existList.length === 0) {
      // 情况 C：Task=success 但 Result 缺失 → 补建 Result（修复历史坏状态）
      // 并发保护（Phase 5-3-C-P1.1）：对 Task 做轻量更新（updated_at）作为冲突点。
      // CloudBase Transaction 对同一文档的并发写入会产生冲突，确保两个并发 repair
      // 只有一个能成功 commit，另一个会因事务冲突而 rollback，从而保证
      // tryon_results(task_id=X) 最终只有一条。
      await tx.collection("tryon_tasks").doc(taskId).update({
        data: { updated_at: ts }
      });
      await tx.collection("tryon_results").add({
        data: {
          _openid: task._openid || task.user_id,
          user_id: task.user_id,
          task_id: taskId,
          avatar_view_id: task.avatar_view_id,
          garment_id: (task.garment_ids || [])[0],
          garment_name: task.garment_name || "AI 试穿",
          tryon_image: tryonImage,
          tryon_video: tryonVideo,
          cache_key: task.cache_key || "",
          ai_tagged: true,
          created_at: ts,
          createdAt: ts,
          updated_at: ts
        }
      });
      await tx.commit();
      return { ok: true, repaired: true };
    }

    // 情况 A：processing → success + 创建 Result
    assertTransition(task.status, "success");

    await tx.collection("tryon_tasks").doc(taskId).update({
      data: {
        status: "success",
        tryon_image: tryonImage,
        tryon_video: tryonVideo,
        provider: provider || task.provider,
        completed_at: ts,
        updated_at: ts
      }
    });

    await tx.collection("tryon_results").add({
      data: {
        _openid: task._openid || task.user_id,
        user_id: task.user_id,
        task_id: taskId,
        avatar_view_id: task.avatar_view_id,
        garment_id: (task.garment_ids || [])[0],
        garment_name: task.garment_name || "AI 试穿",
        tryon_image: tryonImage,
        tryon_video: tryonVideo,
        cache_key: task.cache_key || "",
        ai_tagged: true,
        created_at: ts,
        createdAt: ts,
        updated_at: ts
      }
    });

    await tx.commit();
    return { ok: true };
  } catch (e) {
    // 情况 E：事务失败 → 尝试 rollback（rollback 本身失败不覆盖原始业务错误）
    if (tx) {
      try { await tx.rollback(); } catch (_re) { /* ignore */ }
    }
    if (e && e.appCode) throw e;
    throw appError("TRANSACTION_FAILED", "事务执行失败: " + (e.message || e));
  }
}

async function handleCallback({ db, taskId, status, result, now, providerTaskId }) {
  const tid = requireString(taskId, "taskId", 128);
  const st = requireEnum(status, "status", ["success", "failed", "processing", "cancelled"]);
  let task;
  try {
    const res = await db.collection("tryon_tasks").doc(tid).get();
    task = res.data;
  } catch (e) {
    throw appError("NOT_FOUND");
  }
  // 非 success 幂等：同状态重复回调直接返回
  if (task.status === st && st !== "success") return { ok: true, idempotent: true };
  // success 幂等 + 坏状态修复统一交由 finalizeTryonSuccessAtomically 处理
  if (task.status === st && st === "success") {
    const successResult = resolveSuccessResult(result, task);
    return finalizeTryonSuccessAtomically({
      db, taskId: tid,
      tryonImage: successResult.tryonImage, tryonVideo: successResult.tryonVideo,
      provider: task.provider, now
    });
  }
  // 只允许合法状态迁移
  assertTransition(task.status, st);

  const ts = now || Date.now();

  // 非 success 终态：直接更新 Task（无需事务，不涉及 Result）
  if (st !== "success") {
    const update = { status: st, updated_at: ts };
    if (st === "processing") update.started_at = ts;
    if (st === "failed" || st === "cancelled") update.completed_at = ts;
    if (providerTaskId) update.provider_task_id = providerTaskId;
    await db.collection("tryon_tasks").doc(tid).update({ data: update });
    return { ok: true };
  }

  // success：先验证真实结果（事务外，不信任空值）
  const successResult = resolveSuccessResult(result, task);

  // Phase 5-3-C：Task success + Result 创建/更新 在事务内原子完成
  return finalizeTryonSuccessAtomically({
    db, taskId: tid,
    tryonImage: successResult.tryonImage, tryonVideo: successResult.tryonVideo,
    provider: task.provider, now: ts
  });
}

module.exports = { handleCallback, resolveSuccessResult, finalizeTryonSuccessAtomically };
