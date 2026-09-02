# C 成本与稳定性优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 降低 Agnes AI 生成成本（试穿结果复用、跳过无效四视图、轮询退避）并提升稳定性（超时不误报、定时清理、日志），模型无关。

**Architecture:** 云函数 `aiTryon` 提交时按「openid+avatarViewId+衣物组合」计算 `cache_key` 复用 7 天内成功结果；前端 `ensureGarmentViews` 仅对公网 HTTPS 图调用云函数；`tryon-progress` 轮询退避至 12s 封顶、12 分钟总上限；新增 `cleanup` 云函数每日定时清理旧任务；关键路径打日志。

**Tech Stack:** Node.js（云函数 wx-server-sdk、node:crypto）、微信小程序原生、node:test 单测。

## Global Constraints

- 复用有效期 7 天；成功记录保留 30 天、失败记录保留 7 天。
- 缓存键不绑定模型（按用户+数字人+衣物组合），换模型仍可复用。
- 模板/上传衣物（非公网 HTTPS 图片）不调用 `ensureGarmentViews` 云函数。
- 轮询间隔序列 `[2000, 3000, 5000, 8000, 12000]`ms，封顶 12s；总上限 12 分钟。
- 云函数目录共享模块保持单层文件（避免 CLI 打包 bug）；新函数目录加入 `sync-cloud-services.js` 自动同步。
- 所有源文件 UTF-8；提交信息中文、直接提交 main（用户偏好，无分支/PR）。
- 不生成预览二维码（用户偏好，省 token）。

---

### Task 1: 共享缓存工具 `services/tryonCache.js`

**Files:**
- Create: `cloudfunctions/services/tryonCache.js`
- Test: `cloudfunctions/services/tryonCache.test.js`

**Interfaces:**
- Produces:
  - `buildTryonCacheKey({ openid, avatarViewId, garmentIds }) -> string`（sha1 hex，garmentIds 排序无关）
  - `isCacheHit(doc, now) -> boolean`（status==="success" 且 createdAt 在 7 天内）
  - `isCleanupCandidate(doc, now) -> boolean`（failed 超 7 天 或 success 超 30 天）
  - `CACHE_TTL_MS`、`FAILED_TTL_MS`、`SUCCESS_TTL_MS` 常量

- [ ] **Step 1: 写失败测试**

`cloudfunctions/services/tryonCache.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert");
const { buildTryonCacheKey, isCacheHit, isCleanupCandidate, CACHE_TTL_MS, FAILED_TTL_MS, SUCCESS_TTL_MS } = require("./tryonCache");

test("buildTryonCacheKey 与衣物顺序无关", () => {
  const a = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g2", "g1"] });
  const b = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1", "g2"] });
  assert.strictEqual(a, b);
});

test("buildTryonCacheKey 不同组合生成不同 key", () => {
  const a = buildTryonCacheKey({ openid: "u1", avatarViewId: "av1", garmentIds: ["g1"] });
  const b = buildTryonCacheKey({ openid: "u1", avatarViewId: "av2", garmentIds: ["g1"] });
  assert.notStrictEqual(a, b);
});

test("isCacheHit 仅接受 7 天内成功任务", () => {
  const now = Date.now();
  assert.ok(isCacheHit({ status: "success", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "failed", createdAt: now - 1000 }, now));
  assert.ok(!isCacheHit({ status: "success", createdAt: now - CACHE_TTL_MS - 1 }, now));
});

test("isCleanupCandidate 按失败/成功宽限期判断", () => {
  const now = Date.now();
  assert.ok(isCleanupCandidate({ status: "failed", updated_at: now - FAILED_TTL_MS - 1 }, now));
  assert.ok(!isCleanupCandidate({ status: "failed", updated_at: now - 1000 }, now));
  assert.ok(isCleanupCandidate({ status: "success", createdAt: now - SUCCESS_TTL_MS - 1 }, now));
  assert.ok(!isCleanupCandidate({ status: "success", createdAt: now - 1000 }, now));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd cloudfunctions/services && npm test`
Expected: `tryonCache.test.js` 报 `Cannot find module './tryonCache'`

- [ ] **Step 3: 实现**

`cloudfunctions/services/tryonCache.js`：

```js
/* 试穿任务缓存/清理工具（模型无关） */
const crypto = require("crypto");

const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;      // 成功结果复用有效期 7 天
const FAILED_TTL_MS = 7 * 24 * 3600 * 1000;     // 失败记录保留 7 天
const SUCCESS_TTL_MS = 30 * 24 * 3600 * 1000;   // 成功记录保留 30 天

function buildTryonCacheKey({ openid, avatarViewId, garmentIds }) {
  const sorted = (garmentIds || []).slice().sort().join(",");
  const raw = [openid || "", avatarViewId || "", sorted, "ai_video"].join("|");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

function isCacheHit(doc, now) {
  return !!doc &&
    doc.status === "success" &&
    typeof doc.createdAt === "number" &&
    now - doc.createdAt < CACHE_TTL_MS;
}

function isCleanupCandidate(doc, now) {
  if (!doc) return false;
  if (doc.status === "failed") {
    const t = doc.updated_at || doc.updatedAt || doc.createdAt || 0;
    return typeof t === "number" && now - t > FAILED_TTL_MS;
  }
  if (doc.status === "success") {
    return typeof doc.createdAt === "number" && now - doc.createdAt > SUCCESS_TTL_MS;
  }
  return false;
}

module.exports = { buildTryonCacheKey, isCacheHit, isCleanupCandidate, CACHE_TTL_MS, FAILED_TTL_MS, SUCCESS_TTL_MS };
```

- [ ] **Step 4: 运行确认通过**

Run: `cd cloudfunctions/services && npm test`
Expected: 全部 PASS（tryonCache 4 个 + 原有 8 个）

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/services/tryonCache.js cloudfunctions/services/tryonCache.test.js
git commit -m "feat: 试穿任务缓存键与复用/清理判定工具（模型无关）"
```

---

### Task 2: `aiTryon` 试穿结果复用 + 日志

**Files:**
- Modify: `cloudfunctions/aiTryon/index.js`

**Interfaces:**
- Consumes: `buildTryonCacheKey`、`isCacheHit`（Task 1）
- Produces: submit 返回新增 `cached: true`（命中时）；任务文档新增 `cache_key` 字段

- [ ] **Step 1: 引入工具并在 submit 加去重**

`cloudfunctions/aiTryon/index.js` 顶部加：

```js
const { buildTryonCacheKey, isCacheHit } = require("./tryonCache");
```

`submit()` 内 `task` 对象加字段：

```js
const cacheKey = buildTryonCacheKey({ openid, avatarViewId, garmentIds });
```

并在创建任务前（`db.collection("tryon_tasks").add` 之前）插入命中检查：

```js
// 复用：同一用户+数字人+衣物组合 7 天内成功结果，不重复调用 Agnes
const prev = await db.collection("tryon_tasks")
  .where({ cache_key: cacheKey })
  .orderBy("createdAt", "desc")
  .limit(5)
  .get();
const hit = prev.data.find((d) => isCacheHit(d, Date.now()));
if (hit) {
  console.log("aiTryon cache hit", "taskId=" + hit._id, "cacheKey=" + cacheKey.slice(0, 8));
  return {
    ok: true, taskId: hit._id, status: "success", cached: true,
    tryonImage: hit.tryon_image, tryonVideo: hit.tryon_video, garmentName
  };
}
```

`task` 对象加入 `cache_key: cacheKey`。

- [ ] **Step 2: 日志埋点**

submit 成功分支与 catch 分支、`status()` 轮询完成/失败分支各加一行 `console.log`（含耗时 `Date.now() - t0` 与 `ok/error`，openid 不打印）。示例：

```js
console.log("aiTryon submit ok", "taskId=" + taskId, "costMs=" + (Date.now() - t0));
```

`submit()` 开头记录 `const t0 = Date.now();`。

- [ ] **Step 3: 验证**

Run: `cd cloudfunctions/services && npm test`（不破坏现有测试）
静态确认：`node scripts/check-handlers.js`（在 `miniprogram/` 下执行，若需）。

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/aiTryon/index.js
git commit -m "feat: aiTryon 试穿结果复用（cache_key 命中直接返回）+ 关键路径日志"
```

---

### Task 3: 轮询退避 `utils/poll.js` + `tryon-progress` 改造

**Files:**
- Create: `miniprogram/utils/poll.js`
- Modify: `miniprogram/pages/tryon-progress/index.js`
- Test: `miniprogram/utils/poll.test.js`

**Interfaces:**
- Produces: `nextPollInterval(count) -> number`（`[2000,3000,5000,8000,12000]` 循环，封顶 12000）、`POLL_INTERVALS`、`POLL_MAX_MS = 12*60*1000`

- [ ] **Step 1: 写失败测试**

`miniprogram/utils/poll.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert");
const { nextPollInterval, POLL_INTERVALS, POLL_MAX_MS } = require("./poll");

test("nextPollInterval 按序列递增并封顶", () => {
  assert.strictEqual(nextPollInterval(0), 2000);
  assert.strictEqual(nextPollInterval(1), 3000);
  assert.strictEqual(nextPollInterval(2), 5000);
  assert.strictEqual(nextPollInterval(3), 8000);
  assert.strictEqual(nextPollInterval(4), 12000);
  assert.strictEqual(nextPollInterval(99), 12000);
});

test("常量符合设计", () => {
  assert.deepStrictEqual(POLL_INTERVALS, [2000, 3000, 5000, 8000, 12000]);
  assert.strictEqual(POLL_MAX_MS, 12 * 60 * 1000);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd miniprogram && npm test`
Expected: `poll.test.js` 报 `Cannot find module './poll'`

- [ ] **Step 3: 实现 poll.js**

`miniprogram/utils/poll.js`：

```js
/* 生成轮询退避：间隔递增，封顶 12s；总上限 12 分钟 */
const POLL_INTERVALS = [2000, 3000, 5000, 8000, 12000];
const POLL_MAX_MS = 12 * 60 * 1000;

function nextPollInterval(count) {
  const i = Math.min(Math.max(count, 0), POLL_INTERVALS.length - 1);
  return POLL_INTERVALS[i];
}

module.exports = { nextPollInterval, POLL_INTERVALS, POLL_MAX_MS };
```

- [ ] **Step 4: 改造 tryon-progress**

`miniprogram/pages/tryon-progress/index.js`：

```js
const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
const { nextPollInterval, POLL_MAX_MS } = require("../../utils/poll");

Page({
  data: { percent: 0, garmentName: "所选衣物", stageText: "生成衣物四视图", error: false, errorMsg: "" },
  onLoad() {
    const t = wx.getStorageSync("aiTryonTask") || {};
    this.taskId = t.taskId || "task-ai-mock";
    this._pollCount = 0;
    this._pollStartedAt = Date.now();
    this.setData({ garmentName: t.garmentName || "所选衣物" });
    this.poll();
  },
  poll() {
    api.getAiTryonStatus(this.taskId).then((st) => {
      if (st.status === "failed") {
        this.setData({ error: true, errorMsg: (st && st.error) || "生成失败，请重试" });
        return;
      }
      this.setData({ stageText: st.stage === "garment_views" ? "生成衣物四视图" : "生成 180° 转身视频" });
      if (st.status !== "success") {
        if (Date.now() - this._pollStartedAt > POLL_MAX_MS) {
          this.setData({ error: true, errorMsg: "生成仍在后台进行，可稍后在试穿记录查看" });
          return;
        }
        this._pollCount += 1;
        this._pollTimer = setTimeout(() => this.poll(), nextPollInterval(this._pollCount));
        return;
      }
      this.animateTo100(st);
    }).catch(() => {
      this.setData({ error: true, errorMsg: "网络异常，无法获取生成进度" });
    });
  },
  retry() {
    this.clearTimers();
    this._pollCount = 0;
    this._pollStartedAt = Date.now();
    this.setData({ error: false, errorMsg: "", percent: 0, stageText: "生成衣物四视图" });
    this.poll();
  },
  // 其余方法（animateTo100/clearTimers/onHide/onShow/onUnload/backToSelect）保持现状
});
```

保留 `animateTo100`、`clearTimers`、`onHide`、`onShow`、`onUnload`、`backToSelect` 原实现（WorkBuddy 已加）。

- [ ] **Step 5: 运行确认通过**

Run: `cd miniprogram && npm test`
Expected: 全部 PASS（poll 2 个 + 原有 11 个）

- [ ] **Step 6: 提交**

```bash
git add miniprogram/utils/poll.js miniprogram/utils/poll.test.js miniprogram/pages/tryon-progress/index.js
git commit -m "feat: 试穿进度轮询退避（2s-12s 封顶，12 分钟总上限，超时不误报失败）"
```

---

### Task 4: `ensureGarmentViews` 仅公网 HTTPS 图调用云函数

**Files:**
- Modify: `miniprogram/utils/api.js`
- Test: `miniprogram/utils/api.test.js`

**Interfaces:**
- Produces: 导出 `isPublicHttpUrl(url) -> boolean`

- [ ] **Step 1: 加失败测试**

`miniprogram/utils/api.test.js` 追加：

```js
test("isPublicHttpUrl 仅接受公网 http(s) URL", () => {
  assert.strictEqual(api.isPublicHttpUrl("https://platform-outputs.agnes-ai.space/a.png"), true);
  assert.strictEqual(api.isPublicHttpUrl("http://example.com/a.png"), true);
  assert.strictEqual(api.isPublicHttpUrl("/assets/img/p06-tee.jpg"), false);
  assert.strictEqual(api.isPublicHttpUrl("cloud://env/a.png"), false);
  assert.strictEqual(api.isPublicHttpUrl(""), false);
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd miniprogram && npm test`
Expected: `api.isPublicHttpUrl is not a function`

- [ ] **Step 3: 实现**

`miniprogram/utils/api.js`：

```js
function isPublicHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}
```

`ensureGarmentViews` 开头改为：

```js
async ensureGarmentViews(garmentId, garmentName, garmentImage) {
  // 仅公网 HTTPS 图才调用云函数生成四视图；本地/临时路径直接回退 mock，避免白调 Agnes
  if (!cloudReady() || !isPublicHttpUrl(garmentImage)) return mock.ensureGarmentViews(garmentId, garmentName);
  ...
}
```

`module.exports` 增加 `isPublicHttpUrl`。

- [ ] **Step 4: 运行确认通过**

Run: `cd miniprogram && npm test`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add miniprogram/utils/api.js miniprogram/utils/api.test.js
git commit -m "feat: ensureGarmentViews 仅公网HTTPS图调用云函数，本地/临时图直接mock"
```

---

### Task 5: `cleanup` 定时清理云函数

**Files:**
- Create: `cloudfunctions/cleanup/index.js`
- Create: `cloudfunctions/cleanup/config.json`
- Create: `cloudfunctions/cleanup/package.json`

**Interfaces:**
- Consumes: `isCleanupCandidate`（Task 1）
- Produces: 每日 02:00 触发，清理 `tryon_tasks` 过期记录，返回 `{ ok: true, removed }`

- [ ] **Step 1: 实现**

`cloudfunctions/cleanup/index.js`：

```js
const cloud = require("wx-server-sdk");
const { isCleanupCandidate } = require("./tryonCache");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const now = Date.now();
  let removed = 0;
  const coll = db.collection("tryon_tasks");
  // 分批扫描（云函数单次 get 上限 100），删除到无过期记录为止
  for (let i = 0; i < 20; i++) {
    const res = await coll.limit(100).get();
    if (!res.data || res.data.length === 0) break;
    const stale = res.data.filter((d) => isCleanupCandidate(d, now));
    if (stale.length === 0) break;
    for (const doc of stale) {
      await coll.doc(doc._id).remove();
      removed += 1;
    }
  }
  console.log("cleanup done, removed=" + removed);
  return { ok: true, removed };
};
```

`cloudfunctions/cleanup/config.json`：

```json
{
  "permissions": { "openapi": [] },
  "triggers": [
    { "name": "cleanup-daily", "type": "timer", "config": "0 0 2 * * * *" }
  ]
}
```

`cloudfunctions/cleanup/package.json`（与 `aiTryon/package.json` 的 wx-server-sdk 版本一致）：

```json
{
  "name": "cleanup",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: 同步并部署**

Run:
```bash
node scripts/sync-cloud-services.js
"D:\刘小伟\微信web开发者工具\cli.bat" cloud functions deploy --env cloud1-d8gt95vnl0ec35c4f --names createAvatarViews ensureGarmentViews aiTryon onTryonComplete cleanup --project D:\weixin002 --remote-npm-install
```

Expected: 5 个函数均 `success: true`

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/cleanup
git commit -m "feat: 新增cleanup云函数每日定时清理过期试穿任务（失败7天/成功30天）"
```

---

### Task 6: 文档、索引建议与端到端验证

**Files:**
- Modify: `docs/CLOUD-SETUP.md`

- [ ] **Step 1: 更新文档**

`docs/CLOUD-SETUP.md`：

1. 四、部署命令中的函数列表追加 `cleanup`；
2. 新增小节：**定时清理**——`cleanup` 每日 02:00 自动删除失败超 7 天、成功超 30 天的 `tryon_tasks` 记录；
3. 新增小节：**云函数日志**——云开发控制台 → 云函数 → 函数 → 日志，可查看 submit/完成/失败/耗时日志；未开启时先开启日志服务；
4. 数据库说明：`tryon_tasks` 建议为 `cache_key` 建索引（复用查询）。

- [ ] **Step 2: 全量验证**

Run:
```bash
cd cloudfunctions/services && npm test
cd miniprogram && npm test
node scripts/verify.js
node scripts/check-handlers.js
```

Expected: 全部 PASS

- [ ] **Step 3: 冒烟验证缓存复用**

Run: `node scripts/auto-diag-tryon.js`（先提交一次任务），再次运行同参数 `submitAiTryon`，确认第二次返回 `cached: true`（或直接用 evaluate 调 submit 两次对比）。

Expected: 第二次 submit 秒回 `{ ok: true, cached: true, status: "success" }`，不产生新 Agnes 调用。

- [ ] **Step 4: 提交**

```bash
git add docs/CLOUD-SETUP.md
git commit -m "docs: 云开发说明补充cleanup定时清理、日志开启与cache_key索引建议"
```
