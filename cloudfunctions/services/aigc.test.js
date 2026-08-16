const test = require("node:test");
const assert = require("node:assert");
const { getAigc } = require("./aigc");
const mock = require("./aigc/mock");
const jimeng = require("./aigc/jimeng");

test("未配置 Key 时 getAigc 返回 mock", () => {
  delete process.env.JIMENG_API_KEY;
  delete process.env.AIGC_API_KEY;
  assert.strictEqual(getAigc().name, "mock");
});

test("配置 JIMENG_API_KEY 时 getAigc 返回 jimeng", () => {
  process.env.JIMENG_API_KEY = "test-key";
  assert.strictEqual(getAigc().name, "jimeng");
  delete process.env.JIMENG_API_KEY;
});

test("jimeng 未配置时抛 AIGC_NOT_CONFIGURED", async () => {
  delete process.env.JIMENG_API_KEY;
  delete process.env.AIGC_API_KEY;
  await assert.rejects(() => jimeng.generateImages({}), (e) => e.code === "AIGC_NOT_CONFIGURED");
});

test("mock.generateImages 返回指定数量占位 URL", async () => {
  const res = await mock.generateImages({ count: 3 });
  assert.strictEqual(res.urls.length, 3);
  assert.strictEqual(res.provider, "mock");
});
