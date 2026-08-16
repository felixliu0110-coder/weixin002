const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { taskId, status, result } = event;
  if (!taskId || !status) return { ok: false, error: "taskId/status 必填" };
  try {
    const taskRes = await db.collection("tryon_tasks").doc(taskId).get();
    const task = taskRes.data;
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status, updated_at: Date.now() } });
    if (status === "success" && result) {
      await db.collection("tryon_results").add({
        data: {
          user_id: task.user_id,
          avatar_view_id: task.avatar_view_id,
          garment_id: (task.garment_ids || [])[0],
          garment_name: (result.garmentName || "AI 试穿"),
          tryon_image: result.tryonImage || task.tryon_image,
          tryon_video: result.tryonVideo || task.tryon_video,
          ai_tagged: true,
          created_at: Date.now()
        }
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
