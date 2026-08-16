const test = require("node:test");
const assert = require("node:assert");
const { rotateX, rotateY, projectPoint } = require("./renderer");

test("rotateY 90 度把 +Z 转到 +X", () => {
  const p = rotateY([0, 0, 10], 90);
  assert.ok(Math.abs(p[0] - 10) < 1e-6);
  assert.ok(Math.abs(p[2]) < 1e-6);
});

test("rotateX 90 度把 +Z 转到 +Y", () => {
  const p = rotateX([0, 0, 10], 90);
  assert.ok(Math.abs(p[1] - 10) < 1e-6);
  assert.ok(Math.abs(p[2]) < 1e-6);
});

test("projectPoint 头顶在画面上方，缩放放大位移", () => {
  const view = { rotateY: 0, rotateX: 0, zoom: 1 };
  const opts = { width: 300, height: 600, heightCm: 165, f: 900 };
  const top = projectPoint([0, 165, 0], view, opts);
  const mid = projectPoint([0, 82.5, 0], view, opts);
  assert.ok(top[1] < mid[1]);
  const z2 = projectPoint([0, 165, 0], Object.assign({}, view, { zoom: 2 }), opts);
  assert.ok(Math.abs(z2[1] - mid[1]) > Math.abs(top[1] - mid[1]));
});

test("projectPoint 正视时 z 越大越接近相机", () => {
  const view = { rotateY: 0, rotateX: 0, zoom: 1 };
  const opts = { width: 300, height: 600, heightCm: 165, f: 900 };
  const near = projectPoint([0, 80, 50], view, opts);
  const far = projectPoint([0, 80, -50], view, opts);
  assert.ok(near[2] > far[2]);
});
