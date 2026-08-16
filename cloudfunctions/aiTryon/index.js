const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildTryonVideoPrompt } = require("./tryonVideo");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function submit(event, openid) {
  const { avatarViewId, garmentIds, garmentNames } = event;
  if (!avatarViewId || !garmentIds || garmentIds.length === 0) {
    return { ok: false, error: "avatarViewId/garmentIds 必填" };
  }
  const av = await db.collection("avatar_views").doc(avatarViewId).get();
  const profile = av.data.profile_snapshot || {};
  const garmentName = (garmentNames && garmentNames[0]) || "所选衣物";
  const aigc = getAigc();
  const videoPrompt = buildTryonVideoPrompt(profile, garmentName);
  const task = {
    user_id: openid,
    avatar_view_id: avatarViewId,
    garment_ids: garmentIds,
    type: "ai_video",
    stage: "video",
    status: "processing",
    retry_count: 0,
    created_at: Date.now(),
    updated_at: Date.now()
  };
  const addRes = await db.collection("tryon_tasks").add({ data: task });
  const taskId = addRes._id;
  try {
    // 试穿图 + 转身视频（P0 真实生成在 P1；此处调用适配器，mock 立即返回占位）
    const imgRes = await aigc.generateImages({ prompt: "同人物穿着" + garmentName + "的照片级效果图", refImages: [], count: 1 });
    const vidRes = await aigc.generateVideo({ imageUrl: imgRes.urls[0], prompt: videoPrompt, durationSec: 5 });
    const update = {
      stage: "video",
      status: "success",
      tryon_image: imgRes.urls[0],
      tryon_video: vidRes.videoUrl,
      updated_at: Date.now()
    };
    await db.collection("tryon_tasks").doc(taskId).update({ data: update });
    return { ok: true, taskId, status: "success" };
  } catch (e) {
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "failed", error: e.code || e.message, updated_at: Date.now() } });
    return { ok: false, taskId, error: e.code || e.message };
  }
}

async function status(event) {
  const res = await db.collection("tryon_tasks").doc(event.taskId).get();
  const d = res.data;
  return { ok: true, taskId: event.taskId, status: d.status, stage: d.stage, tryonImage: d.tryon_image, tryonVideo: d.tryon_video, error: d.error };
}

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  if (event.action === "status") return status(event);
  return submit(event, openid);
};
