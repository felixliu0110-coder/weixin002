# 「我形我衣」微信小程序 1:1 还原设计文档

- 日期：2026-08-16
- 状态：已与用户逐块确认，待用户评审
- 范围：将 openDesign HTML 原型（`weixin002/`，17 屏）1:1 还原为原生微信小程序

## 1. 背景与目标

「我形我衣」是一款 AI 虚拟试穿微信小程序：用户录入身材参数并可选上传人脸/全身照创建 3D 数字人，再通过模板或上传衣物图片生成"自己穿着该衣物"的照片级效果图。

当前仓库 = openDesign 导出的 HTML 高保真原型（`weixin002/`）+ 微信开发者工具配置骨架（根目录 `project.config.json` / `project.private.config.json`），**尚无小程序源码**。本次目标是按已确认的决策，从零搭建原生小程序工程，将 17 屏原型 1:1 还原。

"1:1"定义为三层：

1. **视觉层**：布局、间距、字号、颜色、圆角、图标、选中态一致（允许 rpx 取整 ≤2px 偏差）；
2. **交互层**：跳转、Toast、弹层、滑块、进度环、自动跳转等行为与原型一致，五种状态（default / loading / empty / error / success）齐全；
3. **内容层**：文案逐字一致，示例数据标注"示例"，AI 标识、隐私授权、删除二次确认等合规元素齐备。

## 2. 已确认决策

| # | 决策点 | 结论 |
| --- | --- | --- |
| 1 | 技术栈 | 原生微信小程序 |
| 2 | 代码目录 | `miniprogram/` 子目录 + `project.config.json` 配置 `miniprogramRoot` |
| 3 | 推进方式 | 先做样板页（01 登录）验收，通过后按批次批量推进 |
| 4 | 3D 数字人页 | 静态示意 + 按钮 Toast 反馈，真实 3D 留待 SDK/服务端就绪后替换内部实现 |
| 5 | TabBar | 自定义 tabBar（`custom: true`），1:1 复刻胶囊/变色两种选中态 |
| 6 | 图标 | iconfont 字体图标（本地生成，不依赖在线平台） |
| 7 | 数据层 | mock 先行 + `utils/api.js` 统一数据访问层，接口就绪后只替换实现 |
| 8 | 验证标准 | 三层验收（视觉/交互/内容），每批门禁 + 真机抽查 |

附加确认：

- **首次进入页**为登录页（`pages/login/index`），17 首页是 Tab 首页；
- 验收截图与清单归档到 `docs/qa/`。

## 3. 目标目录结构

```
D:\weixin002\
├─ project.config.json          # 修改：新增 "miniprogramRoot": "miniprogram/"
├─ project.private.config.json  # 不动
├─ docs\                        # 文档（PRD、本设计文档、qa 验收产物）
│  └─ qa\
│     ├─ screens\               # 每屏验收截图（与原型同命名）
│     └─ checklist.md           # 逐屏验收清单
├─ weixin002\                   # HTML 原型（只读参考，不再改动）
└─ miniprogram\                 # ★ 小程序源码根
   ├─ app.json                  # 注册 17 页面 + tabBar + 自定义导航
   ├─ app.js                    # 全局逻辑（登录态等）
   ├─ app.wxss                  # 全局设计 token（从 proto.css 迁移）
   ├─ sitemap.json
   ├─ custom-tab-bar\           # 自定义 TabBar（胶囊选中态 1:1）
   ├─ components\               # 公共组件库
   ├─ pages\                    # 17 个页面
   ├─ utils\                    # interaction.js / api.js / mock.js
   └─ assets\                   # 图片、iconfont 字体
```

## 4. 工程配置

### 4.1 project.config.json

仅新增 `"miniprogramRoot": "miniprogram/"`，其余配置（appid `wxe44ebc1661569b32`、es6、postcss、minified）保持不动。改完后 `weixin002/` 与 `docs/` 不会被编译进小程序包。

### 4.2 app.json 要点

- `pages`：注册全部 17 个页面，首个页面为 `pages/login/index`（登录）；
- `tabBar`：保留标准 `list`（4 个 Tab：发现/试衣/收藏/我的），同时 `"custom": true` 启用自定义渲染。Tab 与页面映射：

  | Tab | pagePath | 原型 |
  | --- | --- | --- |
  | 发现 | `pages/home/index` | 17-home.html |
  | 试衣 | `pages/tryon-select/index` | 06-tryon-select.html |
  | 收藏 | `pages/history/index` | 13-tryon-history.html |
  | 我的 | `pages/profile/index` | 08-profile.html |
- `window`：`"navigationStyle": "custom"` 全局关闭原生导航栏，由自定义 `nav-bar` 组件接管（含胶囊按钮避让与安全区适配）。

### 4.3 自定义 TabBar 机制

`custom-tab-bar/index` 组件复刻原型的四个 Tab + SVG 线性图标 + 两种选中态（普通页变色、08/15/16 页胶囊）。四个 Tab 页面在 `onShow` 中调用 `this.getTabBar().setData({ selected })` 同步选中态，避免切换闪烁。非 Tab 页面（登录、向导等）按原型需要展示 tabbar 组件，仅做展示与跳转，不参与 `switchTab` 选中态管理。

## 5. 设计系统迁移

### 5.1 全局 token（app.wxss）

将 `assets/proto.css` 的 `:root` 变量整段迁移到 `app.wxss` 的 `page {}` 选择器（WXSS 支持 CSS 变量），页面样式统一引用变量。核心色板：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#FBF5ED` | 页面暖米色背景 |
| `--surface` | `#FFFFFF` | 卡片/表单/弹窗 |
| `--surface-2` | `#F6F1E9` | 次级底色 |
| `--fg` | `#1F1D1B` | 主文字 |
| `--fg-2` | `#4A423C` | 次级文字 |
| `--muted` | `#8F8378` | 仅装饰性注释（不作正文） |
| `--border` / `--border-soft` | `#EADFD3` / `#F2EBE3` | 分隔线/描边 |
| `--accent` | `#E3A595` | 唯一强调色：主按钮/选中/进度 |
| `--accent-deep` | `#C98F80` | 深一档强调、描边/焦点 |
| `--accent-strong` | `#D4978A` | 弹窗主按钮 |
| `--accent-soft` | `#F8E3DB` | 浅强调底 |
| `--accent-tab` | `#E8B4A6` | Tab 选中胶囊 |
| `--ring-track` | `#F0D6CC` | 进度环未填充 |
| `--danger` | `#C0392B` | 删除警示（占比 <5%） |

前置处理：

- `color-mix()` 全部预计算为纯 hex 值（如 `color-mix(in oklch, var(--accent-deep) 45%, var(--fg))` 按混合比例算出具体色值），WXSS 不支持该函数；
- 字体栈保留系统字体（PingFang SC / HarmonyOS Sans SC / Microsoft YaHei），等宽数字用 `Consolas, monospace` 兜底，不加载自定义字体文件；
- 圆角（12/16/20/999px）、阴影（卡片/抬升两档）、动效（`cubic-bezier(0.28, 0, 0.22, 1)`、时长 0.08–0.26s）、间距统一迁移为变量。

### 5.2 iconfont（决策 6 落地）

从 17 屏 HTML 提取全部内联 SVG（去重后预计 20–30 个），用本地工具（如 svgtofont）生成 `assets/icons/iconfont.{ttf,woff}` 及对应样式；`app.wxss` 中 `@font-face` 注册，图标以 `<text class="iconfont icon-xxx">` 引用，`color` 随状态变色。选中态颜色按原型与 design-audit 结论取深一档强调色。

### 5.3 rpx 换算

原型设计稿宽度 390px → 750rpx，换算 1px ≈ 1.92rpx，布局取整使用；360px 最窄宽度下无横向滚动。

## 6. 公共组件清单（components/）

| 组件 | 职责 | 关键接口 |
| --- | --- | --- |
| `nav-bar` | 自定义导航：返回/标题/右侧，胶囊按钮避让+安全区 | `title`、`showBack` |
| `btn` | 主/次级/危险/深色/禁用/加载 | `type`、`disabled`、`loading`、`bindtap` |
| `chip` | 胶囊选项，单选/多选 | `selected`、`group`、`bindchange` |
| `seg` | 分段控件（性别等） | `options`、`value` |
| `switch` | 开关行 | `checked`、`bindchange` |
| `card` | 卡片容器 | 默认插槽 |
| `sheet` | 底部弹层：遮罩关闭、二次确认、按钮主次 | `visible`、`bindconfirm` |
| `ring-progress` | 生成页环形进度 | `percent` |
| `upload-card` | 照片上传卡 | `title`、`state`、`bindtap` |
| `garment-item` | 衣物网格卡 | `data`、`selected` |
| `record-item` | 试穿记录卡（含 AI 标识） | `data` |
| `compare-card` | 对比视图卡（含选择圆点） | `data`、`selected` |

`toast` 不单独做组件，统一封装 `wx.showToast`。

组装原则：页面 = 导航 + 内容区组件组装 + 底部操作区；页面 WXSS 只写页面特有样式，公共样式全部走全局变量与组件。

## 7. 页面迁移规范

### 7.1 四件套

每个页面一个目录 `pages/<name>/index.{wxml,wxss,js,json}`；页面 json 声明用到的组件；WXML 只做结构。

### 7.2 转换规则

| 原型 | 小程序 |
| --- | --- |
| `div` / `span` | `view` / `text` |
| `button`（含 :hover/:active） | `button` + `hover-class` |
| `img` | `image`（`mode="widthFix"` 或 `aspectFill`，注意 `aspect-ratio` 加 padding-top 兜底） |
| 内联 SVG | iconfont 类名 |
| 内联 `style` | 抽成 WXSS 类 |
| `data-nav` | `bindtap` + `wx.navigateTo` / `wx.switchTab` |
| 页面级 JS | `Page({ data / onLoad / methods })` |

### 7.3 页面骨架

自定义导航 `nav-bar` + 内容区（可滚动）+ 底部操作区（`footer-bar` 或 `tabbar`），适配 `env(safe-area-inset-*)`。

## 8. 样板页：01 登录

结构自上而下：登录标题「我形我衣」→ 副标题 → 插画卡（`p01-hero.png`，宽度撑满、保持比例）→ 协议勾选行（默认勾选，点击切换 on 态 + Toast，文案与原型逐字一致）→ 主按钮「微信授权登录」→ 底部 TabBar（选中"发现"，仅展示与跳转）。

交互映射：

- 协议勾选：`bindtap` 切换 `data.agreed`，Toast 沿用原型两句文案（勾选/取消）；
- 登录按钮：样板页先按原型行为实现（点击跳转 `pages/basic-info/index`）；**真实微信登录（wx.login / 手机号快捷登录）留待后端接口就绪后接入**，页面外壳不变；
- 进入路由：`pages/login/index` 为 `app.json` 首个页面。

验收：390×844 截图对照 `01-login.html` 与 `page_01_login.png.jpeg`，走查勾选、跳转、TabBar 交互。样板页三层验收全部通过后才进入批量阶段。

## 9. 批量推进批次

样板页验收通过后按业务链路分批：

| 批次 | 页面 |
| --- | --- |
| 批 1 | 创建向导：02 基本信息、03 身材参数、04 照片上传 |
| 批 2 | 生成与数字人：10 生成进度、05 3D 查看器 |
| 批 3 | 试穿链路：06 选择衣物、11 衣物预览、12 试穿进度、07 试穿结果、14 对比视图 |
| 批 4 | 我的与隐私：13 试穿记录、08 个人中心、15 隐私管理、16 反馈关于 |
| 批 5 | 首页：17 首页 |
| 收尾 | 全局联调：TabBar 跨页选中态、非 Tab 页返回、登录态贯穿 |

每批完成即按三层标准验收，问题当批清零。

## 10. 交互与数据层

### 10.1 utils/interaction.js（原型 proto.js 迁移）

| 原型函数 | 工具封装 |
| --- | --- |
| `OD.toast` | `toast(msg, ms)` → `wx.showToast` |
| `OD.nav` | `navigate(to)`：Tab 页走 `switchTab`，其余走 `navigateTo`（内部维护路由表） |
| `OD.navAfter` | `navigateAfter(to, ms, msg)`：提示后延时跳转 |
| `OD.openSheet/closeSheet` | 操作 `sheet` 组件 `visible` |
| `OD.ring` | `ring(percent, duration)`：CSS conic-gradient 兼容方案，canvas 兜底 |

滑块直接用小程序 `slider` 组件 + `bindchanging` 数值回显（等宽数字带单位）。

### 10.2 utils/api.js + utils/mock.js

`api.js` 只定义接口形状，页面一律通过它取数，不直接 import mock：

- `getAvatarProfile()` / `saveAvatarProfile(data)` —— 数字人档案（`avatar_profile`）；
- `getGarmentTemplates()` / `uploadGarment(image)` —— 衣物（`garment`）；
- `submitTryon(params)` / `getTryonStatus(taskId)` / `getHistory()` —— 试穿任务（`tryon_task` / `tryon_result`）；
- `getQuota()` / `saveResult()` / `deleteUserData()` —— 额度与数据管理（`quota`）。

`mock.js`：数据来自原型示例值（165/50kg、88/66/92cm、每日 3 次等），统一标注"示例"；所有接口带 300–1500ms 模拟延迟以体验 loading 态；预留失败模拟开关（试穿任务失败一次自动重试、再失败退额度）以验证 error 态。真实接口就绪后仅替换 `api.js` 内部实现。

### 10.3 状态与错误处理

- 不做全局状态库（YAGNI），页面 `data` + `setData`；登录态存 `wx.storage`；
- 每页对齐原型五种状态：default / loading / empty / error / success；
- 内容安全：上传衣物前调用 mock 审核（默认通过，预留拦截分支），拦截文案沿用原型。

### 10.4 埋点与合规标识

- 原型 `data-od-id`（如 `login-cta`、`home-tryon`）映射为页面方法名/组件 id，预留埋点挂钩，本轮不接 SDK；
- AI 生成标识（`badge-ai`）、水印、示例标注直接做进组件，随页面交付。

## 11. 验证与验收

### 11.1 三层验收标准

- **视觉层**：390×844 截图对照原型与原始关键图，允许 ≤2px 偏差；360px 无横向滚动；
- **交互层**：链路走查 + 五种状态核对；
- **内容层**：文案一致、示例标注、合规元素齐备。

### 11.2 节奏

- 样板页门禁 → 每批门禁 → 全局联调；
- 交付前真机抽查：4 个 Tab 页 + 登录页 + 生成进度页，重点看胶囊选中态、iconfont 清晰度、iPhone 底部安全区、Android 状态栏避让。

### 11.3 产物

- 验收截图存 `docs/qa/screens/`，与原型同命名（如 `01-login.png`）；
- `docs/qa/checklist.md` 逐屏打勾，问题标注"待修/已修"。

## 12. 边界与暂缓项

- **3D 数字人页**：静态示意 + 按钮反馈；真实旋转/标注待数字人 SDK 与服务端就绪后替换内部实现；
- **真实微信登录**：样板页先做跳转行为；wx.login / 手机号快捷登录待后端接口就绪后接入；
- **内容安全**：本轮用 mock 预留拦截分支，真实审核接微信内容安全 API（C-04）；
- **埋点**：本轮不接 SDK，仅保留 `data-od-id` 映射与挂钩；
- **额度**：每日 3 次为示例值，付费能力不做（个人主体暂不接微信支付，PRD FR-24a）。

## 13. 风险与对策

| 风险 | 对策 |
| --- | --- |
| iconfont 真机渲染差异（锯齿/缺失） | 交付前真机抽查 4 Tab 页 + 登录页；异常时回退 PNG 2x/3x |
| 自定义 tabBar 切换闪烁/选中态不同步 | 页面 `onShow` 统一同步 `selected`；全局联调专项检查 |
| `aspect-ratio` / conic-gradient 部分机型不支持 | 用 padding-top 占位、canvas 兜底；真机验证 |
| 非 Tab 页展示 tabbar 造成路由困惑 | 按原型原样保留，仅做展示/跳转，不做选中态管理 |
| 批量推进后视觉漂移 | 每批截图归档对比，问题当批清零 |
