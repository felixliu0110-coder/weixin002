const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");
const path = require("path");

// 将 wx-server-sdk 解析重定向到共享 fake 文件
const FAKE_SDK = path.resolve(__dirname, "../../__fake_wx_sdk.js");
const origResolveUg = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req === "wx-server-sdk") return FAKE_SDK;
  return origResolveUg.apply(this, arguments);
};

const fakeDb = {
  collection(name) {
    if (name === "garments") return { add({ data }) { return { _id: "garment-new-1" }; } };
    return { where() { return this; }, get() { return { data: [] }; }, doc() { return { get() { return { data: null }; }, update() { return {}; }, remove() { return {}; } }; } };
  }
};
global.__wxFakeDb__ = fakeDb;

const calls = { imgSecCheck: [] };
// imgSecCheck mock：返回 errCode 0（内容合规），并记录收到的 media
global.__wxFakeDownloadFile__ = function ({ fileID }) {
  if (fileID === "cloud://env/j.jpg") return { fileContent: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]) };
  if (fileID === "cloud://env/p.png") return { fileContent: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) };
  if (fileID === "cloud://env/w.webp") return { fileContent: Buffer.from("RIFF\x00\x00\x00\x00WEBP", "ascii") };
  if (fileID === "cloud://env/bad.bin") return { fileContent: Buffer.from([0x00, 0x01, 0x02, 0x03]) };
  if (fileID === "cloud://env/short") return { fileContent: Buffer.from([0xFF, 0xD8]) };
  return { fileContent: Buffer.alloc(0) };
};
global.__wxFakeImgSecCheck__ = function ({ media }) { calls.imgSecCheck.push(media); return { errCode: 0 }; };

const { main } = require("../index.js");

test("main create: JPEG magic bytes → imgSecCheck 收到 image/jpeg，落库成功", async () => {
  calls.imgSecCheck.length = 0;
  const r = await main({ action: "create", fileID: "cloud://env/j.jpg", name: "J", category: "上衣" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(calls.imgSecCheck.length, 1);
  assert.strictEqual(calls.imgSecCheck[0].contentType, "image/jpeg");
});

test("main create: PNG magic bytes → imgSecCheck 收到 image/png，落库成功", async () => {
  calls.imgSecCheck.length = 0;
  const r = await main({ action: "create", fileID: "cloud://env/p.png", name: "P", category: "上衣" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(calls.imgSecCheck[0].contentType, "image/png");
});

test("main create: WEBP magic bytes → imgSecCheck 收到 image/webp，落库成功", async () => {
  calls.imgSecCheck.length = 0;
  const r = await main({ action: "create", fileID: "cloud://env/w.webp", name: "W", category: "上衣" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(calls.imgSecCheck[0].contentType, "image/webp");
});

test("main create: 非图片 magic bytes → INVALID_ARGUMENT（不调用 imgSecCheck）", async () => {
  calls.imgSecCheck.length = 0;
  const r = await main({ action: "create", fileID: "cloud://env/bad.bin", name: "B", category: "上衣" }).catch((e) => e);
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.strictEqual(code, "INVALID_ARGUMENT");
  assert.strictEqual(calls.imgSecCheck.length, 0);
});

test("main create: 太短无法识别 → INVALID_ARGUMENT", async () => {
  const r = await main({ action: "create", fileID: "cloud://env/short", name: "S", category: "上衣" }).catch((e) => e);
  const code = (r && r.error) || (r && r.appCode) || "";
  assert.strictEqual(code, "INVALID_ARGUMENT");
});

test("main create: PNG 上传落库走真实 contentType（不依赖扩展名）", async () => {
  calls.imgSecCheck.length = 0;
  const r = await main({ action: "create", fileID: "cloud://env/p.png", name: "白T", category: "上衣" });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.garmentId, "garment-new-1");
  assert.strictEqual(calls.imgSecCheck[0].contentType, "image/png");
});
