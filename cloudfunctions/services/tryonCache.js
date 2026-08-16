/* 试穿任务缓存/清理工具（模型无关） */
const crypto = require("crypto");

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;      // 成功结果复用有效期 7 天
const FAILED_TTL_MS = 7 * 24 * 3600 * 1000;     // 失败记录保留 7 天
const SUCCESS_TTL_MS = 30 * 24 * 3600 * 1000;   // 成功记录保留 30 天

function buildTryonCacheKey({ openid, avatarViewId, garmentIds }) {
  const sorted = (garmentIds || []).slice().sort().join(",");
  const raw = [openid || "", avatarViewId || "", sorted, "ai_video"].join("|");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

function isCacheHit(doc, now) {
  return !!doc &&
    doc.status === "success" &&
    typeof doc.createdAt === "number" &&
    now - doc.createdAt < CACHE_TTL_MS;
}

function isCleanupCandidate(doc, now) {
  if (!doc) return false;
  if (doc.status === "failed") {
    const t = doc.updated_at || doc.updatedAt || doc.createdAt || 0;
    return typeof t === "number" && now - t > FAILED_TTL_MS;
  }
  if (doc.status === "success") {
    return typeof doc.createdAt === "number" && now - doc.createdAt > SUCCESS_TTL_MS;
  }
  return false;
}

module.exports = { buildTryonCacheKey, isCacheHit, isCleanupCandidate, CACHE_TTL_MS, FAILED_TTL_MS, SUCCESS_TTL_MS };
