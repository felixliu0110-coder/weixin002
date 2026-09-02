const test = require("node:test");
const assert = require("node:assert");
const { detectImageContentType } = require("./storage");

test("detectImageContentType: JPEG magic bytes (FFD8FF)", () => {
  const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  assert.strictEqual(detectImageContentType(buf), "image/jpeg");
});

test("detectImageContentType: PNG magic bytes (89504E47)", () => {
  const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.strictEqual(detectImageContentType(buf), "image/png");
});

test("detectImageContentType: WEBP RIFF....WEBP", () => {
  const buf = Buffer.from("RIFF\x00\x00\x00\x00WEBP", "ascii");
  assert.strictEqual(detectImageContentType(buf), "image/webp");
});

test("detectImageContentType: 非图片字节返回 null", () => {
  assert.strictEqual(detectImageContentType(Buffer.from([0x00, 0x01, 0x02, 0x03])), null);
  assert.strictEqual(detectImageContentType(Buffer.from([0x47, 0x49, 0x46, 0x38])), null); // GIF 不识别
});

test("detectImageContentType: 太短 buffer 返回 null", () => {
  assert.strictEqual(detectImageContentType(Buffer.from([0xFF, 0xD8])), null);
  assert.strictEqual(detectImageContentType(Buffer.alloc(0)), null);
});

test("detectImageContentType: 非 Buffer / 假值返回 null", () => {
  assert.strictEqual(detectImageContentType(null), null);
  assert.strictEqual(detectImageContentType(undefined), null);
  assert.strictEqual(detectImageContentType("not a buffer"), null);
});

test("detectImageContentType: PNG/JPEG 映射与上传检测语义一致", () => {
  // 上传链路只关心 JPEG/PNG（及可选 WEBP）被识别
  const jpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  const webp = Buffer.from("RIFF\x01\x02\x03\x04WEBP", "ascii");
  assert.strictEqual(detectImageContentType(jpeg), "image/jpeg");
  assert.strictEqual(detectImageContentType(png), "image/png");
  assert.strictEqual(detectImageContentType(webp), "image/webp");
});
