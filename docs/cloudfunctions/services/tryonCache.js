/* 试穿任务缓存/清理工具（模型无关） */
const crypto = require("crypto");

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;      // 成功结果复用有效期 7 天
const FAILED_TTL_MS = 7 * 24 * 3600 * 1000;     // 失败记录保留 7 天
const SUCCESS_TTL_MS = 30 * 24 * 3600 * 1000;   // 成功记录保留 30 天

function buildTryonCacheKey({ openid, avatarViewId, garmentIds, kind }) {
  const sorted = (garmentIds || []).slice().sort().join(",");
  const raw = [openid || "", avatarViewId || "", sorted, kind || "ai_image"].join("|");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

/* 图片任务缓存命中：必须有真实效果图与用户归属，7 天内复用（视频为可选后续步骤） */
function isImageCacheHit(doc, now) {
  return !!doc &&
    doc.status === "success" &&
    !!doc.tryon_image &&
    !!doc.user_id &&
    (now - (doc.created_at || doc.createdAt)) < CACHE_TTL_MS;
}

/* 视频任务缓存命中：必须有真实视频与用户归属，7 天内复用 */
function isCacheHit(doc, now) {
  return !!doc &&
    doc.status === "success" &&
    !!doc.tryon_video &&                       // 必须有真实视频链接，视频缺失的成功任务不参与复用
    !!doc.user_id &&                           // 必须有用户归属（测试/无身份任务不参与复用，否则订阅通知无法发送）
    typeof (doc.created_at || doc.createdAt) === "number" &&
    (now - (doc.created_at || doc.createdAt)) < CACHE_TTL_MS;
}

function isCleanupCandidate(doc, now) {
  if (!doc) return false;
  if (doc.status === "failed") {
    const t = doc.updated_at || doc.updatedAt || doc.created_at || doc.createdAt || 0;
    return typeof t === "number" && now - t > FAILED_TTL_MS;
  }
  if (doc.status === "success") {
    return typeof (doc.created_at || doc.createdAt) === "number" && (now - (doc.created_at || doc.createdAt)) > SUCCESS_TTL_MS;
  }
  return false;
}

module.exports = { buildTryonCacheKey, isImageCacheHit, isCacheHit, isCleanupCandidate, CACHE_TTL_MS, FAILED_TTL_MS, SUCCESS_TTL_MS };
