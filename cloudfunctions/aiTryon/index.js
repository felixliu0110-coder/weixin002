const cloud = require("wx-server-sdk");
const { getAigc } = require("./aigc");
const { buildTryonVideoPrompt } = require("./tryonVideo");
const { buildTryonImagePrompt } = require("./tryonImage");
const { buildTryonCacheKey, isImageCacheHit, isCacheHit } = require("./tryonCache");
const { saveRemoteImage } = require("./storage");
const { requireLogin, requireId, requireString, requireArray } = require("./validation");
const { assertOwner, getOwnedDoc } = require("./ownership");
const { resolveGarments } = require("./garments");
const { appError, fmtErr } = require("./errors");
const { assertTransition } = require("./taskState");
const { dateStr, consumeQuota, refundQuota, getQuota } = require("./quota");
const { requestDeletion, runDeletion } = require("./deletion");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/* 生图参考图要求公网 HTTPS URL：cloud:// 的云存储文件批量换临时链接。
   Fail Closed：任何 cloud:// 无法转换为公网链接时抛 PROVIDER_ERROR，
   禁止静默丢弃参考图（不允许“少一张图继续生成”）。 */
async function toHttpsRefs(urls) {
  const list = (urls || []).filter(Boolean);
  const cloudIds = list.filter((u) => u.indexOf("cloud://") === 0);
  if (cloudIds.length === 0) return list.slice();
  let res;
  try {
    res = await cloud.getTempFile({ fileList: cloudIds });
  } catch (e) {
    console.log("toHttpsRefs getTempFile fail", "error=" + fmtErr(e));
    throw appError("PROVIDER_ERROR", "参考图临时链接获取失败");
  }
  const map = {};
  for (const f of res.fileList || []) {
    if (f.tempFileURL) map[f.fileID] = f.tempFileURL;
  }
  const out = [];
  for (const u of list) {
    if (u.indexOf("cloud://") !== 0) { out.push(u); continue; }
    const url = map[u];
    if (!url) throw appError("PROVIDER_ERROR", "参考图临时链接获取失败");
    out.push(url);
  }
  return out;
}

/* 试穿完成写记录：
   - 图片任务（有图无视频）：新增一条图片记录；
   - 视频任务（有视频）：优先更新同一 task 或同一穿搭组合（image_cache_key）的图片记录补上视频，避免记录重复；
   占位视频不写，避免污染真实记录。 */
async function saveTryonResult(task) {
  try {
    if (!task || (!task.tryon_image && !task.tryon_video)) return false;
    if (task.tryon_video && task.tryon_video.indexOf("placeholder") >= 0) return false;
    const coll = db.collection("tryon_results");
    // 同 task 记录
    const dup = await coll.where({ task_id: task._id }).limit(1).get();
    if (dup.data.length > 0) {
      if (task.tryon_video && !dup.data[0].tryon_video) {
        await coll.doc(dup.data[0]._id).update({ data: { tryon_video: task.tryon_video, updated_at: Date.now() } });
      }
      return true;
    }
    // 视频任务：尝试补到同组合的图片记录（图片任务先完成，视频后补）
    if (task.tryon_video) {
      const imageKey = task.image_cache_key || "";
      if (imageKey) {
        const img = await coll.where({ cache_key: imageKey }).limit(1).get();
        if (img.data.length > 0) {
          await coll.doc(img.data[0]._id).update({ data: { tryon_video: task.tryon_video, updated_at: Date.now() } });
          return true;
        }
      }
    }
    await coll.add({
      data: {
        _openid: task._openid || task.user_id,
        user_id: task.user_id,
        task_id: task._id,
        avatar_view_id: task.avatar_view_id,
        garment_id: (task.garment_ids || [])[0],
        garment_name: task.garment_name || "AI 试穿",
        tryon_image: task.tryon_image || "",
        tryon_video: task.tryon_video || "",
        cache_key: task.cache_key || "",
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
  const mode = event.mode === "video" ? "video" : "image";
  const t0 = Date.now();
  console.log("aiTryon submit entry", "openid=" + (openid ? "set" : "EMPTY"), "mode=" + mode, "avatarViewId=" + (avatarViewId || "none"), "garmentCount=" + ((garmentIds || []).length));
  requireLogin(openid);
  const avId = requireId(avatarViewId, "avatarViewId");
  const gIds = requireArray(garmentIds, "garmentIds", { min: 1, max: 10 }).map((v) => requireId(v, "garmentId"));
  // 人物三视图必须属于当前用户
  const av = await getOwnedDoc(db, "avatar_views", avId, openid);
  const profile = av.profile_snapshot || {};
  // 衣物由服务端解析（garments 集合 / 内置白名单），客户端 garmentNames/garmentImages 不作为生成依据
  const garments = await resolveGarments(db, gIds, openid);
  const garmentName = garments[0].name || "所选衣物";

  // 视频模式必须先验证客户端引用的图片任务，验证通过后才允许进入缓存/额度流程。
  let imageTaskId = "";
  let imgTask = null;
  if (mode === "video") {
    imageTaskId = requireId(event.imageTaskId, "imageTaskId");
    imgTask = await getOwnedDoc(db, "tryon_tasks", imageTaskId, openid);
    if (imgTask.type !== "ai_image" || imgTask.status !== "success" || !imgTask.tryon_image_url) {
      throw appError("INVALID_ARGUMENT", "效果图任务未完成，请先完成穿搭图片");
    }
    if (imgTask.avatar_view_id !== avId) {
      throw appError("INVALID_ARGUMENT", "效果图人物与当前人物不一致，请重新生成");
    }
    const normalizedImageGarments = (imgTask.garment_ids || []).slice().sort().join(",");
    const normalizedCurrentGarments = gIds.slice().sort().join(",");
    if (normalizedImageGarments !== normalizedCurrentGarments) {
      throw appError("INVALID_ARGUMENT", "效果图衣物与当前穿搭不一致，请重新生成");
    }
  }
  const aigc = getAigc();
  const videoPrompt = buildTryonVideoPrompt(profile, garmentName);
  const cacheKey = buildTryonCacheKey({ openid, avatarViewId: avId, garmentIds: gIds, kind: mode === "video" ? "ai_video" : "ai_image" });

  // 缓存复用（图片/视频分开）：严格按 user_id + cache_key 隔离，7 天内成功结果不重复调用 Agnes
  const prev = await db.collection("tryon_tasks")
    .where({ cache_key: cacheKey, user_id: openid })
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();
  // 幂等：同组合已有进行中任务（queued/processing）则复用，不重复创建/扣费
  const pendingHit = prev.data.find((d) => d.status === "queued" || d.status === "processing");
  if (pendingHit) {
    console.log("aiTryon pending hit", "taskId=" + pendingHit._id, "mode=" + mode, "costMs=" + (Date.now() - t0));
    return {
      ok: true, taskId: pendingHit._id, status: pendingHit.status, pending: true,
      tryonImage: pendingHit.tryon_image || "", tryonImageUrl: pendingHit.tryon_image_url || "",
      tryonVideo: pendingHit.tryon_video || "", garmentName
    };
  }
  if (mode === "video") {
    const hit = prev.data.find((d) => isCacheHit(d, Date.now()));
    if (hit) {
      console.log("aiTryon video cache hit", "taskId=" + hit._id, "cacheKey=" + cacheKey.slice(0, 8), "costMs=" + (Date.now() - t0));
      return {
        ok: true, taskId: hit._id, status: "success", cached: true,
        tryonImage: hit.tryon_image, tryonImageUrl: hit.tryon_image_url || "", tryonVideo: hit.tryon_video, garmentName
      };
    }
  } else {
    const hit = prev.data.find((d) => isImageCacheHit(d, Date.now()));
    if (hit) {
      console.log("aiTryon image cache hit", "taskId=" + hit._id, "cacheKey=" + cacheKey.slice(0, 8), "costMs=" + (Date.now() - t0));
      return {
        ok: true, taskId: hit._id, status: "success", cached: true,
        tryonImage: hit.tryon_image, tryonImageUrl: hit.tryon_image_url || "", tryonVideo: "", garmentName
      };
    }
  }

  const base = {
    _openid: openid,
    user_id: openid,
    avatar_view_id: avId,
    garment_ids: gIds,
    garment_name: garmentName,
    cache_key: cacheKey,
    retry_count: 0,
    created_at: Date.now(),
    createdAt: Date.now(),
    updated_at: Date.now()
  };

  // 服务端额度：图片/视频生成各扣 1 次；额度不足直接拒绝（不产生任务）
  const date = dateStr();
  let quota = null;
  try {
    quota = await consumeQuota(db, openid, date);
  } catch (e) {
    if (e && e.appCode === "RATE_LIMITED") {
      return { ok: false, error: "RATE_LIMITED", message: e.message };
    }
    throw e;
  }
  console.log("aiTryon quota consumed", "openid=" + openid, "mode=" + mode, "date=" + date, "used=" + quota.used);

  // ---- 视频模式：直接用已生成的效果图创建视频任务，不重新生图 ----
  if (mode === "video") {
    const imageUrl = imgTask.tryon_image_url;
    const task = Object.assign({}, base, {
      type: "ai_video",
      stage: "video",
      status: "queued",
      tryon_image: imgTask.tryon_image || "",
      tryon_image_url: imageUrl,
      image_task_id: imageTaskId,
      image_cache_key: buildTryonCacheKey({ openid, avatarViewId: avId, garmentIds: gIds, kind: "ai_image" })
    });
    const addRes = await db.collection("tryon_tasks").add({ data: task });
    const taskId = addRes._id;
    assertTransition("queued", "processing");
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "processing", updated_at: Date.now() } });
    let vidRes = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        vidRes = await aigc.generateVideo({ imageUrl, prompt: videoPrompt, durationSec: 5 });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await db.collection("tryon_tasks").doc(taskId).update({ data: { retry_count: attempt + 1, updated_at: Date.now() } });
        console.log("aiTryon video task create fail", "taskId=" + taskId, "attempt=" + (attempt + 1), "error=" + fmtErr(e));
      }
    }
    if (lastErr) {
      assertTransition("processing", "failed");
      await refundQuota(db, openid, date);
      await db.collection("tryon_tasks").doc(taskId).update({
        data: { status: "failed", error: fmtErr(lastErr), error_code: lastErr.code || "PROVIDER_ERROR", error_message: fmtErr(lastErr), updated_at: Date.now(), completed_at: Date.now() }
      });
      console.log("aiTryon video submit fail", "taskId=" + taskId, "error=" + fmtErr(lastErr), "costMs=" + (Date.now() - t0));
      return { ok: false, taskId, error: fmtErr(lastErr) };
    }
    const update = { stage: "video", updated_at: Date.now() };
    if (vidRes.videoTaskId) {
      update.video_task_id = vidRes.videoTaskId;
      update.provider_task_id = vidRes.videoTaskId;
      update.provider = vidRes.provider || "agnes";
    } else {
      assertTransition("processing", "success");
      update.status = "success";
      update.tryon_video = vidRes.videoUrl;
      update.provider = vidRes.provider || "mock";
      update.completed_at = Date.now();
    }
    await db.collection("tryon_tasks").doc(taskId).update({ data: update });
    console.log("aiTryon video submit ok", "taskId=" + taskId, "status=" + (update.status || "processing"), "costMs=" + (Date.now() - t0));
    return { ok: true, taskId, status: update.status || "processing", tryonImage: imgTask.tryon_image || "", tryonImageUrl: imageUrl };
  }

  // ---- 图片模式：只生成穿搭效果图，视频由用户后续在结果页选择生成 ----
  // Reference Preflight（必须在 consumeQuota 之前完成：任何必需 reference 获取/转换失败，
  // 都不调用 Agnes、也不扣 quota；builtin garment originalFileId 允许为空，仅依赖白名单）
  const avatarComposite = (av.views && av.views.composite) || "";
  if (!avatarComposite) throw appError("INVALID_ARGUMENT", "人物参考图缺失，请先完成人物照片");
  const preflightRefs = [];
  preflightRefs.push(avatarComposite);
  for (const g of garments) {
    if (g.type === "builtin") continue; // builtin 无 originalFileId，依赖白名单，不强制
    if (!g.originalFileId) throw appError("INVALID_ARGUMENT", "衣物原图缺失，请重新上传衣物");
    preflightRefs.push(g.originalFileId);
  }
  const refImages = await toHttpsRefs(preflightRefs);
  if (refImages.length !== preflightRefs.length) {
    throw appError("PROVIDER_ERROR", "参考图数量不一致，生成中止");
  }
  const task = Object.assign({}, base, { type: "ai_image", stage: "image", status: "queued" });
  const addRes = await db.collection("tryon_tasks").add({ data: task });
  const taskId = addRes._id;
  const imagePrompt = buildTryonImagePrompt(profile, garments.map((g) => g.name), refImages.length);
  assertTransition("queued", "processing");
  await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "processing", updated_at: Date.now() } });
  let lastErr = null;
  let imgRes = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      imgRes = await aigc.generateImages({
        prompt: imagePrompt,
        refImages,
        count: 1
      });
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      await db.collection("tryon_tasks").doc(taskId).update({ data: { retry_count: attempt + 1, updated_at: Date.now() } });
      console.log("aiTryon generate attempt fail", "taskId=" + taskId, "attempt=" + (attempt + 1), "refCount=" + refImages.length, "error=" + fmtErr(e));
    }
  }
  if (lastErr) {
    assertTransition("processing", "failed");
    await refundQuota(db, openid, date);
    await db.collection("tryon_tasks").doc(taskId).update({
      data: { status: "failed", error: fmtErr(lastErr), error_code: lastErr.code || "PROVIDER_ERROR", error_message: fmtErr(lastErr), updated_at: Date.now(), completed_at: Date.now() }
    });
    console.log("aiTryon submit fail", "taskId=" + taskId, "error=" + fmtErr(lastErr), "costMs=" + (Date.now() - t0));
    return { ok: false, taskId, error: fmtErr(lastErr) };
  }
  const rawUrl = imgRes.urls[0];
  let tryonImage = rawUrl;
  try {
    tryonImage = await saveRemoteImage(rawUrl, "tryon");
  } catch (e) {
    console.log("aiTryon storage save fail", "taskId=" + taskId, "error=" + e.message);
  }
  assertTransition("processing", "success");
  const update = { stage: "image", status: "success", tryon_image: tryonImage, tryon_image_url: rawUrl, provider: imgRes.provider || "agnes", updated_at: Date.now(), completed_at: Date.now() };
  await db.collection("tryon_tasks").doc(taskId).update({ data: update });
  await saveTryonResult(Object.assign({ _id: taskId }, task, update));
  console.log("aiTryon image ok", "taskId=" + taskId, "status=success", "costMs=" + (Date.now() - t0));
  return { ok: true, taskId, status: "success", tryonImage, tryonImageUrl: rawUrl, garmentName };
}

async function status(event, openid) {
  const t0 = Date.now();
  // 任务必须属于当前用户
  const d = await getOwnedDoc(db, "tryon_tasks", requireId(event.taskId, "taskId"), openid);
  // 异步视频任务：生成中轮询；或已 success 但视频 URL 缺失（旧字段解析 bug）时补全
  const needPoll = d.video_task_id && (d.status === "processing" || (d.status === "success" && !d.tryon_video));
  if (needPoll) {
    const aigc = getAigc();
    if (aigc && aigc.getVideoStatus) {
      try {
        const st = await aigc.getVideoStatus(d.video_task_id);
        if (st.status === "completed" || st.status === "succeeded" || st.videoUrl) {
          if (d.status !== "success") assertTransition(d.status, "success");
          await db.collection("tryon_tasks").doc(event.taskId).update({
            data: { status: "success", tryon_video: st.videoUrl, updated_at: Date.now(), completed_at: Date.now() }
          });
          d.status = "success";
          d.tryon_video = st.videoUrl;
          await saveTryonResult(Object.assign({ _id: event.taskId }, d));
          console.log("aiTryon video completed", "taskId=" + event.taskId, "costMs=" + (Date.now() - t0));
        } else if (st.status === "failed") {
          const msg = st.error || "视频生成失败";
          assertTransition(d.status, "failed");
          await db.collection("tryon_tasks").doc(event.taskId).update({
            data: { status: "failed", error: msg, error_code: "PROVIDER_ERROR", error_message: msg, updated_at: Date.now(), completed_at: Date.now() }
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
  return {
    ok: true, taskId: event.taskId, status: d.status, stage: d.stage,
    tryonImage: d.tryon_image, tryonImageUrl: d.tryon_image_url || "",
    tryonVideo: d.tryon_video, error: d.error, errorCode: d.error_code || "", errorMessage: d.error_message || ""
  };
}

/* 收藏（服务端解析结果记录，user_id + result_id 唯一且幂等） */
async function addFavorite(event, openid) {
  const taskId = requireId(event.taskId, "taskId");
  const task = await getOwnedDoc(db, "tryon_tasks", taskId, openid);
  const imageTaskId = task.image_task_id || (task.type === "ai_image" ? task._id : "");
  const _ = db.command;
  const qIds = imageTaskId ? [imageTaskId, taskId] : [taskId];
  const res = await db.collection("tryon_results").where({ task_id: _.in(qIds) }).limit(1).get();
  const rec = res.data && res.data[0];
  if (!rec) throw appError("NOT_FOUND", "试穿结果不存在，无法收藏");
  const dup = await db.collection("favorites").where({ user_id: openid, result_id: rec._id }).limit(1).get();
  if (dup.data.length > 0) return { ok: true, favoriteId: dup.data[0]._id, duplicate: true };
  const now = Date.now();
  const add = await db.collection("favorites").add({
    data: {
      _openid: openid,
      user_id: openid,
      result_id: rec._id,
      garment_name: rec.garment_name || task.garment_name || "AI 试穿",
      image: rec.tryon_image || "",
      video_url: rec.tryon_video || "",
      ai_tagged: true,
      created_at: now,
      updated_at: now
    }
  });
  return { ok: true, favoriteId: add._id, duplicate: false };
}

async function listFavorites(openid) {
  const res = await db.collection("favorites").where({ user_id: openid }).limit(100).get();
  const list = (res.data || [])
    .map((d) => ({
      id: d._id,
      garmentName: d.garment_name || "AI 试穿",
      createdAt: d.created_at || d.createdAt || 0,
      image: d.image || "",
      videoUrl: d.video_url || ""
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
  return { ok: true, list };
}

async function deleteFavorites(event, openid) {
  const ids = requireArray(event.ids || [], "ids", { max: 50 }).map((v) => requireId(v, "id"));
  let removed = 0;
  for (const id of ids) {
    try {
      await getOwnedDoc(db, "favorites", id, openid);
      await db.collection("favorites").doc(id).remove();
      removed++;
    } catch (e) {
      if (e && e.appCode === "NOT_FOUND") continue; // 幂等：不存在跳过
      throw e;
    }
  }
  return { ok: true, removed };
}

exports.main = async (event) => {
  try {
    const { OPENID: openid } = cloud.getWXContext();
    requireLogin(openid);
    if (event.action === "deleteHistory") {
      const ids = requireArray(event.ids || [], "ids", { max: 50 }).map((v) => requireId(v, "id"));
      let removed = 0;
      for (const id of ids) {
        // 逐条校验归属：A 不能删 B 的记录
        const doc = await getOwnedDoc(db, "tryon_results", id, openid);
        const image = doc.tryon_image;
        if (image && image.indexOf("cloud://") === 0) {
          try { await cloud.deleteFile({ fileList: [image] }); } catch (e) { console.log("deleteFile fail", "error=" + e.message); }
        }
        await db.collection("tryon_results").doc(id).remove();
        removed += 1;
      }
      return { ok: true, removed };
    }
    if (event.action === "history") {
      const coll = db.collection("tryon_results");
      // 严格按当前用户隔离
      const res = await coll.where({ user_id: openid }).orderBy("createdAt", "desc").limit(50).get();
      console.log("aiTryon history query", "openid=" + (openid ? "set" : "EMPTY"), "count=" + res.data.length);
      return {
        ok: true,
        list: res.data.map((d) => ({
          id: d._id,
          taskId: d.task_id || "",
          garmentName: d.garment_name,
          createdAt: d.createdAt,
          image: d.tryon_image,
          videoUrl: d.tryon_video || ""
        }))
      };
    }
    if (event.action === "quota") {
      return { ok: true, quota: await getQuota(db, openid, dateStr()) };
    }
    if (event.action === "favoriteAdd") return addFavorite(event, openid);
    if (event.action === "favorites") return listFavorites(openid);
    if (event.action === "favoriteDelete") return deleteFavorites(event, openid);
    if (event.action === "deleteAccount") {
      const req = await requestDeletion(db, openid);
      return runDeletion(db, cloud, openid, req.jobId);
    }
    if (event.action === "status") return status(event, openid);
    return submit(event, openid);
  } catch (e) {
    console.log("aiTryon main fail", "error=" + fmtErr(e));
    return { ok: false, error: e.appCode || "INTERNAL", message: e.appCode ? e.message : "内部错误" };
  }
};
