const test = require("node:test");
const assert = require("node:assert");
const { canTransition, assertTransition, normalizeStatus, ALLOWED_TRANSITIONS } = require("./taskState");

test("合法迁移", () => {
  assert.strictEqual(canTransition("queued", "processing"), true);
  assert.strictEqual(canTransition("queued", "failed"), true);
  assert.strictEqual(canTransition("queued", "cancelled"), true);
  assert.strictEqual(canTransition("processing", "success"), true);
  assert.strictEqual(canTransition("processing", "failed"), true);
  assert.strictEqual(canTransition("processing", "cancelled"), true);
});

test("非法迁移被拒绝（含跳过 queued 直入 success）", () => {
  assert.strictEqual(canTransition("queued", "success"), false);
  assert.strictEqual(canTransition("success", "processing"), false);
  assert.strictEqual(canTransition("success", "failed"), false);
  assert.strictEqual(canTransition("failed", "processing"), false);
  assert.strictEqual(canTransition("cancelled", "processing"), false);
  assert.throws(() => assertTransition("queued", "success"), (e) => e.appCode === "CONFLICT");
});

test("normalizeStatus 只接受五态", () => {
  for (const s of ["queued", "processing", "success", "failed", "cancelled"]) {
    assert.strictEqual(normalizeStatus(s), s);
  }
  assert.strictEqual(normalizeStatus("done"), null);
  assert.strictEqual(normalizeStatus(""), null);
});

test("ALLOWED_TRANSITIONS 覆盖全部状态", () => {
  for (const s of ["queued", "processing", "success", "failed", "cancelled"]) {
    assert.ok(Array.isArray(ALLOWED_TRANSITIONS[s]), s);
  }
});
