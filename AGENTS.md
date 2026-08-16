# AGENTS.md · 我形我衣（weixin002）开发规范

## 1. 项目定位与现状

「我形我衣」是一款 AI 虚拟试穿微信小程序：用户录入身材参数并可选上传人脸/全身照创建 3D 数字人，再通过模板或上传衣物图片生成"自己穿着该衣物"的照片级效果图。

当前仓库状态：**小程序工程已完成开发（19 个页面），处于迭代验收阶段**。

- `weixin002/`：openDesign 导出的 HTML 高保真交互原型（17 屏 + 预览器），是设计与交互的唯一视觉来源，只读；
- `miniprogram/`：微信小程序源码（18 个页面 + 公共组件 + 工具层）；
- 数据层已接入微信云开发（配置环境 ID 后自动上云，未配置时回退本地 mock）。

## 2. 目录结构与职责

```
D:\weixin002\
├─ project.config.json          # 开发者工具配置（appid: wxe44ebc1661569b32，miniprogramRoot: miniprogram/）
├─ project.private.config.json  # 私有配置（基础库 3.17.1）
├─ AGENTS.md                    # 本规范
├─ docs\                        # PRD、验收清单、云开发接入说明
├─ weixin002\                   # openDesign HTML 原型（只读设计源）
└─ miniprogram\                 # ★ 小程序源码根
   ├─ app.json / app.js / app.wxss / sitemap.json
   ├─ config.js                 # 云开发环境 ID 填写处（cloudEnv）
   ├─ custom-tab-bar\           # Tab 页框架注入的自定义 TabBar
   ├─ components\               # nav-bar/btn/card/chip/seg/switch/sheet/tabbar/upload-card/garment-item/record-item/compare-card
   ├─ pages\                    # 19 个页面（login/home/basic-info/body-params/photo-upload/privacy-auth/generate-progress/avatar-3d/tryon-select/image-preview/tryon-progress/tryon-result/compare-view/history/profile/privacy-manage/feedback-about/favorites/account）
   ├─ utils\                    # interaction.js（跳转/Toast/弹层）、api.js（数据访问层）、mock.js（本地模拟）
   ├─ assets\                   # img（JPG 图片）、icons/png（彩色 PNG 图标）、icons-src（SVG 源）
   └─ scripts\                  # verify.js（静态校验）、generate-icon-pngs.js（PNG 图标生成）、auto-*.js（自动化诊断）等
```

## 3. 文档优先级

1. `docs/PRD-我形我衣-v1.0.md` —— 决定做什么（功能、数据模型、合规）。
2. `weixin002/DESIGN-HANDOFF.md` + `DESIGN-MANIFEST.json` —— 决定怎么转工程。
3. `weixin002/assets/proto.css` + `brand-spec.md` —— 视觉 token 与品牌规则。
4. `weixin002/design-audit.md` —— 已确认的 P0/P1/P2 修复决策。
5. `docs/CLOUD-SETUP.md` —— 云开发接入说明。

实现中若细节有歧义，**以导出原型的像素与行为为准**；禁止把原型降级成通用卡片/通用渐变/框架默认字体。

## 4. 页面 ↔ 小程序路由映射

底部 TabBar（4 个）：

| Tab | 小程序页面 | 说明 |
| --- | --- | --- |
| 主页 | `pages/home/index` | 首页（原型 17） |
| 试衣 | `pages/tryon-select/index` | 选择衣物（原型 06） |
| 收藏 | `pages/favorites/index` | 收藏独立页（用户收藏的试穿效果图） |
| 我的 | `pages/profile/index` | 个人中心（原型 08） |

其余页面（独立路由，非 Tab）：

| 原型 | 小程序页面 | 说明 |
| --- | --- | --- |
| 01 | `pages/login/index` | 登录（首次进入页） |
| 02 | `pages/basic-info/index` | 创建向导-基本信息 |
| 03 | `pages/body-params/index` | 创建向导-身材参数（三围/腿长/肤色/可编辑项） |
| 04 | `pages/photo-upload/index` | 创建向导-照片上传 |
| 05 | `pages/avatar-3d/index` | 我的数字人 3D（静态示意 + 按钮反馈） |
| 07 | `pages/tryon-result/index` | 试穿结果（收藏/分享） |
| 09 | `pages/privacy-auth/index` | 隐私授权 |
| 10 | `pages/generate-progress/index` | 生成数字人进度 |
| 11 | `pages/image-preview/index` | 衣物预览 |
| 12 | `pages/tryon-progress/index` | 试穿生成进度 |
| 13 | `pages/history/index` | 试穿记录（从「我的 → 试穿记录」进入） |
| 14 | `pages/compare-view/index` | 对比视图 |
| 15 | `pages/privacy-manage/index` | 隐私与数据管理 |
| 16 | `pages/feedback-about/index` | 反馈与关于 |
| 个人资料 | `pages/account/index` | 账户信息（微信/手机号绑定、个人 ID、退出登录），从「我的」头像进入 |

## 5. 设计系统（已迁移至 app.wxss）

设计 token 已从 `weixin002/assets/proto.css` 迁移到 `miniprogram/app.wxss` 的 `page {}`（CSS 变量），页面样式统一引用变量，禁止裸色值散落。设计稿 390px → 750rpx（1px ≈ 1.92rpx，取整）。

核心 token（同原型）：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#FBF5ED` | 页面暖米色背景 |
| `--surface` | `#FFFFFF` | 卡片/表单/弹窗 |
| `--surface-2` | `#F6F1E9` | 次级底色 |
| `--fg` | `#1F1D1B` | 主文字 |
| `--fg-2` | `#4A423C` | 次级文字 |
| `--muted` | `#8F8378` | 仅装饰性注释 |
| `--border` | `#EADFD3` / `--border-soft: #F2EBE3` | 分隔线/描边 |
| `--accent` | `#E3A595` | 唯一强调色 |
| `--accent-deep` | `#C98F80` | 深一档强调 |
| `--accent-strong` | `#D4978A` | 弹窗主按钮 |
| `--accent-soft` | `#F8E3DB` | 浅强调底 |
| `--accent-tab` | `#E8B4A6` | Tab 选中胶囊 |
| `--ring-track` | `#F0D6CC` | 进度环未填充 |
| `--danger` | `#C0392B` | 删除警示 |

字体：`"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", system-ui, sans-serif`；数值用等宽 `Consolas, monospace` + `tabular-nums`。圆角胶囊（999rpx）、卡片圆角 32–52rpx、统一动效 `cubic-bezier(0.28, 0, 0.22, 1)`。

**图标规范**：使用 `assets/icons/png/*.png`（彩色 PNG，按场景有 gray/active/deep/white/dark/green 版本），**不要用 iconfont 字体**（base64 字体在小程序不加载，已废弃）。源 SVG 在 `assets/icons-src/`。

## 6. 页面开发规范

- 每屏一个页面目录 `pages/<name>/index.{wxml,wxss,js,json}`。
- 页面骨架：`wx-page`（**固定 `height: 100vh` + `overflow: hidden`**，内容在 `content` 内部滚动，导航/TabBar 固定）+ `nav-bar` + `content` + `footer-bar`/`tab-bar`；适配 `env(safe-area-inset-*)` 安全区。
- **自定义组件的外层标签默认是 inline**：页面要控制组件宽度/间距时，给组件传 class 并加 `display: block`（如 `.footer-main { display: block; width: 90%; margin: 0 auto; }`）。
- 文案保留原型真实文案；演示数据标注"示例"。
- 底部操作主按钮：居中、宽度约 90%（`.footer-main`）；双按钮场景各占一半（`.footer-half`/`.action-btn`/`.sheet-action`）。
- 触控目标 ≥88rpx；可点击元素有 `hover-class` 反馈。

## 7. 交互映射与已知坑

- 跳转：Tab 页必须用 `wx.switchTab`（`navigateTo` 打不开 Tab 页）；非 Tab 页 `navigateTo`。统一走 `utils/interaction.js` 的 `navigate()`（内部维护 TAB_ROUTES）。
- 组件内点击用 `catchtap` 触发 `triggerEvent`（避免原生事件冒泡 + triggerEvent 双触发导致重复跳转）。
- **WXML 表达式不支持调用数组方法**（如 `arr.includes()`），选中态等必须存进数据项（如 `item.selected`）。
- **`requestAnimationFrame` 在小程序逻辑层不可用**，动画用 `setInterval`/`setTimeout`。
- **进度环**：页面内联 `conic-gradient` + 伪元素盖洞实现（不用自定义组件、不用 mask、不用 canvas——真机白屏风险）。
- Toast/弹层/进度统一走 `utils/interaction.js`。
- 五种状态必须覆盖：default / loading / empty / error / success。

## 8. 数据与接口约定

- 核心实体（PRD §8）：`avatar_profile`、`garment`、`tryon_task`、`tryon_result`、`quota`，另加 `favorites`（收藏）。
- **数据访问统一走 `utils/api.js`**：已配置 `config.js` 的 `cloudEnv` 时自动读写云数据库（集合：`avatar_profiles`、`tryon_tasks`、`tryon_results`、`favorites`、`quotas`）；未配置/集合不存在/出错时自动回退 `utils/mock.js`。
- 衣物模板为内置资源（未上云）；图片为本地资源；AI 试穿生成为模拟流程。
- 页面禁止直接 require mock；一律经 `api.js`。

## 9. 合规与隐私（强制）

- 所有 AI 生成效果图带「AI 生成」角标；分享文案含"AI 生成效果，仅供参考"。
- 人脸照片单独授权、最小化收集、可导出/删除；未授权不采集。
- 上传内容走内容安全审核（当前 mock 预留）；备案信息在关于页。
- 服务类目「工具-图片处理」；不面向 14 岁以下用户。

## 10. 质量验证（完成改动后必须执行）

```bash
cd miniprogram
npm run verify     # 静态校验：页面注册/跳转目标/图片资源/PNG 图标
npm test           # 单元测试（utils：api/mock/interaction）
```

1. 编译无报错、无 console error；
2. 改动页面逐屏对照 `weixin002/screens/*.html` 与 `page_*.jpeg`；
3. 核对安全区、TabBar 选中态、状态栏（`navigationBarTextStyle: black`）；
4. 真机预览验证（本地 JPG/PNG 图片、进度动画、弹层）。

## 11. 工程约束

- 基础库 3.17.1；es6/postcss/minified 已开启；appid `wxe44ebc1661569b32`。
- 源文件统一 UTF-8；命名英文小写中划线、资源语义化。
- `weixin002/` 只读参考；`node_modules` 仅开发依赖（svgtofont/fonteditor-core/puppeteer-core/sharp 等用于图标与校验脚本）。
- 已知暂缓项：真实微信登录、AI 生成/3D 真实能力、内容安全、图片云存储（完整云开发方案 B）。
