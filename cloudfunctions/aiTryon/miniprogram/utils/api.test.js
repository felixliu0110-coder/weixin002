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
  const methods = ["getAvatarProfile", "saveAvatarProfile", "getGarmentTemplates", "getGarmentLibrary", "getMyTemplates", "addToMyTemplates", "getHomeTemplates", "uploadGarment", "getMyGarments", "deleteMyGarments", "submitTryon", "getTryonStatus", "getHistory", "getFavorites", "deleteItems", "saveToTemplates", "recognizeGarment", "getQuota", "getUserInfo", "saveUserInfo", "logout", "saveResult", "deleteUserData", "createAvatarViews", "getAvatarViews", "ensureGarmentViews", "submitAiTryon", "getAiTryonStatus", "saveAiResult", "updateGarment"];
  methods.forEach((m) => assert.strictEqual(typeof api[m], "function", m + " missing"));
});

test("getMyGarments/deleteMyGarments 走 mock（mockEnabled）", async () => {
  await api.uploadGarment("cloud://mock/y.png", { name: "API测试衣", category: "裤子" });
  const list = await api.getMyGarments();
  const mine = list.filter((g) => g.name === "API测试衣");
  assert.strictEqual(mine.length, 1);
  assert.strictEqual(mine[0].image, "cloud://mock/y.png");
  await api.deleteMyGarments(mine.map((g) => g.id));
  const after = await api.getMyGarments();
  assert.ok(!after.some((g) => g.name === "API测试衣"));
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

test("getMyGarments 返回含 size_label / measurements 的完整字段", async () => {
  const item = await api.uploadGarment("cloud://mock/g.png", { name: "测试上衣", category: "上衣" });
  const list = await api.getMyGarments();
  const found = list.find((g) => g.id === item.id);
  assert.ok(found);
  assert.strictEqual(found.name, "测试上衣");
  assert.strictEqual(found.category, "上衣");
  assert.strictEqual(found.size_label, undefined);
  assert.strictEqual(found.measurements, undefined);
});

test("updateGarment 保存并读取 size_label 和 measurements", async () => {
  const item = await api.uploadGarment("cloud://mock/g2.png", { name: "更新测试衣", category: "上衣" });
  const updated = await api.updateGarment(item.id, {
    size_label: "M",
    measurements: { lengthCm: 72, chestWidthCm: 54 }
  });
  assert.strictEqual(updated.size_label, "M");
  assert.strictEqual(updated.measurements.lengthCm, 72);
  assert.strictEqual(updated.measurements.chestWidthCm, 54);
  const list = await api.getMyGarments();
  const persisted = list.find((g) => g.id === item.id);
  assert.strictEqual(persisted.size_label, "M");
  assert.strictEqual(persisted.measurements.lengthCm, 72);
});
