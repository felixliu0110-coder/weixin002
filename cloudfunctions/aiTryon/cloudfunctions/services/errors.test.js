const test = require("node:test");
const assert = require("node:assert");
const { ERR, appError, isAppError, fmtErr } = require("./errors");

test("appError 生成带 code/http 的错误", () => {
  const e = appError("FORBIDDEN");
  assert.strictEqual(e.appCode, "FORBIDDEN");
  assert.strictEqual(e.httpStatus, 403);
  assert.strictEqual(isAppError(e), true);
});

test("appError 未知 key 回退 INTERNAL", () => {
  const e = appError("NOPE", "x");
  assert.strictEqual(e.appCode, "INTERNAL");
});

test("fmtErr 不泄露内部细节（非 app error 返回 message）", () => {
  assert.strictEqual(fmtErr(new Error("boom")), "boom");
  assert.strictEqual(fmtErr({ appCode: "NOT_FOUND", message: "资源不存在" }), "NOT_FOUND: 资源不存在");
  assert.strictEqual(fmtErr(null), "unknown");
});
