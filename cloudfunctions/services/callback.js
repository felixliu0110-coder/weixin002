/* 试穿回调核心逻辑（模型无关，可单测）：
   - 状态机校验：只允许合法迁移；
   - 幂等：同 task 同状态重复回调直接返回；结果按 task_id 去重；
   - 结果值优先取服务端任务字段，不信任回调携带的任意 URL 作为授权/归属依据。 */
const { appError } = require("./errors");
const { assertTransition } = require("./taskState");
const { requireString, requireEnum } = require("./validation");

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
  // 幂等：同状态重复回调直接返回
  if (task.status === st) return { ok: true, idempotent: true };
  // 只允许合法状态迁移
  assertTransition(task.status, st);
  const ts = now || Date.now();
  const update = { status: st, updated_at: ts };
  if (st === "processing") update.started_at = ts;
  if (st === "success" || st === "failed" || st === "cancelled") update.completed_at = ts;
  if (providerTaskId) update.provider_task_id = providerTaskId;
  await db.collection("tryon_tasks").doc(tid).update({ data: update });
  if (st === "success") {
    const r = result || {};
    const tryonVideo = r.tryonVideo || task.tryon_video || "";
    const tryonImage = r.tryonImage || task.tryon_image || "";
    if (!tryonImage && !tryonVideo) throw appError("INVALID_ARGUMENT", "回调结果缺少图片/视频");
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

module.exports = { handleCallback };
