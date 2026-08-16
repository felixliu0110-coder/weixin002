const test = require("node:test");
const assert = require("node:assert");
const { saveRemoteImage } = require("./storage");

test("saveRemoteImage 对 cloud:// 直接返回不重复下载", async () => {
  const id = "cloud://env.x/ai/1.png";
  const r = await saveRemoteImage(id, "tryon");
  assert.strictEqual(r, id);
});

test("saveRemoteImage 对空/缺失 URL 返回原值", async () => {
  assert.strictEqual(await saveRemoteImage("", "tryon"), "");
  assert.strictEqual(await saveRemoteImage(undefined, "tryon"), undefined);
});
