const test = require("node:test");
const assert = require("node:assert");
const { buildTryonCacheKey, isCacheHit, isCleanupCandidate, CACHE_TTL_MS, FAILED_TTL_MS, SUCCESS_TTL_MS } = require("./tryonCache");

test("buildTryonCacheKey 与衣物顺序无关", () => {
  const a = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g2", "g1"] });
  const b = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1", "g2"] });
  assert.strictEqual(a, b);
});

test("buildTryonCacheKey 不同组合生成不同 key", () => {
  const a = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1"] });
  const b = buildTryonCacheKey({ openid: "u1", avatarViewId: "av2", garmentIds: ["g1"] });
  assert.notStrictEqual(a, b);
});

test("buildTryonCacheKey 跨用户隔离（不同用户不同 key）", () => {
  const a = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1"] });
  const b = buildTryonCacheKey({ openid: "u2", avatarViewId: "av1", garmentIds: ["g1"] });
  assert.notStrictEqual(a, b);
});

test("buildTryonCacheKey 图片/视频 kind 分离", () => {
  const a = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1"], kind: "ai_image" });
  const b = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1"], kind: "ai_video" });
  assert.notStrictEqual(a, b);
});

test("isCacheHit 仅接受 7 天内成功任务", () => {
  const now = Date.now();
  assert.ok(isCacheHit({ status: "success", user_id: "u1", tryon_video: "https://x/v.mp4", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "success", tryon_video: "https://x/v.mp4", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "success", tryon_video: "", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "failed", user_id: "u1", tryon_video: "https://x/v.mp4", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "success", user_id: "u1", tryon_video: "https://x/v.mp4", createdAt: now - CACHE_TTL_MS - 1 }, now));
});

test("isCacheHit/isImageCacheHit 兼容 created_at 新字段", () => {
  const now = Date.now();
  const { isImageCacheHit } = require("./tryonCache");
  assert.ok(isCacheHit({ status: "success", user_id: "u1", tryon_video: "https://x/v.mp4", created_at: now - 1000 }, now));
  assert.ok(isImageCacheHit({ status: "success", user_id: "u1", tryon_image: "cloud://x/1.png", created_at: now - 1000 }, now));
  assert.ok(!isImageCacheHit({ status: "success", tryon_image: "cloud://x/1.png", created_at: now - 1000 }, now));
});

test("isCleanupCandidate 按失败/成功宽限期判断", () => {
  const now = Date.now();
  assert.ok(isCleanupCandidate({ status: "failed", updated_at: now - FAILED_TTL_MS - 1 }, now));
  assert.ok(!isCleanupCandidate({ status: "failed", updated_at: now - 1000 }, now));
  assert.ok(isCleanupCandidate({ status: "success", createdAt: now - SUCCESS_TTL_MS - 1 }, now));
  assert.ok(!isCleanupCandidate({ status: "success", createdAt: now - 1000 }, now));
});
