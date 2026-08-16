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

test("isCacheHit 仅接受 7 天内成功任务", () => {
  const now = Date.now();
  assert.ok(isCacheHit({ status: "success", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "failed", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "success", createdAt: now - CACHE_TTL_MS - 1 }, now));
});

test("isCleanupCandidate 按失败/成功宽限期判断", () => {
  const now = Date.now();
  assert.ok(isCleanupCandidate({ status: "failed", updated_at: now - FAILED_TTL_MS - 1 }, now));
  assert.ok(!isCleanupCandidate({ status: "failed", updated_at: now - 1000 }, now));
  assert.ok(isCleanupCandidate({ status: "success", createdAt: now - SUCCESS_TTL_MS - 1 }, now));
  assert.ok(!isCleanupCandidate({ status: "success", createdAt: now - 1000 }, now));
});
