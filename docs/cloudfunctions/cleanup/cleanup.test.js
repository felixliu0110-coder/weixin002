const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const now = Date.now();
const DAY = 24 * 3600 * 1000;
const SDK_NAME = "wx-server-sdk";
const VIRTUAL_PATH = "/virtual-node-modules/" + SDK_NAME + "/index.js";
const Module = require("module");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === SDK_NAME) return VIRTUAL_PATH;
  return origResolve.call(this, request, parent, ...rest);
};

// 共享 store：cleanup 通过 db.collection("tryon_tasks")
const store = { tryon_tasks: [] };

function makeDocs(list) {
  store.tryon_tasks = list.map((d, i) => Object.assign({ _id: d._id || ("doc" + i), status: d.status, created_at: d.created_at, updated_at: d.updated_at, createdAt: d.createdAt, updatedAt: d.updatedAt }, d));
}

function makeCloud() {
  const db = {
    command: { lt: (v) => ({ $lt: v }), exists: (b) => ({ $exists: b }) },
    collection: (name) => ({
      where: (q) => ({
        limit: (n) => ({
          get: async () => {
            let rows = (store[name] || []).slice();
            if (q && q.status) rows = rows.filter((r) => r.status === q.status);
            if (q && q.updated_at) {
              if (q.updated_at.$exists === false) rows = rows.filter((r) => !r.updated_at && !r.updatedAt);
              else if (q.updated_at.$lt !== undefined) rows = rows.filter((r) => (r.updated_at || r.updatedAt || r.created_at || r.createdAt || 0) < q.updated_at.$lt);
            }
            if (q && q.created_at && q.created_at.$lt !== undefined) rows = rows.filter((r) => (r.created_at || r.createdAt || 0) < q.created_at.$lt);
            return { data: rows.slice(0, (q && q.$limit) || 100) };
          }
        })
      }),
      doc: (id) => ({
        remove: async () => { store[name] = (store[name] || []).filter((r) => r._id !== id); return {}; }
      })
    })
  };
  return { init: () => {}, DYNAMIC_CURRENT_ENV: "mock", database: () => db,
    getWXContext: () => ({ OPENID: "u1" }) };
}
require.cache[VIRTUAL_PATH] = { id: VIRTUAL_PATH, filename: VIRTUAL_PATH, loaded: true, exports: makeCloud() };
const cleanup = require("./index");

test("P1-3 success 按 created_at 过期条件删除，failed 按 updated_at，queued/processing 保留", async () => {
  makeDocs([
    { _id: "s1", status: "success", created_at: now - 40 * DAY },
    { _id: "s2", status: "success", created_at: now - 5 * DAY }, // 未过期
    { _id: "f1", status: "failed", updated_at: now - 10 * DAY },
    { _id: "f2", status: "failed", updated_at: now - 1000 }, // 未过期
    { _id: "q1", status: "queued", created_at: now - 100 * DAY }, // 不应删
    { _id: "p1", status: "processing", created_at: now - 100 * DAY } // 不应删
  ]);
  const res = await cleanup.main();
  const ids = store.tryon_tasks.map((d) => d._id);
  assert.ok(ids.includes("s2"), "未过期 success 应保留");
  assert.ok(ids.includes("f2"), "未过期 failed 应保留");
  assert.ok(ids.includes("q1"), "queued 不应删除");
  assert.ok(ids.includes("p1"), "processing 不应删除");
  assert.ok(!ids.includes("s1"), "过期 success 应删除");
  assert.ok(!ids.includes("f1"), "过期 failed 应删除");
  assert.strictEqual(res.removed >= 2, true);
});

test("P1-3 前 100 条无过期数据时仍能清理第 101+ 条旧数据", async () => {
  const list = [];
  for (let i = 0; i < 110; i++) {
    list.push({ _id: "r" + i, status: "success", created_at: i < 100 ? now - 5 * DAY : now - 40 * DAY });
  }
  makeDocs(list);
  const res = await cleanup.main();
  const ids = store.tryon_tasks.map((d) => d._id);
  assert.strictEqual(ids.includes("r0"), true, "前 100 条新数据应保留");
  assert.strictEqual(ids.includes("r109"), false, "第 101+ 条旧数据应被清理");
  assert.strictEqual(res.removed >= 10, true);
});

test("P1-3 不删除 tryon_results / favorites / garments（仅 tryon_tasks）", async () => {
  makeDocs([{ _id: "s1", status: "success", created_at: now - 40 * DAY }]);
  store.tryon_results = [{ _id: "tr1" }];
  store.favorites = [{ _id: "fv1" }];
  store.garments = [{ _id: "g1" }];
  const res = await cleanup.main();
  assert.strictEqual((store.tryon_results || []).length, 1);
  assert.strictEqual((store.favorites || []).length, 1);
  assert.strictEqual((store.garments || []).length, 1);
  assert.strictEqual(res.removed >= 1, true);
});

test("P1-3 failed 使用 updated_at 时间字段", async () => {
  makeDocs([
    { _id: "f1", status: "failed", created_at: now - 40 * DAY, updated_at: now - 1000 }, // updated 新，不应删
    { _id: "f2", status: "failed", created_at: now - 1000, updated_at: now - 10 * DAY }  // updated 旧，应删
  ]);
  const res = await cleanup.main();
  const ids = store.tryon_tasks.map((d) => d._id);
  assert.ok(ids.includes("f1"), "failed 应以 updated_at 判断，created 旧但 updated 新应保留");
  assert.ok(!ids.includes("f2"), "failed updated_at 过期应删除");
});
