const test = require("node:test");
const assert = require("node:assert");

const { parseSizeLabel, parseMeasurements, MEASUREMENT_FIELDS } = require("../services/validation");

function errCode(fn) {
  try { fn(); } catch (e) { return e.appCode; }
  return null;
}

/* ========== MEASUREMENT_FIELDS ========== */

test("MEASUREMENT_FIELDS 包含全部四个字段", () => {
  assert.deepStrictEqual(MEASUREMENT_FIELDS, ["lengthCm", "chestWidthCm", "shoulderWidthCm", "sleeveLengthCm"]);
});

/* ========== parseSizeLabel ========== */

test("parseSizeLabel 正常值", () => {
  assert.strictEqual(parseSizeLabel("M"), "M");
  assert.strictEqual(parseSizeLabel("XL"), "XL");
  assert.strictEqual(parseSizeLabel(" 2XL "), "2XL");
});

test("parseSizeLabel 空值返回 undefined", () => {
  assert.strictEqual(parseSizeLabel(""), undefined);
  assert.strictEqual(parseSizeLabel("   "), undefined);
  assert.strictEqual(parseSizeLabel(null), undefined);
  assert.strictEqual(parseSizeLabel(undefined), undefined);
});

test("parseSizeLabel 超过 20 字符抛出 INVALID_ARGUMENT", () => {
  assert.strictEqual(errCode(() => parseSizeLabel("A".repeat(21))), "INVALID_ARGUMENT");
});

test("parseSizeLabel 恰好 20 字符通过", () => {
  assert.strictEqual(parseSizeLabel("A".repeat(20)), "A".repeat(20));
});

test("parseSizeLabel 非字符串抛出", () => {
  assert.strictEqual(errCode(() => parseSizeLabel(123)), "INVALID_ARGUMENT");
  assert.strictEqual(errCode(() => parseSizeLabel([])), "INVALID_ARGUMENT");
});

/* ========== parseMeasurements ========== */

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
});

test("parseMeasurements null/undefined 返回 undefined", () => {
  assert.strictEqual(parseMeasurements(null), undefined);
  assert.strictEqual(parseMeasurements(undefined), undefined);
});

test("parseMeasurements 值 <=0 抛出不合法", () => {
  assert.strictEqual(errCode(() => parseMeasurements({ lengthCm: 0 })), "INVALID_ARGUMENT");
  assert.strictEqual(errCode(() => parseMeasurements({ lengthCm: -1 })), "INVALID_ARGUMENT");
});

test("parseMeasurements 值 >300 抛出不合法", () => {
  assert.strictEqual(errCode(() => parseMeasurements({ chestWidthCm: 500 })), "INVALID_ARGUMENT");
});

test("parseMeasurements NaN 抛出不合法", () => {
  assert.strictEqual(errCode(() => parseMeasurements({ shoulderWidthCm: NaN })), "INVALID_ARGUMENT");
});

test("parseMeasurements 非有限数抛出", () => {
  assert.strictEqual(errCode(() => parseMeasurements({ lengthCm: Infinity })), "INVALID_ARGUMENT");
});

test("parseMeasurements 非对象抛出", () => {
  assert.strictEqual(errCode(() => parseMeasurements("abc")), "INVALID_ARGUMENT");
  assert.strictEqual(errCode(() => parseMeasurements([1, 2])), "INVALID_ARGUMENT");
  assert.strictEqual(errCode(() => parseMeasurements(123)), "INVALID_ARGUMENT");
});

test("parseMeasurements 未知字段抛出", () => {
  assert.strictEqual(errCode(() => parseMeasurements({ waistCm: 80 })), "INVALID_ARGUMENT");
  assert.strictEqual(errCode(() => parseMeasurements({ lengthCm: 70, foo: 1 })), "INVALID_ARGUMENT");
});

test("parseMeasurements 保留用户输入 Number 不四舍五入", () => {
  const m = parseMeasurements({ lengthCm: 72.5 });
  assert.strictEqual(m.lengthCm, 72.5);
});

test("parseMeasurements 返回新对象不引用原对象", () => {
  const input = { lengthCm: 72 };
  const m = parseMeasurements(input);
  m.lengthCm = 999;
  assert.strictEqual(input.lengthCm, 72);
});

/* ========== mock updateGarment 语义一致性 ========== */

const mock = require("../../miniprogram/utils/mock");

test("mock updateGarment: measurements 整体替换（不合并）", async () => {
  const up = await mock.uploadGarment("/test.jpg", { name: "测试上衣", category: "上衣" });
  await mock.updateGarment(up.id, { name: "测试上衣", category: "上衣", measurements: { lengthCm: 72, chestWidthCm: 54 } });
  const result = await mock.updateGarment(up.id, { name: "测试上衣", category: "上衣", measurements: { chestWidthCm: 52 } });
  assert.deepStrictEqual(result.measurements, { chestWidthCm: 52 });
  assert.strictEqual(result.measurements.lengthCm, undefined);
});

test("mock updateGarment: 清空 measurements", async () => {
  const up = await mock.uploadGarment("/test.jpg", { name: "测试2", category: "上衣" });
  await mock.updateGarment(up.id, { name: "测试2", category: "上衣", measurements: { lengthCm: 72 } });
  const result = await mock.updateGarment(up.id, { name: "测试2", category: "上衣", measurements: null });
  assert.strictEqual(result.measurements, undefined);
});

test("mock updateGarment: 清空 size_label", async () => {
  const up = await mock.uploadGarment("/test.jpg", { name: "测试3", category: "上衣" });
  await mock.updateGarment(up.id, { name: "测试3", category: "上衣", size_label: "M" });
  const result = await mock.updateGarment(up.id, { name: "测试3", category: "上衣", size_label: null });
  assert.strictEqual(result.size_label, undefined);
});

test("mock updateGarment: 非上衣自动去掉 measurements", async () => {
  const up = await mock.uploadGarment("/test.jpg", { name: "测试4", category: "上衣" });
  await mock.updateGarment(up.id, { name: "测试4", category: "上衣", measurements: { lengthCm: 72 } });
  const result = await mock.updateGarment(up.id, { name: "测试4", category: "裤子", measurements: { lengthCm: 72 } });
  assert.strictEqual(result.measurements, undefined);
  assert.strictEqual(result.category, "裤子");
});

test("mock updateGarment: 不存在抛出 NOT_FOUND", async () => {
  await assert.rejects(() => mock.updateGarment("nonexistent", { name: "x", category: "上衣" }), /NOT_FOUND/);
});
