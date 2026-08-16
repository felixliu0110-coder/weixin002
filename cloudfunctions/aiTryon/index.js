const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildTryonVideoPrompt } = require("./tryonVideo");
const { buildTryonCacheKey, isCacheHit } = require("./tryonCache");
const { saveRemoteImage } = require("./storage");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function fmtErr(e) {
  const detail = (e && e.message) ? e.message : String(e);
  return (e && e.code) ? e.code + ": " + detail : detail;
}

/* 试穿完成写记录（task_id 去重；占位视频不写，避免污染真实记录） */
async function saveTryonResult(task) {
  try {
    if (!task || !task.tryon_video || task.tryon_video.indexOf("placeholder") >= 0) return false;
    const dup = await db.collection("tryon_results").where({ task_id: task._id }).limit(1).get();
    if (dup.data.length > 0) return false;
    await db.collection("tryon_results").add({
      data: {
        _openid: task._openid || task.user_id,
        user_id: task.user_id,
        task_id: task._id,
        avatar_view_id: task.avatar_view_id,
        garment_id: (task.garment_ids || [])[0],
        garment_name: task.garment_name || "AI 试穿",
        tryon_image: task.tryon_image,
        tryon_video: task.tryon_video,
        ai_tagged: true,
        createdAt: Date.now()
      }
    });
    return true;
  } catch (e) {
    console.log("saveTryonResult fail", "taskId=" + (task && task._id), "error=" + fmtErr(e));
    return false;
  }
}

/* 订阅消息通知（需配置环境变量 SUBSCRIBE_TMPL_ID；字段名以申请的模板为准） */
function fmtTime(ts) {
  // 云函数默认 UTC，按中国时区 UTC+8 格式化：2026年8月16日 22:30
  const d = new Date(ts + 8 * 3600 * 1000);
  const iso = d.toISOString();
  const y = iso.slice(0, 4);
  const mo = parseInt(iso.slice(5, 7), 10);
  const da = parseInt(iso.slice(8, 10), 10);
  return y + "年" + mo + "月" + da + "日 " + iso.slice(11, 16);
}

async function sendSubscribe(openid, garmentName) {
  const tmplId = process.env.SUBSCRIBE_TMPL_ID;
  console.log("aiTryon subscribe attempt", "tmplId=" + (tmplId ? "set" : "EMPTY"), "openid=" + (openid ? "set" : "EMPTY"));
  if (!tmplId || !openid) return false;
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: tmplId,
      page: "pages/tryon-result/index",
      data: {
        thing1: { value: ("AI试穿「" + (garmentName || "所选衣物") + "」已生成").slice(0, 20) },
        time1: { value: fmtTime(Date.now()) }
      }
    });
    console.log("aiTryon subscribe sent", "openid=" + openid);
    return true;
  } catch (e) {
    console.log("aiTryon subscribe fail", "error=" + ((e && (e.errMsg || e.message)) || e));
    return false;
  }
}

async function submit(event, openid) {
  const { avatarViewId, garmentIds, garmentNames } = event;
  const t0 = Date.now();
  console.log("aiTryon submit entry", "openid=" + (openid ? "set" : "EMPTY"), "avatarViewId=" + (avatarViewId || "none"), "garmentCount=" + ((garmentIds || []).length));
  if (!avatarViewId || !garmentIds || garmentIds.length === 0) {
    return { ok: false, error: "avatarViewId/garmentIds 必填" };
  }
  const av = await db.collection("avatar_views").doc(avatarViewId).get();
  const profile = av.data.profile_snapshot || {};
  const garmentName = (garmentNames && garmentNames[0]) || "所选衣物";
  const cacheKey = buildTryonCacheKey({ openid, avatarViewId, garmentIds });
  const aigc = getAigc();
  const videoPrompt = buildTryonVideoPrompt(profile, garmentName);

  // 复用：同一用户+数字人+衣物组合 7 天内成功结果，不重复调用 Agnes
  const prev = await db.collection("tryon_tasks")
    .where({ cache_key: cacheKey })
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();
  const hit = prev.data.find((d) => isCacheHit(d, Date.now()));
  if (hit) {
    console.log("aiTryon cache hit", "taskId=" + hit._id, "cacheKey=" + cacheKey.slice(0, 8), "costMs=" + (Date.now() - t0));
    return {
      ok: true, taskId: hit._id, status: "success", cached: true,
      tryonImage: hit.tryon_image, tryonVideo: hit.tryon_video, garmentName
    };
  }

  const task = {
    _openid: openid,
    user_id: openid,
    avatar_view_id: avatarViewId,
    garment_ids: garmentIds,
    garment_name: garmentName,
    cache_key: cacheKey,
    type: "ai_video",
    stage: "video",
    status: "processing",
    retry_count: 0,
    createdAt: Date.now(),
    updated_at: Date.now()
  };
  const addRes = await db.collection("tryon_tasks").add({ data: task });
  const taskId = addRes._id;
  // 生成（效果图 + 视频任务创建）：失败自动重试 1 次（FR-21）
  let lastErr = null;
  let imgRes = null;
  let vidRes = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      imgRes = await aigc.generateImages({ prompt: "同人物穿着" + garmentName + "的照片级效果图", refImages: [], count: 1 });
      vidRes = await aigc.generateVideo({ imageUrl: imgRes.urls[0], prompt: videoPrompt, durationSec: 5 });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await db.collection("tryon_tasks").doc(taskId).update({ data: { retry_count: attempt + 1, updated_at: Date.now() } });
      console.log("aiTryon generate attempt fail", "taskId=" + taskId, "attempt=" + (attempt + 1), "error=" + fmtErr(e));
    }
  }
  if (lastErr) {
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "failed", error: fmtErr(lastErr), updated_at: Date.now() } });
    console.log("aiTryon submit fail", "taskId=" + taskId, "error=" + fmtErr(lastErr), "costMs=" + (Date.now() - t0));
    return { ok: false, taskId, error: fmtErr(lastErr) };
  }
  let tryonImage = imgRes.urls[0];
  try {
    tryonImage = await saveRemoteImage(imgRes.urls[0], "tryon");
  } catch (e) {
    console.log("aiTryon storage save fail", "taskId=" + taskId, "error=" + e.message);
  }
  const update = { stage: "video", tryon_image: tryonImage, updated_at: Date.now() };
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
  console.log("aiTryon submit ok", "taskId=" + taskId, "status=" + (update.status || "processing"), "costMs=" + (Date.now() - t0));
  return { ok: true, taskId, status: update.status || "processing" };
}

async function status(event) {
  const t0 = Date.now();
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
          await saveTryonResult(Object.assign({ _id: event.taskId }, d));
          console.log("aiTryon video completed", "taskId=" + event.taskId, "costMs=" + (Date.now() - t0));
        } else if (st.status === "failed") {
          const msg = st.error || "视频生成失败";
          await db.collection("tryon_tasks").doc(event.taskId).update({
            data: { status: "failed", error: msg, updated_at: Date.now() }
          });
          d.status = "failed";
          d.error = msg;
          console.log("aiTryon video failed", "taskId=" + event.taskId, "error=" + msg, "costMs=" + (Date.now() - t0));
        }
        // queued / in_progress：保持 processing，前端继续轮询
      } catch (e) {
        // 单次轮询失败不判死，保持 processing 让前端重试
      }
    }
  }
  // 幂等补发订阅通知：成功且未通知过的任务，任意一次查询都会补发
  if (d.status === "success" && d.tryon_video && !d.notified) {
    const sent = await sendSubscribe(d.user_id, d.garment_name);
    if (sent) {
      await db.collection("tryon_tasks").doc(event.taskId).update({
        data: { notified: true, updated_at: Date.now() }
      });
      d.notified = true;
    }
  }
  console.log("aiTryon status", "taskId=" + event.taskId, "status=" + d.status, "costMs=" + (Date.now() - t0));
  return { ok: true, taskId: event.taskId, status: d.status, stage: d.stage, tryonImage: d.tryon_image, tryonVideo: d.tryon_video, error: d.error };
}

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  if (event.action === "deleteHistory") {
    const ids = event.ids || [];
    let removed = 0;
    for (const id of ids) {
      try {
        const doc = await db.collection("tryon_results").doc(id).get();
        const image = doc.data && doc.data.tryon_image;
        if (image && image.indexOf("cloud://") === 0) {
          try { await cloud.deleteFile({ fileList: [image] }); } catch (e) { console.log("deleteFile fail", "error=" + e.message); }
        }
        await db.collection("tryon_results").doc(id).remove();
        removed += 1;
      } catch (e) {
        console.log("deleteHistory item fail", "id=" + id, "error=" + fmtErr(e));
      }
    }
    return { ok: true, removed };
  }
  if (event.action === "history") {
    try {
      const coll = db.collection("tryon_results");
      // 单用户阶段：直接取最新记录（测试环境记录无 user_id 归属，按身份过滤会查不到）；
      // 正式多用户时恢复 where({ user_id: openid }) 过滤
      const res = await coll.orderBy("createdAt", "desc").limit(50).get();
      console.log("aiTryon history query", "openid=" + (openid ? "set" : "EMPTY"), "count=" + res.data.length);
      return {
        ok: true,
        list: res.data.map((d) => ({
          id: d._id,
          garmentName: d.garment_name,
          createdAt: d.createdAt,
          image: d.tryon_image,
          videoUrl: d.tryon_video || ""
        }))
      };
    } catch (e) {
      return { ok: false, error: fmtErr(e) };
    }
  }
  if (event.action === "status") return status(event);
  return submit(event, openid);
};
