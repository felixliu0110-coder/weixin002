const test = require("node:test");
const assert = require("node:assert");
const buildModel = require("./build-model");

test("buildModel 返回 free 版模型且版本正确", () => {
  const m = buildModel({ gender: "female", heightCm: 165, weightKg: 50 });
  assert.strictEqual(m.kind, "free");
  assert.strictEqual(m.version, "free-v1");
});

test("身高等于头部最高点", () => {
  const m = buildModel({ gender: "female", heightCm: 165, weightKg: 50 });
  const head = m.body.segments.find((s) => s.name === "head");
  assert.strictEqual(head.b[1], 165);
});

test("缺省估算填充性别默认体型", () => {
  const m = buildModel({ gender: "female", heightCm: 165, weightKg: 50 });
  const shoulder = m.body.measures.find((x) => x.label === "肩宽");
  assert.ok(shoulder.value > 0);
  assert.ok(m.body.segments.length >= 18);
});

test("男女体型比例与发型可区分", () => {
  const f = buildModel({ gender: "female", heightCm: 165, weightKg: 50 });
  const m = buildModel({ gender: "male", heightCm: 175, weightKg: 65 });
  const ratio = (mm) => mm.find((x) => x.label === "腰围").value / mm.find((x) => x.label === "臀围").value;
  assert.ok(ratio(f.body.measures) < ratio(m.body.measures));
  assert.strictEqual(f.body.hairStyle, "long");
  assert.strictEqual(m.body.hairStyle, "short");
});

test("肤色就近映射到 4 档", () => {
  assert.strictEqual(buildModel({ gender: "female", heightCm: 165, weightKg: 50, skinTone: 10 }).body.skin, "#F2D5C4");
  assert.strictEqual(buildModel({ gender: "female", heightCm: 165, weightKg: 50, skinTone: 90 }).body.skin, "#8D5A3B");
});

test("所有端点 y 在 0..heightCm 内", () => {
  const m = buildModel({ gender: "female", heightCm: 165, weightKg: 50, legLengthCm: 96 });
  const ys = [];
  for (const s of m.body.segments) { ys.push(s.a[1], s.b[1]); }
  assert.ok(Math.min(...ys) >= 0);
  assert.ok(Math.max(...ys) <= 165);
});
