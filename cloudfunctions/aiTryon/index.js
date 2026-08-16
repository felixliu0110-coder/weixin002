const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildTryonVideoPrompt } = require("./tryonVideo");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function fmtErr(e) {
  const detail = (e && e.message) ? e.message : String(e);
  return (e && e.code) ? e.code + ": " + detail : detail;
}

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
    _openid: openid,
    user_id: openid,
    avatar_view_id: avatarViewId,
    garment_ids: garmentIds,
    type: "ai_video",
    stage: "video",
    status: "processing",
    retry_count: 0,
    createdAt: Date.now(),
    updated_at: Date.now()
  };
  const addRes = await db.collection("tryon_tasks").add({ data: task });
  const taskId = addRes._id;
  try {
    // 试穿效果图（agnes 同步生图，等待返回 URL）
    const imgRes = await aigc.generateImages({ prompt: "同人物穿着" + garmentName + "的照片级效果图", refImages: [], count: 1 });
    const vidRes = await aigc.generateVideo({ imageUrl: imgRes.urls[0], prompt: videoPrompt, durationSec: 5 });
    const update = { stage: "video", tryon_image: imgRes.urls[0], updated_at: Date.now() };
    if (vidRes.videoTaskId) {
      // 异步视频服务（agnes）：创建任务后由 status 轮询完成
      update.video_task_id = vidRes.videoTaskId;
      update.provider = vidRes.provider || "agnes";
    } else {
      // 同步实现（mock）：直接落结果
      update.status = "success";
      update.tryon_video = vidRes.videoUrl;
      update.provider = vidRes.provider || "mock";
    }
    await db.collection("tryon_tasks").doc(taskId).update({ data: update });
    return { ok: true, taskId, status: update.status || "processing" };
  } catch (e) {
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "failed", error: fmtErr(e), updated_at: Date.now() } });
    return { ok: false, taskId, error: fmtErr(e) };
  }
}

async function status(event) {
  const res = await db.collection("tryon_tasks").doc(event.taskId).get();
  const d = res.data;
  // 异步视频任务：生成中轮询；或已 success 但视频 URL 缺失（旧字段解析 bug）时补全
  const needPoll = d.video_task_id && (d.status === "processing" || (d.status === "success" && !d.tryon_video));
  if (needPoll) {
    const aigc = getAigc();
    if (aigc && aigc.getVideoStatus) {
      try {
        const st = await aigc.getVideoStatus(d.video_task_id);
        if (st.status === "completed" || st.status === "succeeded" || st.videoUrl) {
          await db.collection("tryon_tasks").doc(event.taskId).update({
            data: { status: "success", tryon_video: st.videoUrl, updated_at: Date.now() }
          });
          d.status = "success";
          d.tryon_video = st.videoUrl;
        } else if (st.status === "failed") {
          const msg = st.error || "视频生成失败";
          await db.collection("tryon_tasks").doc(event.taskId).update({
            data: { status: "failed", error: msg, updated_at: Date.now() }
          });
          d.status = "failed";
          d.error = msg;
        }
        // queued / in_progress：保持 processing，前端继续轮询
      } catch (e) {
        // 单次轮询失败不判死，保持 processing 让前端重试
      }
    }
  }
  return { ok: true, taskId: event.taskId, status: d.status, stage: d.stage, tryonImage: d.tryon_image, tryonVideo: d.tryon_video, error: d.error };
}

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  if (event.action === "status") return status(event);
  return submit(event, openid);
};
