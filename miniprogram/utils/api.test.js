const test = require("node:test");
const assert = require("node:assert");
const api = require("./api");

test("api.getAvatarProfile 返回档案（mock 实现）", async () => {
  const profile = await api.getAvatarProfile();
  assert.strictEqual(profile.heightCm, 165);
});

test("api 暴露全部数据访问方法", () => {
  const methods = ["getAvatarProfile", "saveAvatarProfile", "getGarmentTemplates", "getHomeTemplates", "uploadGarment", "submitTryon", "getTryonStatus", "getHistory", "getFavorites", "getQuota", "saveResult", "deleteUserData"];
  methods.forEach((m) => assert.strictEqual(typeof api[m], "function", m + " missing"));
});
