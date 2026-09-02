# 免费版参数化数字人 3D（非 AI）设计文档

- 日期：2026-08-16
- 状态：已与用户确认方案（先用轻量 canvas 渲染器 B）
- 关联 PRD：FR-04/05/06a/08/09；关联变更记录 C-14~C-20（现有实现基线）

## 1. 背景与目标

「我形我衣」目前数字人相关页面均为 mock/静态示意：`pages/avatar-3d` 显示静态图片，旋转/标注为 toast 占位；`pages/generate-progress` 为定时器模拟。用户确认产品后续提供两个版本数字人：

1. **免费版**：程序化（参数化）生成，非 AI；
2. **AI 仿真版**：照片级仿真数字人，供用户选择（本期不实现，只预留接口）。

本期目标：实现免费版“录入身材 → 生成 → 3D 查看（旋转/缩放/标注）→ 保存”完整链路，并保证渲染失败不白屏。渲染方案采用自研轻量 canvas 渲染器（方案 B），不引入 three.js / npm 构建。

## 2. 范围

### 2.1 本期实现

- 身材参数页补全数据保存（三围/腿长/颈长/肩宽/臂长/鞋码/肤色/缺省估算）；
- 生成进度页接入真实生成（参数化建模 + 进度动画 + 保存 + 跳转）；
- `pages/avatar-3d` 改为 canvas 实时渲染参数化人体，支持单指旋转、双指缩放、身材标注模式；
- 渲染失败自动降级到静态图 + 重试，杜绝白屏；
- 统一生成器/渲染器接口，为 AI 版并行预留；
- 单元测试与现有质量校验保持全绿。

### 2.2 本期不做

- AI 仿真数字人（第二生成器，仅留接口与文档）；
- 生成入口的“免费/AI 仿真”选择 UI（随 AI 版一并加入，避免留不可用选项）；
- 数字人历史版本（FR-10，保留最近 3 版）；
- 试穿底图导出接入试穿流程（渲染器先提供导出能力，试穿流程后续接入）。

## 3. 总体架构

```
pages/body-params ──保存──▶ api.saveAvatarProfile ──▶ utils/mock|cloud
pages/photo-upload ──选填状态──▶ api.saveAvatarProfile
pages/generate-progress ──▶ utils/avatar3d/provider.generate(profile)
                                  │
                                  ▼
                        utils/avatar3d/build-model.js（免费参数化建模）
                                  │ avatarModel（纯数据）
                                  ▼
                        utils/avatar3d/renderer.js（轻量 canvas 渲染器）
                                  │
                                  ▼
pages/avatar-3d（canvas 2d：旋转/缩放/标注/兜底）
```

### 3.1 模块职责

| 模块 | 职责 | 依赖 |
| --- | --- | --- |
| `utils/avatar3d/provider.js` | 统一生成入口，按 `kind` 选择生成器；本期仅 `free` | build-model.js |
| `utils/avatar3d/build-model.js` | 纯函数：profile → avatarModel（体型比例/肤色/发型等），无 canvas 依赖，可单测 | 无 |
| `utils/avatar3d/renderer.js` | 渲染器接口：绘制、设置旋转/缩放、标注开关、导出图片；本期实现轻量 canvas 渲染器 | 无（canvas 由页面注入） |
| `pages/avatar-3d` | 创建 canvas 节点、触摸手势、调用渲染器、失败兜底、档案卡片 | renderer.js、api |

接口约定（AI 版并行预留）：

```js
// provider
generate(profile, { kind: "free" }) → Promise<avatarModel>
// avatarModel 结构
{ kind: "free", profile: {...}, body: {...各段比例与外观...}, version: "v1" }

// renderer
init(canvasNode, avatarModel) → Promise<{width, height}>
setView({ rotateY, rotateX, zoom })
setMeasure(on)
render()
exportImage() → Promise<tempFilePath>   // 预留：试穿底图
destroy()
```

## 4. 数据与存储

### 4.1 avatar_profile 补齐

`body-params` 页保存字段（并入现有 `saveAvatarProfile`）：

- `bustCm` / `waistCm` / `hipCm`（三围）
- `legLengthCm` / `neckLengthCm`
- `shoulderCm` / `armLengthCm` / `shoeSize`
- `skinTone`（肤色档位）
- `estimate`（缺省估算开关）

### 4.2 avatarModel 存储

- 本地：`wx.setStorageSync("avatarModel", avatarModel)`，供 `avatar-3d` 即时读取；
- 云端：随 `avatar_profiles` 更新 `modelVersion`（`"free-v1"`）与 `status`（`"ready"`）；模型本体为纯计算数据，不入库，云端仅存档案。
- 无档案时：使用 PRD 示例档案（165cm/50kg 女性）作为兜底演示数据，并保留“示例”标记。

## 5. 生成流程改造

1. `body-params.next()`：先 `api.saveAvatarProfile(...)` 保存全部身材字段，再跳转 `photo-upload`；
2. `photo-upload`：保持选填语义；人脸/全身照当前仍为模拟选择，把选择状态随档案保存（后续接真实上传时替换）；
3. `generate-progress`：进入时调用 `provider.generate(profile)`（真实计算，毫秒级），成功后保存模型；进度环仍动画到 100%，完成后跳转 `avatar-3d`；生成失败显示错误态 + 重试按钮，不静默跳转。

## 6. 3D 查看页（pages/avatar-3d）

- 使用 `<canvas type="2d">`（Canvas 2D API），`onReady` 后通过 `wx.createSelectorQuery().select(...).fields({node:true})` 获取节点，等画布就绪再绘制；
- 手势：
  - 单指拖动：水平旋转（rotateY 无级 0–360°），上下微调视角（rotateX 限制 ±20°）；
  - 双指缩放：zoom 0.8–1.6；
  - 触摸结束后缓动回弹 0.1s；
- 标注模式：显示身高、肩宽、胸围、腰围、臀围、腿长的尺寸线与数值，随人体旋转同步更新；
- 兜底：canvas 初始化失败/渲染异常时隐藏 canvas，显示原静态图 `p05-avatar.jpg` + “重新生成”按钮（跳回生成进度页），不白屏；
- 保留：身材档案卡片（身高/体重/腰围/腿长）、编辑入口、确认按钮、去试穿按钮。

## 7. 参数化人体模型（免费版画风）

- 分段结构：头、颈、肩/躯干（胸/腰/臀三段）、上臂、前臂、手、大腿、小腿、脚；
- 比例计算：以身高为基准按性别标准比例分配各段长度；胸/腰/臀由档案三围驱动（缺省估算时按性别默认体型生成），肩宽、臂长、腿长、颈长取档案值；
- 性别区分（FR-06a）：女性肩窄于男性、胸腰臀曲线明显、默认长发/中发；男性肩宽、腰臀差小、默认短发；
- 肤色：`skinTone` 固定 4 档——浅（#F2D5C4）/ 自然（#E8B895）/ 小麦（#C68B5E）/ 深（#8D5A3B），由档案肤色值就近映射；
- 面部：无五官的风格化头部 + 默认发型；人脸照片本期不用于重建（留待 AI 版）；
- 着装：简洁打底（泳装式色块），保持身形可见，与原型“数字人模特”语义一致。

## 8. 错误处理与兜底

- 档案缺失：使用示例档案并标记“示例”；
- 生成失败：进度页显示错误态 + 重试，可退出；
- canvas 初始化失败/绘制异常：`avatar-3d` 降级静态图 + 重试按钮；
- 云端不可用：沿用现有 mock 回退（cloud → mock），不影响生成链路。

## 9. 测试与验证

- 单元测试（`utils/*.test.js` 风格）：
  - `build-model`：身高 = 各段长度之和；三围/肩宽等在档案值 ±0.1 内；性别不同时肩宽/腰臀比可区分；
  - `provider.generate`：返回合法 avatarModel，`kind === "free"`；
- 脚本校验：`node scripts/verify.js`、`node scripts/check-handlers.js`、`npm test` 全绿；
- 真机：iOS 与安卓各测一次 canvas 绘制、单指旋转、双指缩放、标注模式、失败兜底；
- 回归：登录/创建向导/试衣入口跳转不受影响。

## 10. AI 版并行预留（后续）

- `provider.generate(profile, {kind:"ai"})` 返回 `avatarModel`（含模型 URL/标识）；
- 渲染器接口不变；AI 版新增 three.js 渲染器实现同一接口，查看页按 `avatarModel.kind` 选择渲染器；
- 生成入口增加“免费 / AI 仿真”选择；AI 版消耗额度策略待定（沿用 `quota` 数据模型）。
