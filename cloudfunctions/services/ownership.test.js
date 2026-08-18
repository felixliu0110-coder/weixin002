const test = require("node:test");
const assert = require("node:assert");
const { assertOwner, getOwnedDoc, getOwnedFirst } = require("./ownership");

function appCode(fn) {
  try { fn(); } catch (e) { return e.appCode; }
  return null;
}

test("assertOwner: 未登录 AUTH_REQUIRED", () => {
  assert.strictEqual(appCode(() => assertOwner({ _id: "x", user_id: "u1" }, "")), "AUTH_REQUIRED");
});

test("assertOwner: 资源不存在 NOT_FOUND", () => {
  assert.strictEqual(appCode(() => assertOwner(null, "u1")), "NOT_FOUND");
});

test("assertOwner: 跨用户 FORBIDDEN", () => {
  assert.strictEqual(appCode(() => assertOwner({ _id: "x", user_id: "u2" }, "u1")), "FORBIDDEN");
});

test("assertOwner: 旧数据无归属 FORBIDDEN（不允许未归属资源被访问）", () => {
  assert.strictEqual(appCode(() => assertOwner({ _id: "x" }, "u1")), "FORBIDDEN");
});

test("assertOwner: 归属匹配放行", () => {
  const doc = { _id: "x", user_id: "u1" };
  assert.strictEqual(assertOwner(doc, "u1"), doc);
});

test("getOwnedDoc: 不存在 -> NOT_FOUND", async () => {
  const db = { collection: () => ({ doc: () => ({ get: async () => { throw new Error("not found"); } }) }) };
  await assert.rejects(() => getOwnedDoc(db, "t", "missing", "u1"), (e) => e.appCode === "NOT_FOUND");
});

test("getOwnedDoc: 归属不符 -> FORBIDDEN", async () => {
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: { _id: "x", user_id: "u2" } }) }) }) };
  await assert.rejects(() => getOwnedDoc(db, "t", "x", "u1"), (e) => e.appCode === "FORBIDDEN");
});

test("getOwnedDoc: 归属匹配返回文档", async () => {
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: { _id: "x", user_id: "u1" } }) }) }) };
  const doc = await getOwnedDoc(db, "t", "x", "u1");
  assert.strictEqual(doc.user_id, "u1");
});

test("getOwnedFirst: 未登录 AUTH_REQUIRED", async () => {
  const db = { collection: () => ({ where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }) }) }) };
  await assert.rejects(() => getOwnedFirst(db, "t", {}, ""), (e) => e.appCode === "AUTH_REQUIRED");
});

test("getOwnedFirst: 查询始终带 user_id 且空结果 NOT_FOUND", async () => {
  let captured = null;
  const db = { collection: () => ({ where: (q) => { captured = q; return { orderBy: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }) }; } }) };
  await assert.rejects(() => getOwnedFirst(db, "t", { status: "ready" }, "u1"), (e) => e.appCode === "NOT_FOUND");
  assert.strictEqual(captured.user_id, "u1");
});
