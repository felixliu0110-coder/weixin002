# 免费版参数化数字人 3D（非 AI）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通“录入身材 → 生成免费数字人 → 3D 查看（旋转/缩放/标注）→ 保存”完整链路，渲染失败不白屏，并为 AI 仿真版预留统一生成器接口。

**Architecture:** `utils/avatar3d/` 三层模块——`provider.js`（统一生成入口，仅实现 `free`）→ `build-model.js`（纯函数：档案 → 参数化人体数据）→ `renderer.js`（小程序 canvas 2d 轻量渲染器，负责绘制/旋转/缩放/标注/导出）。`pages/generate-progress` 调用生成器并保存模型，`pages/avatar-3d` 用 canvas 实时渲染；渲染失败降级到静态图。

**Tech Stack:** 微信原生小程序（基础库 3.17.1）、Canvas 2D API、node:test 单元测试。**零新增运行时依赖**（不引入 three.js / npm 构建）。

## Global Constraints

- 基础库 3.17.1，`es6` 已开启；appid `wxe44ebc1661569b32`。
- 不新增任何运行时 npm 依赖；不修改 `weixin002/` 原型目录。
- 设计 token 取自 `app.wxss`（`--accent: #E3A595`、`--accent-deep: #C98F80`、`--fg: #1F1D1B`、`--fg-2: #4A423C`、`--border: #EADFD3` 等），禁止裸色值散落页面。
- 单位约定：身高/三围等在模型中用 cm（数字），canvas 尺寸用 CSS px（`createSelectorQuery` 返回 px，另按 `pixelRatio` 设画布物理像素并 `ctx.scale(dpr,dpr)`）。
- 所有新文件 UTF-8；模块用 CommonJS `require/module.exports`；测试沿用 `node:test` + `node:assert`，位于 `utils/` 下 `*.test.js`。
- 数据层保持“云优先、失败回退 mock”策略（`api.js` 现状），不改云集合范围（云上数据范围仍待用户确认）。
- 每次任务结束必须保持 `node scripts/verify.js`、`node scripts/check-handlers.js`、`npm test` 全绿；git 每任务单独提交（`git commit` 需在沙盒外执行并附说明）。

---

### Task 1: 参数化人体建模（build-model.js）

**Files:**
- Create: `miniprogram/utils/avatar3d/build-model.js`
- Test: `miniprogram/utils/avatar3d/build-model.test.js`

**Interfaces:**
- Consumes: `profile` 对象（字段：`gender`、`heightCm`、`weightKg`、`bustCm`、`waistCm`、`hipCm`、`legLengthCm`、`neckLengthCm`、`shoulderCm`、`armLengthCm`、`shoeSize`、`skinTone`（0–100 数字或档位字符串）、`estimate`）
- Produces: `buildModel(profile)` → `avatarModel`：
  ```js
  {
    kind: "free",
    version: "free-v1",
    profile: { gender, heightCm, weightKg, shoulderCm, bustCm, waistCm, hipCm, legLengthCm, neckLengthCm, armLengthCm, shoeSize, skinTone, estimate },
    body: {
      heightCm,
      skin: "#E8B895",            // 4 档肤色色值
      hairColor: "#3B2F2A",
      hairStyle: "long" | "short",
      segments: [ { name, a:[x,y,z], b:[x,y,z], r, color } ],  // 胶囊线段（y 向上，地面 y=0，单位 cm）
      hair: [ { shape:"cap"|"strand", center?, a?, b?, r, color } ],
      measures: [ { label, value, a, b } ]
    }
  }
  ```
- 供 Task 2（provider）调用；`module.exports` 另暴露 `skinFromValue` 供测试。

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test utils/avatar3d/build-model.test.js`
Expected: FAIL（`Cannot find module './build-model'`）

- [ ] **Step 3: 实现 build-model.js**

```js
/* 免费版参数化数字人建模：profile → avatarModel（纯数据，无 canvas 依赖，可单测） */

const TAU = Math.PI * 2;

const SKIN_TONES = [
  { key: "light", color: "#F2D5C4" },
  { key: "natural", color: "#E8B895" },
  { key: "wheat", color: "#C68B5E" },
  { key: "deep", color: "#8D5A3B" }
];

const GENDER_DEFAULTS = {
  female: {
    shoulderCm: 38, bustCm: 88, waistCm: 66, hipCm: 92,
    legRatio: 0.58, neckLengthCm: 10, armLengthCm: 55, shoeSize: 38,
    hairStyle: "long", hairColor: "#3B2F2A", weightKg: 52
  },
  male: {
    shoulderCm: 44, bustCm: 96, waistCm: 82, hipCm: 94,
    legRatio: 0.56, neckLengthCm: 12, armLengthCm: 58, shoeSize: 42,
    hairStyle: "short", hairColor: "#241B16", weightKg: 68
  }
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function skinFromValue(v) {
  if (v === undefined || v === null || v === "") return "natural";
  if (typeof v === "string") return SKIN_TONES.some((s) => s.key === v) ? v : "natural";
  if (v < 25) return "light";
  if (v < 55) return "natural";
  if (v < 80) return "wheat";
  return "deep";
}

function buildModel(profile) {
  const gender = profile.gender === "male" ? "male" : "female";
  const d = GENDER_DEFAULTS[gender];
  const estimate = profile.estimate !== false;

  const heightCm = Number(profile.heightCm) || 165;
  const weightKg = Number(profile.weightKg) || d.weightKg;
  const shoulderCm = estimate || !profile.shoulderCm ? d.shoulderCm : Number(profile.shoulderCm);
  const bustCm = estimate || !profile.bustCm ? d.bustCm : Number(profile.bustCm);
  const waistCm = estimate || !profile.waistCm ? d.waistCm : Number(profile.waistCm);
  const hipCm = estimate || !profile.hipCm ? d.hipCm : Number(profile.hipCm);
  const legLengthCm = Number(profile.legLengthCm) || Math.round(heightCm * d.legRatio);
  const neckLengthCm = Number(profile.neckLengthCm) || d.neckLengthCm;
  const armLengthCm = Number(profile.armLengthCm) || d.armLengthCm;
  const shoeSize = Number(profile.shoeSize) || d.shoeSize;
  const skinKey = skinFromValue(profile.skinTone);
  const skin = SKIN_TONES.find((s) => s.key === skinKey).color;
  const hairStyle = d.hairStyle;
  const hairColor = d.hairColor;

  // 纵向关键点（y 向上，地面 y=0）
  const headTopY = heightCm;
  const headH = clamp(heightCm * 0.132, 20, 26);
  const headBaseY = headTopY - headH;
  const neckBaseY = headBaseY - neckLengthCm;
  const shoulderY = neckBaseY - 2;
  const hipY = legLengthCm;
  const torsoH = Math.max(18, shoulderY - hipY);
  const chestY = shoulderY - torsoH * 0.3;
  const waistY = hipY + torsoH * 0.42;
  const crotchY = Math.max(0, hipY - 6);
  const kneeY = hipY * 0.5;
  const ankleY = Math.max(3, shoeSize * 0.14);
  const footLen = 8 + shoeSize * 0.42;

  const shoulderHalf = shoulderCm / 2;
  const upperArm = armLengthCm * 0.46;
  const foreArm = armLengthCm * 0.42;
  const handLen = armLengthCm * 0.12;

  const chestR = bustCm / TAU * 0.92;
  const waistR = waistCm / TAU * 0.92;
  const hipR = hipCm / TAU * 0.92;
  const headR = headH * 0.44;
  const neckR = 4;
  const upperArmR = 3.1 + weightKg * 0.006;
  const foreArmR = 2.6 + weightKg * 0.005;
  const handR = 2.2;
  const thighR = 5.6 + hipCm * 0.008;
  const shinR = 4.2 + weightKg * 0.004;
  const footR = 2.6;
  const legX = clamp(hipR * 0.45, 5, 8);

  const bodyColor = skin;
  const accent = "#E3A595";

  const segments = [
    { name: "head", a: [0, headBaseY + 2, 0], b: [0, headTopY, 0], r: headR, color: bodyColor },
    { name: "neck", a: [0, neckBaseY, 0], b: [0, headBaseY, 0], r: neckR, color: bodyColor },
    { name: "chest", a: [0, shoulderY, 0], b: [0, waistY, 0], r: chestR, color: bodyColor },
    { name: "waist", a: [0, waistY, 0], b: [0, hipY, 0], r: waistR, color: bodyColor },
    { name: "hip", a: [0, hipY, 0], b: [0, crotchY, 0], r: hipR, color: bodyColor },
    { name: "shorts", a: [-hipR * 0.8, hipY - 2, 2], b: [hipR * 0.8, hipY - 2, 2], r: 3.2, color: accent },
    { name: "arm-r-upper", a: [shoulderHalf, shoulderY, 0], b: [shoulderHalf + upperArm, shoulderY - 2, 0], r: upperArmR, color: bodyColor },
    { name: "arm-r-fore", a: [shoulderHalf + upperArm, shoulderY - 2, 0], b: [shoulderHalf + upperArm + foreArm, shoulderY - 4, 0], r: foreArmR, color: bodyColor },
    { name: "arm-r-hand", a: [shoulderHalf + upperArm + foreArm, shoulderY - 4, 0], b: [shoulderHalf + upperArm + foreArm + handLen, shoulderY - 4, 0], r: handR, color: bodyColor },
    { name: "arm-l-upper", a: [-shoulderHalf, shoulderY, 0], b: [-shoulderHalf - upperArm, shoulderY - 2, 0], r: upperArmR, color: bodyColor },
    { name: "arm-l-fore", a: [-shoulderHalf - upperArm, shoulderY - 2, 0], b: [-shoulderHalf - upperArm - foreArm, shoulderY - 4, 0], r: foreArmR, color: bodyColor },
    { name: "arm-l-hand", a: [-shoulderHalf - upperArm - foreArm, shoulderY - 4, 0], b: [-shoulderHalf - upperArm - foreArm - handLen, shoulderY - 4, 0], r: handR, color: bodyColor },
    { name: "leg-r-thigh", a: [legX, hipY, 0], b: [legX, kneeY, 0], r: thighR, color: bodyColor },
    { name: "leg-r-shin", a: [legX, kneeY, 0], b: [legX, ankleY, 0], r: shinR, color: bodyColor },
    { name: "leg-r-foot", a: [legX, ankleY, 0], b: [legX, ankleY, footLen], r: footR, color: bodyColor },
    { name: "leg-l-thigh", a: [-legX, hipY, 0], b: [-legX, kneeY, 0], r: thighR, color: bodyColor },
    { name: "leg-l-shin", a: [-legX, kneeY, 0], b: [-legX, ankleY, 0], r: shinR, color: bodyColor },
    { name: "leg-l-foot", a: [-legX, ankleY, 0], b: [-legX, ankleY, footLen], r: footR, color: bodyColor }
  ];

  const hair = [{ shape: "cap", center: [0, headTopY - headH * 0.22, 0], r: headR * 1.02, color: hairColor }];
  if (hairStyle === "long") {
    hair.push(
      { shape: "strand", a: [headR * 0.7, headBaseY + headH * 0.55, -headR * 0.35], b: [headR * 0.95, neckBaseY - 3, -headR * 0.45], r: 3.2, color: hairColor },
      { shape: "strand", a: [-headR * 0.7, headBaseY + headH * 0.55, -headR * 0.35], b: [-headR * 0.95, neckBaseY - 3, -headR * 0.45], r: 3.2, color: hairColor }
    );
  }

  const measures = [
    { label: "身高", value: Math.round(heightCm), a: [0, headTopY, 0], b: [0, 0, 0] },
    { label: "肩宽", value: Math.round(shoulderCm), a: [-shoulderHalf, shoulderY, 0], b: [shoulderHalf, shoulderY, 0] },
    { label: "胸围", value: Math.round(bustCm), a: [-chestR, chestY, 0], b: [chestR, chestY, 0] },
    { label: "腰围", value: Math.round(waistCm), a: [-waistR, waistY, 0], b: [waistR, waistY, 0] },
    { label: "臀围", value: Math.round(hipCm), a: [-hipR, hipY, 0], b: [hipR, hipY, 0] },
    { label: "腿长", value: Math.round(legLengthCm), a: [-legX - 3, hipY, 0], b: [-legX - 3, 0, 0] }
  ];

  return {
    kind: "free",
    version: "free-v1",
    profile: {
      gender, heightCm, weightKg, shoulderCm, bustCm, waistCm, hipCm,
      legLengthCm, neckLengthCm, armLengthCm, shoeSize, skinTone: skinKey, estimate
    },
    body: { heightCm, skin, hairColor, hairStyle, segments, hair, measures }
  };
}

module.exports = buildModel;
module.exports.skinFromValue = skinFromValue;
module.exports.GENDER_DEFAULTS = GENDER_DEFAULTS;
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test utils/avatar3d/build-model.test.js`
Expected: PASS（6 项）

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/avatar3d/build-model.js miniprogram/utils/avatar3d/build-model.test.js
git commit -m "feat: 参数化数字人建模模块（build-model）"
```

---

### Task 2: 统一生成入口（provider.js）

**Files:**
- Create: `miniprogram/utils/avatar3d/provider.js`
- Test: `miniprogram/utils/avatar3d/provider.test.js`

**Interfaces:**
- Consumes: `buildModel(profile)`（Task 1）
- Produces: `generate(profile, options?) → Promise<avatarModel>`；`options.kind` 仅支持 `"free"`（默认），其余抛 `Error("avatar generator not implemented: <kind>")`——AI 版（`"ai"`）为后续并行预留。
- 供 Task 6（generate-progress）调用。

- [ ] **Step 1: 写失败测试**

```js
const test = require("node:test");
const assert = require("node:assert");
const provider = require("./provider");

test("generate 默认返回免费版模型并保留档案", async () => {
  const model = await provider.generate({ gender: "female", heightCm: 165, weightKg: 50 });
  assert.strictEqual(model.kind, "free");
  assert.strictEqual(model.profile.heightCm, 165);
});

test("generate({kind:'free'}) 显式指定同样可用", async () => {
  const model = await provider.generate({ gender: "male", heightCm: 175, weightKg: 65 }, { kind: "free" });
  assert.strictEqual(model.kind, "free");
});

test("AI 版生成器未实现时明确抛错", async () => {
  await assert.rejects(() => provider.generate({}, { kind: "ai" }), /not implemented/);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test utils/avatar3d/provider.test.js`
Expected: FAIL（`Cannot find module './provider'`）

- [ ] **Step 3: 实现 provider.js**

```js
/* 数字人生成统一入口：按 kind 选择生成器。第一版仅免费参数化；AI 仿真版后续并行接入。 */
const buildModel = require("./build-model");

const GENERATORS = {
  free: buildModel
};

async function generate(profile, options) {
  const kind = (options && options.kind) || "free";
  const fn = GENERATORS[kind];
  if (!fn) throw new Error("avatar generator not implemented: " + kind);
  return fn(profile);
}

module.exports = { generate };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test utils/avatar3d/provider.test.js`
Expected: PASS（3 项）

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/avatar3d/provider.js miniprogram/utils/avatar3d/provider.test.js
git commit -m "feat: 数字人生成统一入口（provider，AI 版预留）"
```

---

### Task 3: 轻量 3D 渲染器（renderer.js）

**Files:**
- Create: `miniprogram/utils/avatar3d/renderer.js`
- Test: `miniprogram/utils/avatar3d/renderer.test.js`

**Interfaces:**
- Consumes: `avatarModel`（Task 1 输出）、canvas 节点与尺寸
- Produces:
  - 纯函数（可单测）：`rotateX(p, deg)`、`rotateY(p, deg)`、`projectPoint(p, view, opts) → [x, y, z, k]`，`opts = { width, height, heightCm, f=900 }`，`view = { rotateY, rotateX, zoom }`
  - 类 `AvatarRenderer`：
    - `init(canvas, model, { width, height, ctx })`
    - `setView(view)`（合并并重绘）、`setMeasure(on)`（标注开关）
    - `render()`（清屏 → 地面阴影 → 胶囊分段按 z 从远到近绘制 → 发型覆盖层 → 标注线）
    - `exportImage() → Promise<tempFilePath>`（供试穿底图后续使用）
    - `destroy()`
- 供 Task 7（avatar-3d 页面）调用。

- [ ] **Step 1: 写失败测试**

```js
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
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test utils/avatar3d/renderer.test.js`
Expected: FAIL（`Cannot find module './renderer'`）

- [ ] **Step 3: 实现 renderer.js**

```js
/* 轻量 3D 渲染器：小程序 canvas 2d + 数学投影（无第三方依赖）。
   模型为胶囊线段（圆头粗线）集合，按投影后 z 排序从远到近绘制。 */

const DEG = Math.PI / 180;

function rotateX(p, deg) {
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

function rotateY(p, deg) {
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

function projectPoint(p, view, opts) {
  const f = opts.f || 900;
  const s0 = opts.height / (opts.heightCm * 1.22) * (view.zoom || 1);
  let q = rotateY(p, view.rotateY || 0);
  q = rotateX(q, view.rotateX || 0);
  const zc = q[2] + f;
  const k = f / zc;
  return [opts.width / 2 + q[0] * k * s0, opts.height / 2 + opts.height * 0.05 - q[1] * k * s0, q[2], k];
}

class AvatarRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.model = null;
    this.view = { rotateY: 0, rotateX: 0, zoom: 1 };
    this.measure = false;
    this.width = 0;
    this.height = 0;
  }

  init(canvas, model, size) {
    this.canvas = canvas;
    this.ctx = size.ctx || canvas.getContext("2d");
    this.model = model;
    this.width = size.width;
    this.height = size.height;
  }

  setMeasure(on) { this.measure = !!on; }

  setView(view) {
    Object.assign(this.view, view);
    this.render();
  }

  render() {
    if (!this.ctx || !this.model) return;
    const { width: w, height: h, ctx, view } = this;
    const opts = { width: w, height: h, heightCm: this.model.body.heightCm, f: 900 };
    const s = h / (this.model.body.heightCm * 1.22) * view.zoom;
    ctx.clearRect(0, 0, w, h);

    // 地面阴影
    ctx.save();
    ctx.fillStyle = "rgba(31,29,27,0.10)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 36, this.model.body.heightCm * 0.16 * s, this.model.body.heightCm * 0.024 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const items = this.model.body.segments.map((seg) => {
      const pa = projectPoint(seg.a, view, opts);
      const pb = projectPoint(seg.b, view, opts);
      return { seg, pa, pb, z: (pa[2] + pb[2]) / 2 };
    });
    items.sort((m, n) => n.z - m.z);

    ctx.save();
    ctx.lineCap = "round";
    for (const it of items) {
      const { seg, pa, pb } = it;
      const k = (pa[3] + pb[3]) / 2;
      const lw = seg.r * k * s * 2;
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = Math.max(1, lw);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }
    ctx.restore();

    // 发型覆盖层（后画，保证盖住头顶）
    const hairItems = this.model.body.hair.map((h) => {
      if (h.shape === "cap") {
        const pc = projectPoint(h.center, view, opts);
        return { h, pa: pc, pb: pc, z: pc[2] };
      }
      const pa = projectPoint(h.a, view, opts);
      const pb = projectPoint(h.b, view, opts);
      return { h, pa, pb, z: (pa[2] + pb[2]) / 2 };
    });
    hairItems.sort((m, n) => n.z - m.z);
    ctx.save();
    ctx.lineCap = "round";
    for (const it of hairItems) {
      const { h, pa, pb } = it;
      const k = (pa[3] + pb[3]) / 2;
      if (h.shape === "cap") {
        const r = Math.max(1, h.r * k * s);
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(pa[0], pa[1], r, Math.PI, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = h.color;
        ctx.lineWidth = Math.max(1, h.r * k * s * 2);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (this.measure) this.drawMeasures(view, opts);
  }

  drawMeasures(view, opts) {
    const { ctx } = this;
    ctx.save();
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 1.4;
    for (const m of this.model.body.measures) {
      const pa = projectPoint(m.a, view, opts);
      const pb = projectPoint(m.b, view, opts);
      ctx.strokeStyle = "rgba(201,143,128,0.95)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      const mx = (pa[0] + pb[0]) / 2;
      const my = (pa[1] + pb[1]) / 2;
      const text = m.label + " " + m.value + "cm";
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(mx - tw / 2 - 3, my - 9, tw + 6, 14);
      ctx.fillStyle = "#7A5A4E";
      ctx.fillText(text, mx, my + 3);
    }
    ctx.restore();
  }

  exportImage() {
    return new Promise((resolve, reject) => {
      if (typeof wx === "undefined" || !wx.canvasToTempFilePath) {
        reject(new Error("canvasToTempFilePath unavailable"));
        return;
      }
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(err)
      });
    });
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.model = null;
  }
}

module.exports = AvatarRenderer;
module.exports.rotateX = rotateX;
module.exports.rotateY = rotateY;
module.exports.projectPoint = projectPoint;
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test utils/avatar3d/renderer.test.js`
Expected: PASS（4 项）

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/avatar3d/renderer.js miniprogram/utils/avatar3d/renderer.test.js
git commit -m "feat: 轻量 canvas 3D 渲染器（旋转/缩放/标注/导出）"
```

---

### Task 4: 数据层字段补齐（api.js / mock.js）

**Files:**
- Modify: `miniprogram/utils/mock.js:17-27`（avatarProfile 示例对象）
- Modify: `miniprogram/utils/api.js:20-31`（getAvatarProfile 云端字段映射）
- Test: `miniprogram/utils/mock.test.js`（追加断言）

**Interfaces:**
- Consumes: 无
- Produces: `getAvatarProfile()` 返回对象补齐 `neckLengthCm`、`shoulderCm`、`armLengthCm`、`shoeSize`、`skinTone`、`estimate` 字段（云与 mock 两条路径一致），供 Task 5/6 使用。

- [ ] **Step 1: 写失败测试（追加到 mock.test.js）**

```js
test("getAvatarProfile 含建模所需全部字段", async () => {
  const profile = await mock.getAvatarProfile();
  assert.ok(profile.neckLengthCm > 0);
  assert.ok(profile.shoulderCm > 0);
  assert.ok(profile.armLengthCm > 0);
  assert.ok(profile.shoeSize > 0);
  assert.strictEqual(typeof profile.skinTone, "string");
});
```

- [ ] **Step 2: 运行确认失败**

Run: `node --test utils/mock.test.js`
Expected: FAIL（`profile.neckLengthCm` 为 undefined）

- [ ] **Step 3: 实现**

`miniprogram/utils/mock.js` 的 `avatarProfile` 对象追加：

```js
const avatarProfile = {
  id: "avatar-demo",
  userId: "u-demo",
  gender: "female",
  heightCm: 165,
  weightKg: 50,
  bustCm: 88,
  waistCm: 66,
  hipCm: 92,
  legLengthCm: 96,
  neckLengthCm: 10,
  shoulderCm: 38,
  armLengthCm: 55,
  shoeSize: 38,
  skinTone: "natural",
  estimate: true,
  modelVersion: "v1-demo",
  status: "ready",
  isExample: true
};
```

`miniprogram/utils/api.js` 的 `getAvatarProfile()` 云端映射追加：

```js
      return {
        id: doc._id,
        gender: doc.gender,
        heightCm: doc.heightCm,
        weightKg: doc.weightKg,
        bustCm: doc.bustCm,
        waistCm: doc.waistCm,
        hipCm: doc.hipCm,
        legLengthCm: doc.legLengthCm,
        neckLengthCm: doc.neckLengthCm,
        shoulderCm: doc.shoulderCm,
        armLengthCm: doc.armLengthCm,
        shoeSize: doc.shoeSize,
        skinTone: doc.skinTone,
        estimate: doc.estimate,
        isExample: false
      };
```

- [ ] **Step 4: 运行确认通过**

Run: `node --test utils/mock.test.js && node --test utils/api.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/mock.js miniprogram/utils/mock.test.js miniprogram/utils/api.js
git commit -m "feat: 档案数据层补齐建模所需字段（云/mock 一致）"
```

---

### Task 5: 录入页保存接好（body-params / photo-upload）

**Files:**
- Modify: `miniprogram/pages/body-params/index.js`（`next()` 保存全部身材字段）
- Modify: `miniprogram/pages/photo-upload/index.js`（`generate()` 保存照片选填状态）

**Interfaces:**
- Consumes: `api.saveAvatarProfile(data)`（现有，接收对象并入档案）
- Produces: 档案完整保存；`photo-upload` 保存 `facePhoto` / `bodyPhoto` 占位字段（`""` 或 `"mock-face"` / `"mock-body"`），供 Task 6 读取档案生成模型。

- [ ] **Step 1: 修改 body-params/index.js 的 next()**

```js
  next() {
    api.saveAvatarProfile({
      bustCm: this.data.bust,
      waistCm: this.data.waist,
      hipCm: this.data.hip,
      legLengthCm: this.data.leg,
      neckLengthCm: this.data.neck,
      shoulderCm: this.data.shoulder,
      armLengthCm: this.data.arm,
      shoeSize: this.data.shoe,
      skinTone: this.data.skin,
      estimate: this.data.estimate
    });
    navigate("/pages/photo-upload/index");
  }
```

- [ ] **Step 2: 修改 photo-upload/index.js 的 generate()**

```js
  generate() {
    api.saveAvatarProfile({
      facePhoto: this.data.faceState === "done" ? "mock-face" : "",
      bodyPhoto: this.data.bodyState === "done" ? "mock-body" : ""
    });
    navigate("/pages/privacy-auth/index");
  }
```

- [ ] **Step 3: 校验**

Run: `node scripts/check-handlers.js && node scripts/verify.js`
Expected: `ALL HANDLERS OK`、`VERIFY OK`

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/body-params/index.js miniprogram/pages/photo-upload/index.js
git commit -m "feat: 身材参数/照片页档案保存接入"
```

---

### Task 6: 生成进度页真实生成（generate-progress）

**Files:**
- Modify: `miniprogram/pages/generate-progress/index.js`
- Modify: `miniprogram/pages/generate-progress/index.wxml`
- Modify: `miniprogram/pages/generate-progress/index.wxss`

**Interfaces:**
- Consumes: `api.getAvatarProfile()`、`provider.generate(profile)`（Task 2）、`wx.setStorageSync("avatarModel", model)`
- Produces: 生成成功保存模型并动画到 100% 后跳转 `/pages/avatar-3d/index`；失败显示错误态 + `retry` 重试；`avatarModel` 供 Task 7 读取。

- [ ] **Step 1: 替换 index.js**

```js
const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
const provider = require("../../utils/avatar3d/provider");

Page({
  data: { percent: 0, error: false },
  onLoad() {
    this.run();
  },
  async run() {
    try {
      const profile = await api.getAvatarProfile();
      const model = await provider.generate(profile);
      wx.setStorageSync("avatarModel", model);
      await api.saveAvatarProfile({ modelVersion: model.version, status: "ready" });
      this.animateTo100();
    } catch (e) {
      this.setData({ error: true });
    }
  },
  animateTo100() {
    this._startTimer = setTimeout(() => {
      this._timer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._timer);
          toast("数字人已生成");
          this._navTimer = setTimeout(() => navigate("/pages/avatar-3d/index"), 1200);
        }
      }, 30);
    }, 300);
  },
  retry() {
    this.setData({ percent: 0, error: false });
    this.run();
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
```

- [ ] **Step 2: 修改 index.wxml（错误态 + 文案）**

把 `content` 内内容替换为：

```xml
  <view class="content big-hero-center">
    <block wx:if="{{!error}}">
      <view class="ring-wrap">
        <view class="ring" style="--p: {{percent}};"></view>
        <view class="ring-hole"></view>
        <view class="ring-num mono">{{percent}}%</view>
      </view>
      <view class="gen-title">正在生成你的专属数字人~</view>
      <view class="gen-sub">根据身高体重与三围建立身体比例骨架</view>

      <view class="gen-cards">
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-star-deep.png" /></view>
          <view class="gc-label">生成方式</view>
          <view class="gc-val">参数化 · 免费版</view>
        </view>
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-clock-deep.png" /></view>
          <view class="gc-label">预计还需</view>
          <view class="gc-val">约 8 秒</view>
        </view>
      </view>

      <view class="hint center mt-20">生成期间可以离开，完成后会通知你</view>
    </block>

    <block wx:else>
      <view class="gen-title">生成失败</view>
      <view class="gen-sub">数据或环境异常，请重试</view>
      <btn class="retry-btn" type="primary" bindtap="retry">重新生成</btn>
    </block>
  </view>
```

- [ ] **Step 3: 修改 index.wxss（重试按钮居中）**

追加：

```css
.retry-btn { display: block; width: 70%; margin: 56rpx auto 0; }
```

- [ ] **Step 4: 校验**

Run: `node scripts/check-handlers.js && node scripts/verify.js && npm test`
Expected: `ALL HANDLERS OK`、`VERIFY OK`、8 项测试全过

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/generate-progress/index.js miniprogram/pages/generate-progress/index.wxml miniprogram/pages/generate-progress/index.wxss
git commit -m "feat: 生成进度页接入真实参数化生成与错误重试"
```

---

### Task 7: 数字人 3D 查看页（avatar-3d）

**Files:**
- Modify: `miniprogram/pages/avatar-3d/index.wxml`
- Modify: `miniprogram/pages/avatar-3d/index.wxss`
- Modify: `miniprogram/pages/avatar-3d/index.js`

**Interfaces:**
- Consumes: `AvatarRenderer`（Task 3）、`provider.generate(profile)`、`wx.getStorageSync("avatarModel")`
- Produces: canvas 实时渲染；单指旋转（rotateY 无级、rotateX ±20°）、双指缩放（0.8–1.6）、自动旋转开关、标注开关、失败兜底（静态图 + 重试）。

- [ ] **Step 1: 修改 index.wxml**

`avatar-stage` 内替换为：

```xml
    <view class="avatar-stage">
      <canvas
        wx:if="{{!renderFailed}}"
        id="avatarCanvas"
        type="2d"
        class="avatar-canvas"
        bindtouchstart="onTouchStart"
        catchtouchmove="onTouchMove"
        bindtouchend="onTouchEnd"
      ></canvas>
      <view wx:else class="stage-fallback">
        <image class="avatar-img" src="/assets/img/p05-avatar.jpg" mode="aspectFill" />
        <text class="fb-text">3D 渲染失败，已切换为预览图</text>
        <btn class="fb-btn" type="secondary" size="sm" bindtap="retry">重新渲染</btn>
      </view>
    </view>
    <view class="meas-hint">{{measureOn ? '标注模式：身高 / 肩宽 / 胸围 / 腰围 / 臀围 / 腿长' : '单指旋转 · 双指缩放 · 点按标注查看尺寸'}}</view>
```

- [ ] **Step 2: 修改 index.wxss**

追加/替换：

```css
.avatar-canvas { width: 100%; height: 700rpx; display: block; }
.fb-text { font-size: 26rpx; color: var(--fg-2); margin-top: 16rpx; }
.fb-btn { display: block; width: 60%; margin-top: 28rpx; }
```

- [ ] **Step 3: 替换 index.js**

```js
const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
const provider = require("../../utils/avatar3d/provider");
const AvatarRenderer = require("../../utils/avatar3d/renderer");

function dist(a, b) {
  return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2));
}

Page({
  data: {
    renderFailed: false,
    measureOn: false,
    rotating: false,
    profile: { heightCm: "--", weightKg: "--", waistCm: "--", legLengthCm: "--" }
  },
  onLoad() {
    api.getAvatarProfile().then((profile) => this.setData({ profile }));
  },
  onReady() {
    this.initCanvas();
  },
  initCanvas() {
    this.setData({ renderFailed: false });
    const load = () => {
      const model = wx.getStorageSync("avatarModel");
      if (model && model.kind === "free") return Promise.resolve(model);
      return api.getAvatarProfile().then((profile) => provider.generate(profile));
    };
    load().then((model) => {
      wx.createSelectorQuery()
        .select("#avatarCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            this.setData({ renderFailed: true });
            return;
          }
          const canvas = res[0].node;
          const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio) || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);
          this.renderer = new AvatarRenderer();
          this.renderer.init(canvas, model, { width: res[0].width, height: res[0].height, ctx });
          this.renderer.render();
        });
    }).catch(() => this.setData({ renderFailed: true }));
  },
  onTouchStart(e) {
    this._touches = e.touches;
  },
  onTouchMove(e) {
    if (!this.renderer) return;
    const t = e.touches;
    const view = this.renderer.view;
    if (t.length === 1 && this._touches && this._touches.length === 1) {
      const dx = t[0].clientX - this._touches[0].clientX;
      const dy = t[0].clientY - this._touches[0].clientY;
      view.rotateY = (view.rotateY + dx * 0.6 + 360) % 360;
      view.rotateX = Math.max(-20, Math.min(20, view.rotateX + dy * 0.3));
      this.renderer.render();
    } else if (t.length === 2 && this._touches && this._touches.length === 2) {
      const d0 = dist(this._touches[0], this._touches[1]);
      const d1 = dist(t[0], t[1]);
      view.zoom = Math.max(0.8, Math.min(1.6, view.zoom * (d1 / Math.max(d0, 1))));
      this.renderer.render();
    }
    this._touches = t;
  },
  onTouchEnd(e) {
    this._touches = e.touches || [];
  },
  onRotate() {
    const on = !this.data.rotating;
    this.setData({ rotating: on });
    toast(on ? "自动旋转已开启" : "已停止自动旋转");
    if (on) {
      this._autoTimer = setInterval(() => {
        if (!this.renderer) return;
        this.renderer.view.rotateY = (this.renderer.view.rotateY + 1.2) % 360;
        this.renderer.render();
      }, 33);
    } else if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
  },
  onMeasure() {
    const on = !this.data.measureOn;
    this.setData({ measureOn: on });
    if (this.renderer) {
      this.renderer.setMeasure(on);
      this.renderer.render();
    }
    toast(on ? "身材标注已开启" : "身材标注已关闭");
  },
  onConfirm() {
    toast("身材档案已保存");
  },
  retry() {
    this.initCanvas();
  },
  edit() {
    navigate("/pages/basic-info/index");
  },
  goTryon() {
    navigate("/pages/tryon-select/index");
  },
  onUnload() {
    if (this._autoTimer) clearInterval(this._autoTimer);
    if (this.renderer) this.renderer.destroy();
  }
});
```

- [ ] **Step 4: 校验**

Run: `node scripts/check-handlers.js && node scripts/verify.js && npm test`
Expected: `ALL HANDLERS OK`、`VERIFY OK`、8 项测试全过

- [ ] **Step 5: 开发者工具人工验收（本任务必须）**

1. 从登录 → 创建向导 → 生成数字人，进度到 100% 后进入查看页；
2. canvas 显示参数化人体，单指拖动旋转、双指缩放、自动旋转、标注线随旋转同步；
3. 真机 iOS/安卓各跑一遍上述步骤（canvas 2d 兼容性）；
4. 断网/异常时查看页显示静态图 + 「重新渲染」可恢复。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/pages/avatar-3d/index.wxml miniprogram/pages/avatar-3d/index.wxss miniprogram/pages/avatar-3d/index.js
git commit -m "feat: 数字人 3D 查看页 canvas 渲染（旋转/缩放/标注/兜底）"
```

---

### Task 8: 全量校验与文档更新

**Files:**
- Modify: `docs/PRD-我形我衣-v1.0.md`（§14 追加 C-21）
- Modify: `weixin002/PRD-我形我衣-v1.0.md`（同步副本）
- Modify: `weixin002/design-audit.md`（05 页 P2 更新为已实现）

- [ ] **Step 1: 全量校验**

Run（`miniprogram/` 目录）：`node scripts/verify.js && node scripts/check-handlers.js && npm test`
Expected: `VERIFY OK`、`ALL HANDLERS OK`、测试全过

- [ ] **Step 2: PRD 追加 C-21**

在 `docs/PRD-我形我衣-v1.0.md` §14 表格 C-20 行后追加：

```markdown
| C-21 | 免费版数字人 3D（非 AI） | 数字人由参数化模型按身材档案实时生成（canvas 轻量 3D 渲染），支持单指旋转/双指缩放/身材标注，渲染失败降级静态图；AI 仿真版预留统一生成器接口（后续并行接入） | FR-08/09/10 |
```

同步追加到 `weixin002/PRD-我形我衣-v1.0.md` 对应表格。

- [ ] **Step 3: 更新 design-audit 05 记录**

`weixin002/design-audit.md` 中：

```markdown
- P2：旋转/标注/确认为 toast 示意，与真实 3D 交互差距，原型说明即可。
```

改为：

```markdown
- 已实现：旋转（拖动/自动）、双指缩放、身材标注线，参数化免费数字人（见 PRD C-21）；AI 仿真版为后续并行方案。
```

- [ ] **Step 4: 提交**

```bash
git add docs/PRD-我形我衣-v1.0.md weixin002/PRD-我形我衣-v1.0.md weixin002/design-audit.md
git commit -m "docs: PRD/design-audit 记录免费数字人 3D 实现（C-21）"
```

---

## 验收清单（全部完成后）

- [ ] `miniprogram` 目录下 `verify.js` / `check-handlers.js` / `npm test` 全绿；
- [ ] 生成链路：登录 → 向导（含身材保存）→ 照片（选填）→ 生成进度（真实生成 + 错误重试）→ 3D 查看；
- [ ] 3D 交互：拖动旋转、双指缩放、自动旋转、标注线随人体同步；
- [ ] 兜底：渲染失败显示静态图 + 重新渲染，不白屏；
- [ ] 真机 iOS + 安卓 canvas 渲染验证通过；
- [ ] PRD 变更记录 C-21 与 design-audit 同步完成。
