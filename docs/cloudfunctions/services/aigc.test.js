const test = require("node:test");
const assert = require("node:assert");
const { getAigc } = require("./aigc");
const mock = require("./aigc-mock");
const agnes = require("./aigc-agnes");

function clearKeys() {
  delete process.env.AGNES_API_KEY;
  delete process.env.JIMENG_API_KEY;
  delete process.env.AIGC_API_KEY;
}

test("未配置 Key 时 getAigc 返回 mock", () => {
  clearKeys();
  assert.strictEqual(getAigc().name, "mock");
});

test("配置 AGNES_API_KEY 时 getAigc 返回 agnes", () => {
  clearKeys();
  process.env.AGNES_API_KEY = "test-key";
  assert.strictEqual(getAigc().name, "agnes");
  clearKeys();
});

test("agnes 未配置时抛 AIGC_NOT_CONFIGURED", async () => {
  clearKeys();
  await assert.rejects(() => agnes.generateImages({}), (e) => e.code === "AIGC_NOT_CONFIGURED");
  await assert.rejects(() => agnes.generateVideo({}), (e) => e.code === "AIGC_NOT_CONFIGURED");
});

test("agnes.isContentRejected 识别 400 Unable to generate（内容安全概率性拒绝）", () => {
  const e = { statusCode: 400, message: "Unable to generate this content" };
  assert.strictEqual(agnes.isContentRejected(e), true);
  assert.strictEqual(agnes.isContentRejected({ statusCode: 429, message: "rate limit" }), false);
  assert.strictEqual(agnes.isContentRejected({ statusCode: 500, message: "boom" }), false);
});

test("mock.generateImages 返回指定数量占位 URL", async () => {
  const res = await mock.generateImages({ count: 3 });
  assert.strictEqual(res.urls.length, 3);
  assert.strictEqual(res.provider, "mock");
});

test("mock.generateVideo 同步返回占位视频", async () => {
  const res = await mock.generateVideo({});
  assert.strictEqual(res.provider, "mock");
  assert.ok(res.videoUrl);
  assert.strictEqual(res.videoTaskId, undefined);
});
