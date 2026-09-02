const test = require("node:test");
const assert = require("node:assert");
const { resolveGarment, resolveGarments } = require("./garments");

function fakeDb(docs) {
  return {
    collection: () => ({
      doc: (id) => ({
        get: async () => {
          if (!Object.prototype.hasOwnProperty.call(docs, id)) throw new Error("not found");
          return { data: docs[id] };
        }
      })
    })
  };
}

test("resolveGarment: 内置模板白名单返回可信 name（无参考图）", async () => {
  const db = fakeDb({});
  const g = await resolveGarment(db, "g-tee", "u1");
  assert.strictEqual(g.name, "白色基础T恤");
  assert.strictEqual(g.type, "builtin");
  assert.strictEqual(g.originalFileId, "");
});

test("resolveGarment: 上传衣物从库取 original_file_id", async () => {
  const db = fakeDb({
    "abc123": { _id: "abc123", user_id: "u1", name: "我的衬衫", category: "上衣", original_file_id: "cloud://x/1.png" }
  });
  const g = await resolveGarment(db, "abc123", "u1");
  assert.strictEqual(g.name, "我的衬衫");
  assert.strictEqual(g.originalFileId, "cloud://x/1.png");
});

test("resolveGarment: 跨用户访问 -> FORBIDDEN", async () => {
  const db = fakeDb({
    "abc123": { _id: "abc123", user_id: "u2", name: "B的衣物", original_file_id: "cloud://x/1.png" }
  });
  await assert.rejects(() => resolveGarment(db, "abc123", "u1"), (e) => e.appCode === "FORBIDDEN");
});

test("resolveGarment: 不存在且非内置 -> NOT_FOUND", async () => {
  const db = fakeDb({});
  await assert.rejects(() => resolveGarment(db, "no-such-id", "u1"), (e) => e.appCode === "NOT_FOUND");
});

test("resolveGarment: 无归属旧记录 -> FORBIDDEN（不可访问）", async () => {
  const db = fakeDb({
    "abc123": { _id: "abc123", name: "无主衣物" }
  });
  await assert.rejects(() => resolveGarment(db, "abc123", "u1"), (e) => e.appCode === "FORBIDDEN");
});

test("resolveGarments: 批量解析保持顺序", async () => {
  const db = fakeDb({
    "abc123": { _id: "abc123", user_id: "u1", name: "A", original_file_id: "" }
  });
  const list = await resolveGarments(db, ["g-tee", "abc123"], "u1");
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].type, "builtin");
  assert.strictEqual(list[1].name, "A");
});
