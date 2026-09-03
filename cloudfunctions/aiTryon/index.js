const cloud = require("wx-server-sdk");
const { getAigc } = require("../services/aigc");
const { buildTryonVideoPrompt } = require("../services/tryonVideo");
const { buildTryonImagePrompt } = require("./tryonImage");
const { buildTryonCacheKey, isImageCacheHit, isCacheHit } = require("../services/tryonCache");
const { saveRemoteImage } = require("../services/storage");
const { requireLogin, requireId, requireString, requireArray } = require("../services/validation");
const { assertOwner, getOwnedDoc } = require("../services/ownership");
const { resolveGarments } = require("../services/garments");
const { appError, fmtErr } = require("../services/errors");
const { assertTransition } = require("../services/taskState");
const { dateStr, consumeQuota, refundQuota, getQuota } = require("../services/quota");
const { requestDeletion, runDeletion } = require("../services/deletion");

// ---- V2 Try-On Engine（Phase 4.2，feature flag 控制，默认关闭以保留回滚能力）----
// Phase 4.2.1：aiTryon 不再构造业务 Prompt，Prompt / provider payload 完全由
// Try-On Engine 与其 Provider Adapter 负责，避免责任边界混淆。
let tryonEngine = null;
try {
  tryonEngine = require("../services/tryon-engine");
} catch (e) {
  // Engine 模块不可用时（极旧部署）降级为纯 legacy，不阻断启动
  tryonEngine = null;
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/* ============================================================
   Feature Flag：TRYON_ENGINE_ENABLED
     - false（默认）：走旧 aiTryon 图片链路（legacy fallback，保留回滚）
     - true：图片试穿走 Try-On Engine（Router → Agnes）
   不修改前端、不要求重新发布前端，上线后可立即回滚。
   ============================================================ */
function isEngineEnabled() {
  const raw = process.env.TRYON_ENGINE_ENABLED;
  return raw === "true" || raw === "1";
}

/* ============================================================
   人物来源优先级（V2，取消 composite 作为默认生产人物输入）：
     originalPhoto > frontPhoto > anchorImage
   - 若 Person Asset 不存在且旧 avatar_views 只有 composite：返回 PERSON_ASSET_REQUIRED
   - 绝不伪造 person photo、绝不进入 AI 生成
   ============================================================ */
const PERSON_SOURCE_PRIORITY = ["originalPhoto", "frontPhoto", "anchorImage"];

function pickPersonSource(personAsset) {
  if (!personAsset || typeof personAsset !== "object") return { url: null, type: null };
  // 兼容 person-asset 下划线命名（original_photo / front_photo / anchor_image）
  // 与标准 Context 驼峰（originalPhoto / frontPhoto / anchorImage）
  const keyMap = {
    originalPhoto: ["originalPhoto", "original_photo"],
    frontPhoto: ["frontPhoto", "front_photo"],
    anchorImage: ["anchorImage", "anchor_image"]
  };
  for (const key of PERSON_SOURCE_PRIORITY) {
    const candidates = keyMap[key] || [key];
    let v = null;
    for (const c of candidates) { if (typeof personAsset[c] === "string" && personAsset[c].length > 0) { v = personAsset[c]; break; } }
    if (v) {
      const type = key.replace(/Photo$/, "_photo").replace("anchorImage", "anchor_image");
      return { url: v, type, sourceKey: key };
    }
  }
  return { url: null, type: null };
}

/* 身体档案来源（Phase 4.2.1，禁止伪造）：
   优先级：
     1) avatar_views.profile_snapshot（已由 Avatar Generation 固化的真实人物档案）— 真实存在的数值字段优先
     2) Person Asset 的 bodyProfile / body_profile — 仅补充 profile_snapshot 中缺失的字段
     3) 仍缺失 → null（promptBuilder / provider 不得据此虚构人体数据，严禁 170cm/60kg 默认值）
   仅映射真实存在且为合法 number 的字段；不存在的字段不补值、不做 BMI/性别推测。 */
const BODY_FIELDS = [
  ["gender", "gender"],
  ["height_cm", "heightCm"], ["weight_kg", "weightKg"],
  ["shoulder_cm", "shoulderCm"], ["bust_cm", "bustCm"],
  ["waist_cm", "waistCm"], ["hip_cm", "hipCm"],
  ["leg_length_cm", "legLengthCm"], ["arm_length_cm", "armLengthCm"],
  ["neck_length_cm", "neckLengthCm"],
];

function mapProfileSnapshot(snapshot) {
  // snapshot 可能为下划线或驼峰；统一映射为驼峰键，仅保留真实 number 字段
  if (!snapshot || typeof snapshot !== "object") return {};
  const out = {};
  for (const [src, dst] of BODY_FIELDS) {
    const v = snapshot[src] ?? snapshot[dst];
    if (typeof v === "number" && isFinite(v)) out[dst] = v;
  }
  return out;
}

function readBodyProfile(personAsset, profileSnapshot) {
  // 1) avatar_views.profile_snapshot 真实字段（最高优先）
  const fromSnapshot = mapProfileSnapshot(profileSnapshot);
  // 2) Person Asset bodyProfile 仅补充缺失字段，不得覆盖 snapshot 已有真实字段
  const pa = personAsset && (personAsset.bodyProfile || personAsset.body_profile);
  const fromAsset = (pa && typeof pa === "object") ? mapProfileSnapshot(pa) : {};
  const merged = { ...fromAsset, ...fromSnapshot }; // snapshot 优先
  return Object.keys(merged).length ? merged : null;
}

/* ============================================================
   生图参考图要求公网 HTTPS URL：cloud:// 的云存储文件批量换临时链接。
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

/* 试穿完成写记录（图片/视频兼容，字段保持） */
async function saveTryonResult(task) {
  try {
    if (!task || (!task.tryon_image && !task.tryon_video)) return false;
    if (task.tryon_video && task.tryon_video.indexOf("placeholder") >= 0) return false;
    const coll = db.collection("tryon_results");
    const dup = await coll.where({ task_id: task._id }).limit(1).get();
    if (dup.data.length > 0) {
      if (task.tryon_video && !dup.data[0].tryon_video) {
        await coll.doc(dup.data[0]._id).update({ data: { tryon_video: task.tryon_video, updated_at: Date.now() } });
      }
      return true;
    }
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
    const createdAt = task.created_at || task.createdAt || Date.now();
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
        created_at: createdAt,
        createdAt: createdAt,
        updated_at: createdAt
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

/* ============================================================
   解析当前用户 Person Asset（优先 person-asset 服务，含 ownership）。
   - 返回 { asset, source: 'person_asset' | 'legacy_composite' | null }
   - 不存在时返回 null（不自动创建）
   ============================================================ */
async function resolvePersonAsset(openid, avatarViewId) {
  // 关联规则（Phase 4.2.1 修正）：
  //   avatarViewId → 读取已 ownership 校验过的 avatar_views → avatar_profile_id
  //   → person-asset 按 (avatar_profile_id, openid) 精确匹配
  //   → 找不到对应 Person Asset 时，严禁回退到“当前用户最新 Person Asset”。
  // ownership 由 person-asset 服务内部强制（user_id === openid），禁止跨用户查询。
  if (!avatarViewId) {
    return { asset: null, source: null };
  }
  try {
    const { getPersonAssetService } = require("../services/person-asset");
    const service = getPersonAssetService(db);
    // 1) 拿到当前 avatar_view 的 avatar_profile_id（av 已在前端 ownership 校验）
    const av = await getOwnedDoc(db, "avatar_views", avatarViewId, openid);
    const avatarProfileId = av && (av.avatar_profile_id || av.avatarProfileId);
    if (!avatarProfileId) {
      // 该 avatar_view 没有关联的 profile，无法定位唯一 Person Asset → 不猜测
      return { asset: null, source: null };
    }
    // 2) 按 (avatar_profile_id, openid) 精确匹配；不存在即返回 null，绝不偷用最新 asset
    const findBy = typeof service.findByAvatarProfileId === "function"
      ? service.findByAvatarProfileId
      : (typeof service.find === "function" ? service.find : null);
    if (typeof service.findByAvatarProfileId === "function") {
      const asset = await service.findByAvatarProfileId(avatarProfileId, openid);
      if (asset && (asset.original_photo || asset.front_photo || asset.anchor_image || asset.originalPhoto)) {
        return { asset, source: "person_asset" };
      }
      return { asset: null, source: null };
    }
    // 兜底：服务尚未支持精确查找时，拒绝猜测（返回 null，上层走 PERSON_ASSET_REQUIRED）
    console.log("resolvePersonAsset findByAvatarProfileId unavailable; refusing fallback", "avatarProfileId=" + avatarProfileId);
    return { asset: null, source: null };
  } catch (e) {
    console.log("resolvePersonAsset person-asset error", "error=" + fmtErr(e));
    return { asset: null, source: null };
  }
}

/* ============================================================
   图片试穿：V2 Engine 路径（flag=true 时调用）
   构造标准 Try-On Context → tryonEngine.generate() → 适配前端返回格式
   ============================================================ */
async function generateViaEngine({ personAsset, bodyProfile, garments, garmentName, strategy, openid, avatarViewId }) {
  const { url: personUrl, type: personSourceType } = pickPersonSource(personAsset);

  // 衣物转换：服务端解析，客户端图片不作为可信来源
  const { normalizeGarmentCategory } = require("../services/tryon-engine/category");
  const engineGarments = garments.map((g) => {
    const norm = normalizeGarmentCategory({ category: g.category });
    return {
      garmentId: g._id || g.garmentId || null,
      image: g.originalFileId || g.image || null, // 后续经 toHttpsRefs 转换
      category: norm.category,                    // tops / bottoms / UNSUPPORTED_TRYON_CATEGORY
      sourceCategory: g.category,                 // 原始中文业务枚举（上衣/裤子/...）
      name: g.name || "",
      profile: g.profile || null
    };
  });

  // person_asset_id 用于 cache key 隔离（composite 与 originalPhoto 不共用缓存）
  const personAssetId = personAsset && (personAsset._id || personAsset.assetId) ? String(personAsset._id || personAsset.assetId) : null;
  const personAssetVersion = personAsset && (personAsset.updated_at || personAsset.updatedAt) ? String(personAsset.updated_at || personAsset.updatedAt) : (personAssetId ? "v1" : "legacy");

  const context = {
    person: {
      assetId: personAssetId,
      originalPhoto: personAsset ? personAsset.original_photo || personAsset.originalPhoto || null : null,
      frontPhoto: personAsset ? personAsset.front_photo || personAsset.frontPhoto || null : null,
      anchorImage: personAsset ? personAsset.anchor_image || personAsset.anchorImage || null : null,
      bodyProfile
    },
    garments: engineGarments,
    options: {
      strategy: strategy || "BALANCED",
      mode: "image",
      preserveFace: true,
      background: "keep"
    }
  };

  // Phase 4.2.1：不再自行构造业务 Prompt。Prompt / provider payload 由 Engine 内部负责。
  console.log("aiTryon engine generate", "personSource=" + personSourceType, "garmentCount=" + engineGarments.length, "strategy=" + (strategy || "BALANCED"));

  const result = await tryonEngine.generate(context, strategy || "BALANCED");

  return {
    result,            // engine 标准响应 { ok, provider, imageUrl, metadata }
    personUrl,
    personSourceType,
    personAssetId,
    personAssetVersion
  };
}

/* 将 Engine 响应适配为 aiTryon 前端已使用的返回格式（不要求前端改字段） */
function adaptEngineResult(engineRes, { personAssetId, personSourceType, strategy, providerOverride }) {
  const provider = engineRes.provider || providerOverride || "engine";
  return {
    ok: engineRes.ok !== false,
    provider,
    imageUrl: engineRes.imageUrl || "",
    rawProvider: engineRes.metadata || {},
    personSourceType,
    personAssetId,
    strategy: strategy || "BALANCED",
    error: engineRes.error || ""
  };
}

async function submit(event, openid) {
  const { avatarViewId, garmentIds, garmentNames } = event;
  const mode = event.mode === "video" ? "video" : "image";
  const strategy = isEngineEnabled() ? "BALANCED" : "BALANCED";
  const t0 = Date.now();
  console.log("aiTryon submit entry",
    "openid=" + (openid ? "set" : "EMPTY"),
    "mode=" + mode,
    "engine=" + (isEngineEnabled() ? "V2" : "legacy"),
    "avatarViewId=" + (avatarViewId || "none"),
    "garmentCount=" + ((garmentIds || []).length));
  requireLogin(openid);
  const avId = requireId(avatarViewId, "avatarViewId");
  // Phase 5-1：一次试穿严格 1 件；0 件与多件分别给出明确错误码，绝不 silently slice
  const gCount = Array.isArray(garmentIds) ? garmentIds.length : 0;
  if (gCount === 0) {
    throw appError("INVALID_TRYON_CONTEXT", "请选择一件衣物后再试穿");
  }
  if (gCount > 1) {
    throw appError("MULTI_GARMENT_NOT_SUPPORTED", "暂不支持多件衣物同时试穿，请只选择一件");
  }
  const gIds = [requireId(garmentIds[0], "garmentId")];

  // 人物三视图必须属于当前用户
  const av = await getOwnedDoc(db, "avatar_views", avId, openid);
  const profile = av.profile_snapshot || {};
  // 衣物由服务端解析（garments 集合 / 内置白名单），客户端 garmentNames/garmentImages 不作为生成依据
  const garments = await resolveGarments(db, gIds, openid);
  const garmentName = garments[0].name || "所选衣物";

  // 视频模式必须先验证客户端引用的图片任务（视频链路暂不重构，保持 legacy）
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

  // ---- 解析 Person Asset（V2 来源优先级；legacy 兼容在下方 preflight 处理）----
  const { asset: personAsset, source: personAssetSource } = await resolvePersonAsset(openid, avId);
  const bodyProfile = readBodyProfile(personAsset, profile); // profile = av.profile_snapshot（优先来源）

  // cache key：必须含 personAssetId/version，避免 composite 与 originalPhoto 共用缓存
  const personAssetId = personAsset && (personAsset._id || personAsset.assetId) ? String(personAsset._id || personAsset.assetId) : null;
  const personAssetVersion = personAsset && (personAsset.updated_at || personAsset.updatedAt) ? String(personAsset.updated_at || personAsset.updatedAt) : (personAssetId ? "v1" : "legacy");

  const cacheKey = buildTryonCacheKey({
    openid,
    avatarViewId: avId,
    garmentIds: gIds,
    kind: mode === "video" ? "ai_video" : "ai_image",
    personAssetId,
    personAssetVersion
  });

  // 缓存复用（图片/视频分开）：严格按 user_id + cache_key 隔离
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
    // V2：新增字段（旧数据兼容，不存在即新增）
    person_asset_id: personAssetId,
    person_source_type: null,   // 在生成路径中填充
    strategy: strategy || "BALANCED",
    provider: null,
    provider_task_id: "",
    started_at: null,
    completed_at: null,
    created_at: Date.now(),
    createdAt: Date.now(),
    updated_at: Date.now()
  };

  // ---- 视频模式：直接用已生成的效果图创建视频任务，不重新生图（保持 legacy）----
  // （图片模式的 consumeQuota 已移至 reference preflight 之后，见下方图片模式段）
  if (mode === "video") {
    const imageUrl = imgTask.tryon_image_url;
    const task = Object.assign({}, base, {
      type: "ai_video",
      stage: "video",
      status: "queued",
      tryon_image: imgTask.tryon_image || "",
      tryon_image_url: imageUrl,
      image_task_id: imageTaskId,
      image_cache_key: buildTryonCacheKey({ openid, avatarViewId: avId, garmentIds: gIds, kind: "ai_image", personAssetId, personAssetVersion })
    });
    const addRes = await db.collection("tryon_tasks").add({ data: task });
    const taskId = addRes._id;
    assertTransition("queued", "processing");
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "processing", started_at: Date.now(), updated_at: Date.now() } });
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

  // ============================================================
  // ---- 图片模式 ----
  // ============================================================

  // ---- Person Asset preflight（V2，flag 无关，用于 cache key 与来源选择）----
  const { url: personUrl, type: personSourceType } = pickPersonSource(personAsset);
  // 若使用 Engine 路径：必须由真实 Person Asset 提供人物图，禁止 composite 冒充。
  // 此时 consumeQuota 尚未执行（在下方的 reference preflight 之后），故此处拒绝不扣 quota。
  if (isEngineEnabled()) {
    if (!personUrl) {
      console.log("aiTryon engine preflight no person asset", "openid=" + openid, "costMs=" + (Date.now() - t0));
      return { ok: false, error: "PERSON_ASSET_REQUIRED", message: "请先上传真实人物照片以建立人物资产" };
    }
  }

  // ---- Reference Preflight（必须在 consumeQuota 之后校验；此处沿用原顺序：先扣 quota 再 preflight。
  //      为保证"preflight 失败不扣 quota"，对 V2 路径将人物 preflight 前置；衣物 reference 仍按原流程）----
  const preflightRefs = [];
  if (isEngineEnabled()) {
    // V2：人物图来自 Person Asset（已通过 personUrl 校验），衣物图走服务端解析
    preflightRefs.push(personUrl);
    for (const g of garments) {
      if (g.type === "builtin") continue; // builtin 无 originalFileId，依赖白名单，不强制
      if (!g.originalFileId) throw appError("INVALID_ARGUMENT", "衣物原图缺失，请重新上传衣物");
      preflightRefs.push(g.originalFileId);
    }
  } else {
    // Legacy：人物参考图 = avatar_views.views.composite（旧链路保留）
    const avatarComposite = (av.views && av.views.composite) || "";
    if (!avatarComposite) throw appError("INVALID_ARGUMENT", "人物参考图缺失，请先完成人物照片");
    preflightRefs.push(avatarComposite);
    for (const g of garments) {
      if (g.type === "builtin") continue;
      if (!g.originalFileId) throw appError("INVALID_ARGUMENT", "衣物原图缺失，请重新上传衣物");
      preflightRefs.push(g.originalFileId);
    }
  }
  const refImages = await toHttpsRefs(preflightRefs);
  if (refImages.length !== preflightRefs.length) {
    // Fail Closed：参考图数量不一致 → 生成中止、不调用 Provider、不扣 quota
    throw appError("PROVIDER_ERROR", "参考图数量不一致，生成中止");
  }

  // 服务端额度：图片/视频生成各扣 1 次；额度不足直接拒绝（不产生任务）
  // 注意：所有 preflight（person asset / reference）均在 consumeQuota 之前完成，
  // 故 preflight 失败天然不扣 quota，符合“reference preflight 失败不扣 quota”要求。
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

  const task = Object.assign({}, base, { type: "ai_image", stage: "image", status: "queued", person_source_type: personSourceType });

  // ---- V2 Engine 路径 ----
  if (isEngineEnabled() && tryonEngine) {
    const taskAddRes = await db.collection("tryon_tasks").add({ data: task });
    const taskId = taskAddRes._id;
    assertTransition("queued", "processing");
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "processing", person_source_type: personSourceType, started_at: Date.now(), updated_at: Date.now() } });

    // 衣物 HTTPS 参考图已就位（refImages[0] = person，其余 = garments）
    const engineGarms = garments.map((g, i) => ({
      garmentId: g._id || null,
      image: refImages[i + 1] || g.originalFileId || null,
      category: g.category,
      sourceCategory: g.category,
      name: g.name || "",
      profile: g.profile || null
    }));

    const context = {
      person: {
        assetId: personAssetId,
        originalPhoto: personAsset ? (personAsset.original_photo || personAsset.originalPhoto || null) : (refImages[0] || null),
        frontPhoto: personAsset ? (personAsset.front_photo || personAsset.frontPhoto || null) : null,
        anchorImage: personAsset ? (personAsset.anchor_image || personAsset.anchorImage || null) : null,
        bodyProfile
      },
      garments: engineGarms,
      options: { strategy: "BALANCED", mode: "image", preserveFace: true, background: "keep" }
    };

    let engineRes = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        engineRes = await tryonEngine.generate(context, "BALANCED");
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        await db.collection("tryon_tasks").doc(taskId).update({ data: { retry_count: attempt + 1, updated_at: Date.now() } });
        console.log("aiTryon engine generate fail", "taskId=" + taskId, "attempt=" + (attempt + 1), "error=" + fmtErr(e));
      }
    }
    if (lastErr || (engineRes && engineRes.ok === false)) {
      assertTransition("processing", "failed");
      await refundQuota(db, openid, date); // Provider 失败 → 退款
      const errMsg = (engineRes && engineRes.error) ? engineRes.error : (lastErr ? fmtErr(lastErr) : "Engine 生成失败");
      await db.collection("tryon_tasks").doc(taskId).update({
        data: { status: "failed", error: errMsg, error_code: engineRes && engineRes.errorCode || lastErr && lastErr.code || "PROVIDER_ERROR", error_message: errMsg, provider: "engine", updated_at: Date.now(), completed_at: Date.now() }
      });
      console.log("aiTryon engine submit fail", "taskId=" + taskId, "error=" + errMsg, "costMs=" + (Date.now() - t0));
      return { ok: false, taskId, error: errMsg };
    }

    const rawUrl = (engineRes && engineRes.imageUrl) || "";
    let tryonImage = rawUrl;
    try {
      tryonImage = await saveRemoteImage(rawUrl, "tryon");
    } catch (e) {
      console.log("aiTryon storage save fail", "taskId=" + taskId, "error=" + e.message);
    }
    const provider = (engineRes && engineRes.provider) || "engine";
    assertTransition("processing", "success");
    const update = {
      stage: "image", status: "success",
      tryon_image: tryonImage, tryon_image_url: rawUrl,
      person_asset_id: personAssetId, person_source_type: personSourceType,
      strategy: "BALANCED", provider,
      updated_at: Date.now(), completed_at: Date.now()
    };
    await db.collection("tryon_tasks").doc(taskId).update({ data: update });
    await saveTryonResult(Object.assign({ _id: taskId }, task, update));
    console.log("aiTryon engine image ok", "taskId=" + taskId, "provider=" + provider, "costMs=" + (Date.now() - t0));
    // 前端兼容返回格式（不要求前端修改字段）
    return {
      ok: true, taskId, status: "success",
      tryonImage, tryonImageUrl: rawUrl, tryonVideo: "",
      garmentName, personSourceType, provider, strategy: "BALANCED"
    };
  }

  // ---- Legacy 路径（flag=false，默认；旧代码完整保留作为 fallback）----
  const imagePrompt = buildTryonImagePrompt(profile, garments.map((g) => g.name), refImages.length);
  const addRes = await db.collection("tryon_tasks").add({ data: task });
  const taskId = addRes._id;
  assertTransition("queued", "processing");
  await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "processing", started_at: Date.now(), updated_at: Date.now() } });
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
  return { ok: true, taskId, status: "success", tryonImage, tryonImageUrl: rawUrl, tryonVideo: "", garmentName };
}

async function status(event, openid) {
  const t0 = Date.now();
  const d = await getOwnedDoc(db, "tryon_tasks", requireId(event.taskId, "taskId"), openid);
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
      } catch (e) {
        // 单次轮询失败不判死，保持 processing 让前端重试
      }
    }
  }
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
    provider: d.provider || "", providerTaskId: d.provider_task_id || "",
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
      videoUrl: d.tryon_video || ""
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
      const res = await coll.where({ user_id: openid }).orderBy("createdAt", "desc").limit(50).get();
      console.log("aiTryon history query", "openid=" + (openid ? "set" : "EMPTY"), "count=" + res.data.length);
      return {
        ok: true,
        list: res.data.map((d) => ({
          id: d._id,
          resultId: d._id,
          taskId: d.task_id || "",
          garmentId: d.garment_id || "",
          avatarViewId: d.avatar_view_id || "",
          garmentName: d.garment_name,
          createdAt: d.createdAt || d.created_at || 0,
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
    // Phase 5-1：Person Asset 精确查询（复用现有 person-asset service，禁止重新实现 / 禁止取最新）
    if (event.action === "findByAvatarProfileId") {
      // Phase 5-1.1 安全边界：
      // 第二个参数必须始终来自云函数当前调用上下文的真实 openid（cloud.getWXContext()），
      // 严禁使用客户端传入的 event.openid —— 否则恶意客户端可通过伪造 openid 查询其他用户的 Person Asset。
      // 此处显式解构并丢弃 event.openid，作为防御性声明（即使未来有人误用也不会生效）。
      const { avatarProfileId } = event; // eslint-disable-line no-unused-vars
      // openid 严格来自外层 main() 的 cloud.getWXContext()，本作用域内即参数 openid
      if (!avatarProfileId) throw appError("INVALID_PARAM", "avatarProfileId 不能为空");
      const { getPersonAssetService } = require("../services/person-asset");
      const service = getPersonAssetService(db);
      if (typeof service.findByAvatarProfileId !== "function") {
        throw appError("INTERNAL", "Person Asset 查询能力未就绪");
      }
      // 精确绑定：avatarProfileId + 当前登录用户 openid；不存在返回 null，绝不取最新/第一条
      const asset = await service.findByAvatarProfileId(avatarProfileId, openid);
      return { ok: true, asset: asset || null };
    }
    return await submit(event, openid);
  } catch (e) {
    console.log("aiTryon main fail", "error=" + fmtErr(e));
    return { ok: false, error: e.appCode || "INTERNAL", message: e.appCode ? e.message : "内部错误" };
  }
};
