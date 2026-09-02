const test = require("node:test");
const assert = require("node:assert");
const { consumeQuota, refundQuota, getQuota, quotaDocId, DEFAULT_DAILY_LIMIT } = require("./quota");

function fakeDb(store) {
  return {
    runTransaction: async (fn) => fn({
      collection: () => ({
        doc: (id) => ({
          get: async () => {
            if (store[id]) return { data: store[id] };
            throw new Error("not found");
          },
          set: async ({ data }) => { store[id] = data; return { _id: id }; }
        })
      })
    }),
    collection: () => ({
      doc: (id) => ({
        get: async () => {
          if (store[id]) return { data: store[id] };
          throw new Error("not found");
        },
        update: async ({ data }) => {
          const d = store[id];
          if (!d) return { stats: { updated: 0 } };
          if (data.used && data.used.inc !== undefined) d.used = (d.used || 0) + data.used.inc;
          if (data.updated_at) d.updated_at = data.updated_at;
          return { stats: { updated: 1 } };
        }
      })
    }),
    command: { inc: (n) => ({ inc: n }) }
  };
}

test("consumeQuota 首次创建 used=1", async () => {
  const store = {};
  const db = fakeDb(store);
  const r = await consumeQuota(db, "u1", "2026-08-18");
  assert.strictEqual(r.used, 1);
  assert.strictEqual(r.limit, DEFAULT_DAILY_LIMIT);
});

test("consumeQuota 超限抛 RATE_LIMITED", async () => {
  const store = {};
  const db = fakeDb(store);
  await consumeQuota(db, "u1", "2026-08-18");
  await consumeQuota(db, "u1", "2026-08-18");
  await consumeQuota(db, "u1", "2026-08-18");
  await assert.rejects(() => consumeQuota(db, "u1", "2026-08-18"), (e) => e.appCode === "RATE_LIMITED");
});

test("refundQuota 回补 1 次", async () => {
  const store = {};
  const db = fakeDb(store);
  await consumeQuota(db, "u1", "2026-08-18");
  await refundQuota(db, "u1", "2026-08-18");
  const q = await getQuota(db, "u1", "2026-08-18");
  assert.strictEqual(q.used, 0);
});

test("getQuota 无记录返回默认额度", async () => {
  const q = await getQuota(fakeDb({}), "u1", "2026-08-18");
  assert.strictEqual(q.dailyFree, DEFAULT_DAILY_LIMIT);
  assert.strictEqual(q.used, 0);
});

test("quotaDocId 按用户+日期隔离", () => {
  assert.strictEqual(quotaDocId("u1", "2026-08-18"), "q_u1_2026-08-18");
  assert.notStrictEqual(quotaDocId("u1", "2026-08-18"), quotaDocId("u2", "2026-08-18"));
});
