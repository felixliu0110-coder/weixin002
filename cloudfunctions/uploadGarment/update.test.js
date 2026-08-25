const test = require("node:test");
const assert = require("node:assert");

/* ========== 直接测试纯校验函数（无需云环境） ========== */
const { parseSizeLabel, parseMeasurements, MEASUREMENT_FIELDS } = require("./validation");

test("parseSizeLabel 正常值", () => {
  assert.strictEqual(parseSizeLabel("M"), "M");
  assert.strictEqual(parseSizeLabel(" XL "), "XL");
  assert.strictEqual(parseSizeLabel(""), undefined);
  assert.strictEqual(parseSizeLabel(null), undefined);
  assert.strictEqual(parseSizeLabel(undefined), undefined);
});

test("parseSizeLabel 过长抛出", () => {
  assert.throws(() => parseSizeLabel("A".repeat(21)), /过长/);
});

test("parseMeasurements 正常值", () => {
  const m = parseMeasurements({ lengthCm: 72, chestWidthCm: 54 });
  assert.deepStrictEqual(m, { lengthCm: 72, chestWidthCm: 54 });
});

test("parseMeasurements 部分字段", () => {
  const m = parseMeasurements({ lengthCm: 80 });
  assert.deepStrictEqual(m, { lengthCm: 80 });
  assert.strictEqual(m.chestWidthCm, undefined);
});

test("parseMeasurements 空对象返回 undefined", () => {
  assert.strictEqual(parseMeasurements({}), undefined);
  assert.strictEqual(parseMeasurements(null), undefined);
  assert.strictEqual(parseMeasurements(undefined), undefined);
});

test("parseMeasurements 非法值抛出", () => {
  assert.throws(() => parseMeasurements({ lengthCm: -1 }), /不合法/);
  assert.throws(() => parseMeasurements({ lengthCm: 0 }), /不合法/);
  assert.throws(() => parseMeasurements({ chestWidthCm: 500 }), /不合法/);
  assert.throws(() => parseMeasurements({ shoulderWidthCm: NaN }), /不合法/);
});

test("parseMeasurements 非对象抛出", () => {
  assert.throws(() => parseMeasurements("abc"), /必须为对象/);
  assert.throws(() => parseMeasurements([1, 2]), /必须为对象/);
});

test("MEASUREMENT_FIELDS 包含全部四个字段", () => {
  assert.deepStrictEqual(MEASUREMENT_FIELDS, ["lengthCm", "chestWidthCm", "shoulderWidthCm", "sleeveLengthCm"]);
});