const test = require("node:test");
const assert = require("node:assert");
const { handleCallback } = require("./callback");

function fakeDb(store) {
  return {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (store[name] && store[name][id]) return { data: store[name][id] };
          throw new Error("not found");
        },
        update: async ({ data }) => {
          Object.assign(store[name][id], data);
          return { stats: { updated: 1 } };
        }
      }),
      where: (q) => ({
        limit: () => ({
          get: async () => ({
            data: Object.keys(store[name] || {}).map((k) => store[name][k]).filter((d) => d[q.task_id] === q.task_id)
          })
        })
      }),
      add: async ({ data }) => {
        store[name] = store[name] || {};
        const id = "doc_" + Object.keys(store[name]).length;
        store[name][id] = data;
        return { _id: id };
      }
    })
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
