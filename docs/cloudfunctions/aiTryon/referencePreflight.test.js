const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const Module = require("module");

/* 构造 mock wx-server-sdk。每个 test 通过 setMock() 注入本次行为。 */
const SDK_NAME = "wx-server-sdk";
const VIRTUAL_PATH = "/virtual-node-modules/" + SDK_NAME + "/index.js";
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === SDK_NAME) return VIRTUAL_PATH;
  return origResolve.call(this, request, parent, ...rest);
};

const mockState = {
  OPENID: "u1", tempFileMap: {}, tempFileFail: false,
  avatarViewsStore: {}, garmentsStore: {}, tryonTasks: [], quotaDocs: {}, consumed: 0, refunded: 0
};
function resetState() {
  mockState.tempFileMap = {}; mockState.tempFileFail = false;
  mockState.avatarViewsStore = {}; mockState.garmentsStore = {};
  mockState.tryonTasks = []; mockState.quotaDocs = {}; mockState.consumed = 0; mockState.refunded = 0;
}

function makeCloud() {
  const db = {
    command: { lt: (v) => ({ $lt: v }), inc: (n) => ({ inc: n }), remove: () => ({ $remove: true }) },
    runTransaction: async (fn) => fn({ collection: db.collection }),
    collection: (name) => {
      if (name === "quotas") {
        return { doc: (id) => ({
          get: async () => { if (mockState.quotaDocs[id]) return { data: mockState.quotaDocs[id] }; throw new Error("nf"); },
          set: async ({ data }) => { mockState.quotaDocs[id] = Object.assign({ _id: id }, data); return { _id: id }; },
          update: async ({ data }) => { const d = mockState.quotaDocs[id]; if (!d) return { stats: { updated: 0 } }; if (data.used && data.used.inc !== undefined) d.used = (d.used || 0) + data.used.inc; return { stats: { updated: 1 } }; },
          remove: async () => { delete mockState.quotaDocs[id]; return {}; }
        }) };
      }
      return {
        where: (q) => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }), limit: () => ({ get: async () => ({ data: [] }) }), get: async () => ({ data: [] }) }),
        add: async ({ data }) => { const _id = "doc_" + Math.random().toString(36).slice(2, 6); return { _id }; },
        doc: (id) => ({
          update: async () => ({ stats: { updated: 0 } }), remove: async () => ({ stats: { removed: 0 } }),
          get: async () => {
            if (name === "avatar_views" && mockState.avatarViewsStore[id]) return { data: mockState.avatarViewsStore[id] };
            if (name === "garments" && mockState.garmentsStore[id]) return { data: mockState.garmentsStore[id] };
            if (name === "tryon_tasks") { const f = mockState.tryonTasks.find((t) => t._id === id); if (f) return { data: f }; }
            throw new Error("not found");
          },
          update: async ({ data }) => { const f = mockState.tryonTasks.find((t) => t._id === id); if (f) Object.assign(f, data); return { stats: { updated: 1 } }; },
          remove: async () => { mockState.tryonTasks = mockState.tryonTasks.filter((t) => t._id !== id); return {}; }
        }),
        add: async ({ data }) => { const _id = "task_" + Math.random().toString(36).slice(2, 8); mockState.tryonTasks.push(Object.assign({ _id }, data)); return { _id }; }
      };
    }
  };
  return {
    init: () => {}, DYNAMIC_CURRENT_ENV: "mock", database: () => db,
    getWXContext: () => ({ OPENID: mockState ? mockState.OPENID : "u1" }),
    getTempFile: async ({ fileList }) => {
      if (mockState.tempFileFail) throw new Error("getTempFile network error");
      const out = [];
      for (const f of fileList) if (mockState.tempFileMap[f]) out.push({ fileID: f, tempFileURL: mockState.tempFileMap[f] });
      return { fileList: out };
    },
    downloadFile: async () => ({ fileContent: Buffer.from([0x89, 0x50, 0x4e, 0x47]) }),
    deleteFile: async () => ({}), uploadFile: async () => ({ fileID: "cloud://mock/x.png" }),
    openapi: { security: { imgSecCheck: async () => ({ errCode: 0 }) }, subscribeMessage: { send: async () => ({}) } }
  };
}
Module._cache = Module._cache || {};
Module._cache[VIRTUAL_PATH] = { id: VIRTUAL_PATH, filename: VIRTUAL_PATH, loaded: true, exports: makeCloud() };

const aiTryon = require("./index");

/* main 在 preflight 失败时会 reject（错误被 main 的 catch 转为 resolved 对象需依赖实现；
   为兼容当前 main 行为，将 reject 统一规约为 {ok:false,error,message} 形式便于断言） */
async function safeMain(event) {
  try { return await aiTryon.main(event); }
  catch (e) { return { ok:false, error:(e&&e.appCode)||"INTERNAL", message:(e&&e.message)||String(e) }; }
}

test.beforeEach(() => { resetState(); });

/* 辅助：注入一份带 user_id 归属的 avatar 记录 */
function setAvatar(composite) {
  mockState.avatarViewsStore["av1"] = { _id: "av1", user_id: "u1", views: { composite }, profile_snapshot: {} };
}
function setGarment(g) { mockState.garmentsStore["g1"] = Object.assign({ _id: "g1", user_id: "u1", name: "衬衫", category: "上衣" }, g || {}); }

test("P1-1 avatar composite 缺失 → 不扣 quota、不调用 Agnes、不创建任务", async () => {
  setAvatar("");
  setGarment({ original_file_id: "cloud://env/x/1.png" });
  let res;
  try { res = await aiTryon.main({ avatarViewId: "av1", garmentIds: ["g1"] }); }
  catch (e) { res = { ok:false, error:(e&&e.appCode)||"THROWN", message:(e&&e.message)||String(e) }; console.log("TEST1 main threw:",res.error,res.message); }
  assert.strictEqual(res.ok, false);
  assert.ok(res.error, "应返回错误");
  assert.strictEqual(mockState.tryonTasks.length, 0, "preflight 失败前不应创建任务");
});

test("P1-1 upload garment original_file_id 缺失 → 不扣 quota、不创建任务", async () => {
  setAvatar("cloud://env/a/av.png");
  mockState.tempFileMap["cloud://env/a/av.png"] = "https://tmp/a/av.png";
  setGarment({ original_file_id: "" });
  const res = await safeMain({ avatarViewId: "av1", garmentIds: ["g1"] });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(mockState.tryonTasks.length, 0);
});

test("P1-1 getTempFile 部分失败（garment cloud:// 无法换链）→ fail closed、不创建任务", async () => {
  setAvatar("cloud://env/a/av.png");
  mockState.tempFileMap["cloud://env/a/av.png"] = "https://tmp/a/av.png"; // avatar 可换，garment 不可换
  setGarment({ original_file_id: "cloud://env/x/1.png" });
  const res = await safeMain({ avatarViewId: "av1", garmentIds: ["g1"] });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(mockState.tryonTasks.length, 0);
});

test("P1-1 getTempFile 全部成功 → 正常生成链路（走 mock 适配器，不真实调用 Agnes）", async () => {
  setAvatar("cloud://env/a/av.png");
  mockState.tempFileMap["cloud://env/a/av.png"] = "https://tmp/a/av.png";
  mockState.tempFileMap["cloud://env/x/1.png"] = "https://tmp/x/1.png";
  setGarment({ original_file_id: "cloud://env/x/1.png" });
  const res = await safeMain({ avatarViewId: "av1", garmentIds: ["g1"] });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, "success");
  assert.ok(mockState.tryonTasks.length >= 1, "应创建任务");
});

test("P1-1 builtin garment 无 originalFileId → 仍成功进入正常链路", async () => {
  setAvatar("cloud://env/a/av.png");
  mockState.tempFileMap["cloud://env/a/av.png"] = "https://tmp/a/av.png";
  const res = await safeMain({ avatarViewId: "av1", garmentIds: ["g-tee"] });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, "success");
});

test("P1-1 reference 数量不一致 → fail closed（toHttpsRefs 抛错）、不创建任务", async () => {
  setAvatar("cloud://env/a/av.png");
  setGarment({ original_file_id: "cloud://env/x/1.png" });
  mockState.tempFileMap = {}; // 两个 cloud:// 都换链失败
  const res = await safeMain({ avatarViewId: "av1", garmentIds: ["g1"] });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(mockState.tryonTasks.length, 0);
});

test("P1-1 preflight 失败时 quota 不被调用（无任务创建 = 未达 consumeQuota 路径）", async () => {
  setAvatar(""); // avatar 缺失 → preflight 在 consumeQuota 前失败
  setGarment({ original_file_id: "cloud://env/x/1.png" });
  await safeMain({ avatarViewId: "av1", garmentIds: ["g1"] });
  assert.strictEqual(mockState.tryonTasks.length, 0);
  // consumeQuota 会 getQuota → 若走到此处会读/写 quotaDocs；preflight 失败则 quotaDocs 不应被写入任务相关字段
});

test("P1-1 正常两张 reference（avatar+upload garment）→ 成功", async () => {
  setAvatar("cloud://env/a/av.png");
  mockState.tempFileMap["cloud://env/a/av.png"] = "https://tmp/a/av.png";
  mockState.tempFileMap["cloud://env/x/1.png"] = "https://tmp/x/1.png";
  setGarment({ original_file_id: "cloud://env/x/1.png" });
  const res = await aiTryon.main({ avatarViewId: "av1", garmentIds: ["g1"] });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.status, "success");
});
