const test = require("node:test");
const assert = require("node:assert");
const {
  requireLogin, requireString, requireId, requireArray, requireInt, requireEnum, normalizeUserField
} = require("./validation");

function appCode(fn) {
  try { fn(); } catch (e) { return e.appCode; }
  return null;
}

test("requireLogin: 空 openid -> AUTH_REQUIRED", () => {
  assert.strictEqual(appCode(() => requireLogin("")), "AUTH_REQUIRED");
  assert.strictEqual(requireLogin("o1"), "o1");
});

test("requireString/requireId: 空/超长/类型 -> INVALID_ARGUMENT", () => {
  assert.strictEqual(appCode(() => requireString("", "name")), "INVALID_ARGUMENT");
  assert.strictEqual(appCode(() => requireString(123, "name")), "INVALID_ARGUMENT");
  assert.strictEqual(appCode(() => requireString("abc", "name", 2)), "INVALID_ARGUMENT");
  assert.strictEqual(appCode(() => requireId("", "id")), "INVALID_ARGUMENT");
});

test("requireArray: 非数组/越界 -> INVALID_ARGUMENT", () => {
  assert.strictEqual(appCode(() => requireArray("x", "arr")), "INVALID_ARGUMENT");
  assert.strictEqual(appCode(() => requireArray([], "arr", { min: 1 })), "INVALID_ARGUMENT");
  assert.strictEqual(appCode(() => requireArray([1, 2], "arr", { max: 1 })), "INVALID_ARGUMENT");
});

test("requireInt: 非数值/越界 -> INVALID_ARGUMENT", () => {
  assert.strictEqual(appCode(() => requireInt("x", "n")), "INVALID_ARGUMENT");
  assert.strictEqual(appCode(() => requireInt(5, "n", { min: 6 })), "INVALID_ARGUMENT");
  assert.strictEqual(requireInt(5.9, "n"), 5);
});

test("requireEnum: 不在允许列表 -> INVALID_ARGUMENT", () => {
  assert.strictEqual(appCode(() => requireEnum("x", "mode", ["a", "b"])), "INVALID_ARGUMENT");
  assert.strictEqual(requireEnum("b", "mode", ["a", "b"]), "b");
});

test("normalizeUserField: 兼容 user_id/_openid", () => {
  assert.strictEqual(normalizeUserField({ user_id: "u1" }), "u1");
  assert.strictEqual(normalizeUserField({ _openid: "o1" }), "o1");
  assert.strictEqual(normalizeUserField({}), "");
  assert.strictEqual(normalizeUserField(null), "");
});
