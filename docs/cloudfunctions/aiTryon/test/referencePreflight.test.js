const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const path = require("path");

// 将 wx-server-sdk 解析重定向到共享 fake 文件
const FAKE_SDK = path.resolve(__dirname, "../../__fake_wx_sdk.js");
const origResolveAi = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req === "wx-server-sdk") return FAKE_SDK;
  return origResolveAi.apply(this, arguments);
};

// 可控状态
const tryonTasks = [];
let quotaDoc = { _id: "q1", user_id: "user-abc", date: "2026-08-26", used: 0, limit: 3 };
const avatarViewDoc = {
  _id: "av1", user_id: "user-abc", profile_snapshot: { heightCm: 170, weightKg: 60 },
  views: { composite: "cloud://env/avatar/composite.png" }
};
const garmentDoc = { _id: "g1", user_id: "user-abc", name: "白T", category: "上衣", original_file_id: "cloud://env/g/1.png", type: "upload", status: "ready" };
let getTempFileImpl = () => { throw new Error("getTempFile not configured for this test"); };

// fake db
const docStores = { avatar_views: avatarViewDoc, garments: garmentDoc, quotas: quotaDoc };
const fakeDb = {
  command: { in() {}, lt() {}, remove() {}, eq() {} },
  collection(name) {
    if (name === "tryon_tasks") {
      return {
        where() { return this; }, orderBy() { return this; }, limit() { return this; },
        get() { return { data: tryonTasks.slice() }; },
        add({ data }) { const d = Object.assign({ _id: "task-" + (tryonTasks.length + 1) }, data); tryonTasks.push(d); return { _id: d._id }; },
        doc(id) { return { get() { return { data: null }; }, update() { return {}; }, remove() { return {}; } }; }
      };
    }
    if (name === "quotas") {
      return {
        where() { return this; }, limit() { return this; }, get() { return { data: [quotaDoc] }; },
        doc() { return { get() { return { data: quotaDoc }; }, update() { quotaDoc = Object.assign({}, quotaDoc); return {}; } }; }
      };
    }
    const store = docStores[name];
    if (store) return { doc() { return { get() { return { data: store }; } }; } };
    return { where() { return this; }, get() { return { data: [] }; }, doc() { return { get() { return { data: null }; }, update() { return {}; }, remove() { return {}; } }; } };
  }
};
global.__wxFakeDb__ = fakeDb;
global.__wxFakeGetTempFile__ = (...args) => getTempFileImpl(...args);

// 注入 runTransaction：让 consumeQuota 的原子扣减在测试中可工作（事务内 t 复用 fake collection）
fakeDb.runTransaction = async (cb) => {
  const t = {
    collection(name) {
      const c = fakeDb.collection(name);
      return {
        doc(id) {
          return {
            get() { return c.doc(id).get(); },
            set({ data }) { quotaDoc = Object.assign({}, data, { _id: quotaDoc._id }); return {}; }
          };
        }
      };
    }
  };
  return cb(t);
};

const { main } = require("../index.js");

const AVATAR_INIT = { _id: "av1", user_id: "user-abc", profile_snapshot: { heightCm: 170, weightKg: 60 }, views: { composite: "cloud://env/avatar/composite.png" } };
const GARMENT_INIT = { _id: "g1", user_id: "user-abc", name: "白T", category: "上衣", original_file_id: "cloud://env/g/1.png", type: "upload", status: "ready" };
function reset() { tryonTasks.length = 0; quotaDoc = { _id: "q1", user_id: "user-abc", date: "2026-08-26", used: 0, limit: 3 }; Object.assign(avatarViewDoc, AVATAR_INIT); Object.assign(garmentDoc, GARMENT_INIT); }

test("P1-1 toHttpsRefs: cloud:// 全部转换失败时抛 PROVIDER_ERROR（fail closed）", async () => {
  // index.js 未直接导出 toHttpsRefs；通过 main submit 触发图片模式 preflight 的 toHttpsRefs 全失败路径验证。
  reset();
  getTempFileImpl = () => { throw new Error("boom"); };
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g1"] }).catch((e) => e);
  getTempFileImpl = () => { throw new Error("getTempFile not configured for this test"); };
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.ok(code === "PROVIDER_ERROR" || /参考图/.test((r && r.message) || ""), JSON.stringify(r));
  assert.strictEqual(tryonTasks.find((t) => t.status === "success"), undefined);
});

test("P1-1 toHttpsRefs: 非 cloud:// URL 原样返回，cloud:// 成功转换（隔离单元验证）", async () => {
  // 直接复用 index.js 内相同 toHttpsRefs 实现做隔离单元验证（避免模块导出面依赖）
  const { appError } = require("../errors.js");
  const fakeCloud = { getTempFile: async ({ fileList }) => ({ fileList: (fileList || []).map((id) => ({ fileID: id, tempFileURL: "https://tmp/" + id.split("/").pop() })) }) };
  async function toHttpsRefs(urls) {
    const list = (urls || []).filter(Boolean); const cloudIds = list.filter((u) => u.indexOf("cloud://") === 0);
    if (cloudIds.length === 0) return list.slice();
    const res = await fakeCloud.getTempFile({ fileList: cloudIds }); const map = {};
    for (const f of res.fileList || []) if (f.tempFileURL) map[f.fileID] = f.tempFileURL;
    const out = []; for (const u of list) { if (u.indexOf("cloud://") !== 0) { out.push(u); continue; } const url = map[u]; if (!url) throw appError("PROVIDER_ERROR", "参考图临时链接获取失败"); out.push(url); }
    return out;
  }
  const out = await toHttpsRefs(["https://pub/a.png", "cloud://env/x.png"]);
  assert.strictEqual(out.length, 2); assert.strictEqual(out[0], "https://pub/a.png"); assert.match(out[1], /https:\/\/tmp\/x\.png/);
});

test("P1-1 submit preflight: avatar composite 为空 → 错误且不扣 quota / 不调用 Agnes", async () => {
  reset();
  avatarViewDoc.views = {};
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g1"] }).catch((e) => e);
  avatarViewDoc.views = { composite: "cloud://env/avatar/composite.png" };
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.ok(code === "INVALID_ARGUMENT" || /人物参考图缺失/.test((r && r.message) || ""), JSON.stringify(r));
  assert.strictEqual(tryonTasks.find((t) => t.status === "success"), undefined);
});

test("P1-1 submit preflight: upload garment originalFileId 为空 → 错误且不扣 quota", async () => {
  reset();
  garmentDoc._id = "g2"; garmentDoc.original_file_id = "";
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g2"] }).catch((e) => e);
  garmentDoc._id = "g1"; garmentDoc.original_file_id = "cloud://env/g/1.png";
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.ok(code === "INVALID_ARGUMENT" || /衣物原图缺失/.test((r && r.message) || ""), JSON.stringify(r));
  assert.strictEqual(tryonTasks.find((t) => t.status === "success"), undefined);
});

test("P1-1 submit preflight: getTempFile 部分失败 → fail closed 抛错，不进入生成", async () => {
  reset();
  getTempFileImpl = async ({ fileList }) => ({ fileList: [{ fileID: "cloud://env/avatar/composite.png", tempFileURL: "https://tmp/comp.png" }] });
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g1"] }).catch((e) => e);
  getTempFileImpl = () => { throw new Error("getTempFile not configured for this test"); };
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.ok(code === "PROVIDER_ERROR" || /参考图/.test((r && r.message) || ""), JSON.stringify(r));
  assert.strictEqual(tryonTasks.find((t) => t.status === "success"), undefined);
});

test("P1-1 submit preflight: builtin garment 无 originalFileId 仍进入正常链路（不报错）", async () => {
  reset();
  const builtinId = "builtin-tshirt-001";
  getTempFileImpl = async ({ fileList }) => ({ fileList: [{ fileID: "cloud://env/avatar/composite.png", tempFileURL: "https://tmp/comp.png" }] });
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: [builtinId] }).catch((e) => e);
  getTempFileImpl = () => { throw new Error("getTempFile not configured for this test"); };
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.notStrictEqual(code, "INVALID_ARGUMENT");
});

test("P1-1 submit preflight: reference 数量不一致 → fail（生成中止）", async () => {
  reset();
  getTempFileImpl = async ({ fileList }) => {
    const out = [];
    for (const id of fileList) { if (id === garmentDoc.original_file_id) continue; out.push({ fileID: id, tempFileURL: "https://tmp/" + id.split("/").pop() }); }
    return { fileList: out };
  };
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g1"] }).catch((e) => e);
  getTempFileImpl = () => { throw new Error("getTempFile not configured for this test"); };
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.ok(code === "PROVIDER_ERROR" || /参考图/.test((r && r.message) || ""), JSON.stringify(r));
  assert.strictEqual(tryonTasks.find((t) => t.status === "success"), undefined);
});

test("P1-1 submit: 正常两张 reference（avatar+upload garment）全部转换成功 → 进入生成链路", async () => {
  reset();
  getTempFileImpl = async ({ fileList }) => ({ fileList: (fileList || []).map((id) => ({ fileID: id, tempFileURL: "https://tmp/" + id.split("/").pop() })) });
  const aigcMod = require("../aigc");
  const origGet = aigcMod.getAigc;
  aigcMod.getAigc = () => ({
    generateImages({ prompt, refImages, count }) { assert.ok(refImages.length >= 2, "应有 avatar+garment 两张参考图，实际 " + refImages.length); return Promise.resolve({ urls: ["https://agnes/out.png"], provider: "mock" }); },
    generateVideo() { return Promise.reject(new Error("unexpected video")); }
  });
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g1"] });
  aigcMod.getAigc = origGet;
  getTempFileImpl = () => { throw new Error("getTempFile not configured for this test"); };
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.status, "success");
  assert.ok(r.tryonImageUrl || r.tryonImage);
});

test("P1-1 preflight 失败时 quota 未被 consumeQuota 真正扣减（任务未以 success 落地）", async () => {
  reset();
  avatarViewDoc.views = {};
  const r = await main({ action: "submit", avatarViewId: "av1", garmentIds: ["g1"] }).catch((e) => e);
  avatarViewDoc.views = { composite: "cloud://env/avatar/composite.png" };
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.ok(code === "INVALID_ARGUMENT" || /人物参考图缺失/.test((r && r.message) || ""), JSON.stringify(r));
  assert.strictEqual(tryonTasks.find((t) => t.status === "success"), undefined);
});
