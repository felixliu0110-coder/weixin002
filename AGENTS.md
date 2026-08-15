# AGENTS.md · 我形我衣（weixin002）开发规范

## 1. 项目定位与现状

「我形我衣」是一款 AI 虚拟试穿微信小程序：用户录入身材参数并可选上传人脸/全身照创建 3D 数字人，再通过模板或上传衣物图片生成"自己穿着该衣物"的照片级效果图。

当前仓库状态：**原型已完成、工程化开发尚未开始**。

- `weixin002/`：openDesign 导出的 HTML 高保真交互原型（17 屏 + 预览器），是设计与交互的唯一视觉来源；
- 根目录 `project.config.json` / `project.private.config.json`：微信开发者工具生成的配置骨架；
- 目前**没有** `app.json` / `app.js` / `pages/` 等小程序源码，首次开发需要按本规范从零搭建小程序工程。

## 2. 目录结构与职责

```
D:\weixin002\
├─ project.config.json          # 开发者工具配置（appid: wxe44ebc1661569b32，compileType: miniprogram）
├─ project.private.config.json  # 私有配置（基础库 3.17.1）
├─ docs\PRD-我形我衣-v1.0.md     # 产品需求文档（需求唯一来源；weixin002 内为副本）
├─ weixin002\                   # openDesign HTML 原型（设计源，禁止混入小程序代码）
│  ├─ index.html                # 原型预览器（仅审阅工具，不是最终 UI）
│  ├─ woxingwoyi-demo.html      # 17 屏合一交互演示
│  ├─ 我形我衣-单文件演示.html    # 单文件演示（约 12MB，全量内嵌）
│  ├─ screens\01-login.html … 17-home.html   # 17 个独立页面
│  ├─ assets\proto.css          # 共享设计系统（token + 组件，视觉唯一来源）
│  ├─ assets\proto.js           # 共享交互（跳转/Toast/弹层/进度环/滑块）
│  ├─ assets\img\               # 设计素材（数字人、服装、效果图等）
│  ├─ page_01…17.png.jpeg       # 原始关键图（未修改，视觉唯一来源）
│  ├─ DESIGN-HANDOFF.md         # 设计交接契约（实现时优先遵守）
│  ├─ DESIGN-MANIFEST.json      # 屏幕/模块/token 的机器可读映射
│  ├─ brand-spec.md             # 品牌与视觉规范
│  └─ design-audit.md           # 设计诊断记录（已确认的修复决策）
```

## 3. 文档优先级

1. `docs/PRD-我形我衣-v1.0.md` —— 决定做什么（功能、数据模型、合规）。
2. `weixin002/DESIGN-HANDOFF.md` + `DESIGN-MANIFEST.json` —— 决定怎么转工程（屏幕边界、token 抽取、状态清单）。
3. `weixin002/assets/proto.css` + `brand-spec.md` —— 视觉 token 与品牌规则。
4. `weixin002/design-audit.md` —— 已确认的 P0/P1/P2 修复决策（如 TabBar 选中态、hint 对比度、分段控件样式）。
5. `weixin002/README.md` —— 原型使用说明。

实现中若细节有歧义，**以导出原型的像素与行为为准**，不要自行发明新模式；禁止把原型降级成通用卡片/通用渐变/框架默认字体。

## 4. 页面 ↔ 小程序路由映射

按 `DESIGN-MANIFEST.json` 的 screen-file-first 策略：每个原型屏幕对应小程序的一个独立页面，禁止合并成一页。

底部 TabBar（4 个）：

| Tab | 原型页面 | 小程序页面 |
| --- | --- | --- |
| 发现 | 17-home.html | pages/home/index |
| 试衣 | 06-tryon-select.html | pages/tryon/index |
| 收藏 | 13-tryon-history.html | pages/history/index |
| 我的 | 08-profile.html | pages/profile/index |

其余页面按编号映射为独立路由：

| 原型 | 页面 | PRD 需求 |
| --- | --- | --- |
| 01-login.html | 登录 | FR-01 |
| 02-basic-info.html | 创建向导-基本信息 | FR-04/05 |
| 03-body-params.html | 创建向导-身材参数 | FR-04/05 |
| 04-photo-upload.html | 创建向导-照片上传 | FR-06/06a/07 |
| 05-3d-viewer.html | 我的数字人 3D | FR-09/10/12 |
| 06-tryon-select.html | 选择衣物 | FR-13/14 |
| 07-tryon-result.html | 试穿结果 | FR-17/18/19 |
| 08-profile.html | 个人中心 | FR-22~26 |
| 09-privacy-auth.html | 隐私授权 | FR-03、C-03 |
| 10-generate-progress.html | 生成数字人进度 | FR-08 |
| 11-image-preview.html | 衣物预览 | FR-15/16 |
| 12-tryon-progress.html | 试穿生成中 | FR-16/16a/21 |
| 13-tryon-history.html | 试穿记录 | FR-18/23 |
| 14-compare-view.html | 对比视图 | FR-20 |
| 15-privacy-manage.html | 隐私与数据管理 | FR-11/25、C-03 |
| 16-feedback-about.html | 反馈与关于 | FR-26、C-01/02/05 |
| 17-home.html | 首页 | FR-12/13 |

## 5. 设计系统（proto.css → WXSS）

原型设计稿宽度 390px，小程序按 750rpx 设计宽度换算（1px ≈ 1.92rpx，取整使用）。颜色、圆角、阴影、动效必须从 `assets/proto.css` 抽取，禁止裸色值散落页面。

### 5.1 颜色 token

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#FBF5ED` | 页面暖米色背景 |
| `--surface` | `#FFFFFF` | 卡片/表单/弹窗 |
| `--surface-2` | `#F6F1E9` | 次级底色 |
| `--fg` | `#1F1D1B` | 主文字 |
| `--fg-2` | `#4A423C` | 次级文字 |
| `--muted` | `#8F8378` | 仅装饰性注释（对比度不足，不作正文） |
| `--border` | `#EADFD3` / `--border-soft: #F2EBE3` | 分隔线/描边 |
| `--accent` | `#E3A595` | 唯一强调色：主按钮/选中/进度 |
| `--accent-deep` | `#C98F80` | 深一档强调、描边/焦点 |
| `--accent-strong` | `#D4978A` | 弹窗主按钮 |
| `--accent-soft` | `#F8E3DB` | 浅强调底 |
| `--accent-tab` | `#E8B4A6` | Tab 选中胶囊 |
| `--ring-track` | `#F0D6CC` | 进度环未填充 |
| `--danger` | `#C0392B` | 删除警示（占比 <5%） |

### 5.2 字体与结构

- 字体族：`"PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", system-ui, sans-serif`；数值使用等宽字体 `"SF Mono", Consolas, monospace` 并启用 `tabular-nums`（身高体重、三围、百分比、日期）。
- 圆角：卡片 16–26px（小程序按 rpx 换算），按钮/Tab/品类/角度选项一律全圆角胶囊（999px）。
- 阴影：卡片 `0 10px 28px rgba(70,52,40,0.07)`，抬升 `0 14px 34px rgba(70,52,40,0.12)`。
- 动效：统一缓动 `cubic-bezier(0.28, 0, 0.22, 1)`，时长 0.08–0.26s。
- 导航：自定义导航栏（返回 + 居中标题），44px 高；底部 TabBar 56px + 安全区。

### 5.3 组件清单（复用，不要重造）

按钮 `btn`（主/次级/深色/危险/小号/禁用）、胶囊选项 `chip`、卡片 `card`、分段控件 `seg`、开关 `switch`、行开关 `row-toggle`、三围数字卡 `num-card`、上传卡 `upload-card`、空态 `empty-state`、衣物网格 `garment`、记录瀑布 `record`、对比卡 `compare-card`、效果图卡 `photo-card`（含 AI 角标 `badge-ai`、水印 `wm`）、圆形操作钮 `circle-btn`、搜索框、额度条、进度步骤条 `steps`、环形进度 `ring`、Toast、底部弹层 `sheet`。

## 6. 页面开发规范

- 每屏一个页面目录 `pages/<name>/index.{wxml,wxss,js,json}`，目录名与原型 `screens/` 语义对应（如 `pages/tryon-select/`）。
- 页面骨架：自定义导航 `nav` + 内容区 `content` + 底部操作条 `footer-bar` 或 `tabbar`；适配 `env(safe-area-inset-*)` 安全区。
- 文案保留原型真实文案与数值；演示数据（如 165cm/50kg、88/66/92cm、每日 3 次、排队位）必须标注"示例"或替换为真实数据。
- 图标沿用原型线性描边风格（stroke-width 1.7–2.2），小程序内用 image/iconfont 实现，保持视觉一致。
- 原型元素上的 `data-od-id`（如 `home-tryon`、`template-dress`）对应小程序里的页面方法与组件标识，用于自动化与埋点。
- 底部 Tab 选中态按页面语义校正：首页=发现、试穿=试衣、记录/我的系=我的。
- 上传/生成类操作底部只保留一个主按钮，主次关系按 `design-audit.md` 执行。

## 7. 交互映射（proto.js → 小程序 API）

| 原型交互 | 小程序实现 |
| --- | --- |
| `OD.nav(to)` | `wx.navigateTo`；Tab 页用 `wx.switchTab` |
| `OD.navAfter(to, ms, msg)` | 提示后 `setTimeout` + 跳转 |
| `OD.toast(msg)` | `wx.showToast` |
| `OD.openSheet / closeSheet` | 自定义 bottom-sheet 组件（支持遮罩点击关闭、删除等二次确认） |
| `OD.ring` 进度环 | 生成页环形进度动画；文案统一"可离开页面，完成后通知你" |
| `OD.slider` | `slider` 组件 + 等宽数值实时回显（带单位 cm/kg） |
| `data-garment` 多选 | `bindtap` + dataset 切换选中态，Toast 反馈 |
| `data-chip` 单选 | 同组互斥，选中态为粉底胶囊 |

必须覆盖的状态：default / hover / pressed / disabled / loading / empty / error / success（如模板库空态、生成失败重试与退额度、表单成功态）。

## 8. 数据与接口约定

- 核心实体（PRD §8）：`avatar_profile`（身材档案）、`garment`（衣物素材）、`tryon_task`（试穿任务）、`tryon_result`（结果）、`quota`（额度）。
- 原型中的 mock 值仅为演示，工程化时集中到数据层/接口层，禁止在页面里散落硬编码。
- 异步链路：提交 → 排队 → 生成中（可离开）→ 订阅消息通知 → 成功/失败；失败自动重试 1 次，仍失败退回额度并提示原因。
- 试穿底图以 3D 数字人渲染图为准，人脸照仅用于面部相似度（FR-16a）。
- 接口未定义前使用统一 mock 模块，后续可无痛替换为真实 API。

## 9. 合规与隐私（强制）

- 所有 AI 生成效果图必须带「AI 生成」角标；分享卡片必须标注"AI 生成效果，仅供参考"（FR-19、C-02）。
- 人脸照片属敏感个人信息：单独授权、最小化收集、加密存储、可导出/删除；未授权前不采集（C-03）。
- 上传内容接入微信内容安全 API 或等效审核，涉政/涉黄/违禁内容拦截不进生成流程（C-04）。
- 服务类目「工具-图片处理」，备案信息展示于关于页；深度合成按 C-01 落实。
- 不面向 14 岁以下用户，注册流程声明（C-06）。

## 10. 可访问性与体验基线

- 触控目标 ≥44px（约 88rpx），所有可点击元素有按压反馈（`hover-class` 等价于原型 `:active`）。
- 键盘焦点可见（`focus-visible` 对应 `:focus` 样式）；正文对比度 ≥4.5:1，`muted` 色仅限装饰性注释（design-audit S1/S2）。
- 支持减少动效偏好；360px 最窄宽度下无横向滚动。
- 生成类等待页允许离开并回跳，不强制用户停留。

## 11. 质量验证（完成前必须执行）

1. 开发者工具编译通过、无控制台报错。
2. 逐屏对照 `screens/*.html` 与原始关键图 `page_*.jpeg`，核对布局、文案、图标、选中态。
3. 检查每页 5 种状态、导航跳转、安全区适配、TabBar 选中态。
4. 抽检对比度与触控尺寸；确认最窄宽度无横向滚动。
5. 确认 AI 标识、隐私授权、删除确认等合规元素齐备。

## 12. 工程约束

- 基础库 3.17.1；`es6`、`postcss`、`minified` 已开启；appid `wxe44ebc1661569b32`。
- 所有源文件统一 UTF-8 编码。
- 页面/资源命名：英文小写中划线，资源语义化（如 `p17-dress.png`）。
- `weixin002/` 原型目录只读参考，不往里面写小程序代码。
- 新增第三方依赖前先确认必要性（如 3D 查看器、抠图预览），并说明选型理由。
