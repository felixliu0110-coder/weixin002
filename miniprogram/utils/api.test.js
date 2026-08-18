const test = require("node:test");
const assert = require("node:assert");
const config = require("../config");
// 测试环境显式开启 Mock（生产永不 fallback）
config.mockEnabled = true;
const api = require("./api");

test("api.getAvatarProfile 返回档案（mock 实现）", async () => {
  const profile = await api.getAvatarProfile();
  assert.strictEqual(profile.heightCm, 165);
});

test("api 暴露全部数据访问方法", () => {
  const methods = ["getAvatarProfile", "saveAvatarProfile", "getGarmentTemplates", "getGarmentLibrary", "getMyTemplates", "addToMyTemplates", "getHomeTemplates", "uploadGarment", "submitTryon", "getTryonStatus", "getHistory", "getFavorites", "deleteItems", "saveToTemplates", "recognizeGarment", "getQuota", "getUserInfo", "saveUserInfo", "logout", "saveResult", "deleteUserData", "createAvatarViews", "getAvatarViews", "ensureGarmentViews", "submitAiTryon", "getAiTryonStatus", "saveAiResult"];
  methods.forEach((m) => assert.strictEqual(typeof api[m], "function", m + " missing"));
});

test("production（mockEnabled=false 且无云环境）不 fallback，直接抛服务错误", async () => {
  const saved = config.mockEnabled;
  config.mockEnabled = false;
  try {
    await assert.rejects(() => api.getHistory(), (e) => e.appCode === "SERVICE_UNAVAILABLE");
    await assert.rejects(() => api.submitAiTryon({}), (e) => e.appCode === "SERVICE_UNAVAILABLE");
  } finally {
    config.mockEnabled = saved;
  }
});

test("isMockResult 识别云函数占位结果", () => {
  assert.strictEqual(api.isMockResult({ provider: "mock", views: { composite: "https://placeholder.example.com/mock.jpg" } }), true);
  assert.strictEqual(api.isMockResult({ provider: "agnes", views: { composite: "https://cdn.example.com/real.jpg" } }), false);
  assert.strictEqual(api.isMockResult(null), true);
});

test("isPublicHttpUrl 仅接受公网 http(s) URL", () => {
  assert.strictEqual(api.isPublicHttpUrl("https://platform-outputs.agnes-ai.space/a.png"), true);
  assert.strictEqual(api.isPublicHttpUrl("http://example.com/a.png"), true);
  assert.strictEqual(api.isPublicHttpUrl("/assets/img/p06-tee.jpg"), false);
  assert.strictEqual(api.isPublicHttpUrl("cloud://env/a.png"), false);
  assert.strictEqual(api.isPublicHttpUrl(""), false);
});
