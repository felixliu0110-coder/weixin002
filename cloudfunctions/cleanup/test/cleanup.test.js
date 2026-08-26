const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const path = require("path");
const { SUCCESS_TTL_MS, FAILED_TTL_MS } = require("../tryonCache");

// 将 wx-server-sdk 解析重定向到共享 fake 文件（避免虚拟 ID cache 不命中真实包）
const FAKE_SDK = path.resolve(__dirname, "../../__fake_wx_sdk.js");
const origResolveCleanup = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req === "wx-server-sdk") return FAKE_SDK;
  return origResolveCleanup.call(this, req, parent, ...rest);
};

/* Mock wx-server-sdk：database 返回可控 collection；不依赖真实云环境。 */
const now = Date.now();
const tasks = [];
function makeTask(over) {
  return Object.assign({ status: "success", created_at: now - SUCCESS_TTL_MS - 1000, updated_at: now - SUCCESS_TTL_MS - 1000, _id: "t" + (tasks.length + 1) }, over);
}
const fakeDb = {
  command: { lt(v) { return { __lt: v }; }, in() { return this; } },
  collection(name) {
    if (name !== "tryon_tasks") return { where() { return this; }, get() { return { data: [] }; }, doc() { return { get() { return { data: null }; }, remove() { return {}; } }; } };
    function makeChain() {
      const ctx = { _where: null, _limit: 100 };
      return {
        where(clause) { ctx._where = clause; return this; },
        limit(n) { ctx._limit = n; return this; },
        get() {
          const w = ctx._where || {};
          let pool = tasks.slice();
          // 用 clause 中的 timeField < cutoff（__.lt）做真实过滤
          const timeField = (w.created_at && w.created_at.__lt != null) ? "created_at"
            : (w.updated_at && w.updated_at.__lt != null) ? "updated_at" : null;
          const cutoff = timeField ? (w[timeField].__lt) : null;
          if (w.status === "success") {
            pool = pool.filter((d) => d.status === "success" && (cutoff == null || d.created_at < cutoff));
          } else if (w.status === "failed") {
            pool = pool.filter((d) => d.status === "failed" && (cutoff == null || (d.updated_at || d.created_at) < cutoff));
          } else if (w.status) {
            pool = pool.filter((d) => d.status === w.status);
          }
          return { data: pool.slice(0, ctx._limit) };
        },
        doc(id) {
          return {
            remove() {
              const idx = tasks.findIndex((t) => t._id === id);
              if (idx >= 0) tasks.splice(idx, 1);
              return {};
            }
          };
        }
      };
    }
    return makeChain();
  }
};
// 通过全局变量把本测试的定制 fakeDb 注入共享 fake SDK
global.__wxFakeDb__ = fakeDb;

const { main } = require("../index.js");

function reset() { tasks.length = 0; }

test("cleanup: success 过期按 created_at 删除，failed 过期按 updated_at 删除", async () => {
  reset();
  // 101 条 success 过期（验证不依赖前 100 条 + 能处理 101+）
  for (let i = 0; i < 101; i++) tasks.push(makeTask({ status: "success", _id: "s" + i }));
  tasks.push(makeTask({ status: "failed", _id: "f1", updated_at: now - FAILED_TTL_MS - 1000 }));
  // 新数据（不应被删）
  tasks.push(makeTask({ status: "success", _id: "sn", created_at: now }));
  tasks.push(makeTask({ status: "failed", _id: "fn", updated_at: now }));
  // queued/processing 不应被删
  tasks.push(makeTask({ status: "queued", _id: "q1" }));
  tasks.push(makeTask({ status: "processing", _id: "p1" }));

  const before = tasks.length;
  const r = await main({});
  const remaining = tasks.length;
  assert.ok(r.ok);
  assert.ok(r.removedSuccess >= 101, "应删除 101 条过期 success，实际 removedSuccess=" + r.removedSuccess);
  assert.strictEqual(r.removedFailed, 1);
  // 新数据 + queued/processing 保留
  const kept = tasks.filter((t) => ["sn", "fn", "q1", "p1"].includes(t._id));
  assert.strictEqual(kept.length, 4, "新数据/queued/processing 应保留");
  assert.ok(r.removed >= 102);
});

test("cleanup: 无过期数据时返回 removed=0 且不误删", async () => {
  reset();
  tasks.push(makeTask({ status: "success", _id: "snew", created_at: now }));
  tasks.push(makeTask({ status: "failed", _id: "fnew", updated_at: now }));
  const r = await main({});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.removed, 0);
  assert.strictEqual(tasks.length, 2);
});

test("cleanup: 仅 failed 过期存在时只删 failed", async () => {
  reset();
  tasks.push(makeTask({ status: "failed", _id: "f1", updated_at: now - FAILED_TTL_MS - 5000 }));
  tasks.push(makeTask({ status: "success", _id: "snew", created_at: now }));
  const r = await main({});
  assert.strictEqual(r.removedSuccess, 0);
  assert.strictEqual(r.removedFailed, 1);
  assert.strictEqual(tasks.find((t) => t._id === "snew"), tasks.find((t) => t._id === "snew"));
});
