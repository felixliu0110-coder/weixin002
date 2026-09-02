# 「我形我衣」小程序 1:1 还原实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 openDesign HTML 原型（`weixin002/`，17 屏）1:1 还原为原生微信小程序，先做样板页验收，再按批次推进全部页面。

**Architecture:** 原生微信小程序，代码全部位于 `miniprogram/` 子目录（`project.config.json` 配置 `miniprogramRoot`）。全局设计 token 从 `weixin002/assets/proto.css` 迁移到 `app.wxss`；公共组件（nav-bar/btn/chip/seg/switch/card/sheet/custom-tab-bar）复用原型 `proto.css` 的组件类；页面只做组装。交互迁移到 `utils/interaction.js`，数据访问统一走 `utils/api.js`（mock 实现 `utils/mock.js`），接口就绪后仅替换 api.js 内部实现。

**Tech Stack:** 原生微信小程序（基础库 3.17.1，ES6，无 npm 运行时依赖）；图标用 svgtofont 本地生成的 iconfont 字体；utils 测试用 Node 内置 `node:test` + `assert`（无小程序运行时依赖）。

## Global Constraints

以下约束对所有任务生效（源自设计文档 `docs/superpowers/specs/2026-08-16-woxingwoyi-miniprogram-restoration-design.md`）：

- appid：`wxe44ebc1661569b32`；基础库 3.17.1；`es6`、`postcss`、`minified` 已开启。
- 代码根：`miniprogram/`；`weixin002/` 与 `docs/` 只读参考，禁止写入小程序代码。
- 设计稿 390px → 750rpx，1px ≈ 1.92rpx，取整使用；360px 最窄宽度无横向滚动。
- 视觉验收：390×844 截图对照 `screens/*.html` 与 `page_*.jpeg`，允许 ≤2px 偏差。
- 文案逐字与原型一致；示例数据（165/50kg、88/66/92cm、每日 3 次、排队位等）标注"示例"。
- 颜色只用 `app.wxss` 中的 token，禁止裸色值散落页面；`color-mix()` 已预计算为 hex。
- 图标统一 iconfont（`<text class="iconfont icon-xxx">`），禁止内联 SVG。
- 交互映射（每页适用）：`div/span→view/text`；`button + :hover/:active→button + hover-class`；`img→image`；内联 `style→WXSS 类`；`data-nav→bindtap + navigate/switchTab`；Toast 用 `utils/interaction.js` 的 `toast()`。
- 底部 Tab：发现=`pages/home/index`（17）、试衣=`pages/tryon-select/index`（06）、收藏=`pages/history/index`（13）、我的=`pages/profile/index`（08）；Tab 页间用 `wx.switchTab`，其余用 `wx.navigateTo`。
- 合规（必须随页面交付）：AI 生成图带「AI 生成」角标（`badge-ai`）；分享文案含"AI 生成效果，仅供参考"；隐私删除操作有二次确认；上传内容走 `api.js` 的审核分支（mock 默认通过）。
- 每页必须覆盖五种状态：default / loading / empty / error / success（原型未显式画出的状态用空态/错误提示补齐，文案与原型同风格）。
- 每个任务结束：开发者工具编译无报错、无 console error，按任务验收点截图归档到 `docs/qa/screens/`，更新 `docs/qa/checklist.md`，并 git commit。

## 文件结构总览

**创建：**

```
project.config.json                    # 修改：miniprogramRoot
.gitignore                             # 排除 node_modules 等
miniprogram/app.json                   # 页面注册 + tabBar(custom) + navigationStyle: custom
miniprogram/app.js                     # 全局 App（登录态）
miniprogram/app.wxss                   # 全局 token + reset + iconfont @import
miniprogram/sitemap.json
miniprogram/package.json               # 仅用于 svgtofont 生成图标（devDependency）
miniprogram/scripts/generate-icons.js  # 从 SVG 源生成 iconfont
miniprogram/assets/icons/iconfont.ttf|woff|iconfont.css
miniprogram/assets/icons-src/icon-*.svg
miniprogram/components/nav-bar/        # nav-bar 组件
miniprogram/components/btn/            # btn 组件
miniprogram/components/card/           # card 组件
miniprogram/components/chip/           # chip 组件
miniprogram/components/seg/            # seg 组件
miniprogram/components/switch/         # switch 组件
miniprogram/components/sheet/          # sheet 组件
miniprogram/components/ring-progress/  # ring-progress 组件（批 2）
miniprogram/components/upload-card/    # upload-card 组件（批 1）
miniprogram/components/garment-item/   # garment-item 组件（批 3）
miniprogram/components/record-item/    # record-item 组件（批 4）
miniprogram/components/compare-card/   # compare-card 组件（批 3）
miniprogram/custom-tab-bar/index.*     # 自定义 TabBar
miniprogram/utils/interaction.js       # toast/navigate/navigateAfter/ring/sheet 封装
miniprogram/utils/api.js               # 数据访问层接口
miniprogram/utils/mock.js              # mock 数据实现
miniprogram/utils/*.test.js            # utils 测试（node:test）
miniprogram/pages/login/index.*        # 01 登录（样板页）
miniprogram/pages/basic-info/index.*   # 02 基本信息（批 1）
miniprogram/pages/body-params/index.*  # 03 身材参数（批 1）
miniprogram/pages/photo-upload/index.* # 04 照片上传（批 1）
miniprogram/pages/generate-progress/index.*  # 10 生成进度（批 2）
miniprogram/pages/avatar-3d/index.*    # 05 3D 查看器（批 2）
miniprogram/pages/tryon-select/index.* # 06 选择衣物（批 3 + Tab）
miniprogram/pages/image-preview/index.*# 11 衣物预览（批 3）
miniprogram/pages/tryon-progress/index.*# 12 试穿进度（批 3）
miniprogram/pages/tryon-result/index.* # 07 试穿结果（批 3）
miniprogram/pages/compare-view/index.* # 14 对比视图（批 3）
miniprogram/pages/history/index.*      # 13 试穿记录（批 4 + Tab）
miniprogram/pages/profile/index.*      # 08 个人中心（批 4 + Tab）
miniprogram/pages/privacy-manage/index.* # 15 隐私管理（批 4）
miniprogram/pages/feedback-about/index.* # 16 反馈关于（批 4）
miniprogram/pages/home/index.*         # 17 首页（批 5 + Tab）
docs/qa/checklist.md                   # 逐屏验收清单
docs/qa/screens/                       # 验收截图归档
```

**接口约定（跨任务依赖）：**

- `utils/interaction.js` 导出：`toast(msg, ms?)`、`navigate(to)`、`navigateAfter(to, ms, msg?)`、`openSheet(id)`、`closeSheet(id)`、`ring(percent, duration?, cb?)`。
- `utils/api.js` 导出（全部返回 Promise）：`getAvatarProfile()`、`saveAvatarProfile(data)`、`getGarmentTemplates()`、`uploadGarment(imagePath)`、`submitTryon(params)`、`getTryonStatus(taskId)`、`getHistory()`、`getQuota()`、`saveResult(result)`、`deleteUserData()`。
- `custom-tab-bar` 属性：`selected`（Number，当前选中索引）、`navMode`（Boolean，非 Tab 页传 true，点击走 navigateTo）；Tab 页在 `onShow` 中 `this.getTabBar().setData({ selected: N })`。
- `nav-bar` 属性：`title`（String）、`showBack`（Boolean，默认 false）。
- `btn` 属性：`type`（primary|secondary|danger|dark，默认 primary）、`disabled`、`loading`；事件 `bindtap`。
- `sheet` 属性：`visible`；事件 `bindconfirm`、`bindcancel`；默认插槽为内容，`actions` 插槽放按钮。
- 页面 json 模板（除 tabBar 页外通用）：

```json
{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "card": "/components/card/index",
    "chip": "/components/chip/index",
    "seg": "/components/seg/index",
    "switch": "/components/switch/index",
    "sheet": "/components/sheet/index"
  }
}
```

---

### Task 1: 工程初始化与全局设计系统

**Files:**
- Modify: `project.config.json`
- Create: `.gitignore`、`miniprogram/app.json`、`miniprogram/app.js`、`miniprogram/app.wxss`、`miniprogram/sitemap.json`
- Test: 开发者工具编译通过、预览 login 空页

**Interfaces:**
- Produces: `miniprogram/app.wxss` 中的全部 CSS 变量（后续所有组件/页面引用）

- [ ] **Step 1: 修改 project.config.json，新增 miniprogramRoot**

`project.config.json` 中新增（保持其余字段不动）：

```json
{
  "miniprogramRoot": "miniprogram/"
}
```

- [ ] **Step 2: 创建 .gitignore**

```gitignore
node_modules/
miniprogram_npm/
.DS_Store
```

- [ ] **Step 3: git init 并提交基线**

```bash
git init
git add project.config.json project.private.config.json docs weixin002
git commit -m "chore: 初始化仓库，纳入原型与设计文档"
```

- [ ] **Step 4: 创建 miniprogram/app.json（先只注册 login 空页，tabBar 在 Task 4 添加）**

```json
{
  "pages": ["pages/login/index"],
  "window": {
    "navigationStyle": "custom",
    "backgroundColor": "#FBF5ED"
  },
  "sitemapLocation": "sitemap.json"
}
```

- [ ] **Step 5: 创建 miniprogram/app.js**

```js
App({
  globalData: {
    loggedIn: false
  }
});
```

- [ ] **Step 6: 创建 miniprogram/sitemap.json**

```json
{
  "rules": [{ "action": "allow", "page": "*" }]
}
```

- [ ] **Step 7: 创建 miniprogram/app.wxss（全局 token，迁移自 proto.css 的 :root）**

```css
/* ============ 全局设计 token（迁移自 weixin002/assets/proto.css） ============ */
page {
  /* 基础色板 */
  --bg: #FBF5ED;
  --surface: #FFFFFF;
  --surface-2: #F6F1E9;
  --fg: #1F1D1B;
  --fg-2: #4A423C;
  --muted: #8F8378;
  --border: #EADFD3;
  --border-soft: #F2EBE3;

  /* 强调色 */
  --accent: #E3A595;
  --accent-deep: #C98F80;
  --accent-strong: #D4978A;
  --accent-soft: #F8E3DB;
  --accent-tab: #E8B4A6;
  --ring-track: #F0D6CC;
  --danger: #C0392B;
  --tag-bg: #F0EDE8;
  --btn-soft: #F5EDE4;
  --search-bg: #F5F3EE;
  --backdrop: #EFEAE2;
  --accent-on: #FFFFFF;
  --mask: rgba(31, 29, 27, 0.45);

  /* 字体 */
  --font-body: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", system-ui, sans-serif;
  --font-mono: Consolas, "SF Mono", ui-monospace, monospace;

  /* 结构 */
  --nav-h: 44px;
  --tabbar-h: 56px;
  --radius-sm: 24rpx;
  --radius-md: 32rpx;
  --radius-lg: 40rpx;
  --radius-pill: 999rpx;
  --shadow-card: 0 10rpx 28rpx rgba(70, 52, 40, 0.07);
  --shadow-raise: 0 14rpx 34rpx rgba(70, 52, 40, 0.12);
  --ease: cubic-bezier(0.28, 0, 0.22, 1);

  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-body);
  font-size: 30rpx;
  -webkit-font-smoothing: antialiased;
}

view, text, button, image, input, textarea { box-sizing: border-box; }
button { margin: 0; padding: 0; background: none; font: inherit; line-height: inherit; }
button::after { border: 0; }
image { display: block; }

/* 等宽数字 */
.mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 8: 创建 miniprogram/pages/login 空页四件套（后续 Task 6 填充）**

`pages/login/index.wxml`：

```xml
<view class="wx-page">
  <view class="content"><text>login placeholder</text></view>
</view>
```

`index.js`：`Page({ data: {} });`；`index.wxss`：空（写 `.wx-page` 骨架类）；`index.json`：

```json
{ "usingComponents": {} }
```

`index.wxss` 骨架类（后续所有页面共用，可逐步补充到 app.wxss）：

```css
.wx-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.content {
  flex: 1;
  padding: 4px 20px 24px;
  overflow-y: auto;
}
```

- [ ] **Step 9: 复制原型素材**

将 `weixin002/assets/img/` 下全部图片（`p01-hero.png`、`p05-avatar.png`、`p06-*.png`、`p07-result.png`、`p11-garment.png`、`p13-*.png`、`p14-*.png`、`p17-*.png` 等）复制到 `miniprogram/assets/img/`，保持文件名不变。

- [ ] **Step 10: 编译验证**

Run: 微信开发者工具打开 `D:\weixin002`，编译项目。
Expected: 编译成功，模拟器显示 login 空页，控制台无报错。

- [ ] **Step 11: Commit**

```bash
git add project.config.json .gitignore miniprogram
git commit -m "feat: 初始化小程序工程骨架与全局设计 token"
```

---

### Task 2: 生成 iconfont 图标

**Files:**
- Create: `miniprogram/package.json`、`miniprogram/scripts/generate-icons.js`、`miniprogram/assets/icons-src/icon-*.svg`（从原型提取）、`miniprogram/assets/icons/iconfont.ttf|woff|iconfont.css`
- Modify: `miniprogram/app.wxss`（@import iconfont.css + .iconfont 基础类）
- Test: 开发者工具模拟器中 `<text class="iconfont icon-home">` 渲染出首页图标

**Interfaces:**
- Produces: 全局可用的 `.iconfont` + `.icon-<name>` 类；类名清单供所有页面任务使用

- [ ] **Step 1: 从原型提取内联 SVG 并命名**

从 `weixin002/screens/*.html`、`weixin002/index.html` 中提取所有 `<svg>...</svg>` 片段，按语义去重后保存为 `miniprogram/assets/icons-src/icon-<name>.svg`。命名清单（按此命名，页面任务引用这些类名）：

| 类名 | 图标语义 | 来源页 |
| --- | --- | --- |
| `icon-home` | 首页/发现 | 01、17 等全部 |
| `icon-hanger` | 试衣 | 01、17 等全部 |
| `icon-heart` | 收藏 | 01、17 等全部 |
| `icon-user` | 我的 | 01、17 等全部 |
| `icon-back` | 返回箭头 | 各页 nav |
| `icon-search` | 搜索 | 17 |
| `icon-check` | 勾选 | 01 协议、选中态 |
| `icon-close` | 关闭 | sheet |
| `icon-plus` | 添加/上传 | 04、06 |
| `icon-camera` | 拍照 | 04 |
| `icon-rotate` | 旋转 | 05 |
| `icon-ruler` | 身材标注 | 05 |
| `icon-ok` | 确认 | 05、07 |
| `icon-save` | 保存 | 07、14 |
| `icon-share` | 分享 | 07、14 |
| `icon-trash` | 删除 | 15 |
| `icon-export` | 导出 | 15 |
| `icon-lock` | 隐私 | 15 |
| `icon-star` | 额度/星级 | 08、17 |
| `icon-settings` | 设置 | 08 |
| `icon-feedback` | 反馈 | 16 |
| `icon-info` | 关于/说明 | 16 |
| `icon-sparkle` | AI 生成 | 07、13 |
| `icon-chevron-right` | 列表箭头 | 08、15、16 |
| `icon-chevron-left` | 返回/翻页 | 14 |
| `icon-prev` / `icon-next` | 上一屏/下一屏 | 14 |

提取时保留原始 SVG 的 `viewBox` 与路径，去掉 `<svg>` 外层标签，另存为纯 SVG 文件。

- [ ] **Step 2: 初始化 npm 与 svgtofont**

```bash
cd miniprogram
npm init -y
npm i -D svgtofont
```

- [ ] **Step 3: 编写 scripts/generate-icons.js**

```js
const path = require("path");
const svgtofont = require("svgtofont");
const fs = require("fs");

const src = path.join(__dirname, "../assets/icons-src");
const out = path.join(__dirname, "../assets/icons");

(async () => {
  await svgtofont({
    src,
    dist: out,
    fontName: "iconfont",
    css: true,
    startUnicode: 0xe001,
    svgicons2svgfont: { fontHeight: 1000, normalize: true }
  });
  // 修正生成的 css 中字体 url 为相对路径
  const cssPath = path.join(out, "iconfont.css");
  let css = fs.readFileSync(cssPath, "utf8");
  css = css.replace(/url\([^)]*fonts\/iconfont\.(ttf|woff)/g, "url('./iconfont.$1");
  css = css.replace(/font-family:\s*"iconfont"/g, 'font-family: "iconfont"');
  fs.writeFileSync(cssPath, css);
  console.log("iconfont generated at", out);
})();
```

- [ ] **Step 4: 运行脚本生成字体**

Run: `node scripts/generate-icons.js`
Expected: `assets/icons/` 下生成 `iconfont.ttf`、`iconfont.woff`、`iconfont.css`（含 `.icon-home::before { content: "\\e001" }` 等类）。

- [ ] **Step 5: app.wxss 引入 iconfont**

在 `app.wxss` 顶部添加：

```css
@import "./assets/icons/iconfont.css";

.iconfont {
  font-family: "iconfont" !important;
  font-size: 44rpx;
  color: inherit;
  line-height: 1;
}
```

- [ ] **Step 6: 验证渲染**

在 `pages/login/index.wxml` 临时加入 `<text class="iconfont icon-home"></text>`。
Run: 开发者工具编译。
Expected: 模拟器显示首页图标；控制台无字体加载报错。

- [ ] **Step 7: Commit**

```bash
git add miniprogram
git commit -m "feat: 生成 iconfont 图标字体"
```

---

### Task 3: 基础组件库

**Files:**
- Create: `miniprogram/components/nav-bar/index.*`、`btn/index.*`、`card/index.*`、`chip/index.*`、`seg/index.*`、`switch/index.*`、`sheet/index.*`
- Test: 开发者工具中 login 空页组合引用组件，交互走查

**Interfaces:**
- Produces: `nav-bar`（`title`、`showBack`）、`btn`（`type`、`disabled`、`loading`、`bindtap`）、`chip`（`label`、`selected`、`group`、`bindchange`）、`seg`（`options`、`value`、`bindchange`）、`switch`（`checked`、`bindchange`）、`card`（默认插槽）、`sheet`（`visible`、`bindconfirm`、`bindcancel`、`actions` 插槽）

- [ ] **Step 1: nav-bar 组件**

`components/nav-bar/index.wxml`：

```xml
<view class="nav" style="padding-top: {{statusBarHeight}}px;">
  <view class="nav-bar" style="height: {{navHeight}}px;">
    <view class="nav-left">
      <view wx:if="{{showBack}}" class="nav-btn" hover-class="nav-btn-hover" bindtap="onBack">
        <text class="iconfont icon-back"></text>
      </view>
    </view>
    <view class="nav-title">{{title}}</view>
    <view class="nav-right"><slot name="right"></slot></view>
  </view>
</view>
```

`index.js`：

```js
Component({
  properties: {
    title: { type: String, value: "" },
    showBack: { type: Boolean, value: false }
  },
  data: { statusBarHeight: 20, navHeight: 44 },
  lifetimes: {
    attached() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      this.setData({ statusBarHeight: info.statusBarHeight || 20 });
    }
  },
  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: "/pages/home/index" });
      }
    }
  }
});
```

`index.wxss`（沿用 token）：

```css
.nav { width: 100%; background: var(--bg); }
.nav-bar { display: flex; align-items: center; padding: 0 10px; position: relative; }
.nav-left { width: 96rpx; display: flex; align-items: center; }
.nav-title { position: absolute; left: 168rpx; right: 168rpx; text-align: center; font-size: 34rpx; font-weight: 600; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nav-right { margin-left: auto; display: flex; gap: 4rpx; }
.nav-btn { width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center; border-radius: 24rpx; color: var(--fg); }
.nav-btn-hover { background: var(--surface-2); }
.nav-btn .iconfont { font-size: 42rpx; }
```

`index.json`：

```json
{ "component": true, "options": { "multipleSlots": true } }
```

- [ ] **Step 2: btn 组件**

`components/btn/index.wxml`：

```xml
<button
  class="btn {{type}} {{size}}"
  hover-class="btn-hover"
  disabled="{{disabled || loading}}"
  loading="{{loading}}"
  bindtap="onTap"
>
  <slot></slot>
</button>
```

`index.js`：

```js
Component({
  properties: {
    type: { type: String, value: "primary" },
    size: { type: String, value: "normal" },
    disabled: { type: Boolean, value: false },
    loading: { type: Boolean, value: false }
  },
  methods: {
    onTap(e) {
      if (this.data.disabled || this.data.loading) return;
      this.triggerEvent("tap", e.detail);
    }
  }
});
```

`index.wxss`：

```css
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96rpx;
  padding: 0 44rpx;
  border-radius: var(--radius-pill);
  background: linear-gradient(180deg, #E4A999, #D9A191);
  color: var(--accent-on);
  font-size: 32rpx;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: filter 0.16s var(--ease), transform 0.08s ease;
}
.btn-hover { filter: brightness(1.045); transform: scale(0.98); }
.btn.secondary { background: var(--surface); border: 1px solid var(--border); color: var(--fg); font-weight: 500; }
.btn.secondary-hover { border-color: var(--accent); color: var(--accent-deep); }
.btn.danger { background: var(--danger); }
.btn.dark { background: var(--fg); }
.btn.sm { min-height: 88rpx; padding: 0 36rpx; font-size: 29rpx; }
.btn[disabled] { background: var(--surface-2); color: var(--fg-2); }
```

注意：`secondary` 的 hover 用 `hover-class="secondary-hover"` 需在 wxml 中按 type 条件设置，简化为统一 `.btn-hover`（仅亮度和缩放），与原型一致。

- [ ] **Step 3: card 组件**

`index.wxml`：

```xml
<view class="card"><slot></slot></view>
```

`index.wxss`：

```css
.card { background: var(--surface); border: 1px solid var(--border-soft); border-radius: var(--radius-lg); padding: 32rpx; box-shadow: var(--shadow-card); }
```

`index.js`：`Component({});`

- [ ] **Step 4: chip 组件**

`index.wxml`：

```xml
<view class="chip {{selected ? 'on' : ''}}" hover-class="chip-hover" bindtap="onTap">
  <text>{{label}}</text>
</view>
```

`index.js`：

```js
Component({
  properties: {
    label: { type: String, value: "" },
    selected: { type: Boolean, value: false },
    group: { type: String, value: "" }
  },
  methods: {
    onTap() {
      this.triggerEvent("change", { label: this.data.label, group: this.data.group });
    }
  }
});
```

`index.wxss`：

```css
.chip { display: inline-flex; align-items: center; justify-content: center; min-height: 88rpx; padding: 0 36rpx; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); color: var(--fg-2); font-size: 28rpx; font-weight: 500; }
.chip-hover { border-color: var(--accent); transform: scale(0.97); }
.chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-on); font-weight: 600; }
```

- [ ] **Step 5: seg 组件**

`index.wxml`：

```xml
<view class="seg">
  <view
    wx:for="{{options}}"
    wx:key="value"
    class="seg-item {{value === item.value ? 'on' : ''}}"
    hover-class="seg-hover"
    data-value="{{item.value}}"
    bindtap="onTap"
  >{{item.label}}</view>
</view>
```

`index.js`：

```js
Component({
  properties: {
    options: { type: Array, value: [] }, // [{ label, value }]
    value: { type: String, value: "" }
  },
  methods: {
    onTap(e) {
      const v = e.currentTarget.dataset.value;
      this.triggerEvent("change", { value: v });
    }
  }
});
```

`index.wxss`：

```css
.seg { display: flex; gap: 16rpx; background: var(--surface-2); border-radius: var(--radius-md); padding: 8rpx; }
.seg-item { flex: 1; min-height: 88rpx; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); color: var(--fg-2); font-size: 30rpx; font-weight: 500; }
.seg-hover { opacity: 0.85; }
.seg-item.on { background: var(--accent-soft); color: #7A5A4E; font-weight: 600; }
```

（`#7A5A4E` 为 `color-mix(in oklch, var(--accent-deep) 45%, var(--fg))` 的预计算值）

- [ ] **Step 6: switch 组件**

`index.wxml`：

```xml
<view class="switch {{checked ? 'on' : ''}}" bindtap="onTap">
  <view class="knob"></view>
</view>
```

`index.js`：

```js
Component({
  properties: { checked: { type: Boolean, value: false } },
  methods: {
    onTap() { this.triggerEvent("change", { value: !this.data.checked }); }
  }
});
```

`index.wxss`：

```css
.switch { position: relative; width: 100rpx; height: 60rpx; border-radius: 999rpx; background: var(--border); transition: background 0.18s var(--ease); }
.knob { position: absolute; top: 6rpx; left: 6rpx; width: 48rpx; height: 48rpx; border-radius: 50%; background: var(--surface); box-shadow: 0 4rpx 10rpx rgba(70,52,40,0.25); transition: transform 0.18s var(--ease); }
.switch.on { background: var(--accent); }
.switch.on .knob { transform: translateX(40rpx); }
```

- [ ] **Step 7: sheet 组件**

`index.wxml`：

```xml
<view wx:if="{{visible}}" class="sheet-mask" catchtouchmove="noop" bindtap="onMaskTap">
  <view class="sheet" catchtap="noop">
    <view class="grab"></view>
    <slot></slot>
    <view class="s-actions"><slot name="actions"></slot></view>
  </view>
</view>
```

`index.js`：

```js
Component({
  properties: { visible: { type: Boolean, value: false } },
  methods: {
    noop() {},
    onMaskTap() { this.triggerEvent("cancel"); },
    onConfirm() { this.triggerEvent("confirm"); },
    onCancel() { this.triggerEvent("cancel"); }
  }
});
```

`index.wxss`：

```css
.sheet-mask { position: fixed; inset: 0; background: var(--mask); display: flex; align-items: flex-end; z-index: 80; }
.sheet { width: 100%; background: var(--surface); border-radius: 52rpx 52rpx 0 0; padding: 20rpx 40rpx calc(36rpx + env(safe-area-inset-bottom)); animation: sheet-up 0.26s var(--ease); }
@keyframes sheet-up { from { transform: translateY(60%); } to { transform: none; } }
.grab { width: 80rpx; height: 8rpx; border-radius: 4rpx; background: var(--border); margin: 8rpx auto 28rpx; }
.s-actions { display: flex; gap: 20rpx; margin-top: 36rpx; }
.s-actions > * { flex: 1; }
```

`index.json`：

```json
{ "component": true, "options": { "multipleSlots": true } }
```

页面侧通过 `bind:cancel` / `bind:confirm` 响应；二次确认（如删除）在页面里组合两个 `btn`（`danger` 确认 + `secondary` 取消）放入 `actions` 插槽。

- [ ] **Step 8: 组合验证**

在 `pages/login/index.wxml` 临时组合引用 nav-bar、btn、chip、seg、switch、card、sheet，点击 sheet 触发显示。
Run: 开发者工具编译并交互。
Expected: 组件渲染与原型样式一致；btn 点击有按压反馈；switch 开合动画正常；sheet 遮罩点击关闭。

- [ ] **Step 9: Commit**

```bash
git add miniprogram/components miniprogram/pages/login
git commit -m "feat: 基础组件库 nav-bar/btn/card/chip/seg/switch/sheet"
```

---

### Task 4: 自定义 TabBar 与四个 Tab 空壳页

**Files:**
- Create: `miniprogram/custom-tab-bar/index.*`、`miniprogram/pages/home/index.*`、`pages/tryon-select/index.*`、`pages/history/index.*`、`pages/profile/index.*`（空壳）
- Modify: `miniprogram/app.json`（注册 4 Tab 页 + tabBar + custom）
- Test: 开发者工具中 Tab 切换、胶囊/变色选中态

**Interfaces:**
- Produces: `custom-tab-bar` 组件（`selected`、`navMode`）；Tab 页 `onShow` 同步选中态的规范

- [ ] **Step 1: 更新 app.json，注册 4 个 Tab 页并启用自定义 tabBar**

```json
{
  "pages": [
    "pages/login/index",
    "pages/home/index",
    "pages/tryon-select/index",
    "pages/history/index",
    "pages/profile/index"
  ],
  "window": {
    "navigationStyle": "custom",
    "backgroundColor": "#FBF5ED"
  },
  "tabBar": {
    "custom": true,
    "color": "#4A423C",
    "selectedColor": "#7A5A4E",
    "backgroundColor": "#FFFFFF",
    "list": [
      { "pagePath": "pages/home/index", "text": "发现" },
      { "pagePath": "pages/tryon-select/index", "text": "试衣" },
      { "pagePath": "pages/history/index", "text": "收藏" },
      { "pagePath": "pages/profile/index", "text": "我的" }
    ]
  },
  "sitemapLocation": "sitemap.json"
}
```

- [ ] **Step 2: custom-tab-bar/index.json + wxml**

`index.json`：`{ "component": true }`

`index.wxml`：

```xml
<view class="tabbar {{pill ? 'pill' : ''}}">
  <view
    wx:for="{{list}}"
    wx:key="pagePath"
    class="tab {{selected === index ? 'on' : ''}}"
    data-index="{{index}}"
    bindtap="onSelect"
  >
    <text class="iconfont {{item.icon}}"></text>
    <text class="tab-label">{{item.text}}</text>
  </view>
</view>
```

- [ ] **Step 3: custom-tab-bar/index.js**

```js
Component({
  data: {
    selected: 0,
    navMode: false,
    pill: false,
    list: [
      { pagePath: "/pages/home/index", text: "发现", icon: "icon-home" },
      { pagePath: "/pages/tryon-select/index", text: "试衣", icon: "icon-hanger" },
      { pagePath: "/pages/history/index", text: "收藏", icon: "icon-heart" },
      { pagePath: "/pages/profile/index", text: "我的", icon: "icon-user" }
    ]
  },
  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      if (index === this.data.selected) return;
      this.setData({ selected: index });
      if (this.data.navMode) {
        wx.navigateTo({ url: item.pagePath });
      } else {
        wx.switchTab({ url: item.pagePath });
      }
    }
  }
});
```

- [ ] **Step 4: custom-tab-bar/index.wxss（两种选中态：普通变色 + pill 胶囊）**

```css
.tabbar { display: flex; background: var(--surface); border-top: 1px solid var(--border-soft); padding: 12rpx 20rpx calc(12rpx + env(safe-area-inset-bottom)); min-height: calc(var(--tabbar-h) + env(safe-area-inset-bottom)); }
.tab { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6rpx; font-size: 22rpx; color: var(--fg-2); border-radius: var(--radius-md); }
.tab .iconfont { font-size: 44rpx; }
.tab.on { color: #7A5A4E; font-weight: 600; }
.tabbar.pill .tab.on { background: var(--accent-tab); color: var(--fg); border-radius: 999rpx; margin: 4rpx 16rpx; }
```

- [ ] **Step 5: 创建 4 个 Tab 空壳页**

每个页面四件套（以 home 为例，其余相同仅标题不同）：

`pages/home/index.json`：

```json
{
  "usingComponents": { "nav-bar": "/components/nav-bar/index" },
  "navigationBarTitleText": "发现"
}
```

`index.wxml`：

```xml
<view class="wx-page">
  <nav-bar title="发现"></nav-bar>
  <view class="content"><text>home placeholder</text></view>
</view>
```

注意：Tab 页**不需要**在 wxml 中手写 `<tab-bar>` 标签——`app.json` 启用 `"custom": true` 后，微信框架会自动渲染 `custom-tab-bar` 组件；页面 js 通过 `this.getTabBar()` 同步选中态即可。非 Tab 页（如 login）需要展示 tabbar 时，才在页面 json 注册 `"tab-bar": "/custom-tab-bar/index"` 并在 wxml 使用（见 Task 6）。

`index.js`：

```js
Page({
  data: {},
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0, navMode: false, pill: false });
    }
  }
});
```

`index.wxss`：复用 `.wx-page` / `.content` 骨架（`@import "../../app.wxss"` 不需要，全局生效）。

四个 Tab 页的 `selected` 索引与 `pill` 值：home=0、tryon-select=1、history=2、profile=3（pill: true，因为 08 原型是胶囊样式）。

- [ ] **Step 6: 验证 Tab 切换**

Run: 开发者工具编译，从 login 跳转 home 后切换 4 个 Tab。
Expected: 4 个 Tab 切换正常，选中态与原型一致（profile 页为胶囊、其余变色），无闪烁，无 console error。

- [ ] **Step 7: Commit**

```bash
git add miniprogram/app.json miniprogram/custom-tab-bar miniprogram/pages
git commit -m "feat: 自定义 TabBar 与四个 Tab 页骨架"
```

---

### Task 5: 工具层 utils（interaction / api / mock）+ 测试

**Files:**
- Create: `miniprogram/utils/interaction.js`、`api.js`、`mock.js`、`interaction.test.js`、`api.test.js`、`mock.test.js`
- Test: `node --test`（在 miniprogram 目录运行，无需小程序运行时）

**Interfaces:**
- Produces: `toast(msg, ms?)`、`navigate(to)`、`navigateAfter(to, ms, msg?)`、`openSheet(id)`、`closeSheet(id)`、`ring(percent, duration?, cb?)`；`api.js` 的全部 Promise 方法（见文件结构总览）；mock 数据形状

- [ ] **Step 1: 写失败测试 mock.test.js**

`miniprogram/utils/mock.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert");
const mock = require("./mock");

test("getAvatarProfile 返回 PRD 示例档案并含示例标记", async () => {
  const profile = await mock.getAvatarProfile();
  assert.strictEqual(profile.heightCm, 165);
  assert.strictEqual(profile.weightKg, 50);
  assert.strictEqual(profile.bustCm, 88);
  assert.strictEqual(profile.waistCm, 66);
  assert.strictEqual(profile.hipCm, 92);
  assert.strictEqual(profile.isExample, true);
});

test("getQuota 返回每日 3 次示例额度", async () => {
  const quota = await mock.getQuota();
  assert.strictEqual(quota.dailyFree, 3);
  assert.strictEqual(quota.used, 0);
});

test("submitTryon 生成任务并在默认策略下成功", async () => {
  const task = await mock.submitTryon({ avatarId: "a1", garmentId: "g1", pose: "front" });
  assert.strictEqual(task.status, "success");
  assert.ok(task.resultUrls.length > 0);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test utils/mock.test.js`
Expected: FAIL（`Cannot find module './mock'`）

- [ ] **Step 3: 实现 mock.js**

```js
/* 原型示例数据，标注示例标记；带模拟延迟 */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const avatarProfile = {
  id: "avatar-demo",
  userId: "u-demo",
  gender: "female",
  heightCm: 165,
  weightKg: 50,
  bustCm: 88,
  waistCm: 66,
  hipCm: 92,
  legLengthCm: 88,
  neckLengthCm: 9,
  skinTone: "light",
  modelVersion: "v1-demo",
  status: "ready",
  isExample: true
};

const quota = { userId: "u-demo", dailyFree: 3, used: 0, resetDate: "2026-08-16", isExample: true };

const templates = [
  { id: "t-dress", name: "粉色连衣裙", category: "连衣裙", image: "/assets/img/p17-dress.png" },
  { id: "t-shirt", name: "蓝色衬衫", category: "上装", image: "/assets/img/p17-shirt.png" },
  { id: "t-white", name: "白色衬衫", category: "上装", image: "/assets/img/p17-white.png" }
];

const history = [
  { id: "r1", garmentName: "粉色连衣裙", date: "2026-08-15", image: "/assets/img/p07-result.png", aiTagged: true },
  { id: "r2", garmentName: "蓝色衬衫", date: "2026-08-14", image: "/assets/img/p13-1.png", aiTagged: true }
];

module.exports = {
  async getAvatarProfile() { await delay(400); return JSON.parse(JSON.stringify(avatarProfile)); },
  async saveAvatarProfile(data) { await delay(300); Object.assign(avatarProfile, data); return { ok: true }; },
  async getGarmentTemplates() { await delay(400); return JSON.parse(JSON.stringify(templates)); },
  async uploadGarment(imagePath) {
    await delay(600);
    return { id: "g-upload-" + Date.now(), image: imagePath, category: "上装", status: "ok" };
  },
  async submitTryon(params) {
    await delay(900);
    return { taskId: "task-" + Date.now(), status: "success", pose: params.pose || "front", resultUrls: ["/assets/img/p07-result.png"] };
  },
  async getTryonStatus(taskId) { await delay(300); return { taskId, status: "success" }; },
  async getHistory() { await delay(400); return JSON.parse(JSON.stringify(history)); },
  async getQuota() { await delay(200); return JSON.parse(JSON.stringify(quota)); },
  async saveResult(result) { await delay(300); return { ok: true, id: "r-" + Date.now() }; },
  async deleteUserData() { await delay(500); return { ok: true }; }
};
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test utils/mock.test.js`
Expected: PASS（3 个用例全过）

- [ ] **Step 5: 写失败测试 api.test.js**

`miniprogram/utils/api.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert");
const api = require("./api");

test("api.getAvatarProfile 返回档案（mock 实现）", async () => {
  const profile = await api.getAvatarProfile();
  assert.strictEqual(profile.heightCm, 165);
});

test("api 暴露全部数据访问方法", () => {
  const methods = ["getAvatarProfile", "saveAvatarProfile", "getGarmentTemplates", "uploadGarment", "submitTryon", "getTryonStatus", "getHistory", "getQuota", "saveResult", "deleteUserData"];
  methods.forEach((m) => assert.strictEqual(typeof api[m], "function", m + " missing"));
});
```

- [ ] **Step 6: 运行确认失败，然后实现 api.js**

Run: `node --test utils/api.test.js` → FAIL（模块不存在）。

`api.js`：

```js
/* 数据访问层：页面只依赖本文件。真实接口就绪后替换内部实现。 */
const mock = require("./mock");

module.exports = {
  getAvatarProfile: mock.getAvatarProfile,
  saveAvatarProfile: mock.saveAvatarProfile,
  getGarmentTemplates: mock.getGarmentTemplates,
  uploadGarment: mock.uploadGarment,
  submitTryon: mock.submitTryon,
  getTryonStatus: mock.getTryonStatus,
  getHistory: mock.getHistory,
  getQuota: mock.getQuota,
  saveResult: mock.saveResult,
  deleteUserData: mock.deleteUserData
};
```

- [ ] **Step 7: 运行测试确认通过**

Run: `node --test utils/api.test.js`
Expected: PASS

- [ ] **Step 8: 写失败测试 interaction.test.js 并实现 interaction.js**

`interaction.test.js`：

```js
const test = require("node:test");
const assert = require("node:assert");

const calls = [];
global.__wx = {
  showToast: (o) => calls.push(["toast", o.title]),
  navigateTo: (o) => calls.push(["navigateTo", o.url]),
  switchTab: (o) => calls.push(["switchTab", o.url])
};

const ui = require("./interaction");

test("toast 调用 wx.showToast", () => {
  ui.toast("已保存");
  assert.deepStrictEqual(calls[calls.length - 1], ["toast", "已保存"]);
});

test("navigate 对 Tab 页走 switchTab，对其他页走 navigateTo", () => {
  ui.navigate("/pages/profile/index");
  ui.navigate("/pages/basic-info/index");
  assert.deepStrictEqual(calls[calls.length - 2], ["switchTab", "/pages/profile/index"]);
  assert.deepStrictEqual(calls[calls.length - 1], ["navigateTo", "/pages/basic-info/index"]);
});
```

`interaction.js`：

```js
/* 交互封装（迁移自 weixin002/assets/proto.js） */
const wxApi = typeof wx !== "undefined" ? wx : (global.__wx || {});

const TAB_ROUTES = ["/pages/home/index", "/pages/tryon-select/index", "/pages/history/index", "/pages/profile/index"];

function toast(msg, ms) {
  if (!wxApi.showToast) return;
  wxApi.showToast({ title: msg, icon: "none", duration: ms || 1900 });
}

function navigate(to) {
  const url = to.startsWith("/") ? to : "/" + to;
  if (TAB_ROUTES.includes(url) && wxApi.switchTab) {
    wxApi.switchTab({ url });
  } else if (wxApi.navigateTo) {
    wxApi.navigateTo({ url });
  }
}

function navigateAfter(to, ms, msg) {
  if (msg) toast(msg, Math.min(ms, 2400));
  setTimeout(() => navigate(to), ms || 1800);
}

function openSheet(id) {
  const page = getCurrentPage();
  if (page && page.selectComponent) {
    const comp = page.selectComponent("#" + id);
    if (comp) comp.setData({ visible: true });
  }
}

function closeSheet(id) {
  const page = getCurrentPage();
  if (page && page.selectComponent) {
    const comp = page.selectComponent("#" + id);
    if (comp) comp.setData({ visible: false });
  }
}

function getCurrentPage() {
  try {
    const pages = getCurrentPages();
    return pages[pages.length - 1];
  } catch (e) { return null; }
}

function ring(percent, duration, cb) {
  /* 环形进度由 ring-progress 组件实现；此处为兼容调用（原型 OD.ring 迁移） */
  if (typeof cb === "function") setTimeout(cb, duration || 3000);
}

module.exports = { toast, navigate, navigateAfter, openSheet, closeSheet, ring };
```

- [ ] **Step 9: 运行全部测试**

Run: `node --test utils/*.test.js`
Expected: 全部 PASS

- [ ] **Step 10: Commit**

```bash
git add miniprogram/utils
git commit -m "feat: 工具层 interaction/api/mock 及单元测试"
```

---

### Task 6: 样板页 01 登录（验收门禁）

**Files:**
- Modify: `miniprogram/pages/login/index.*`（填充完整实现）
- Create: `docs/qa/checklist.md`、`docs/qa/screens/01-login.png`（验收截图）
- Test: 390×844 截图对照 `weixin002/screens/01-login.html` 与 `weixin002/page_01_login.png.jpeg`；交互走查

**Interfaces:**
- Consumes: `nav-bar`、`btn`、`sheet`（Task 3）、`toast`/`navigate`（Task 5）、iconfont（Task 2）

- [ ] **Step 1: login/index.json 声明组件**

```json
{
  "usingComponents": {
    "nav-bar": "/components/nav-bar/index",
    "btn": "/components/btn/index",
    "sheet": "/components/sheet/index"
  },
  "navigationBarTitleText": "登录"
}
```

- [ ] **Step 2: login/index.wxml（结构与原型一致）**

```xml
<view class="wx-page">
  <view class="content big-hero-center">
    <view class="login-title">我形<text class="accent-word">我衣</text></view>
    <view class="login-tag">看见每一件衣服穿在自己身上的样子</view>
    <view class="hero-art">
      <image src="/assets/img/p01-hero.png" mode="widthFix" />
    </view>
    <view class="check-row {{agreed ? 'on' : ''}}" hover-class="check-hover" bindtap="toggleAgree">
      <view class="box"><text class="iconfont icon-check"></text></view>
      <view class="check-copy">我已阅读并同意<text class="strong">《用户协议》</text>和<text class="strong">《隐私政策》</text></view>
    </view>
    <btn class="login-cta" type="primary" bindtap="onLogin">微信授权登录</btn>
  </view>

  <tab-bar selected="{{0}}" navMode="{{true}}"></tab-bar>
</view>
```

注意：`login` 页面不是 Tab 页，`tab-bar` 组件用 `navMode="{{true}}"`，点击走 `navigateTo`（与原型的 `data-nav` 行为一致）。`tab-bar` 需在 `index.json` 中声明为 `"tab-bar": "/custom-tab-bar/index"`。

- [ ] **Step 3: login/index.js**

```js
const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { agreed: true },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    toast(agreed ? "已同意《用户协议》和《隐私政策》" : "需同意协议后才能使用人脸相关功能");
  },
  onLogin() {
    // 真实微信登录（wx.login/手机号快捷登录）待后端接口就绪后接入
    navigate("/pages/basic-info/index");
  }
});
```

- [ ] **Step 4: login/index.wxss**

```css
.big-hero-center { display: flex; flex-direction: column; justify-content: center; padding-bottom: 16rpx; }
.login-title { font-size: 64rpx; font-weight: 700; letter-spacing: 0.1em; text-align: center; margin-top: 68rpx; color: var(--fg); }
.accent-word { color: var(--accent-deep); font-weight: 700; }
.login-tag { text-align: center; font-size: 27rpx; color: var(--fg-2); margin-top: 18rpx; }
.hero-art { margin-top: 48rpx; border-radius: 52rpx; overflow: hidden; border: 1px solid var(--border-soft); box-shadow: var(--shadow-raise); background: var(--surface); }
.hero-art image { width: 100%; }
.check-row { display: flex; align-items: flex-start; gap: 18rpx; width: 100%; padding: 36rpx 8rpx 0; }
.box { flex: 0 0 40rpx; width: 40rpx; height: 40rpx; border-radius: 14rpx; border: 1.5px solid var(--border); background: var(--surface); display: flex; align-items: center; justify-content: center; margin-top: 2rpx; }
.box .iconfont { font-size: 26rpx; color: transparent; }
.check-row.on .box { background: var(--accent); border-color: var(--accent); }
.check-row.on .box .iconfont { color: var(--accent-on); }
.check-copy { font-size: 24rpx; color: var(--fg-2); line-height: 1.65; }
.strong { color: var(--fg); font-weight: 500; }
.check-hover { opacity: 0.85; }
.login-cta { margin-top: 44rpx; }
```

- [ ] **Step 5: 复制素材**

将 `weixin002/assets/img/p01-hero.png` 复制到 `miniprogram/assets/img/p01-hero.png`。

- [ ] **Step 6: 编译并逐项对照**

Run: 开发者工具编译，模拟器机型 iPhone 15 Pro（390×844）。

逐项对照 `01-login.html` / `page_01_login.png.jpeg`：
- 标题「我形我衣」字号/字重/间距；
- 插画卡圆角 52rpx、阴影；
- 协议勾选行默认勾选态；
- 主按钮胶囊、粉底白字、文案「微信授权登录」；
- 底部 TabBar 四图标 + 「发现」选中。

Expected: 视觉三层全部通过（≤2px 偏差）；勾选 Toast 两句文案与原型逐字一致；按钮点击跳转 basic-info。

- [ ] **Step 7: 截图归档并更新 checklist**

保存模拟器截图到 `docs/qa/screens/01-login.png`。

创建 `docs/qa/checklist.md`：

```markdown
# 「我形我衣」小程序还原验收清单

| 页面 | 视觉层 | 交互层 | 内容层 | 状态 |
| --- | --- | --- | --- | --- |
| 01 登录 | ✅ | ✅ | ✅ | 通过 |
```

- [ ] **Step 8: Commit**

```bash
git add miniprogram/pages/login miniprogram/assets/img docs/qa
git commit -m "feat: 样板页 01 登录 1:1 还原并通过三层验收"
```

> **门禁：** 样板页三层验收必须全部通过（用户确认）后，才允许进入 Task 7。若未通过，就地修复后重新走 Step 6-8。

---

### Task 7: 批 1 创建向导（02 基本信息 / 03 身材参数 / 04 照片上传 + upload-card）

**Files:**
- Create: `miniprogram/components/upload-card/index.*`、`miniprogram/pages/basic-info/index.*`、`pages/body-params/index.*`、`pages/photo-upload/index.*`
- Modify: `miniprogram/app.json`（注册 3 个页面）
- Test: 三页截图对照 + 表单交互走查

**Interfaces:**
- Consumes: `seg`、`chip`、`switch`、`btn`、`card`、`nav-bar`、`api.js`
- Produces: `upload-card`（`title`、`desc`、`state`（none|done）、`bindtap`）

- [ ] **Step 1: upload-card 组件**

`index.wxml`：

```xml
<view class="upload-card {{state === 'done' ? 'done' : ''}}" hover-class="upload-hover" bindtap="onTap">
  <view class="uc-ic"><text class="iconfont icon-camera"></text></view>
  <view class="uc-main">
    <view class="uc-title">{{title}}</view>
    <view class="uc-desc">{{desc}}</view>
  </view>
  <view class="uc-state">{{state === 'done' ? '已上传' : '点击上传'}}</view>
</view>
```

`index.js`：`Component({ properties: { title: String, desc: String, state: { type: String, value: "none" } }, methods: { onTap() { this.triggerEvent("tap"); } } });`

`index.wxss`（沿用 `proto.css` 的 `.upload-card` 视觉）：

```css
.upload-card { display: flex; align-items: center; gap: 28rpx; border: 3rpx dashed var(--accent-deep); background: var(--accent-soft); border-radius: var(--radius-lg); padding: 36rpx 32rpx; width: 100%; }
.uc-ic { flex: 0 0 92rpx; width: 92rpx; height: 92rpx; border-radius: 30rpx; background: var(--accent); color: var(--accent-on); display: flex; align-items: center; justify-content: center; }
.uc-main { flex: 1; min-width: 0; }
.uc-title { font-size: 30rpx; font-weight: 600; }
.uc-desc { font-size: 25rpx; color: var(--fg-2); margin-top: 6rpx; line-height: 1.5; }
.uc-state { font-size: 26rpx; font-weight: 600; color: var(--fg-2); }
.upload-card.done .uc-state { color: var(--accent-deep); }
.upload-hover { filter: brightness(0.97); }
```

- [ ] **Step 2: 02 基本信息页**

对照 `weixin002/screens/02-basic-info.html`。结构：步骤条（第 1/3 步）→ 标题「基本信息」→ 副标题「约 1 分钟完成，后续可随时修改」→ 性别分段（`seg`，女性/男性，默认女性）→ 身高滑块（`slider`，140–200cm，默认 165，等宽数字 + cm）→ 体重滑块（`slider`，35–100kg，默认 50，等宽数字 + kg）→ 底部 `footer-bar`：主按钮「下一步」跳转 03。

关键数据与逻辑：

```js
data: { step: 1, gender: "female", height: 165, weight: 50 }
onGender(e) { this.setData({ gender: e.detail.value }); },
onHeight(e) { this.setData({ height: e.detail.value }); },
next() { this.saveDraft(); navigate("/pages/body-params/index"); },
saveDraft() { api.saveAvatarProfile({ gender: this.data.gender, heightCm: this.data.height, weightKg: this.data.weight }); }
```

滑块 WXML 片段：

```xml
<slider min="140" max="200" step="1" value="{{height}}" activeColor="#E3A595" backgroundColor="#EADFD3" block-size="24" bindchanging="onHeight" />
<view class="mono">{{height}}<text class="unit">cm</text></view>
```

验收点：与原型截图对照；滑块拖动实时回显；「下一步」保存草稿并跳转 03；原型副标题文案逐字保留。

- [ ] **Step 3: 03 身材参数页**

对照 `weixin002/screens/03-body-params.html`。结构：步骤条（第 2/3 步）→ 三围数字卡（`num-card` 样式：胸围 88 / 腰围 66 / 臀围 92，各带 −/+ 步进器，标题旁标「示例」）→ 缺省估算开关（`switch`，默认开）→ 腿长滑块（默认 88cm）→ 肤色滑块（渐变轨，`skin-range` 样式）→ 肤色标签 chips（2×2）→ 底部 `footer-bar`：「上一步」次级 +「下一步」主按钮跳转 04。

实现要点：三围步进器在页面内实现（`-`/`+` 按钮调整 `bustCm/waistCm/hipCm`，范围 50–150）；「示例」小标放在三围标题旁；步进器按钮沿用 `num-card .nc-step` 圆形按钮样式（88rpx 圆形，`--accent-soft` 按压反馈）。

验收点：三围数值等宽、步进器可用；滑块实时回显；「示例」标注存在；360px 宽度下 2×2 chip 不拥挤。

- [ ] **Step 4: 04 照片上传页**

对照 `weixin002/screens/04-photo-upload.html`。结构：步骤条（第 3/3 步）→ 人脸照 `upload-card`（选填，点击调用 `wx.chooseMedia`，成功后 `state=done`）→ 全身照 `upload-card`（选填）→ step-note「不上传使用默认形象；中途自动保存」→ 底部单一主按钮「生成数字人」。

```js
chooseFace() {
  wx.chooseMedia({
    count: 1,
    mediaType: ["image"],
    success: (res) => {
      const path = res.tempFiles[0].tempFilePath;
      this.setData({ faceState: "done", facePath: path });
      toast("已选择人脸照（示例）");
    }
  });
}
```

「生成数字人」点击 → `toast("正在生成数字人（示例）")` + `navigate("/pages/generate-progress/index")`。

验收点：两张上传卡可独立选择；主按钮唯一且居中；说明文案与原型逐字一致。

- [ ] **Step 5: 注册页面并编译验收**

`app.json` 的 `pages` 追加 `pages/basic-info/index`、`pages/body-params/index`、`pages/photo-upload/index`。

Run: 编译；三页 390×844 截图对照原型；走查 02→03→04→生成进度跳转链。
Expected: 三页视觉/交互/内容三层通过；截图归档 `docs/qa/screens/02-basic-info.png`、`03-body-params.png`、`04-photo-upload.png`；checklist 更新。

- [ ] **Step 6: Commit**

```bash
git add miniprogram/components/upload-card miniprogram/pages miniprogram/app.json docs/qa
git commit -m "feat: 批1 创建向导 02/03/04 还原"
```

---

### Task 8: 批 2 生成与数字人（10 生成进度 + ring-progress / 05 3D 查看器）

**Files:**
- Create: `miniprogram/components/ring-progress/index.*`、`miniprogram/pages/generate-progress/index.*`、`pages/avatar-3d/index.*`
- Modify: `miniprogram/app.json`
- Test: 进度环动画、3D 页按钮反馈；截图对照

**Interfaces:**
- Consumes: `ring(percent, duration, cb)`（Task 5）、`btn`、`nav-bar`、`toast`
- Produces: `ring-progress`（`percent` Number，conic-gradient 实现，canvas 兜底）

- [ ] **Step 1: ring-progress 组件**

`index.wxml`：

```xml
<view class="ring-wrap">
  <view class="ring" style="--p: {{percent}};"></view>
  <view class="ring-num mono">{{percent}}%</view>
</view>
```

`index.js`：

```js
Component({
  properties: { percent: { type: Number, value: 0 } },
  observers: { percent(v) { this.setData({ percent: Math.max(0, Math.min(100, v)) }); } }
});
```

`index.wxss`（conic-gradient + mask 实现，基础库 3.17.1 WebView 支持；若真机异常则回退 canvas 2d 绘制）：

```css
.ring-wrap { position: relative; width: 432rpx; height: 432rpx; margin: 68rpx auto 48rpx; }
.ring { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--ring-track) 0); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 44rpx), black calc(100% - 42rpx)); mask: radial-gradient(farthest-side, transparent calc(100% - 44rpx), black calc(100% - 42rpx)); }
.ring-num { position: absolute; inset: 44rpx; border-radius: 50%; background: var(--bg); display: flex; align-items: center; justify-content: center; font-size: 92rpx; font-weight: 700; color: var(--fg); }
```

- [ ] **Step 2: 10 生成进度页**

对照 `weixin002/screens/10-generate-progress.html`。结构：标题「正在生成数字人」→ 副标题「生成中，可离开页面，完成后通知你」→ `ring-progress`（0→100 动画，3s）→ 两张 `gen-card`（「排队位置」第 1/2 位（示例）、「预计用时」约 30 秒）→ 完成动画后 Toast + 跳转 `/pages/avatar-3d/index`。

```js
onReady() {
  let p = 0;
  const timer = setInterval(() => {
    p += 1;
    this.setData({ percent: p });
    if (p >= 100) {
      clearInterval(timer);
      toast("数字人生成完成（示例）");
      setTimeout(() => navigate("/pages/avatar-3d/index"), 600);
    }
  }, 30);
}
```

验收点：进度环动画与原型一致；副标题文案逐字；「示例」标注在排队位旁。

- [ ] **Step 3: 05 3D 查看器页（静态示意 + 按钮反馈）**

对照 `weixin002/screens/05-3d-viewer.html`。结构：`nav-bar`（返回 + 标题「我的数字人」）→ 数字人展示区（`avatar-stage`，`p05-avatar.png`，圆角 48rpx + 阴影）→ 圆形操作钮三枚（旋转 / 身材标注 / 确认，`circle-btn` 样式，64px 圆形 + 底部文字标签）→ 身材档案卡片（`profile-card`，2×2 网格：身高 165cm、体重 50kg、三围 88/66/92cm、肤色，等宽数字）→ 底部主按钮「去试穿」跳转 `/pages/tryon-select/index`。

交互：三个圆形按钮点击仅 `toast`（"旋转（3D 能力待接入）"、"标注（3D 能力待接入）"、"确认完成"），与原型一致；「去试穿」跳转。

验收点：静态图与原型视觉一致；三个按钮 Toast 文案与原型一致；档案卡数值标注「示例」。

- [ ] **Step 4: 注册页面并编译验收**

`app.json` 追加 `pages/generate-progress/index`、`pages/avatar-3d/index`。

Run: 编译；截图对照 `10-generate-progress.html` / `05-3d-viewer.html`；动画与跳转走查。
Expected: 两层页面通过；截图归档 `docs/qa/screens/10-generate-progress.png`、`05-avatar-3d.png`；checklist 更新。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/components/ring-progress miniprogram/pages miniprogram/app.json docs/qa
git commit -m "feat: 批2 生成进度与 3D 数字人页还原"
```

---

### Task 9: 批 3 试穿链路（06 / 11 / 12 / 07 / 14 + garment-item / compare-card）

**Files:**
- Create: `miniprogram/components/garment-item/index.*`、`compare-card/index.*`、`miniprogram/pages/tryon-select/index.*`（填充）、`pages/image-preview/index.*`、`pages/tryon-progress/index.*`、`pages/tryon-result/index.*`、`pages/compare-view/index.*`
- Modify: `miniprogram/app.json`
- Test: 五页截图对照 + 完整试穿链路走查

**Interfaces:**
- Consumes: `api.getGarmentTemplates()`、`api.uploadGarment()`、`api.submitTryon()`、`chip`、`sheet`、`ring-progress`
- Produces: `garment-item`（`data`、`selected`、`bindtap`）、`compare-card`（`data`、`selected`、`bindtap`）

- [ ] **Step 1: garment-item 组件**

`index.wxml`：

```xml
<view class="garment {{selected ? 'on' : ''}}" hover-class="garment-hover" bindtap="onTap">
  <image class="g-img" src="{{data.image}}" mode="aspectFill" />
  <view class="g-name">{{data.name}}</view>
  <view class="g-cat">{{data.category}}</view>
  <view class="pick"><text class="iconfont icon-check"></text></view>
</view>
```

`index.js`：`Component({ properties: { data: Object, selected: Boolean }, methods: { onTap() { this.triggerEvent("tap", { id: this.data.data.id }); } } });`

`index.wxss`（3 列网格卡片，参照 `proto.css` `.garment`）：

```css
.garment { position: relative; border: 3rpx solid var(--border-soft); background: var(--surface); border-radius: var(--radius-md); padding: 20rpx 16rpx 18rpx; text-align: center; }
.garment.on { border-color: var(--accent); box-shadow: 0 0 0 4rpx var(--accent-soft); }
.g-img { width: 100%; height: 300rpx; border-radius: 20rpx; background: var(--surface-2); }
.g-name { font-size: 25rpx; font-weight: 500; margin-top: 14rpx; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-cat { font-size: 22rpx; color: var(--fg-2); margin-top: 4rpx; }
.pick { position: absolute; top: 28rpx; right: 24rpx; width: 44rpx; height: 44rpx; border-radius: 50%; border: 3rpx solid var(--border); background: var(--surface); display: flex; align-items: center; justify-content: center; }
.pick .iconfont { font-size: 26rpx; color: transparent; }
.garment.on .pick { background: var(--accent); border-color: var(--accent); }
.garment.on .pick .iconfont { color: var(--accent-on); }
```

- [ ] **Step 2: 06 选择衣物页（Tab 页，填充空壳）**

对照 `weixin002/screens/06-tryon-select.html`。结构：`nav-bar`（标题「试衣」）→ 分段切换（`seg`：模板 / 上传）→ 模板网格（`garment-grid` 3 列，`wx:for` 渲染 `api.getGarmentTemplates()` 返回的 3 个模板，多选）→ 上传模式下显示 `upload-card`（点击 `wx.chooseMedia` 调 `api.uploadGarment`）→ 空态（`empty-state`：「暂无模板衣物」+ 上传入口，模板列表为空时显示）→ 底部 `footer-bar`：主按钮「下一步」跳转 11（有选中时）或禁用。

```js
onLoad() { this.setData({ loading: true }); api.getGarmentTemplates().then((list) => this.setData({ templates: list, loading: false })); },
toggleGarment(e) {
  const id = e.detail.id;
  const selected = this.data.selected.includes(id) ? this.data.selected.filter((x) => x !== id) : [...this.data.selected, id];
  this.setData({ selected });
  toast(selected.includes(id) ? "已选择「" + e.detail.name + "」" : "已取消选择");
}
```

验收点：多选切换圆点勾选；空态引导存在；Tab 切换正常（`onShow` 同步 `selected: 1`）。

- [ ] **Step 3: 11 衣物预览页**

对照 `weixin002/screens/11-image-preview.html`。结构：`nav-bar` → 衣物大图（`photo-card`，`mode="widthFix"`，左上「已抠图」角标 `badge-cut`）→ 品类单选 `chip`（上装/下装/连衣裙/外套，单选，默认识别结果）→ step-note（抠图说明）→ 底部主按钮「确认生成试穿」。

「确认生成试穿」→ `api.submitTryon({ avatarId, garmentId, pose: "front" })` → `navigate("/pages/tryon-progress/index")`。

验收点：按钮文案「确认生成试穿」（design-audit 已定）；品类单选互斥；抠图角标位置与原型一致。

- [ ] **Step 4: 12 试穿进度页**

对照 `weixin002/screens/12-tryon-progress.html`。结构：标题「正在生成试穿效果」→ 副标题「生成中，可离开页面，完成后通知你」→ `ring-progress`（0→100）→ 排队信息（「第 1/2 位（示例）」）→ 完成后 Toast + 跳转 `/pages/tryon-result/index`。复用 Task 8 的进度逻辑（参数不同）。

验收点：动画、文案、「示例」标注。

- [ ] **Step 5: 07 试穿结果页**

对照 `weixin002/screens/07-tryon-result.html`。结构：`nav-bar` → 效果图 `photo-card`（`p07-result.png`，左上「AI 生成」角标 `badge-ai`，底部水印「AI 生成效果，仅供参考」）→ `result-meta`（标题「粉色连衣裙」+ 两行说明：「按你的身材（168cm / 55kg）生成」+「尺码建议仅供参考」+ 「示例」tag）→ 角度切换 `chip` 行（正面/侧面/背面，单选，Toast 提示）→ `action-row`：主按钮「保存」+ 次级「分享」（分享 Toast 含"AI 生成效果，仅供参考"）。

验收点：AI 角标与水印文案；meta 两行文案与 design-audit 结论一致；主次按钮关系正确。

- [ ] **Step 6: 14 对比视图页 + compare-card 组件**

`compare-card`：两列对比卡 + 右上选择圆点（`sel-dot`），选中显示勾。

对照 `weixin002/screens/14-compare-view.html`：两张 `compare-card`（左右衣物）→ 提示文案「点圆点切换，保存所选」→ 底部「保存」主按钮 +「分享」次级按钮。

验收点：圆点切换所选卡；提示文案与 design-audit 一致；保存为主按钮。

- [ ] **Step 7: 注册页面并编译验收**

`app.json` 追加 `pages/image-preview/index`、`pages/tryon-progress/index`、`pages/tryon-result/index`、`pages/compare-view/index`（`tryon-select` 已注册）。

Run: 编译；五页截图对照；完整链路走查（06 选衣 → 11 预览 → 12 进度 → 07 结果 → 14 对比）。
Expected: 五页三层通过；截图归档；checklist 更新。

- [ ] **Step 8: Commit**

```bash
git add miniprogram/components/garment-item miniprogram/components/compare-card miniprogram/pages miniprogram/app.json docs/qa
git commit -m "feat: 批3 试穿链路 06/11/12/07/14 还原"
```

---

### Task 10: 批 4 我的与隐私（13 / 08 / 15 / 16 + record-item）

**Files:**
- Create: `miniprogram/components/record-item/index.*`、`miniprogram/pages/history/index.*`（填充）、`pages/profile/index.*`（填充）、`pages/privacy-manage/index.*`、`pages/feedback-about/index.*`
- Modify: `miniprogram/app.json`
- Test: 四页截图对照 + 删除二次确认/表单提交走查

**Interfaces:**
- Consumes: `api.getHistory()`、`api.deleteUserData()`、`record-item`、`sheet`、`btn`

- [ ] **Step 1: record-item 组件**

`index.wxml`：

```xml
<view class="record" hover-class="record-hover" bindtap="onTap">
  <view class="r-img">
    <image src="{{data.image}}" mode="aspectFill" />
    <view class="r-ai" wx:if="{{data.aiTagged}}">AI 生成</view>
  </view>
  <view class="r-meta">
    <view class="r-name">{{data.garmentName}}</view>
    <view class="r-date">{{data.date}}</view>
  </view>
</view>
```

`index.js`：`Component({ properties: { data: Object }, methods: { onTap() { this.triggerEvent("tap", { id: this.data.data.id }); } } });`

`index.wxss`（2 列瀑布，参照 `.record`）：图片 `aspect-ratio 3/4.3`（用 `height: 430rpx` 实现）、右上角黑底「AI 生成」角标。

- [ ] **Step 2: 13 试穿记录页（Tab 页，填充）**

对照 `weixin002/screens/13-tryon-history.html`。结构：`nav-bar`（标题「收藏」？—— 对照原型：Tab 名为「收藏」，页面标题按原型）→ 记录网格（2 列 `record-item`，`wx:for` 渲染 `api.getHistory()`，图片 `contain` 模式处理）→ 空态（无记录时显示）。`onShow` 同步 `selected: 2`。

验收点：记录卡带「AI 生成」角标；2 列布局；点击记录跳转对应结果详情（原型行为：跳 07）。

- [ ] **Step 3: 08 个人中心页（Tab 页，pill 胶囊，填充）**

对照 `weixin002/screens/08-profile.html`。结构：`profile-head`（圆形头像「云」+ 昵称「小云」+ 副标题）→ 额度胶囊「每日免费 3 次（示例）」+ 额度条 → 列表（`row-list`：我的数字人→05、我的试穿记录→13、使用额度（示例 badge 12 弱化）、隐私与数据管理→15、意见反馈→16、关于我们→16、设置（占位））。`onShow` 同步 `selected: 3, pill: true`。

验收点：列表项跳转正确；badge「12」弱化为示例；pill 胶囊选中态。

- [ ] **Step 4: 15 隐私与数据管理页（pill 胶囊）**

对照 `weixin002/screens/15-privacy-manage.html`。结构：`nav-bar` → 已授权数据列表（`row-list`：人脸照片、全身照、身体数据，行内副标题说明用途）→ 操作区：「导出我的数据」次级按钮（点击 `toast("导出任务已提交（示例）")`）、「删除全部数据」`danger` 主按钮 → 点击删除弹出 `sheet` 二次确认（文案与原型一致：「删除后不可恢复，将同时删除数字人、试穿记录与已授权照片」）→ 确认后调 `api.deleteUserData()` + Toast + 返回登录页。

`onShow` 同步 `pill: true`。

验收点：删除二次确认弹层；danger 按钮样式；文案逐字。

- [ ] **Step 5: 16 反馈与关于页（pill 胶囊）**

对照 `weixin002/screens/16-feedback-about.html`。结构：分段 `seg`（意见反馈 / 关于我们）→ 反馈表单（`textarea` 带 label「反馈内容」+ 提交按钮，提交后内联成功态 `.form-success`「已收到你的反馈」）→ 关于：AI 生成说明 + 备案信息（文案与原型一致）。`onShow` 同步 `pill: true`。

验收点：提交后内联成功态；备案信息文案存在。

- [ ] **Step 6: 注册页面并编译验收**

`app.json` 追加 `pages/privacy-manage/index`、`pages/feedback-about/index`。

Run: 编译；四页截图对照；走查删除二次确认、反馈提交、Tab 切换（profile/history pill 胶囊）。
Expected: 四页三层通过；截图归档；checklist 更新。

- [ ] **Step 7: Commit**

```bash
git add miniprogram/components/record-item miniprogram/pages miniprogram/app.json docs/qa
git commit -m "feat: 批4 我的与隐私 13/08/15/16 还原"
```

---

### Task 11: 批 5 首页（17）

**Files:**
- Modify: `miniprogram/pages/home/index.*`（填充空壳）
- Test: 截图对照 + 入口跳转走查

**Interfaces:**
- Consumes: `api.getGarmentTemplates()`、`api.getQuota()`、`api.getAvatarProfile()`、`toast`、`navigate`

- [ ] **Step 1: 实现 home 页**

对照 `weixin002/screens/17-home.html`。结构：`nav-bar`（品牌标题「我形我衣」）→ 搜索框（`search-box`，Enter 触发 `toast("搜索「xx」（原型演示）")`）→ `hero-tryon` 主卡（「一键试穿」+ 副文案，点击跳 06）→ 额度行「今日剩余 3 次免费试穿（示例）」（`api.getQuota()` 渲染，等宽数字）→ 「热门模板」分区（`template-grid` 3 列，`api.getGarmentTemplates()` 渲染，点击跳 06）→ 「我的数字人」分区（`avatar-row` 卡：`p05-avatar.png` + 「小云的专属数字人」+ 「去试穿」按钮，点击跳 05）→ `tab-bar`（selected 0）。

`onShow` 同步 `selected: 0`；`onLoad` 拉取模板与额度。

验收点：搜索框可输入；主卡/模板/数字人卡跳转正确；额度「示例」标注；模板命名与原型一致（粉色连衣裙/蓝色衬衫/白色衬衫）。

- [ ] **Step 2: 编译验收**

Run: 编译；截图对照 `17-home.html` / `page_17_home.png.jpeg`。
Expected: 视觉/交互/内容三层通过；截图归档 `docs/qa/screens/17-home.png`；checklist 更新。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/home docs/qa
git commit -m "feat: 批5 首页 17 还原"
```

---

### Task 12: 全局联调、真机抽查与验收归档

**Files:**
- Modify: `docs/qa/checklist.md`（全量结论）
- Test: 全链路走查 + 真机预览抽查

- [ ] **Step 1: 全量编译与页面注册核对**

Run: 开发者工具编译；确认 `app.json` 注册全部 17 个页面：

`login`、`home`、`basic-info`、`body-params`、`photo-upload`、`generate-progress`、`avatar-3d`、`tryon-select`、`image-preview`、`tryon-progress`、`tryon-result`、`compare-view`、`history`、`profile`、`privacy-manage`、`feedback-about`。

Expected: 编译无报错；17 页均可在模拟器打开。

- [ ] **Step 2: 全链路走查**

逐条走查：登录 → 创建向导（02→03→04）→ 生成进度（10）→ 3D（05）→ 选衣（06）→ 预览（11）→ 试穿进度（12）→ 结果（07）→ 对比（14）→ 记录（13）→ 个人中心（08）→ 隐私管理（15）→ 反馈（16）→ 首页（17）。

Expected: 所有跳转、Toast、弹层、进度环、滑块、TabBar 选中态与原型一致；无 console error。

- [ ] **Step 3: TabBar 与导航专项**

- 4 个 Tab 页之间切换，`onShow` 同步 selected，无闪烁；
- 非 Tab 页（login/向导/结果等）的 `tab-bar` 展示与跳转与原型一致；
- 非 Tab 页 `nav-bar` 返回：栈深 >1 走 `navigateBack`，否则回首页（Tab）。

- [ ] **Step 4: 真机抽查**

Run: 开发者工具「预览」生成二维码，真机（iOS + Android 各一台）打开。

抽查页面：home、profile（pill 胶囊）、login、generate-progress。
抽查点：胶囊选中态、iconfont 清晰度、iPhone 底部安全区、Android 状态栏避让、conic-gradient 进度环。

Expected: 无字体缺失、无布局溢出、安全区正常。

- [ ] **Step 5: 验收清单收尾**

`docs/qa/checklist.md` 全 17 页逐屏确认视觉/交互/内容三层，全部通过；遗留问题记录并修复。

- [ ] **Step 6: 最终 Commit**

```bash
git add docs/qa miniprogram
git commit -m "feat: 全局联调与验收归档，17 屏 1:1 还原完成"
```

---

## 自检记录

**Spec 覆盖：** 设计文档 13 节均有对应任务——目录/配置（Task 1）、iconfont（Task 2）、组件（Task 3）、tabBar（Task 4）、数据层（Task 5）、样板页（Task 6）、批次 1-5（Task 7-11）、验收与联调（Task 12）。3D 静态占位、微信登录后接、内容安全 mock 分支均在各任务中明确。

**占位符扫描：** 无 TBD/TODO；每个代码步骤含实际代码或精确的迁移来源。

**类型一致性：** `interaction.js` 的 `toast/navigate/navigateAfter/openSheet/closeSheet/ring`、`api.js` 的 10 个方法、`custom-tab-bar` 的 `selected/navMode`、`nav-bar` 的 `title/showBack`、`btn` 的 `type/disabled/loading`、`sheet` 的 `visible/confirm/cancel` 在全部任务中签名一致。
