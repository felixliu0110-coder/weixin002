# AI 试穿视频方案实现计划（P0：云函数骨架 + mock + 前端改造）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「我形我衣」的数字人/试穿链路从免费参数化 3D 切换为 AI 方案：人物写实三视图一次生成、衣物四视图按需缓存、试穿结果改为 AI 180° 转身视频，并在 API Key 未配置时用 mock 跑通全链路。

**Architecture:** 云函数（`cloudfunctions/`）承担 AI 生成调度：`createAvatarViews` 生成人物三视图、`ensureGarmentViews` 生成衣物四视图缓存、`aiTryon` 生成穿衣效果图与转身视频、`onTryonComplete` 更新任务并通知。统一 AIGC 适配器（`services/aigc/`）在 Key 未配置时回退 mock；小程序前端 `api.js` 在云函数不可用时回退本地 mock，页面零感知。提示词模板源自 `.agnes/` 三份即梦提示词，参数化后由云函数组装。

**Tech Stack:** 微信原生小程序（基础库 3.17.1）、微信云开发（云函数 + 云数据库 + 云存储）、Node.js（云函数侧，CommonJS）、node:test 单元测试。

## Global Constraints

- 基础库 3.17.1；`es6`、`postcss`、`minified` 已开启；appid `wxe44ebc1661569b32`；云环境 `cloud1-d8gt95vnl0ec35c4f`。
- 所有源文件统一 UTF-8 编码；页面/资源命名英文小写中划线。
- `weixin002/` 原型目录只读，禁止写入小程序代码。
- 页面文案保留原型真实文案与数值；演示数据必须标注「示例」或替换为真实数据。
- AI 生成效果图/视频必须带「AI 生成」角标；分享标注"AI 生成效果，仅供参考"（FR-19、C-02）。
- 删除联动：删除模板衣物连带删除其四视图缓存；删除数字人连带删除三视图与相关视频。
- 免费 3D 相关代码（`utils/avatar3d/`、avatar-3d canvas 渲染、generate-progress 参数化生成）本计划内移除，不留并行入口。
- 小程序质量校验命令：`cd miniprogram; node scripts/verify.js; node scripts/check-handlers.js; npm test` 必须全绿。
- 云函数共享代码测试命令：`cd cloudfunctions/services; npm test` 必须全绿。
- 云函数部署前必须先运行 `node scripts/sync-cloud-services.js`，把 `cloudfunctions/services/` 同步到各函数目录；同步副本加入 `.gitignore`。
- 每个任务结束时提交 git（`git add <files> && git commit`），提交信息含 `feat|fix|chore|docs:` 前缀。

---

## 文件结构总览

```
cloudfunctions/
  services/                        # 共享纯逻辑（唯一源码，测试目标）
    package.json
    templates/avatarViews.js       # 人物三视图提示词组装
    templates/garmentViews.js      # 服装四视图提示词组装
    templates/tryonVideo.js        # 试穿视频提示词组装
    aigc/index.js                  # getAigc()：按 Key 是否配置选择 jimeng / mock
    aigc/jimeng.js                 # 即梦适配器（P0 仅配置检测与明确报错）
    aigc/mock.js                   # mock 适配器（返回占位 URL）
    templates.test.js
    aigc.test.js
  createAvatarViews/               # 人物三视图云函数（部署副本含 services/）
    index.js
    package.json
  ensureGarmentViews/
    index.js
    package.json
  aiTryon/
    index.js
    package.json
  onTryonComplete/
    index.js
    package.json
scripts/
  sync-cloud-services.js           # 复制 services/ 到各云函数目录
miniprogram/
  utils/mock.js                    # 扩展：AI 接口 mock + 视频素材
  utils/api.js                     # 扩展：createAvatarViews 等接口（cloud 优先，mock 回退）
  utils/mock.test.js               # 扩展断言
  utils/api.test.js                # 扩展 methods 清单
  assets/video/mock-turn.mp4       # CC0 占位视频（接入真实生成前演示播放）
  pages/generate-progress/         # 改为调 createAvatarViews 真实任务
  pages/avatar-3d/                 # 改为三视图预览页（删除 canvas）
  pages/tryon-select/index.js      # 提交链路：确保四视图 + 提交 aiTryon
  pages/image-preview/index.js     # 同上
  pages/tryon-progress/            # 轮询 aiTryon 任务
  pages/tryon-result/              # video 播放 + 效果图 + 三按钮
  components/record-item/          # 视频角标
  package.json                     # test 脚本移除 avatar3d
project.config.json                # 新增 cloudfunctionRoot
.gitignore                         # 新增 cloudfunctions/*/services/
docs/PRD-我形我衣-v1.0.md           # C-21 修正 + C-22 追加
weixin002/PRD-我形我衣-v1.0.md      # 副本同步
```

---

### Task 1: 云函数共享服务——提示词模板 + AIGC 适配器

**Files:**
- Create: `cloudfunctions/services/package.json`
- Create: `cloudfunctions/services/templates/avatarViews.js`
- Create: `cloudfunctions/services/templates/garmentViews.js`
- Create: `cloudfunctions/services/templates/tryonVideo.js`
- Create: `cloudfunctions/services/aigc/index.js`
- Create: `cloudfunctions/services/aigc/jimeng.js`
- Create: `cloudfunctions/services/aigc/mock.js`
- Create: `cloudfunctions/services/templates.test.js`
- Create: `cloudfunctions/services/aigc.test.js`

**Interfaces:**
- Produces（后续任务依赖）:
  - `buildAvatarViewsPrompt(profile) → string`，profile 字段：`heightCm, weightKg, shoeSize, shoulderCm, bustCm, waistCm, hipCm, armLengthCm, legLengthCm, neckLengthCm, skinTone`
  - `buildGarmentViewsPrompt(garmentName) → string`
  - `buildTryonVideoPrompt(profile, garmentName) → string`
  - `getAigc() → { name, generateImages, generateVideo }`；`generateImages({prompt, refImages, count}) → {urls:[...], provider}`；`generateVideo({imageUrl, prompt, durationSec}) → {videoUrl, provider}`

- [ ] **Step 1: 创建 `cloudfunctions/services/package.json`**

```json
{
  "name": "cloud-services",
  "version": "1.0.0",
  "private": true,
  "description": "共享提示词模板与 AIGC 适配器（纯 Node，可单测）",
  "scripts": { "test": "node --test" },
  "type": "commonjs"
}
```

- [ ] **Step 2: 创建 `cloudfunctions/services/templates/avatarViews.js`**

```js
/* 人物三视图提示词：源自 .agnes/jimeng-2026-08-16-7722-真人写实三视图生成提示词文档.md */
const SKIN_TONE_MAP = {
  light: "自然偏浅肤色",
  natural: "自然黄种人肤色",
  tan: "小麦色肤色",
  deep: "偏深肤色"
};

function skinToneDesc(skinTone) {
  return SKIN_TONE_MAP[skinTone] || "自然黄种人肤色";
}

function buildAvatarViewsPrompt(profile) {
  return `真人写实等比例三视图人物设定图，同一张图内横向并排展示完整人物的正面视图、左侧面视图、背面视图，三个视图的人物完全为同一人，站姿统一为双手自然垂于身体两侧、双脚分开与肩同宽，全程不做任何美颜美化、不加滤镜、不磨皮、不拉长腿、不调整五官比例，完全按照真实人体参数等比例还原：身高${profile.heightCm}cm、体重${profile.weightKg}kg、鞋码${profile.shoeSize}码，肩宽${profile.shoulderCm}cm，胸围${profile.bustCm}cm、腰围${profile.waistCm}cm、臀围${profile.hipCm}cm，臂长${profile.armLengthCm}cm，腿长${profile.legLengthCm}cm，颈长${profile.neckLengthCm}cm，${skinToneDesc(profile.skinTone)}，皮肤表面保留真实的细微毛孔、色素沉淀和自然肌理。纯白色纯净背景，均匀三点柔光打光，无多余道具、无装饰、无环境元素，画面仅展示三个视角的完整真人全身像，所有身体部位比例严格写实、不存在任何夸张美化效果。`;
}

module.exports = { buildAvatarViewsPrompt, skinToneDesc };
```

- [ ] **Step 3: 创建 `cloudfunctions/services/templates/garmentViews.js`**

```js
/* 服装四视图提示词：源自 .agnes/jimeng-2026-08-16-8289-通用服装四视图提示词模板.md */
function buildGarmentViewsPrompt(garmentName) {
  return `纯白普通背景，和原图一致的普通日常打光，不补光不刻意修瑕疵，画面和原图清晰度保持一致，完全保留【参考原图】的【${garmentName}】所有真实特征，生成该服装的四视图，四张视图2x2均等排布在同一张画布，内容各自独立：
1. 左上角：服装真实正面平拍，版型、颜色、所有细节和原图完全一致，不做任何美化
2. 右上角：服装真实45度斜侧角度实拍，自然呈现服装真实的立体形态，不刻意调整廓形
3. 左下角：服装真实局部细节特写，1:1还原原图面料纹理、缝线、纽扣/拉链等所有细节，不做锐化优化
4. 右下角：服装真实背面平拍，完整体现背面版型、所有背部设计，不对外观做任何美化修饰

全局强制约束：四张图里的服装和参考原图完全一模一样，颜色、面料、版型、所有细节100%匹配原图，原图有的小瑕疵、自然使用痕迹、水洗效果全部保留，不添加任何原图不存在的高级效果，完全真实写实，不做任何后期美化。`;
}

module.exports = { buildGarmentViewsPrompt };
```

- [ ] **Step 4: 创建 `cloudfunctions/services/templates/tryonVideo.js`**

```js
/* 试穿视频提示词：源自 .agnes/jimeng-2026-08-16-2206-写实人衣匹配视频生成提示词.md */
const { skinToneDesc } = require("./avatarViews");

function buildTryonVideoPrompt(profile, garmentName) {
  return `纯白色纯净背景，均匀三点柔光打光，无多余道具、无装饰、无多余环境元素，画面全程聚焦完整人物全身：
人物严格按照真实人体参数等比例还原：身高${profile.heightCm}cm、体重${profile.weightKg}kg、鞋码${profile.shoeSize}码，肩宽${profile.shoulderCm}cm，胸围${profile.bustCm}cm、腰围${profile.waistCm}cm、臀围${profile.hipCm}cm，臂长${profile.armLengthCm}cm，腿长${profile.legLengthCm}cm，颈长${profile.neckLengthCm}cm，${skinToneDesc(profile.skinTone)}，皮肤表面保留真实的细微毛孔、色素沉淀和自然肌理，全程不做任何美颜美化。
人物身上穿着指定参考服装【${garmentName}】，服装100%还原参考原图所有真实特征，版型、颜色、面料纹理、缝线、纽扣/拉链细节、水洗效果、自然使用痕迹和原图完全一致，不对服装做任何外观优化、不刻意提升质感、不添加任何原图不存在的高级效果。
人物初始站姿为双手自然垂于身体两侧、双脚分开与肩同宽，随后缓慢原地静态转身180度，镜头保持固定不动，完整自然展示人物从正面转向背面的全过程，依次呈现人物着装的正面、侧转过程、背面的完整全身效果，全程所有身体部位比例严格写实，服装与人体贴合自然，不出现任何夸张美化效果，完整呈现普通人日常着装的真实自然状态。
全局强制规则：全程无滤镜无后期美化，所有画面保持原生真实质感，允许视觉效果不够精致好看。`;
}

module.exports = { buildTryonVideoPrompt };
```

- [ ] **Step 5: 创建 `cloudfunctions/services/aigc/mock.js`**

```js
/* mock 适配器：Key 未配置或开发自测时使用，返回占位 URL */
const MOCK_IMAGE = "https://placeholder.example.com/mock.jpg";
const MOCK_VIDEO = "https://placeholder.example.com/mock.mp4";

module.exports = {
  name: "mock",
  async generateImages({ count }) {
    return { urls: Array(count || 1).fill(MOCK_IMAGE), provider: "mock" };
  },
  async generateVideo() {
    return { videoUrl: MOCK_VIDEO, provider: "mock" };
  }
};
```

- [ ] **Step 6: 创建 `cloudfunctions/services/aigc/jimeng.js`**

```js
/* 即梦/火山方舟适配器：P0 只做配置检测与明确报错；真实接口接入见 P1（设计文档 §10） */
function getKey() {
  return process.env.JIMENG_API_KEY || process.env.AIGC_API_KEY || "";
}

function notConfiguredError() {
  const err = new Error("AIGC_NOT_CONFIGURED: 未配置 JIMENG_API_KEY / AIGC_API_KEY 环境变量");
  err.code = "AIGC_NOT_CONFIGURED";
  return err;
}

module.exports = {
  name: "jimeng",
  isConfigured() {
    return !!getKey();
  },
  async generateImages() {
    if (!getKey()) throw notConfiguredError();
    // P1：调用即梦/火山方舟生图接口（按三视图/四视图提示词 + 参考图）
    throw Object.assign(new Error("JIMENG_IMAGES_NOT_IMPLEMENTED: 真实生图接口将在 P1 接入"), { code: "JIMENG_IMAGES_NOT_IMPLEMENTED" });
  },
  async generateVideo() {
    if (!getKey()) throw notConfiguredError();
    // P1：调用即梦/火山方舟图生视频接口
    throw Object.assign(new Error("JIMENG_VIDEO_NOT_IMPLEMENTED: 真实视频接口将在 P1 接入"), { code: "JIMENG_VIDEO_NOT_IMPLEMENTED" });
  }
};
```

- [ ] **Step 7: 创建 `cloudfunctions/services/aigc/index.js`**

```js
const mock = require("./mock");
const jimeng = require("./jimeng");

function getAigc() {
  return jimeng.isConfigured() ? jimeng : mock;
}

module.exports = { getAigc };
```

- [ ] **Step 8: 写测试 `cloudfunctions/services/templates.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert");
const { buildAvatarViewsPrompt } = require("./templates/avatarViews");
const { buildGarmentViewsPrompt } = require("./templates/garmentViews");
const { buildTryonVideoPrompt } = require("./templates/tryonVideo");

const profile = {
  heightCm: 165, weightKg: 50, shoeSize: 38,
  shoulderCm: 38, bustCm: 88, waistCm: 66, hipCm: 92,
  armLengthCm: 55, legLengthCm: 96, neckLengthCm: 9,
  skinTone: "natural"
};

test("buildAvatarViewsPrompt 包含全部身材参数", () => {
  const p = buildAvatarViewsPrompt(profile);
  ["165cm", "50kg", "38码", "38cm", "88cm", "66cm", "92cm", "55cm", "96cm", "9cm", "自然黄种人肤色"].forEach((s) => {
    assert.ok(p.includes(s), "缺少 " + s);
  });
  assert.ok(p.includes("正面视图") && p.includes("左侧面视图") && p.includes("背面视图"));
});

test("buildGarmentViewsPrompt 包含服装名与四视图要求", () => {
  const p = buildGarmentViewsPrompt("浅蓝色水洗直筒牛仔裤");
  assert.ok(p.includes("浅蓝色水洗直筒牛仔裤"));
  assert.ok(p.includes("2x2均等排布"));
  assert.ok(p.includes("正面平拍") && p.includes("背面平拍"));
});

test("buildTryonVideoPrompt 包含参数与180度转身", () => {
  const p = buildTryonVideoPrompt(profile, "白色基础T恤");
  assert.ok(p.includes("165cm") && p.includes("白色基础T恤"));
  assert.ok(p.includes("原地静态转身180度"));
  assert.ok(p.includes("无滤镜"));
});
```

- [ ] **Step 9: 写测试 `cloudfunctions/services/aigc.test.js`**

```js
const test = require("node:test");
const assert = require("node:assert");
const { getAigc } = require("./aigc");
const mock = require("./aigc/mock");
const jimeng = require("./aigc/jimeng");

test("未配置 Key 时 getAigc 返回 mock", () => {
  delete process.env.JIMENG_API_KEY;
  delete process.env.AIGC_API_KEY;
  assert.strictEqual(getAigc().name, "mock");
});

test("配置 JIMENG_API_KEY 时 getAigc 返回 jimeng", () => {
  process.env.JIMENG_API_KEY = "test-key";
  assert.strictEqual(getAigc().name, "jimeng");
  delete process.env.JIMENG_API_KEY;
});

test("jimeng 未配置时抛 AIGC_NOT_CONFIGURED", async () => {
  delete process.env.JIMENG_API_KEY;
  delete process.env.AIGC_API_KEY;
  await assert.rejects(() => jimeng.generateImages({}), (e) => e.code === "AIGC_NOT_CONFIGURED");
});

test("mock.generateImages 返回指定数量占位 URL", async () => {
  const res = await mock.generateImages({ count: 3 });
  assert.strictEqual(res.urls.length, 3);
  assert.strictEqual(res.provider, "mock");
});
```

- [ ] **Step 10: 运行测试确认全绿**

Run: `cd cloudfunctions/services && npm test`
Expected: 6 个测试全部 PASS。

- [ ] **Step 11: 提交**

```bash
git add cloudfunctions/services
git commit -m "feat: 云函数共享服务——三份AI提示词模板与AIGC适配器（mock/jimeng）"
```

---

### Task 2: 云函数入口骨架 + 同步脚本 + 工程配置

**Files:**
- Create: `cloudfunctions/createAvatarViews/index.js`
- Create: `cloudfunctions/createAvatarViews/package.json`
- Create: `cloudfunctions/ensureGarmentViews/index.js`
- Create: `cloudfunctions/ensureGarmentViews/package.json`
- Create: `cloudfunctions/aiTryon/index.js`
- Create: `cloudfunctions/aiTryon/package.json`
- Create: `cloudfunctions/onTryonComplete/index.js`
- Create: `cloudfunctions/onTryonComplete/package.json`
- Create: `scripts/sync-cloud-services.js`
- Modify: `project.config.json`（新增 `cloudfunctionRoot`）
- Create: `.gitignore`（若已存在则追加一行）

**Interfaces:**
- Consumes: `getAigc()`、`buildAvatarViewsPrompt`、`buildGarmentViewsPrompt`、`buildTryonVideoPrompt`（Task 1）
- Produces:
  - `createAvatarViews.main(event)`：`event.profile` + `event.refImages` → `{ ok, avatarViewId?, status?, views?, error? }`；写入 `avatar_views` 集合
  - `ensureGarmentViews.main(event)`：`event.garmentId/garmentName/garmentImage` → `{ ok, garmentViewId?, status?, views?, cached?, error? }`；写入 `garment_views`
  - `aiTryon.main(event)`：`event.action === "submit" | "status"`；submit 入参 `avatarViewId, garmentIds, garmentNames` → `{ ok, taskId, status }`；status 入参 `taskId` → `{ ok, taskId, status, stage, tryonImage?, tryonVideo?, error? }`
  - `onTryonComplete.main(event)`：`event.taskId, event.status, event.result` → `{ ok }`；更新 `tryon_tasks` 并在成功时写 `tryon_results`

- [ ] **Step 1: 修改 `project.config.json`，新增 cloudfunctionRoot**

在 `"miniprogramRoot": "miniprogram/"` 之后加一行：

```json
  "cloudfunctionRoot": "cloudfunctions/",
```

- [ ] **Step 2: 创建 `.gitignore`（若不存在）**

```gitignore
cloudfunctions/*/services/
node_modules/
```

若 `.gitignore` 已存在，只追加 `cloudfunctions/*/services/` 一行（保留原内容）。

- [ ] **Step 3: 创建 `scripts/sync-cloud-services.js`**

```js
/* 部署云函数前运行：把 cloudfunctions/services 同步到各云函数目录，保证 require("./services/...") 可解析 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "cloudfunctions");
const src = path.join(root, "services");
const targets = fs.readdirSync(root).filter((name) => {
  return fs.statSync(path.join(root, name)).isDirectory() && name !== "services";
});

for (const name of targets) {
  const target = path.join(root, name, "services");
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(src, target, { recursive: true });
  console.log("synced ->", path.relative(path.resolve(__dirname, ".."), target));
}
console.log("done: " + targets.length + " 个云函数已同步 services");
```

- [ ] **Step 4: 创建 `cloudfunctions/createAvatarViews/index.js`**

```js
const cloud = require("wx-server-sdk");
const { getAigc } = require("./services/aigc");
const { buildAvatarViewsPrompt } = require("./services/templates/avatarViews");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  const profile = event.profile || {};
  const aigc = getAigc();
  const prompt = buildAvatarViewsPrompt(profile);
  try {
    const res = await aigc.generateImages({ prompt, refImages: event.refImages || [], count: 1 });
    const doc = {
      user_id: openid,
      profile_snapshot: profile,
      views: { composite: res.urls[0] },
      provider: res.provider,
      status: "ready",
      created_at: Date.now()
    };
    const addRes = await db.collection("avatar_views").add({ data: doc });
    return { ok: true, avatarViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    return { ok: false, error: e.code || e.message };
  }
};
```

- [ ] **Step 5: 创建 `cloudfunctions/createAvatarViews/package.json`**

```json
{
  "name": "createAvatarViews",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": { "wx-server-sdk": "~2.6.3" }
}
```

- [ ] **Step 6: 创建 `cloudfunctions/ensureGarmentViews/index.js`**

```js
const cloud = require("wx-server-sdk");
const { getAigc } = require("./services/aigc");
const { buildGarmentViewsPrompt } = require("./services/templates/garmentViews");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  const { garmentId, garmentName, garmentImage } = event;
  if (!garmentId || !garmentName) {
    return { ok: false, error: "garmentId/garmentName 必填" };
  }
  try {
    // 缓存命中直接返回
    const cached = await db.collection("garment_views").where({ garment_id: garmentId }).limit(1).get();
    if (cached.data.length > 0 && cached.data[0].status === "ready") {
      return { ok: true, cached: true, garmentViewId: cached.data[0]._id, status: "ready", views: cached.data[0].views };
    }
    const aigc = getAigc();
    const prompt = buildGarmentViewsPrompt(garmentName);
    const res = await aigc.generateImages({ prompt, refImages: garmentImage ? [garmentImage] : [], count: 1 });
    const doc = {
      garment_id: garmentId,
      user_id: openid,
      views: { composite: res.urls[0] },
      provider: res.provider,
      status: "ready",
      created_at: Date.now()
    };
    const addRes = await db.collection("garment_views").add({ data: doc });
    return { ok: true, cached: false, garmentViewId: addRes._id, status: "ready", views: doc.views };
  } catch (e) {
    return { ok: false, error: e.code || e.message };
  }
};
```

- [ ] **Step 7: 创建 `cloudfunctions/ensureGarmentViews/package.json`**

```json
{
  "name": "ensureGarmentViews",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": { "wx-server-sdk": "~2.6.3" }
}
```

- [ ] **Step 8: 创建 `cloudfunctions/aiTryon/index.js`**

```js
const cloud = require("wx-server-sdk");
const { getAigc } = require("./services/aigc");
const { buildTryonVideoPrompt } = require("./services/templates/tryonVideo");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function submit(event, openid) {
  const { avatarViewId, garmentIds, garmentNames } = event;
  if (!avatarViewId || !garmentIds || garmentIds.length === 0) {
    return { ok: false, error: "avatarViewId/garmentIds 必填" };
  }
  const av = await db.collection("avatar_views").doc(avatarViewId).get();
  const profile = av.data.profile_snapshot || {};
  const garmentName = (garmentNames && garmentNames[0]) || "所选衣物";
  const aigc = getAigc();
  const videoPrompt = buildTryonVideoPrompt(profile, garmentName);
  const task = {
    user_id: openid,
    avatar_view_id: avatarViewId,
    garment_ids: garmentIds,
    type: "ai_video",
    stage: "video",
    status: "processing",
    retry_count: 0,
    created_at: Date.now(),
    updated_at: Date.now()
  };
  const addRes = await db.collection("tryon_tasks").add({ data: task });
  const taskId = addRes._id;
  try {
    // 试穿图 + 转身视频（P0 真实生成在 P1；此处调用适配器，mock 立即返回占位）
    const imgRes = await aigc.generateImages({ prompt: "同人物穿着" + garmentName + "的照片级效果图", refImages: [], count: 1 });
    const vidRes = await aigc.generateVideo({ imageUrl: imgRes.urls[0], prompt: videoPrompt, durationSec: 5 });
    const update = {
      stage: "video",
      status: "success",
      tryon_image: imgRes.urls[0],
      tryon_video: vidRes.videoUrl,
      updated_at: Date.now()
    };
    await db.collection("tryon_tasks").doc(taskId).update({ data: update });
    return { ok: true, taskId, status: "success" };
  } catch (e) {
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status: "failed", error: e.code || e.message, updated_at: Date.now() } });
    return { ok: false, taskId, error: e.code || e.message };
  }
}

async function status(event) {
  const res = await db.collection("tryon_tasks").doc(event.taskId).get();
  const d = res.data;
  return { ok: true, taskId: event.taskId, status: d.status, stage: d.stage, tryonImage: d.tryon_image, tryonVideo: d.tryon_video, error: d.error };
}

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  if (event.action === "status") return status(event);
  return submit(event, openid);
};
```

- [ ] **Step 9: 创建 `cloudfunctions/aiTryon/package.json`**

```json
{
  "name": "aiTryon",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": { "wx-server-sdk": "~2.6.3" }
}
```

- [ ] **Step 10: 创建 `cloudfunctions/onTryonComplete/index.js`**

```js
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { taskId, status, result } = event;
  if (!taskId || !status) return { ok: false, error: "taskId/status 必填" };
  try {
    const taskRes = await db.collection("tryon_tasks").doc(taskId).get();
    const task = taskRes.data;
    await db.collection("tryon_tasks").doc(taskId).update({ data: { status, updated_at: Date.now() } });
    if (status === "success" && result) {
      await db.collection("tryon_results").add({
        data: {
          user_id: task.user_id,
          avatar_view_id: task.avatar_view_id,
          garment_id: (task.garment_ids || [])[0],
          garment_name: (result.garmentName || "AI 试穿"),
          tryon_image: result.tryonImage || task.tryon_image,
          tryon_video: result.tryonVideo || task.tryon_video,
          ai_tagged: true,
          created_at: Date.now()
        }
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};
```

- [ ] **Step 11: 创建 `cloudfunctions/onTryonComplete/package.json`**

```json
{
  "name": "onTryonComplete",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": { "wx-server-sdk": "~2.6.3" }
}
```

- [ ] **Step 12: 运行同步脚本并做语法检查**

Run: `node scripts/sync-cloud-services.js`
Expected: 输出 4 行 "synced -> ..."，且 `cloudfunctions/createAvatarViews/services/` 等目录存在。

Run: `node --check cloudfunctions/createAvatarViews/index.js; node --check cloudfunctions/ensureGarmentViews/index.js; node --check cloudfunctions/aiTryon/index.js; node --check cloudfunctions/onTryonComplete/index.js`
Expected: 无输出、退出码 0。

- [ ] **Step 13: 提交**

```bash
git add project.config.json .gitignore scripts/sync-cloud-services.js cloudfunctions/createAvatarViews cloudfunctions/ensureGarmentViews cloudfunctions/aiTryon cloudfunctions/onTryonComplete
git commit -m "feat: 云函数入口骨架（createAvatarViews/ensureGarmentViews/aiTryon/onTryonComplete）与services同步脚本"
```

---

### Task 3: 小程序数据层——AI 接口 + mock + 占位视频素材

**Files:**
- Modify: `miniprogram/utils/mock.js`
- Modify: `miniprogram/utils/api.js`
- Modify: `miniprogram/utils/mock.test.js`
- Modify: `miniprogram/utils/api.test.js`
- Create: `miniprogram/assets/video/mock-turn.mp4`（CC0 占位视频，来源 MDN flower.mp4，接入真实生成后替换）

**Interfaces:**
- Consumes: 现有 `mock.js` / `api.js` 风格（cloud 优先、mock 回退）
- Produces（后续任务依赖）:
  - `api.createAvatarViews(profile) → Promise<{taskId?, avatarViewId?, status, views?}>`
  - `api.getAvatarViews() → Promise<{status, views:{composite}, isExample}>`
  - `api.ensureGarmentViews(garmentId, garmentName, garmentImage) → Promise<{ok, status, views?, cached?}>`
  - `api.submitAiTryon({avatarViewId, garmentIds, garmentNames}) → Promise<{taskId, status}>`
  - `api.getAiTryonStatus(taskId) → Promise<{taskId, status, stage, tryonImage?, tryonVideo?, error?}>`
  - `api.saveAiResult(result) → Promise<{ok, id}>`（收藏时写入，含 videoUrl）

- [ ] **Step 1: 复制占位视频素材**

Run: `New-Item -ItemType Directory -Force -Path miniprogram\assets\video | Out-Null; Copy-Item "$env:TEMP\mock-turn.mp4" miniprogram\assets\video\mock-turn.mp4 -Force`
Expected: `miniprogram/assets/video/mock-turn.mp4` 存在，大小约 1.1MB。

- [ ] **Step 2: 扩展 `miniprogram/utils/mock.js`**

在 `module.exports` 前追加：

```js
const avatarViews = {
  status: "ready",
  views: { composite: "/assets/img/p05-avatar.jpg" },
  provider: "mock",
  isExample: true
};

let garmentViewsCache = {};
let aiTryonTasks = {};

async function mockCreateAvatarViews(profile) {
  // mock：立即生成，三视图占位用原型数字人图
  return { avatarViewId: "av-mock-" + Date.now(), status: "ready", views: avatarViews.views };
}

async function mockEnsureGarmentViews(garmentId, garmentName) {
  if (garmentViewsCache[garmentId] && garmentViewsCache[garmentId].status === "ready") {
    return { ok: true, cached: true, status: "ready", views: garmentViewsCache[garmentId].views };
  }
  const views = { composite: "/assets/img/p06-tee.jpg" };
  garmentViewsCache[garmentId] = { status: "ready", views };
  return { ok: true, cached: false, status: "ready", views };
}

async function mockSubmitAiTryon(params) {
  const taskId = "task-ai-" + Date.now();
  aiTryonTasks[taskId] = {
    taskId,
    status: "processing",
    stage: "garment_views",
    poll: 0,
    tryonImage: "/assets/img/p07-result.jpg",
    tryonVideo: "/assets/video/mock-turn.mp4"
  };
  return { taskId, status: "processing" };
}

async function mockGetAiTryonStatus(taskId) {
  const t = aiTryonTasks[taskId];
  if (!t) {
    return {
      taskId,
      status: "processing",
      stage: "garment_views",
      tryonImage: "/assets/img/p07-result.jpg",
      tryonVideo: "/assets/video/mock-turn.mp4"
    };
  }
  t.poll = (t.poll || 0) + 1;
  if (t.poll === 1) return { taskId, status: "processing", stage: "garment_views" };
  if (t.poll === 2) return { taskId, status: "processing", stage: "video" };
  t.status = "success";
  return { taskId, status: "success", stage: "video", tryonImage: t.tryonImage, tryonVideo: t.tryonVideo };
}
```

然后在 `module.exports` 中加入：

```js
  getAvatarViews() { return Promise.resolve(JSON.parse(JSON.stringify(avatarViews))); },
  createAvatarViews: mockCreateAvatarViews,
  ensureGarmentViews: mockEnsureGarmentViews,
  submitAiTryon: mockSubmitAiTryon,
  getAiTryonStatus: mockGetAiTryonStatus,
  async saveAiResult(result) {
    const item = {
      id: "f-ai-" + Date.now(),
      garmentName: result.garmentName || "AI 试穿",
      date: "刚刚",
      image: result.tryonImage || "/assets/img/p07-result.jpg",
      videoUrl: result.tryonVideo || "/assets/video/mock-turn.mp4",
      aiTagged: true
    };
    favorites.unshift(item);
    return { ok: true, id: item.id };
  },
```

并修改现有 `deleteItems` 实现，删除模板衣物/我的模板时同步清理四视图缓存（删除联动）：

```js
  async deleteItems(kind, ids) {
    if (kind === "history") history = history.filter((i) => !ids.includes(i.id));
    if (kind === "favorites") favorites = favorites.filter((i) => !ids.includes(i.id));
    if (kind === "myTemplates") myTemplates = myTemplates.filter((i) => !ids.includes(i.id));
    if (kind === "library") garmentLibrary = garmentLibrary.filter((i) => !ids.includes(i.id));
    if (kind === "library" || kind === "myTemplates") {
      ids.forEach((id) => { delete garmentViewsCache[id]; });
    }
    return { ok: true };
  },
```

- [ ] **Step 3: 扩展 `miniprogram/utils/api.js`**

在 `module.exports` 中新增（放在 `getQuota` 附近、`getUserInfo` 之前）：

```js
  async createAvatarViews(profile) {
    if (!cloudReady()) return mock.createAvatarViews(profile);
    try {
      const res = await wx.cloud.callFunction({ name: "createAvatarViews", data: { profile } });
      const r = res.result;
      if (!r.ok) return mock.createAvatarViews(profile);
      return r;
    } catch (e) {
      return mock.createAvatarViews(profile);
    }
  },

  async getAvatarViews() {
    if (!cloudReady()) return mock.getAvatarViews();
    try {
      const res = await db().collection("avatar_views").orderBy("createdAt", "desc").limit(1).get();
      if (res.data.length === 0) return mock.getAvatarViews();
      const d = res.data[0];
      return { status: d.status, views: d.views, isExample: false };
    } catch (e) {
      return mock.getAvatarViews();
    }
  },

  async ensureGarmentViews(garmentId, garmentName, garmentImage) {
    if (!cloudReady()) return mock.ensureGarmentViews(garmentId, garmentName);
    try {
      const res = await wx.cloud.callFunction({
        name: "ensureGarmentViews",
        data: { garmentId, garmentName, garmentImage }
      });
      const r = res.result;
      if (!r.ok) return mock.ensureGarmentViews(garmentId, garmentName);
      return r;
    } catch (e) {
      return mock.ensureGarmentViews(garmentId, garmentName);
    }
  },

  async submitAiTryon(params) {
    if (!cloudReady()) return mock.submitAiTryon(params);
    try {
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: Object.assign({ action: "submit" }, params) });
      const r = res.result;
      if (!r.ok) return mock.submitAiTryon(params);
      return r;
    } catch (e) {
      return mock.submitAiTryon(params);
    }
  },

  async getAiTryonStatus(taskId) {
    if (!cloudReady()) return mock.getAiTryonStatus(taskId);
    try {
      const res = await wx.cloud.callFunction({ name: "aiTryon", data: { action: "status", taskId } });
      return res.result;
    } catch (e) {
      return mock.getAiTryonStatus(taskId);
    }
  },

  async saveAiResult(result) {
    if (!cloudReady()) return mock.saveAiResult(result);
    try {
      const item = {
        garmentName: result.garmentName || "AI 试穿",
        image: result.tryonImage || "/assets/img/p07-result.jpg",
        videoUrl: result.tryonVideo || "",
        aiTagged: true,
        createdAt: Date.now()
      };
      const res = await db().collection("favorites").add({ data: item });
      return { ok: true, id: res._id };
    } catch (e) {
      return mock.saveAiResult(result);
    }
  },
```

- [ ] **Step 4: 更新 `miniprogram/utils/mock.test.js`**

在文件末尾追加：

```js
test("mock AI 接口可用且返回占位素材", async () => {
  const views = await mock.getAvatarViews();
  assert.ok(views.views.composite.includes("/assets/img/p05-avatar.jpg"));
  const gv = await mock.ensureGarmentViews("g-tee", "白色基础T恤");
  assert.strictEqual(gv.status, "ready");
  const cached = await mock.ensureGarmentViews("g-tee", "白色基础T恤");
  assert.strictEqual(cached.cached, true);
  const t = await mock.submitAiTryon({ avatarViewId: "av-1", garmentIds: ["g-tee"] });
  assert.strictEqual(t.status, "processing");
  const s1 = await mock.getAiTryonStatus(t.taskId);
  assert.strictEqual(s1.stage, "garment_views");
  const s2 = await mock.getAiTryonStatus(t.taskId);
  assert.strictEqual(s2.stage, "video");
  const s3 = await mock.getAiTryonStatus(t.taskId);
  assert.strictEqual(s3.status, "success");
  assert.ok(s3.tryonVideo.includes(".mp4"));
  // 删除联动：删除模板衣物后四视图缓存被清理
  const before = await mock.ensureGarmentViews("g-del-test", "测试衣物");
  assert.strictEqual(before.cached, false);
  await mock.deleteItems("library", ["g-del-test"]);
  const after = await mock.ensureGarmentViews("g-del-test", "测试衣物");
  assert.strictEqual(after.cached, false);
});
```

（先确认文件顶部已有 `const mock = require("./mock");`，没有则补上。）

- [ ] **Step 5: 更新 `miniprogram/utils/api.test.js` 的 methods 数组**

把 `const methods = [...]` 数组改为：

```js
  const methods = ["getAvatarProfile", "saveAvatarProfile", "getGarmentTemplates", "getGarmentLibrary", "getMyTemplates", "addToMyTemplates", "getHomeTemplates", "uploadGarment", "submitTryon", "getTryonStatus", "getHistory", "getFavorites", "deleteItems", "saveToTemplates", "recognizeGarment", "getQuota", "getUserInfo", "saveUserInfo", "logout", "saveResult", "deleteUserData", "createAvatarViews", "getAvatarViews", "ensureGarmentViews", "submitAiTryon", "getAiTryonStatus", "saveAiResult"];
```

- [ ] **Step 6: 运行测试确认全绿**

Run: `cd miniprogram && npm test`
Expected: 全部 PASS（含原有 utils 测试与新增断言）。

- [ ] **Step 7: 提交**

```bash
git add miniprogram/utils/mock.js miniprogram/utils/api.js miniprogram/utils/mock.test.js miniprogram/utils/api.test.js miniprogram/assets/video/mock-turn.mp4
git commit -m "feat: 小程序数据层新增AI三视图/四视图/试穿接口（cloud优先mock回退）与占位视频素材"
```

---

### Task 4: generate-progress 改造——真实 AI 三视图任务

**Files:**
- Modify: `miniprogram/pages/generate-progress/index.js`
- Modify: `miniprogram/pages/generate-progress/index.wxml`
- Modify: `miniprogram/pages/generate-progress/index.wxss`（如需要微调文案样式，可跳过）

**Interfaces:**
- Consumes: `api.getAvatarProfile`、`api.createAvatarViews`、`api.getAvatarViews`（Task 3）
- Produces: 完成后跳转 `/pages/avatar-3d/index`

- [ ] **Step 1: 重写 `miniprogram/pages/generate-progress/index.js`**

```js
const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { percent: 0, error: false, stageText: "正在生成 AI 三视图" },
  onLoad() {
    this.run();
  },
  async run() {
    this.setData({ percent: 0, error: false });
    try {
      const profile = await api.getAvatarProfile();
      const av = await api.createAvatarViews(profile);
      if (av && av.avatarViewId) {
        wx.setStorageSync("avatarViewId", av.avatarViewId);
      } else {
        wx.setStorageSync("avatarViewId", "av-current");
      }
      this.animateTo100();
    } catch (e) {
      this.setData({ error: true });
    }
  },
  animateTo100() {
    this._startTimer = setTimeout(() => {
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          toast("三视图已生成");
          this._navTimer = setTimeout(() => navigate("/pages/avatar-3d/index"), 1200);
        }
      }, 20);
    }, 300);
  },
  retry() {
    this.setData({ percent: 0, error: false });
    this.run();
  },
  onUnload() {
    if (this._frameTimer) clearInterval(this._frameTimer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
```

- [ ] **Step 2: 更新 `miniprogram/pages/generate-progress/index.wxml`**

把 `gen-title` / `gen-sub` 和 `gen-cards` 内容替换为：

```xml
      <view class="gen-title">正在生成你的 AI 三视图~</view>
      <view class="gen-sub">根据身材档案生成写实三视图（正面 / 侧面 / 背面）</view>

      <view class="gen-cards">
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-star-deep.png" /></view>
          <view class="gc-label">生成方式</view>
          <view class="gc-val">AI 写实 · 三视图</view>
        </view>
        <view class="gen-card">
          <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-clock-deep.png" /></view>
          <view class="gc-label">预计还需</view>
          <view class="gc-val">约 30 秒（示例）</view>
        </view>
      </view>
```

- [ ] **Step 3: 验证页面无报错**

Run: `cd miniprogram && node scripts/check-handlers.js`
Expected: 无缺失 handler 报错。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/generate-progress
git commit -m "feat: 生成进度页改为AI三视图生成任务（mock回退）"
```

---

### Task 5: avatar-3d 改造——三视图预览页（删除 canvas 3D）

**Files:**
- Rewrite: `miniprogram/pages/avatar-3d/index.js`
- Rewrite: `miniprogram/pages/avatar-3d/index.wxml`
- Modify: `miniprogram/pages/avatar-3d/index.wxss`（移除 canvas 专属样式，改为图片预览样式）

**Interfaces:**
- Consumes: `api.getAvatarViews`、`api.getAvatarProfile`（Task 3）
- Produces: 页面标题「我的 AI 数字人」；按钮：确认（保存并回首页）、重新生成（回 generate-progress）、编辑、去试穿

- [ ] **Step 1: 重写 `miniprogram/pages/avatar-3d/index.js`**

```js
const { toast, navigate, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    views: { composite: "" },
    isExample: false,
    profile: { heightCm: "--", weightKg: "--", waistCm: "--", legLengthCm: "--" }
  },
  onLoad() {
    api.getAvatarProfile().then((profile) => this.setData({ profile }));
    api.getAvatarViews().then((av) => {
      this.setData({ views: av.views || { composite: "" }, isExample: !!av.isExample });
    });
  },
  onConfirm() {
    toast("AI 三视图已确认");
    navigate("/pages/home/index");
  },
  regenerate() {
    navigate("/pages/generate-progress/index");
  },
  edit() {
    navigate("/pages/basic-info/index");
  },
  goTryon() {
    navigate("/pages/tryon-select/index");
  }
});
```

- [ ] **Step 2: 重写 `miniprogram/pages/avatar-3d/index.wxml`**

```xml
<view class="wx-page">
  <nav-bar title="我的 AI 数字人" showBack="{{true}}" backRoute="/pages/home/index"></nav-bar>

  <view class="content">
    <view class="avatar-stage">
      <image wx:if="{{views.composite}}" class="avatar-img" src="{{views.composite}}" mode="widthFix" />
      <view wx:else class="stage-fallback">
        <text class="fb-text">尚未生成三视图，先完成生成</text>
        <btn class="fb-btn" type="secondary" size="sm" bindtap="regenerate">去生成</btn>
      </view>
      <view wx:if="{{isExample}}" class="example-tag">示例</view>
      <view class="view-labels">
        <text>正面</text>
        <text>侧面</text>
        <text>背面</text>
      </view>
    </view>
    <view class="meas-hint">同一人物 · 正面 / 左侧面 / 背面，AI 写实生成</view>

    <card class="profile-card">
      <view class="sec-hd">
        <text class="sec-title">身材档案</text>
        <view class="more" hover-class="more-hover" bindtap="edit">编辑<image class="ic-img" style="width:26rpx;height:26rpx" src="/assets/icons/png/icon-chevron-right-gray.png" /></view>
      </view>
      <view class="profile-grid">
        <view class="p-cell"><text class="pc-label">身高</text><text class="pc-val mono">{{profile.heightCm}}cm</text></view>
        <view class="p-cell"><text class="pc-label">体重</text><text class="pc-val mono">{{profile.weightKg}}kg</text></view>
        <view class="p-cell"><text class="pc-label">腰围</text><text class="pc-val mono">{{profile.waistCm}}cm</text></view>
        <view class="p-cell"><text class="pc-label">腿长</text><text class="pc-val mono">{{profile.legLengthCm}}cm</text></view>
      </view>
    </card>
  </view>

  <view class="footer-bar">
    <btn class="footer-main" type="primary" bindtap="goTryon">去试穿</btn>
    <btn class="footer-sub" type="secondary" bindtap="onConfirm">确认保存</btn>
  </view>
</view>
```

- [ ] **Step 3: 更新 `miniprogram/pages/avatar-3d/index.wxss`**

删除 `.avatar-canvas` 相关样式（canvas、`circle-actions` 不再需要），保留 `.avatar-stage`、`.profile-card` 等，并追加：

```css
.avatar-stage { position: relative; background: #FFFFFF; border-radius: 24rpx; overflow: hidden; }
.avatar-img { width: 100%; display: block; }
.example-tag { position: absolute; top: 16rpx; left: 16rpx; background: rgba(31,29,27,0.55); color: #FFFFFF; font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
.view-labels { display: flex; justify-content: space-between; padding: 14rpx 40rpx 18rpx; color: #8F8378; font-size: 22rpx; }
.stage-fallback { min-height: 480rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20rpx; }
.footer-bar { display: flex; gap: 20rpx; padding-bottom: env(safe-area-inset-bottom); }
.footer-main { flex: 2; }
.footer-sub { flex: 1; }
```

（若原有 `.footer-bar` / `.footer-main` 已有定义，直接在其上追加 `.footer-sub`，避免重复冲突。）

- [ ] **Step 4: 验证页面无报错**

Run: `cd miniprogram && node scripts/check-handlers.js`
Expected: 无缺失 handler 报错（avatar-3d 页面方法：onConfirm / regenerate / edit / goTryon 全部有定义）。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/avatar-3d
git commit -m "feat: 数字人页改为AI三视图预览（删除canvas 3D渲染/旋转/缩放/标注）"
```

---

### Task 6: 删除免费 3D 模块并更新测试脚本

**Files:**
- Delete: `miniprogram/utils/avatar3d/build-model.js`
- Delete: `miniprogram/utils/avatar3d/build-model.test.js`
- Delete: `miniprogram/utils/avatar3d/provider.js`
- Delete: `miniprogram/utils/avatar3d/provider.test.js`
- Delete: `miniprogram/utils/avatar3d/renderer.js`
- Delete: `miniprogram/utils/avatar3d/renderer.test.js`
- Modify: `miniprogram/package.json`（test 脚本移除 avatar3d）

- [ ] **Step 1: 删除 `miniprogram/utils/avatar3d/` 目录**

Run: `Remove-Item -Recurse -Force miniprogram\utils\avatar3d`
Expected: 目录不存在；`rg -n "avatar3d" miniprogram` 仅剩 package.json 引用（下一步修复）。

- [ ] **Step 2: 修改 `miniprogram/package.json` 的 test 脚本**

```json
  "scripts": {
    "test": "node --test utils/*.test.js",
```

- [ ] **Step 3: 确认没有残留引用**

Run: `rg -n "avatar3d|provider\.generate|AvatarRenderer" miniprogram/pages miniprogram/utils miniprogram/app.json`
Expected: 无匹配。

- [ ] **Step 4: 运行测试确认全绿**

Run: `cd miniprogram && npm test`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A miniprogram/utils miniprogram/package.json
git commit -m "chore: 移除免费3D参数化模块（utils/avatar3d）并更新测试脚本"
```

---

### Task 7: tryon-select / image-preview 提交链路——确保四视图 + 提交 aiTryon

**Files:**
- Modify: `miniprogram/pages/tryon-select/index.js`（`startTryon`）
- Modify: `miniprogram/pages/image-preview/index.js`（`confirm`）

**Interfaces:**
- Consumes: `api.ensureGarmentViews`、`api.submitAiTryon`（Task 3）
- Produces: 写入 storage `aiTryonTask`（`{taskId, garmentName}`），跳转 `/pages/tryon-progress/index`

- [ ] **Step 1: 修改 `miniprogram/pages/tryon-select/index.js` 的 `startTryon`**

```js
  startTryon() {
    if (this.data.selectedCount === 0) {
      toast("请先选择一件衣物");
      return;
    }
    if (this._submitting) return;
    this._submitting = true;
    const items = this.data.myTemplates.filter((t) => t.selected);
    const first = items[0];
    const avatarViewId = wx.getStorageSync("avatarViewId") || "av-current";
    api.ensureGarmentViews(first.id, first.name, first.image).then(() => {
      return api.submitAiTryon({
        avatarViewId,
        garmentIds: items.map((g) => g.id),
        garmentNames: items.map((g) => g.name)
      });
    }).then((res) => {
      wx.setStorageSync("aiTryonTask", { taskId: res.taskId, garmentName: first.name });
      this._submitting = false;
      navigate("/pages/tryon-progress/index");
    }).catch(() => {
      this._submitting = false;
      toast("提交失败，请重试");
    });
  },
```

（把原 `startTryon` 的 `navigate` 逻辑整体替换为上述实现。）

- [ ] **Step 2: 修改 `miniprogram/pages/image-preview/index.js` 的 `confirm`**

```js
  confirm() {
    if (this._submitting) return;
    this._submitting = true;
    const g = this.data.garment;
    const garmentId = (g && g.id) || "g-upload-" + Date.now();
    const avatarViewId = wx.getStorageSync("avatarViewId") || "av-current";
    api.ensureGarmentViews(garmentId, g.name, g.image).then(() => {
      return api.submitAiTryon({
        avatarViewId,
        garmentIds: [garmentId],
        garmentNames: [g.name]
      });
    }).then((res) => {
      wx.setStorageSync("aiTryonTask", { taskId: res.taskId, garmentName: g.name });
      this._submitting = false;
      navigate("/pages/tryon-progress/index");
    }).catch(() => {
      this._submitting = false;
      toast("提交失败，请重试");
    });
  }
```

- [ ] **Step 3: 验证页面无报错**

Run: `cd miniprogram && node scripts/check-handlers.js`
Expected: 无缺失 handler 报错。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/tryon-select/index.js miniprogram/pages/image-preview/index.js
git commit -m "feat: 试衣提交链路接入四视图确保与AI试穿任务"
```

---

### Task 8: tryon-progress 改造——轮询 AI 试穿任务

**Files:**
- Rewrite: `miniprogram/pages/tryon-progress/index.js`
- Modify: `miniprogram/pages/tryon-progress/index.wxml`（文案：生成四视图 → 生成转身视频）

**Interfaces:**
- Consumes: storage `aiTryonTask`、`api.getAiTryonStatus`（Task 3）
- Produces: 写入 storage `aiTryonResult`（`{tryonImage, tryonVideo, garmentName}`），跳转 `/pages/tryon-result/index`

- [ ] **Step 1: 重写 `miniprogram/pages/tryon-progress/index.js`**

```js
const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { percent: 0, garmentName: "所选衣物", stageText: "生成衣物四视图" },
  onLoad() {
    const t = wx.getStorageSync("aiTryonTask") || {};
    this.taskId = t.taskId || "task-ai-mock";
    this.setData({ garmentName: t.garmentName || "所选衣物" });
    this.poll();
  },
  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        this.setData({ stageText: "生成失败，请重试" });
        return;
      }
      this.setData({
        stageText: st.stage === "garment_views" ? "生成衣物四视图" : "生成 180° 转身视频"
      });
      if (st.status !== "success") {
        this._pollTimer = setTimeout(() => this.poll(), 900);
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      // 云函数/接口不可用时回退 mock 结果
      this.animateTo100({
        status: "success",
        tryonImage: "/assets/img/p07-result.jpg",
        tryonVideo: "/assets/video/mock-turn.mp4"
      });
    });
  },
  animateTo100(st) {
    this._startTimer = setTimeout(() => {
      this._frameTimer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._frameTimer);
          wx.setStorageSync("aiTryonResult", {
            tryonImage: st.tryonImage || "/assets/img/p07-result.jpg",
            tryonVideo: st.tryonVideo || "/assets/video/mock-turn.mp4",
            garmentName: this.data.garmentName
          });
          toast("生成完成 · AI 生成效果，仅供参考");
          this._navTimer = setTimeout(() => navigate("/pages/tryon-result/index"), 1400);
        }
      }, 40);
    }, 300);
  },
  onUnload() {
    if (this._frameTimer) clearInterval(this._frameTimer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
    if (this._pollTimer) clearTimeout(this._pollTimer);
  }
});
```

- [ ] **Step 2: 更新 `miniprogram/pages/tryon-progress/index.wxml` 文案**

把 `gen-title` / `gen-sub` 与 `gen-cards` 替换为：

```xml
    <view class="gen-title">正在为你试穿{{garmentName}}...</view>
    <view class="gen-sub">AI 三视图 + 衣物四视图 → 180° 转身视频</view>

    <view class="gen-cards">
      <view class="gen-card">
        <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-star-deep.png" /></view>
        <view class="gc-label">当前阶段</view>
        <view class="gc-val">{{stageText}}</view>
      </view>
      <view class="gen-card">
        <view class="gc-ic"><image class="ic-img" style="width:34rpx;height:34rpx" src="/assets/icons/png/icon-clock-deep.png" /></view>
        <view class="gc-label">预计耗时</view>
        <view class="gc-val">15 秒（示例）</view>
      </view>
    </view>
```

- [ ] **Step 3: 验证页面无报错**

Run: `cd miniprogram && node scripts/check-handlers.js`
Expected: 无缺失 handler 报错。

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/tryon-progress
git commit -m "feat: 试穿生成页轮询AI任务并展示两阶段（四视图→转身视频）"
```

---

### Task 9: tryon-result 改造——video 播放 + 效果图 + 三按钮

**Files:**
- Modify: `miniprogram/pages/tryon-result/index.js`
- Modify: `miniprogram/pages/tryon-result/index.wxml`
- Modify: `miniprogram/pages/tryon-result/index.wxss`（追加 video 样式）

**Interfaces:**
- Consumes: storage `aiTryonResult`、`api.saveAiResult`、`api.saveToTemplates`（Task 3 / 现有）
- Produces: 收藏弹层确认后 `saveAiResult({garmentName, tryonImage, tryonVideo})`；保存模板沿用现有逻辑

- [ ] **Step 1: 修改 `miniprogram/pages/tryon-result/index.js`**

在 `data` 中新增 `result`，并在 `onLoad` 读取 storage：

```js
  data: {
    angle: "正面",
    collectVisible: false,
    templateVisible: false,
    tplName: "",
    tplCategory: "",
    categories: ["上衣", "裤子", "头饰", "鞋子", "其他"],
    result: { tryonImage: "/assets/img/p07-result.jpg", tryonVideo: "", garmentName: "AI 试穿" }
  },
  onLoad() {
    const r = wx.getStorageSync("aiTryonResult") || {};
    this.setData({
      result: Object.assign({ tryonImage: "/assets/img/p07-result.jpg", tryonVideo: "", garmentName: "AI 试穿" }, r)
    });
  },
```

把 `collectYes` / `collectNo` 改为：

```js
  collectYes() {
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      tryonVideo: this.data.result.tryonVideo,
      saved: true
    }).then(() => {
      toast("已收藏并保存到相册");
    });
  },
  collectNo() {
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      tryonVideo: this.data.result.tryonVideo,
      saved: true
    }).then(() => {
      toast("已收藏");
    });
  },
```

`onSaveTemplate` 中 `tplName` 默认值改为 `this.data.result.garmentName`。

- [ ] **Step 2: 更新 `miniprogram/pages/tryon-result/index.wxml`**

把 photo-card 部分替换为：

```xml
    <view class="photo-card">
      <video
        wx:if="{{result.tryonVideo}}"
        class="result-video"
        src="{{result.tryonVideo}}"
        controls
        objectFit="cover"
        poster="{{result.tryonImage}}"
      ></video>
      <image wx:else src="{{result.tryonImage}}" mode="widthFix" />
      <view class="badge-ai"><image class="ic-img" style="width:24rpx;height:24rpx" src="/assets/icons/png/icon-star-white.png" />AI 生成</view>
      <view class="wm">AI 生成效果，仅供参考</view>
    </view>
```

`result-meta` 中标题改为 `{{result.garmentName}}`，副文案改为 `按你的身材生成，AI 180° 转身视频，默认正面起转。`，并移除 `angle-row`（角度切换已由视频覆盖；若保留也无碍，移除更符合"视频替代"）。

- [ ] **Step 3: 追加 `miniprogram/pages/tryon-result/index.wxss` 样式**

```css
.result-video { width: 100%; border-radius: 24rpx; display: block; background: #000000; }
```

- [ ] **Step 4: 验证页面无报错**

Run: `cd miniprogram && node scripts/check-handlers.js`
Expected: 无缺失 handler 报错。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/tryon-result
git commit -m "feat: 试穿结果页改为AI转身视频播放+效果图（保留收藏/保存模板/分享）"
```

---

### Task 10: record-item 视频角标 + history/favorites 数据

**Files:**
- Modify: `miniprogram/components/record-item/index.wxml`
- Modify: `miniprogram/components/record-item/index.wxss`
- Modify: `miniprogram/utils/mock.js`（history/favorites 数据加 `videoUrl`）
- Modify: `miniprogram/utils/api.js`（getHistory/getFavorites 映射 `videoUrl`）

- [ ] **Step 1: 更新 `miniprogram/components/record-item/index.wxml`**

在 `r-ai` 标签旁追加视频角标：

```xml
    <view wx:if="{{data.videoUrl}}" class="r-video">视频</view>
```

- [ ] **Step 2: 更新 `miniprogram/components/record-item/index.wxss`**

追加：

```css
.r-video { position: absolute; top: 16rpx; right: 16rpx; background: rgba(31,29,27,0.55); color: #FFFFFF; font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 999rpx; }
```

（若 `r-ai` 已有样式，保持其位置不冲突：`r-ai` 在左上，`r-video` 在右上。）

- [ ] **Step 3: mock.js 的 history/favorites 数据加 `videoUrl`**

在 `history` 数组第一项与 `favorites` 数组第一项中加入 `videoUrl: "/assets/video/mock-turn.mp4"`。

- [ ] **Step 4: api.js 的 getHistory/getFavorites 映射补 `videoUrl`**

```js
        aiTagged: true,
        videoUrl: d.videoUrl || ""
```

（两处 map 回调各加一行。）

- [ ] **Step 5: 运行测试确认全绿**

Run: `cd miniprogram && npm test`
Expected: 全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add miniprogram/components/record-item miniprogram/utils/mock.js miniprogram/utils/api.js
git commit -m "feat: 试穿记录/收藏卡片显示视频角标并透传videoUrl"
```

---

### Task 11: PRD 同步 + 全量验证 + 最终提交

**Files:**
- Modify: `docs/PRD-我形我衣-v1.0.md`（C-21 修正 + 追加 C-22）
- Modify: `weixin002/PRD-我形我衣-v1.0.md`（副本同步）

- [ ] **Step 1: 修正 PRD C-21 并追加 C-22**

把 C-21 行替换为：

```markdown
| C-21 | ~~免费版数字人 3D（非 AI）~~ 已废弃 | 已被 C-22 AI 试穿视频方案替代；相关代码（utils/avatar3d、canvas 渲染）已移除 | FR-08/09/10 |
```

并在表格末尾追加：

```markdown
| C-22 | AI 试穿视频（替代免费 3D） | 数字人改为 AI 写实三视图（创建向导完成时生成一次并复用）；模板衣物保持单张上传图，首次试穿时 AI 生成四视图缓存（单图↔四视图 1:1，删除联动）；试穿结果由静态效果图改为 AI 180° 转身视频；生成服务为云函数+可插拔 AIGC 适配器，API Key 未配置时 mock 回退 | FR-08/09/13/16/17 |
```

同步修改 `weixin002/PRD-我形我衣-v1.0.md` 相同位置。

- [ ] **Step 2: 全量质量校验**

Run: `cd miniprogram; node scripts/verify.js; node scripts/check-handlers.js; npm test`
Expected: 全部通过、无报错。

Run: `cd cloudfunctions/services; npm test`
Expected: 全部 PASS。

- [ ] **Step 3: 提交**

```bash
git add docs/PRD-我形我衣-v1.0.md weixin002/PRD-我形我衣-v1.0.md
git commit -m "docs: PRD追加C-22 AI试穿视频方案，标记C-21免费3D废弃"
```

---

## 验收清单（P0 完成标准）

- [ ] `cd miniprogram; node scripts/verify.js; node scripts/check-handlers.js; npm test` 全绿
- [ ] `cd cloudfunctions/services; npm test` 全绿
- [ ] 开发者工具编译通过：登录 → 创建向导 → 生成进度（AI 三视图）→ 三视图预览页（确认/去试穿）→ 试衣选择 → 生成穿搭 → 视频结果页可播放（mock 占位视频）
- [ ] 试穿记录/收藏卡片显示「视频」角标，点击可进结果页
- [ ] 删除模板衣物时连带删除四视图缓存（Task 3 已实现 `deleteItems` 联动清理，mock.test 有断言覆盖）
- [ ] `utils/avatar3d/` 已删除，无残留引用
- [ ] API Key 接入后（P1）：仅需部署云函数、配置环境变量、真实适配器实现，前端无需改动
