const test = require("node:test");
const assert = require("node:assert");
const { handleCallback, finalizeTryonSuccessAtomically } = require("./callback");

// 支持 Transaction 的 fake db（模拟 CloudBase Transaction API）
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
      let committed = false;
      let rolledBack = false;
      return {
        collection: (name) => collApi(txStore, name),
        commit: async () => {
          committed = true;
          for (const [k, v] of Object.entries(txStore)) {
            store[k] = {};
            for (const [id, doc] of Object.entries(v)) {
              store[k][id] = { ...doc };
            }
          }
        },
        rollback: async () => {
          rolledBack = true;
          // txStore 丢弃，store 不变
        }
      };
    }
  };
}

// ============================================================
// Phase 5-3-C：finalizeTryonSuccessAtomically 边界测试
// ============================================================

// 1. processing → success + image
test("5-3-C: processing → success + image 原子完成", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "processing", user_id: "u1", _openid: "u1", garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1" } },
    tryon_results: {}
  };
  const r = await finalizeTryonSuccessAtomically({
    db: fakeDb(store), taskId: "t1",
    tryonImage: "cloud://img/final.png", tryonVideo: "",
    provider: "agnes"
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(store.tryon_tasks.t1.status, "success");
  assert.strictEqual(store.tryon_tasks.t1.tryon_image, "cloud://img/final.png");
  assert.strictEqual(store.tryon_tasks.t1.provider, "agnes");
  const results = Object.values(store.tryon_results);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].tryon_image, "cloud://img/final.png");
  assert.strictEqual(results[0].task_id, "t1");
});

// 2. processing → success + video
test("5-3-C: processing → success + video 原子完成", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "processing", user_id: "u1", _openid: "u1", garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1", tryon_image: "cloud://img/existing.png" } },
    tryon_results: {}
  };
  const r = await finalizeTryonSuccessAtomically({
    db: fakeDb(store), taskId: "t1",
    tryonImage: "cloud://img/existing.png", tryonVideo: "cloud://vid/final.mp4",
    provider: "agnes"
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(store.tryon_tasks.t1.status, "success");
  assert.strictEqual(store.tryon_tasks.t1.tryon_video, "cloud://vid/final.mp4");
  const results = Object.values(store.tryon_results);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].tryon_video, "cloud://vid/final.mp4");
});

// 3. 空结果 → 抛 INVALID_ARGUMENT，Task 保持 processing
test("5-3-C: 空结果 → INVALID_ARGUMENT，Task 不变", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "processing", user_id: "u1" } },
    tryon_results: {}
  };
  await assert.rejects(
    () => finalizeTryonSuccessAtomically({
      db: fakeDb(store), taskId: "t1",
      tryonImage: "", tryonVideo: ""
    }),
    (e) => e.appCode === "INVALID_ARGUMENT"
  );
  assert.strictEqual(store.tryon_tasks.t1.status, "processing");
  assert.strictEqual(Object.keys(store.tryon_results).length, 0);
});

// 4. success + Result 已存在 → idempotent
test("5-3-C: success + Result 已存在 → idempotent", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "success", user_id: "u1", _openid: "u1" } },
    tryon_results: { r1: { _id: "r1", task_id: "t1", tryon_image: "cloud://img/existing.png" } }
  };
  const r = await finalizeTryonSuccessAtomically({
    db: fakeDb(store), taskId: "t1",
    tryonImage: "cloud://img/existing.png", tryonVideo: ""
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.idempotent, true);
  assert.strictEqual(Object.values(store.tryon_results).length, 1);
});

// 5. success + Result 缺失 + 真实结果 → 修复（补建 Result）
test("5-3-C: success + Result 缺失 → 修复补建", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "success", user_id: "u1", _openid: "u1", garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1", tryon_image: "cloud://img/orphan.png" } },
    tryon_results: {}
  };
  const r = await finalizeTryonSuccessAtomically({
    db: fakeDb(store), taskId: "t1",
    tryonImage: "cloud://img/orphan.png", tryonVideo: ""
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.repaired, true);
  const results = Object.values(store.tryon_results);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].tryon_image, "cloud://img/orphan.png");
  assert.strictEqual(results[0].task_id, "t1");
});

// 6. Result 写失败 → Task 不得最终 success（rollback）
test("5-3-C: Result 写失败 → Task 保持 processing（rollback）", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "processing", user_id: "u1", _openid: "u1", garment_ids: ["g1"] } },
    tryon_results: {}
  };
  const brokenDb = fakeDb(store);
  const origStart = brokenDb.startTransaction;
  brokenDb.startTransaction = async function() {
    const tx = await origStart.call(this);
    const origColl = tx.collection.bind(tx);
    tx.collection = (name) => {
      const c = origColl(name);
      if (name === "tryon_results") {
        c.add = async () => { throw new Error("simulated write failure"); };
      }
      return c;
    };
    return tx;
  };
  await assert.rejects(
    () => finalizeTryonSuccessAtomically({
      db: brokenDb, taskId: "t1",
      tryonImage: "cloud://img/x.png", tryonVideo: ""
    }),
    (e) => e.appCode === "INTERNAL"
  );
  assert.strictEqual(store.tryon_tasks.t1.status, "processing");
  assert.strictEqual(Object.keys(store.tryon_results).length, 0);
});

// 7. Result 不重复创建（通过 handleCallback 幂等路径）
test("5-3-C: Result 不重复创建（handleCallback 幂等）", async () => {
  const store = {
    tryon_tasks: { t1: { _id: "t1", status: "processing", user_id: "u1", _openid: "u1", garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1" } },
    tryon_results: {}
  };
  const db = fakeDb(store);
  const r1 = await handleCallback({ db, taskId: "t1", status: "success", result: { tryonImage: "cloud://img/a.png" } });
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(Object.values(store.tryon_results).length, 1);
  // 第二次 success 回调：应幂等，不新增 Result
  const r2 = await handleCallback({ db, taskId: "t1", status: "success", result: { tryonImage: "cloud://img/a.png" } });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.idempotent, true);
  assert.strictEqual(Object.values(store.tryon_results).length, 1);
});

// 8. Result 字段契约保持
test("5-3-C: Result 字段契约完整保持", async () => {
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "processing",
        _openid: "u1", user_id: "u1",
        avatar_view_id: "av1",
        garment_ids: ["g1"], garment_name: "白T恤",
        cache_key: "ck_abc",
        tryon_image: "cloud://img/x.png"
      }
    },
    tryon_results: {}
  };
  await finalizeTryonSuccessAtomically({
    db: fakeDb(store), taskId: "t1",
    tryonImage: "cloud://img/final.png", tryonVideo: "cloud://vid/final.mp4",
    provider: "agnes"
  });
  const result = Object.values(store.tryon_results)[0];
  // 契约字段全部存在
  assert.strictEqual(result._openid, "u1");
  assert.strictEqual(result.user_id, "u1");
  assert.strictEqual(result.task_id, "t1");
  assert.strictEqual(result.avatar_view_id, "av1");
  assert.strictEqual(result.garment_id, "g1");
  assert.strictEqual(result.garment_name, "白T恤");
  assert.strictEqual(result.tryon_image, "cloud://img/final.png");
  assert.strictEqual(result.tryon_video, "cloud://vid/final.mp4");
  assert.strictEqual(result.cache_key, "ck_abc");
  assert.strictEqual(result.ai_tagged, true);
  assert.ok(typeof result.created_at === "number");
  assert.ok(typeof result.createdAt === "number");
  assert.ok(typeof result.updated_at === "number");
});
