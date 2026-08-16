const test = require("node:test");
const assert = require("node:assert");
const api = require("./api");

test("api.getAvatarProfile 返回档案（mock 实现）", async () => {
  const profile = await api.getAvatarProfile();
  assert.strictEqual(profile.heightCm, 165);
});

test("api 暴露全部数据访问方法", () => {
  const methods = ["getAvatarProfile", "saveAvatarProfile", "getGarmentTemplates", "getGarmentLibrary", "getMyTemplates", "addToMyTemplates", "getHomeTemplates", "uploadGarment", "submitTryon", "getTryonStatus", "getHistory", "getFavorites", "deleteItems", "saveToTemplates", "recognizeGarment", "getQuota", "getUserInfo", "saveUserInfo", "logout", "saveResult", "deleteUserData", "createAvatarViews", "getAvatarViews", "ensureGarmentViews", "submitAiTryon", "getAiTryonStatus", "saveAiResult"];
  methods.forEach((m) => assert.strictEqual(typeof api[m], "function", m + " missing"));
});

test("isMockResult 识别云函数占位结果", () => {
  assert.strictEqual(api.isMockResult({ provider: "mock", views: { composite: "https://placeholder.example.com/mock.jpg" } }), true);
  assert.strictEqual(api.isMockResult({ provider: "agnes", views: { composite: "https://cdn.example.com/real.jpg" } }), false);
  assert.strictEqual(api.isMockResult(null), true);
});
