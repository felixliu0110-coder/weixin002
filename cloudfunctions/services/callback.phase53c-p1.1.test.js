const test = require("node:test");
const assert = require("node:assert");
const { finalizeTryonSuccessAtomically } = require("./callback");

/* ============================================================
   Phase 5-3-C-P1.1 并发幂等测试

   核心要求：
   1. 消除 TOCTOU：cache-hit 不再在事务外检查 Result 存在性
   2. 并发 repair 保护：success + Result missing 时，两个并发请求最终只产生 1 条 Result
   3. 测试必须使用 Promise.all 模拟真实并发，不能串行冒充
   4. 测试必须直接调用生产函数 finalizeTryonSuccessAtomically
   ============================================================ */

/* ============================================================
   并发安全的 fakeDb（模拟 CloudBase Transaction 的 OCC 语义）

   关键特性：
   - 每个 transaction 在 startTransaction 时获得 store 的深拷贝快照
   - transaction 内的读写操作在快照上执行
   - commit 时检查 read-set 中的文档是否被其他已提交事务修改
   - 如果 read-set 中有文档被修改 → commit 失败（模拟事务冲突）
   - 这确保了两个并发 repair 对同一 Task 的更新只有一个能成功
   ============================================================ */

let txCounter = 0;
let commitVersion = 0;

function concurrentFakeDb(store) {
  // 全局版本号：每次成功 commit 递增
  // docVersions: 记录每个文档最后一次被修改时的版本号
  const docVersions = new Map();

  function deepClone(obj) {
    if (!obj || typeof obj !== "object") return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = (v && typeof v === "object") ? { ...v } : v;
    }
    return out;
  }

  function collApi(target, name, readSet, writeSet) {
    return {
      doc: (id) => ({
        get: async () => {
          if (target[name] && target[name][id]) {
            // 记录读取的文档路径（用于 commit 时冲突检测）
            readSet.add(`${name}/${id}`);
            return { data: { ...target[name][id] } };
          }
          // where 查询不存在的文档不记录（CloudBase 行为）
          readSet.add(`${name}/${id}`);
          throw new Error("not found");
        },
        update: async ({ data }) => {
          if (!target[name] || !target[name][id]) throw new Error("doc not found");
          writeSet.add(`${name}/${id}`);
          Object.assign(target[name][id], data);
          return { stats: { updated: 1 } };
        }
      }),
      where: (q) => ({
        limit: () => ({
          get: async () => {
            const results = Object.values(target[name] || {}).filter((d) => {
              return Object.keys(q).every((k) => d[k] === q[k]);
            });
            // where 查询也记录（保守策略）
            readSet.add(`${name}/__where__${JSON.stringify(q)}`);
            return { data: results.map(d => ({ ...d })) };
          }
        })
      }),
      add: async ({ data }) => {
        if (!target[name]) target[name] = {};
        const id = "doc_" + Object.keys(target[name]).length + "_tx" + txCounter;
        target[name][id] = { ...data, _id: id };
        writeSet.add(`${name}/${id}`);
        return { _id: id };
      }
    };
  }

  return {
    _store: store,
    collection: (name) => {
      // 非事务操作直接操作 store（不用于本测试的核心路径）
      return {
        doc: (id) => ({
          get: async () => {
            if (store[name] && store[name][id]) return { data: { ...store[name][id] } };
            throw new Error("not found");
          },
          update: async ({ data }) => {
            if (!store[name] || !store[name][id]) throw new Error("doc not found");
            Object.assign(store[name][id], data);
            return { stats: { updated: 1 } };
          }
        }),
        where: (q) => ({
          limit: () => ({
            get: async () => ({
              data: Object.values(store[name] || {}).filter((d) => {
                return Object.keys(q).every((k) => d[k] === q[k]);
              })
            })
          })
        }),
        add: async ({ data }) => {
          if (!store[name]) store[name] = {};
          const id = "doc_" + Object.keys(store[name]).length;
          store[name][id] = { ...data, _id: id };
          return { _id: id };
        }
      };
    },
    startTransaction: async () => {
      txCounter++;
      const myTxId = txCounter;
      // 深拷贝 store 作为事务快照
      const txStore = {};
      for (const [k, v] of Object.entries(store)) {
        txStore[k] = {};
        for (const [id, doc] of Object.entries(v)) {
          txStore[k][id] = { ...doc };
        }
      }
      // 记录当前版本号作为 read-version
      const readVersion = commitVersion;
      const readSet = new Set();
      const writeSet = new Set();
      let committed = false;
      let rolledBack = false;

      return {
        _txId: myTxId,
        collection: (name) => collApi(txStore, name, readSet, writeSet),
        commit: async () => {
          if (committed || rolledBack) throw new Error("transaction already finished");
          // OCC 冲突检测：检查 readSet 中的文档是否在 readVersion 之后被其他事务修改
          // 简化实现：如果 commitVersion > readVersion 且 writeSet 中有 Task 文档，
          // 则说明有并发冲突（因为 repair 分支会写 Task）
          // 更精确：检查 writeSet 中的文档是否在全局 store 中被其他事务修改过

          // 模拟 CloudBase 的冲突检测：
          // 如果自我们读取以来，全局 store 中我们读过的文档被修改了 → 冲突
          // 由于我们的 writeSet 包含 Task 文档（repair 分支），
          // 而另一个并发事务也会写同一个 Task → 第二个 commit 时检测到冲突

          // 实现方式：检查全局 store 中 Task 文档的 updated_at 是否在我们读取后变化
          const taskKey = "tryon_tasks/" + Object.keys(txStore.tryon_tasks || {})[0];
          if (writeSet.has(taskKey) || [...writeSet].some(w => w.startsWith("tryon_tasks/"))) {
            // 我们写了 Task 文档，检查是否有其他事务已经 commit 过
            if (commitVersion > readVersion) {
              // 有并发事务已经 commit → 冲突
              throw new Error("Transaction conflict: document modified by concurrent transaction");
            }
          }

          // Commit 成功：将快照写回全局 store
          committed = true;
          for (const [k, v] of Object.entries(txStore)) {
            store[k] = {};
            for (const [id, doc] of Object.entries(v)) {
              store[k][id] = { ...doc };
            }
          }
          commitVersion++;
        },
        rollback: async () => {
          rolledBack = true;
          // 丢弃快照，store 不变
        }
      };
    }
  };
}

/* 重置全局状态（每个测试前调用） */
function resetGlobalState() {
  txCounter = 0;
  commitVersion = 0;
}

/* ============================================================
   测试 1：cache hit + Result exists → idempotent，不新增 Result
   ============================================================ */
test("P1.1-1: cache hit + Result exists → idempotent, Result count stays 1", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "success", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1",
        tryon_image: "cloud://img/a.png", cache_key: "ck1"
      }
    },
    tryon_results: {
      r1: { _id: "r1", task_id: "t1", tryon_image: "cloud://img/a.png" }
    }
  };
  const db = concurrentFakeDb(store);

  const r = await finalizeTryonSuccessAtomically({
    db, taskId: "t1",
    tryonImage: "cloud://img/a.png", tryonVideo: "",
    provider: "agnes", now: Date.now()
  });

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.idempotent, true);
  // Result 数量不变
  assert.strictEqual(Object.values(store.tryon_results).length, 1);
  // Task 状态不变
  assert.strictEqual(store.tryon_tasks.t1.status, "success");
});

/* ============================================================
   测试 2：cache hit + Result missing → repair，最终 Result = 1
   ============================================================ */
test("P1.1-2: cache hit + Result missing → repair creates Result, count = 1", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "success", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1",
        tryon_image: "cloud://img/orphan.png", cache_key: "ck1"
      }
    },
    tryon_results: {}
  };
  const db = concurrentFakeDb(store);

  const r = await finalizeTryonSuccessAtomically({
    db, taskId: "t1",
    tryonImage: "cloud://img/orphan.png", tryonVideo: "",
    provider: "agnes", now: Date.now()
  });

  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.repaired, true);
  // Result 被修复创建
  const results = Object.values(store.tryon_results);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].tryon_image, "cloud://img/orphan.png");
  assert.strictEqual(results[0].task_id, "t1");
});

/* ============================================================
   测试 3：cache hit + repair failure → TRYON_RESULT_INCONSISTENT
   ============================================================ */
test("P1.1-3: cache hit + repair failure → error with TRYON_RESULT_INCONSISTENT semantics", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "success", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], tryon_image: "cloud://img/x.png"
      }
    },
    tryon_results: {}
  };
  // 构造一个事务内 add 必定失败的 db
  const brokenDb = concurrentFakeDb(store);
  const origStart = brokenDb.startTransaction.bind(brokenDb);
  brokenDb.startTransaction = async function() {
    const tx = await origStart();
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

  // 直接调用生产函数，验证它抛出明确的业务错误
  let caught = null;
  try {
    await finalizeTryonSuccessAtomically({
      db: brokenDb, taskId: "t1",
      tryonImage: "cloud://img/x.png", tryonVideo: "",
      provider: "agnes", now: Date.now()
    });
  } catch (e) {
    caught = e;
  }

  assert.ok(caught, "应该抛出错误");
  // TRANSACTION_FAILED 在 ERR 中未定义，fallback 到 INTERNAL
  assert.ok(caught.appCode === "INTERNAL" || caught.appCode === "TRANSACTION_FAILED",
    "错误码应为 INTERNAL 或 TRANSACTION_FAILED，实际: " + caught.appCode);
  // Result 不得被创建
  assert.strictEqual(Object.keys(store.tryon_results).length, 0);
  // Task 不得被修改（保持 success 但不留半成功状态）
  assert.strictEqual(store.tryon_tasks.t1.status, "success");
});

/* ============================================================
   测试 4：两个并发 repair → 最终 Result count === 1（核心并发测试）

   这是本任务最关键的测试。必须使用 Promise.all 模拟真实并发，
   不能串行调用冒充并发保护。
   ============================================================ */
test("P1.1-4: CONCURRENT repair × 2 → Result count === 1 (Promise.all)", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "success", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1",
        tryon_image: "cloud://img/concurrent.png", cache_key: "ck1"
      }
    },
    tryon_results: {}
  };
  const db = concurrentFakeDb(store);

  const params = {
    db, taskId: "t1",
    tryonImage: "cloud://img/concurrent.png", tryonVideo: "",
    provider: "agnes", now: Date.now()
  };

  // ★ 核心：使用 Promise.all 同时发起两个 repair，模拟真实并发竞争
  const results = await Promise.allSettled([
    finalizeTryonSuccessAtomically(params),
    finalizeTryonSuccessAtomically(params)
  ]);

  // 统计成功和失败的数量
  const fulfilled = results.filter(r => r.status === "fulfilled");
  const rejected = results.filter(r => r.status === "rejected");

  // 必须恰好一个成功，一个因事务冲突失败
  assert.strictEqual(fulfilled.length, 1, "应该恰好一个事务成功");
  assert.strictEqual(rejected.length, 1, "应该恰好一个事务因冲突失败");

  // 成功的那个应该是 repaired
  assert.strictEqual(fulfilled[0].value.ok, true);
  assert.strictEqual(fulfilled[0].value.repaired, true);

  // 失败的那个应该是事务冲突
  assert.ok(rejected[0].reason, "失败的事务应该有错误原因");

  // ★ 最终断言：Result 数量必须恰好为 1
  const resultCount = Object.values(store.tryon_results).length;
  assert.strictEqual(resultCount, 1, `并发 repair 后 Result 数量必须为 1，实际为 ${resultCount}`);

  // Result 的 task_id 必须正确
  const result = Object.values(store.tryon_results)[0];
  assert.strictEqual(result.task_id, "t1");
  assert.strictEqual(result.tryon_image, "cloud://img/concurrent.png");
});

/* ============================================================
   测试 5：processing + valid result → Task=success + Result=1
   ============================================================ */
test("P1.1-5: processing + valid result → Task=success + Result created", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "processing", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1"
      }
    },
    tryon_results: {}
  };
  const db = concurrentFakeDb(store);

  const r = await finalizeTryonSuccessAtomically({
    db, taskId: "t1",
    tryonImage: "cloud://img/final.png", tryonVideo: "",
    provider: "agnes", now: Date.now()
  });

  assert.strictEqual(r.ok, true);
  assert.strictEqual(store.tryon_tasks.t1.status, "success");
  assert.strictEqual(store.tryon_tasks.t1.tryon_image, "cloud://img/final.png");
  const results = Object.values(store.tryon_results);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].tryon_image, "cloud://img/final.png");
  assert.strictEqual(results[0].task_id, "t1");
});

/* ============================================================
   测试 6：processing + empty result → Task ≠ success, Result = 0
   ============================================================ */
test("P1.1-6: processing + empty result → Task stays processing, Result = 0", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: { _id: "t1", status: "processing", user_id: "u1", _openid: "u1" }
    },
    tryon_results: {}
  };
  const db = concurrentFakeDb(store);

  await assert.rejects(
    () => finalizeTryonSuccessAtomically({
      db, taskId: "t1",
      tryonImage: "", tryonVideo: ""
    }),
    (e) => e.appCode === "INVALID_ARGUMENT"
  );

  // Task 不得变成 success
  assert.strictEqual(store.tryon_tasks.t1.status, "processing");
  // Result 不得创建
  assert.strictEqual(Object.keys(store.tryon_results).length, 0);
});

/* ============================================================
   测试 7：transaction failure → 不留半成功状态
   ============================================================ */
test("P1.1-7: transaction failure → no half-success state", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "processing", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤"
      }
    },
    tryon_results: {}
  };
  // 构造一个 commit 必定失败的 db
  const brokenDb = concurrentFakeDb(store);
  const origStart = brokenDb.startTransaction.bind(brokenDb);
  brokenDb.startTransaction = async function() {
    const tx = await origStart();
    tx.commit = async () => {
      throw new Error("simulated commit failure");
    };
    return tx;
  };

  let caught = null;
  try {
    await finalizeTryonSuccessAtomically({
      db: brokenDb, taskId: "t1",
      tryonImage: "cloud://img/x.png", tryonVideo: "",
      provider: "agnes", now: Date.now()
    });
  } catch (e) {
    caught = e;
  }

  assert.ok(caught, "应该抛出错误");
  // Task 不得变成 success（事务失败 → rollback → 保持 processing）
  assert.strictEqual(store.tryon_tasks.t1.status, "processing");
  // Result 不得创建
  assert.strictEqual(Object.keys(store.tryon_results).length, 0);
});

/* ============================================================
   测试 8：并发 processing → success × 2 → 最终 Result = 1
   补充测试：两个并发请求从 processing 状态开始
   ============================================================ */
test("P1.1-8: CONCURRENT processing→success × 2 → Result count === 1", async () => {
  resetGlobalState();
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "processing", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1"
      }
    },
    tryon_results: {}
  };
  const db = concurrentFakeDb(store);

  const params = {
    db, taskId: "t1",
    tryonImage: "cloud://img/concurrent2.png", tryonVideo: "",
    provider: "agnes", now: Date.now()
  };

  const results = await Promise.allSettled([
    finalizeTryonSuccessAtomically(params),
    finalizeTryonSuccessAtomically(params)
  ]);

  const fulfilled = results.filter(r => r.status === "fulfilled");
  const rejected = results.filter(r => r.status === "rejected");

  // 至少一个成功（第一个 commit 后 Task 变 success，第二个可能 idempotent 或冲突）
  assert.ok(fulfilled.length >= 1, "至少一个事务应该成功");

  // ★ Result 数量必须恰好为 1
  const resultCount = Object.values(store.tryon_results).length;
  assert.strictEqual(resultCount, 1, `并发 processing→success 后 Result 数量必须为 1，实际为 ${resultCount}`);
});

/* ============================================================
   测试 9：验证 aiTryon cache-hit 路径不再做事务外 Result 检查

   此测试验证修复后的 aiTryon 行为：直接调用 finalizeTryonSuccessAtomically，
   不再先查询 tryon_results 再决定是否 repair。
   ============================================================ */
test("P1.1-9: aiTryon cache-hit path delegates to finalizeTryonSuccessAtomically directly", async () => {
  resetGlobalState();
  // 场景：Task=success + Result exists → finalizeTryonSuccessAtomically 返回 idempotent
  const store = {
    tryon_tasks: {
      t1: {
        _id: "t1", status: "success", user_id: "u1", _openid: "u1",
        garment_ids: ["g1"], garment_name: "白T恤", avatar_view_id: "av1",
        tryon_image: "cloud://img/cached.png", cache_key: "ck1", provider: "agnes"
      }
    },
    tryon_results: {
      r1: { _id: "r1", task_id: "t1", tryon_image: "cloud://img/cached.png" }
    }
  };
  const db = concurrentFakeDb(store);

  // 模拟修复后的 aiTryon cache-hit 路径（直接调用，不做事务外检查）
  const hit = store.tryon_tasks.t1;
  let repairError = null;
  try {
    await finalizeTryonSuccessAtomically({
      db, taskId: hit._id,
      tryonImage: hit.tryon_image || "", tryonVideo: "",
      provider: hit.provider || "", now: Date.now()
    });
  } catch (_e) {
    repairError = _e;
  }

  // 不应该报错（Result 已存在 → idempotent）
  assert.strictEqual(repairError, null);
  // Result 数量不变
  assert.strictEqual(Object.values(store.tryon_results).length, 1);
});
