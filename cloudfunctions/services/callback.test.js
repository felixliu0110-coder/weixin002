const test = require("node:test");
const assert = require("node:assert");
const { handleCallback } = require("./callback");

function fakeDb(store) {
  function collApi(target, name) {
    return {
      doc: (id) => ({
        get: async () => {
          if (target[name] && target[name][id]) return { data: { ...target[name][id] } };
          throw new Error("not found");
        },
        update: async ({ data }) => {
          if (!target[name]) target[name] = {};
          if (!target[name][id]) throw new Error("doc not found");
          Object.assign(target[name][id], data);
          return { stats: { updated: 1 } };
        }
      }),
      where: (q) => ({
        limit: () => ({
          get: async () => ({
            data: Object.values(target[name] || {}).filter((d) => {
              return Object.keys(q).every((k) => d[k] === q[k]);
            })
          })
        })
      }),
      add: async ({ data }) => {
        if (!target[name]) target[name] = {};
        const id = "doc_" + Object.keys(target[name]).length;
        target[name][id] = { ...data, _id: id };
        return { _id: id };
      }
    };
  }
  return {
    collection: (name) => collApi(store, name),
    startTransaction: async () => {
      const txStore = {};
      for (const [k, v] of Object.entries(store)) {
        txStore[k] = {};
        for (const [id, doc] of Object.entries(v)) {
          txStore[k][id] = { ...doc };
        }
      }
      return {
        collection: (name) => collApi(txStore, name),
        commit: async () => {
          for (const [k, v] of Object.entries(txStore)) {
            store[k] = {};
            for (const [id, doc] of Object.entries(v)) {
              store[k][id] = { ...doc };
            }
          }
        },
        rollback: async () => {}
      };
    }
  };
}

test("callback: 非法状态迁移被拒绝", async () => {
  const store = { tryon_tasks: { t1: { _id: "t1", status: "queued" } } };
  await assert.rejects(
    () => handleCallback({ db: fakeDb(store), taskId: "t1", status: "success" }),
    (e) => e.appCode === "CONFLICT"
  );
});

test("callback: 合法迁移并幂等写入结果（重复回调不重复创建）", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "processing", user_id: "u1", garment_ids: ["g1"], tryon_image: "cloud://x/1.png" } },
    tryon_results: {}
  };
  const db = fakeDb(store);
  const r1 = await handleCallback({ db, taskId: "t1", status: "success", result: { tryonVideo: "https://v/1.mp4" } });
  assert.strictEqual(r1.ok, true);
  const results = Object.values(store.tryon_results);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].tryon_video, "https://v/1.mp4");
  // 重复 success 回调：幂等，不新增结果
  const r2 = await handleCallback({ db, taskId: "t1", status: "success", result: { tryonVideo: "https://v/1.mp4" } });
  assert.strictEqual(r2.idempotent, true);
  assert.strictEqual(Object.values(store.tryon_results).length, 1);
});

test("callback: 任务不存在 NOT_FOUND", async () => {
  await assert.rejects(
    () => handleCallback({ db: fakeDb({}), taskId: "nope", status: "processing" }),
    (e) => e.appCode === "NOT_FOUND"
  );
});

test("callback: 参数缺失 INVALID_ARGUMENT", async () => {
  await assert.rejects(
    () => handleCallback({ db: fakeDb({}), taskId: "", status: "success" }),
    (e) => e.appCode === "INVALID_ARGUMENT"
  );
});
