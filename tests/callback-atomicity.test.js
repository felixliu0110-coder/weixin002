/* Phase 5-3-B-3 边界测试：tryon task / result 原子一致性
   使用本地 mock db，不联网、不调真实 AI。运行：node tests/callback-atomicity.test.js */
const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

// 内联 mock 依赖
const appError = (code, msg) => { const e = new Error(msg || code); e.code = code; return e; };
const assertTransition = (from, to) => {
  const allowed = { queued: ["processing", "failed", "cancelled"], processing: ["success", "failed", "cancelled"] };
  if (from === to) return;
  if (!allowed[from] || !allowed[from].includes(to)) throw appError("INVALID_STATE_TRANSITION");
};
const requireString = (v) => v, requireEnum = (v) => v;

// 通过 vm 加载磁盘上的真实 callback.js，注入 mock 依赖
const src = fs.readFileSync(__dirname + "/../cloudfunctions/services/callback.js", "utf8");
const moduleObj = { exports: {} };
const sandbox = {
  require: () => ({ appError, assertTransition, requireString, requireEnum }),
  module: moduleObj,
  exports: moduleObj.exports,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const { handleCallback } = moduleObj.exports;

function makeDb(tasks, results) {
  const _t = { ...tasks };
  const _r = (results || []).slice();
  return {
    _tasks: _t, _results: _r,
    collection(name) {
      return {
        doc(id) {
          return {
            get: async () => ({ data: _t[id] }),
            update: async (arg) => { _t[id] = { ..._t[id], ...arg.data }; },
          };
        },
        where(q) {
          return {
            limit() {
              return {
                get: async () => {
                  const k = Object.keys(q)[0];
                  return { data: _r.filter((x) => x[k] === q[k]) };
                },
              };
            },
          };
        },
        add: async (arg) => {
          const row = { ...arg.data, _id: "r" + _r.length };
          _r.push(row);
          return { _id: row._id };
        },
      };
    },
  };
}
const baseTask = (o = {}) => ({ _openid: "o1", user_id: "u1", status: "processing", avatar_view_id: "av1", garment_ids: ["g1"], ...o });

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test("syntax: callback.js 可被解析执行", () => { assert.ok(handleCallback); });

test("1. processing→success + 有图片 → Task=success, Result 创建", async () => {
  const db = makeDb({ t1: baseTask() });
  await handleCallback({ db, taskId: "t1", status: "success", result: { tryonImage: "http://i.png" } });
  assert.strictEqual(db._tasks.t1.status, "success");
  assert.strictEqual(db._results.length, 1);
});

test("2. processing→success + 有视频 → Task=success", async () => {
  const db = makeDb({ t2: baseTask() });
  await handleCallback({ db, taskId: "t2", status: "success", result: { tryonVideo: "http://v.mp4" } });
  assert.strictEqual(db._tasks.t2.status, "success");
  assert.strictEqual(db._results[0].tryon_video, "http://v.mp4");
});

test("3. success + 图片/视频都为空 → Task 不得变成 success", async () => {
  const db = makeDb({ t3: baseTask({ status: "processing" }) });
  try { await handleCallback({ db, taskId: "t3", status: "success", result: {} }); assert.fail("应抛错"); }
  catch (e) { assert.strictEqual(e.code, "INVALID_ARGUMENT"); }
  assert.strictEqual(db._tasks.t3.status, "processing");
  assert.strictEqual(db._results.length, 0);
});

test("4. 失败(+无结果)后，再 success(+真实图片) → 必须成功补建", async () => {
  const db = makeDb({ t4: baseTask({ status: "processing" }) });
  try { await handleCallback({ db, taskId: "t4", status: "success", result: {} }); }
  catch (e) { assert.strictEqual(e.code, "INVALID_ARGUMENT"); }
  assert.strictEqual(db._tasks.t4.status, "processing");
  await handleCallback({ db, taskId: "t4", status: "success", result: { tryonImage: "http://real.png" } });
  assert.strictEqual(db._tasks.t4.status, "success");
  assert.strictEqual(db._results.length, 1);
  assert.strictEqual(db._results[0].tryon_image, "http://real.png");
});

test("5. success 重复 callback → 幂等 (idempotent=true)", async () => {
  const db = makeDb({ t5: baseTask() });
  await handleCallback({ db, taskId: "t5", status: "success", result: { tryonImage: "http://i.png" } });
  const r2 = await handleCallback({ db, taskId: "t5", status: "success", result: { tryonImage: "http://i.png" } });
  assert.strictEqual(r2.idempotent, true);
});

test("6. Result 按 task_id 去重 → 只存在一条", async () => {
  const db = makeDb({ t6: baseTask() });
  await handleCallback({ db, taskId: "t6", status: "success", result: { tryonImage: "http://a.png" } });
  await handleCallback({ db, taskId: "t6", status: "success", result: { tryonImage: "http://a.png" } });
  assert.strictEqual(db._results.filter((x) => x.task_id === "t6").length, 1);
});

test("7. created_at/createdAt/updated_at 契约保留", async () => {
  const db = makeDb({ t7: baseTask() });
  await handleCallback({ db, taskId: "t7", status: "success", result: { tryonImage: "http://i.png" } });
  const res = db._results.find((x) => x.task_id === "t7");
  assert.ok("created_at" in res && "createdAt" in res && "updated_at" in res);
});

test("8. 验证前不得写 Task：空结果抛错时 Task 状态未变", async () => {
  const db = makeDb({ t8: baseTask({ status: "processing" }) });
  try { await handleCallback({ db, taskId: "t8", status: "success", result: { tryonImage: "", tryonVideo: "" } }); }
  catch (e) { assert.strictEqual(e.code, "INVALID_ARGUMENT"); }
  assert.strictEqual(db._tasks.t8.status, "processing");
});

(async () => {
  let pass = 0, fail = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log("  ✓", name); pass++; }
    catch (e) { console.log("  ✗", name, "\n     ", e.message); fail++; }
  }
  console.log(`\n结果: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
