/* 试穿回调核心逻辑（模型无关，可单测）：
   - 状态机校验：只允许合法迁移；
   - 幂等：同 task 同状态重复回调直接返回；结果按 task_id 去重；
   - 结果值优先取服务端任务字段，不信任回调携带的任意 URL 作为授权/归属依据。
   - 原子性：success 必须先验证真实结果（tryonImage/tryonVideo 至少一个存在），
     验证通过后才写 tryon_tasks=success，再创建/更新 tryon_results；
     验证失败（结果为空）不得把 Task 写成 success。 */

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
  // 幂等：同状态重复回调直接返回（合法幂等逻辑保留）
  if (task.status === st) return { ok: true, idempotent: true };
  // 只允许合法状态迁移
  assertTransition(task.status, st);

  const ts = now || Date.now();

  // 【原子性保证】success 必须先解析并验证真实结果，在任何 Task 状态写入之前完成。
  // 验证失败（tryonImage/tryonVideo 都为空）直接抛错，此时 Task 尚未被改写，
  // 后续带真实结果的 success 回调仍可正常处理（不会留下 success + 无 result 的不一致状态）。
  let successResult = null;
  if (st === "success") {
    successResult = resolveSuccessResult(result, task);
  }

  // 至此，success 已通过真实结果验证；开始写 Task 终态。
  const update = { status: st, updated_at: ts };
  if (st === "processing") update.started_at = ts;
  if (st === "success" || st === "failed" || st === "cancelled") update.completed_at = ts;
  if (providerTaskId) update.provider_task_id = providerTaskId;
  await db.collection("tryon_tasks").doc(tid).update({ data: update });

  // Task 已成功写入 success，接着创建/更新 tryon_results（按 task_id 去重）
  if (st === "success") {
    const { tryonImage, tryonVideo } = successResult;
    const dup = await db.collection("tryon_results").where({ task_id: tid }).limit(1).get();
    if (dup.data.length === 0) {
      await db.collection("tryon_results").add({
        data: {
          _openid: task._openid || task.user_id,
          user_id: task.user_id,
          task_id: tid,
          avatar_view_id: task.avatar_view_id,
          garment_id: (task.garment_ids || [])[0],
          garment_name: task.garment_name || "AI 试穿",
          tryon_image: tryonImage,
          tryon_video: tryonVideo,
          ai_tagged: true,
          created_at: ts,
          createdAt: ts,
          updated_at: ts
        }
      });
    } else {
      await db.collection("tryon_results").doc(dup.data[0]._id).update({
        data: { tryon_video: tryonVideo, tryon_image: tryonImage, updated_at: ts }
      });
    }
  }
  return { ok: true };
}

module.exports = { handleCallback, resolveSuccessResult };
