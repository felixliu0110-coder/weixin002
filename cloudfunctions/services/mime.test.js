const test = require("node:test");
const assert = require("node:assert");
const { detectImageContentType } = require("./storage");

// JPEG: FF D8 FF
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
// PNG: 89 50 4E 47 0D 0A 1A 0A
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
// WEBP: RIFF....WEBP
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x00, 0x00]);
// 非图片（纯文本）
const notImage = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
const tooShort = Buffer.from([0xff, 0xd8]);

test("detectImageContentType: JPEG magic bytes", () => {
  assert.strictEqual(detectImageContentType(jpeg), "image/jpeg");
});

test("detectImageContentType: PNG magic bytes", () => {
  assert.strictEqual(detectImageContentType(png), "image/png");
});

test("detectImageContentType: WEBP magic bytes (RIFF...WEBP)", () => {
  assert.strictEqual(detectImageContentType(webp), "image/webp");
});

test("detectImageContentType: 非图片返回 null", () => {
  assert.strictEqual(detectImageContentType(notImage), null);
});

test("detectImageContentType: 太短无法识别返回 null", () => {
  assert.strictEqual(detectImageContentType(tooShort), null);
  assert.strictEqual(detectImageContentType(Buffer.from([])), null);
});

test("detectImageContentType: null/undefined 返回 null", () => {
  assert.strictEqual(detectImageContentType(null), null);
  assert.strictEqual(detectImageContentType(undefined), null);
  assert.strictEqual(detectImageContentType("not-a-buffer"), null);
});

test("detectImageContentType: contentType 映射正确（JPEG/PNG/WEBP）", () => {
  assert.strictEqual(detectImageContentType(jpeg), "image/jpeg");
  assert.strictEqual(detectImageContentType(png), "image/png");
  assert.strictEqual(detectImageContentType(webp), "image/webp");
});
