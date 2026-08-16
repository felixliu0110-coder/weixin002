# 「我形我衣」AI 试穿视频方案设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 方案名称 | AI 试穿视频生成方案（AI 写实数字人 + 转身视频） |
| 文档版本 | v1.2（定稿，替代免费 3D 方案） |
| 日期 | 2026-08-16 |
| 状态 | 已与用户确认设计，待写实现计划 |
| 关联文档 | PRD `docs/PRD-我形我衣-v1.0.md`；免费版 3D 设计 `docs/superpowers/specs/2026-08-16-free-avatar-3d-design.md`（已废弃）；提示词源 `.agnes/`（三份即梦提示词）；云开发 `docs/CLOUD-SETUP.md` |

---

## 1. 方案定位（重要）

本方案是「我形我衣」**唯一**的数字人/试穿实现路径，**替代**此前已实现的免费参数化 3D 数字人（Canvas 2D，`utils/avatar3d`）。

- 人物侧：AI 生成写实三视图（正面/侧面/背面），创建向导完成时自动生成一次，后续试穿复用；
- 衣物侧：模板衣物保持单张上传图，试穿需要时 AI 生成 2x2 四视图并缓存（与单张图 1:1 关联，删除联动）；
- 试穿侧：人物三视图 + 服装四视图 → AI 生成 180° 原地转身视频，替代静态效果图。

**关键决策**：免费 3D 方案整体废弃（删除 `utils/avatar3d/` 与 canvas 渲染逻辑），不留并行入口；AI 生成服务通过「云函数 + 可插拔 AIGC 适配器」接入，API Key 由用户后续提供，未配置时 mock 回退保证链路可跑通。

---

## 2. 核心思路

```
身材档案 + 可选参考图
  → AI 三视图（正面/侧面/背面）→ 存云端 avatar_views（一次生成，试穿复用）

模板衣物（单张上传图）
  → 首次试穿时 AI 四视图（正面/45°/细节/背面）→ 存云端 garment_views（1:1 缓存）

试穿：人物三视图 + 服装四视图
  → AI 穿衣效果图 → AI 180° 转身视频（4-6 秒）→ 存云端
  → 展示 + 收藏/保存模板/分享（带 AI 标识）
```

相比"每次试穿都重新生成人"：三视图一次性生成复用，保证同一用户多次试穿的体型/面部一致，试穿链路只做换装与转身。

---

## 3. 流程设计

### 3.1 人物三视图（创建向导完成时自动生成）

```
用户填写/读取身材参数（身高/体重/三围/肩宽/臂长/腿长/颈长/鞋码/性别/肤色）
    ↓
上传参考图（可选：人脸照/全身照，用于保持面部与体型特征；未授权则不使用）
    ↓
进入生成进度页（generate-progress）→ 提交 createAvatarViews 任务
    ↓
云函数按 .agnes「真人写实三视图」提示词模板组装参数，调用 AIGC 生图
    ↓
三视图预览页（avatar-3d 改造）：正面/侧面/背面 + 档案卡 + 确认/重新生成/去试穿
    ↓
确认后 avatar_views.status=ready，后续试穿引用
```

### 3.2 服装四视图（按需生成 + 缓存）

```
试衣页选择/上传衣物（单张图，分类：上衣/裤子/头饰/鞋子/其他，UI 不变）
    ↓
提交试穿前检查 garment_views 是否已有该 garment 的四视图
    ↓
无 → 云函数 ensureGarmentViews：按 .agnes「服装四视图」模板（参考原图）生成 2x2 并缓存
    ↓
有 → 直接复用
    ↓
删除模板衣物 → 同步删除该 garment_views 记录与云存储文件
```

### 3.3 试穿视频（生成穿搭）

```
人物三视图（front 图）+ 服装四视图
    ↓
云函数 aiTryon：
  ① AI 生图：人物穿着指定服装的效果图（写真）
  ② AI 图生视频：180° 原地转身（正面→侧面→背面→回正面），4-6 秒
    ↓
任务入队 → 生成中（可离开，订阅消息通知）→ 成功/失败
    ↓
tryon-result：video 播放 + 效果图 + 收藏/保存模板/分享（AI 标识）
```

---

## 4. 已确认决策

| 决策项 | 结论 |
|--------|------|
| 方案定位 | AI 方案为唯一路径，废弃免费 3D（删除 avatar3d 模块） |
| 人物三视图生成时机 | 创建向导完成时自动生成（方案 A），一次生成试穿复用 |
| 服装素材 | 模板衣物保持单张上传图；四视图按需生成并缓存，1:1 关联 |
| 删除联动 | 删除单张衣物图 → 连带删除四视图；删除数字人 → 删除三视图与相关视频 |
| 试穿页面 | 试衣页 UI 不变；生成穿搭结果由静态图换成 AI 转身视频 |
| 转身角度/时长 | 180°、4-6 秒 |
| 生成服务 | 云函数 + AIGC 适配器（即梦/火山方舟预留），API Key 后续提供，未配置 mock 回退 |
| 额度 | 三视图扣 1、每次试穿扣 1；失败重试 1 次不重复扣，仍失败退额度（FR-21） |
| 存储 | 三视图 + 四视图 + 视频全部云存储，小程序只存 URL |

---

## 5. 数据模型

### 5.1 三视图档案（新集合 `avatar_views`）

```json
{
  "_id": "av-xxx",
  "user_id": "user-xxx",
  "profile_snapshot": {
    "gender": "female", "height_cm": 165, "weight_kg": 50,
    "bust_cm": 88, "waist_cm": 66, "hip_cm": 92,
    "shoulder_cm": 38, "arm_length_cm": 55, "leg_length_cm": 96,
    "neck_length_cm": 9, "shoe_size": 38, "skin_tone": "light"
  },
  "views": {
    "front": "https://xxx.cos.example.com/avatar-front.jpg",
    "side": "https://xxx.cos.example.com/avatar-side.jpg",
    "back": "https://xxx.cos.example.com/avatar-back.jpg"
  },
  "ref_image": "https://xxx.cos.example.com/ref.jpg",
  "status": "pending | processing | ready | failed",
  "task_id": "task-xxx",
  "created_at": 1723780800000
}
```

### 5.2 模板衣物（新集合 `garments`）

```json
{
  "_id": "g-xxx",
  "user_id": "user-xxx",
  "name": "浅蓝色水洗直筒牛仔裤",
  "category": "裤子",
  "image": "https://xxx.cos.example.com/garment.jpg",
  "status": "ok",
  "created_at": 1723780800000
}
```

### 5.3 四视图缓存（新集合 `garment_views`，与 garments 1:1）

```json
{
  "_id": "gv-xxx",
  "garment_id": "g-xxx",
  "user_id": "user-xxx",
  "views": {
    "composite": "https://xxx.cos.example.com/gv-2x2.jpg"
  },
  "status": "pending | processing | ready | failed",
  "task_id": "task-xxx",
  "created_at": 1723780800000
}
```

### 5.4 试穿任务（扩展 `tryon_tasks`）

```json
{
  "_id": "task-xxx",
  "user_id": "user-xxx",
  "avatar_view_id": "av-xxx",
  "garment_id": "g-xxx",
  "garment_view_id": "gv-xxx",
  "type": "ai_video",
  "stage": "garment_views | tryon_image | video",
  "status": "pending | processing | success | failed",
  "retry_count": 0,
  "tryon_image": "https://xxx.cos.example.com/tryon.jpg",
  "tryon_video": "https://xxx.cos.example.com/tryon.mp4",
  "error": "",
  "created_at": 1723780800000,
  "updated_at": 1723780860000
}
```

### 5.5 试穿结果（扩展 `tryon_results`）

```json
{
  "_id": "r-xxx",
  "user_id": "user-xxx",
  "avatar_view_id": "av-xxx",
  "garment_id": "g-xxx",
  "garment_name": "蓝色直筒牛仔裤",
  "tryon_image": "https://xxx.cos.example.com/tryon.jpg",
  "tryon_video": "https://xxx.cos.example.com/tryon.mp4",
  "ai_tagged": true,
  "created_at": 1723780800000
}
```

### 5.6 额度（复用现有 `quotas`）

- 生成三视图：消耗 1 次额度（每日免费 3 次，对应 FR-24a）；
- 试穿生成（四视图缓存 + 效果图 + 视频）：消耗 1 次额度；
- 生成失败自动重试 1 次不重复扣费，仍失败退回额度（FR-21）。

---

## 6. 提示词模板（源：.agnes 三文件）

> 生成时用「占位符替换」方式组装；三视图必须同批次生成并固定人物描述，保证同一人。

### 6.1 人物三视图 `.agnes/jimeng-2026-08-16-7722-真人写实三视图生成提示词文档.md`

参数替换区：身高、体重、鞋码、肩宽、胸围、腰围、臀围、臂长、腿长、颈长、肤色。
核心约束：完全写实、等比例还原、不做美颜、站姿统一（双手自然垂于身侧、双脚与肩同宽）、纯白背景、三点柔光。

### 6.2 服装四视图 `.agnes/jimeng-2026-08-16-8289-通用服装四视图提示词模板.md`

以「参考原图」为输入，2x2 均等排布：正面平拍 / 45° 斜侧 / 局部细节特写 / 背面平拍；要求与原图 100% 一致、不美化、保留水洗与使用痕迹。

### 6.3 试穿视频 `.agnes/jimeng-2026-08-16-2206-写实人衣匹配视频生成提示词.md`

人物按 6.1 参数还原 + 指定参考服装（四视图/原图）；初始站姿自然，随后缓慢原地静态转身 180°，镜头固定；全局无滤镜无美化。

> 实现时把三份提示词迁入云函数 `templates/` 目录（txt 或 js 模板常量），按档案/衣物动态填充。

---

## 7. 小程序集成设计

### 7.1 页面流程

```
创建向导（basic-info → body-params → photo-upload）
  → generate-progress（AI 三视图生成中，可离开）→ avatar-3d（三视图预览，确认/重生成/去试穿）
  → home / tryon-select

tryon-select（模板衣物/上传衣物，UI 不变）
  → 提交试穿（自动补生成四视图）→ tryon-progress（AI 生成中，可离开）
  → tryon-result（video 播放 + 效果图 + 收藏/保存模板/分享）
```

### 7.2 异步生成策略（沿用 FR-16/21）

```
用户提交试穿请求
  → 校验额度 → 扣减 → 任务入队（tryon_tasks: pending）
  → 返回生成中页面（可离开，提示"完成后通知你"）
  → 云函数/回调更新状态（processing → success/failed）
  → 订阅消息通知；失败自动重试 1 次，仍失败退回额度并提示原因
  → 完成后跳转/用户手动进入结果页
```

### 7.3 前端改动点

| 页面 | 改动 |
|------|------|
| `avatar-3d` | 删除 canvas 3D 渲染/旋转/缩放/标注；改为三视图预览（三图横滑 + 档案卡 + 确认/重新生成/去试穿） |
| `generate-progress` | 调 `createAvatarViews` 真实任务，进度环按任务状态推进，可离开；失败重试 |
| `tryon-select` | UI 不变；提交时确保四视图缓存存在（无则先触发生成） |
| `image-preview` | 上传确认后走提交链路（含四视图补生成） |
| `tryon-progress` | 轮询 `aiTryon` 任务，展示两阶段（四视图→视频）；可离开 |
| `tryon-result` | video 播放 + 效果图 + 收藏/保存模板/分享（AI 标识） |
| `history` / `favorites` | 卡片视频角标，点击播放 |
| `api.js` | 新增 createAvatarViews / ensureGarmentViews / aiTryon 接口与轮询；mock 回退 |

### 7.4 云函数与 AIGC 适配器

```
cloudfunctions/
  ├─ createAvatarViews/      # 三视图任务：入参 profile+ref → 调 AIGC → 存云存储/数据库
  ├─ ensureGarmentViews/     # 四视图缓存：garment_id → 已有直接返回，无则生成
  ├─ aiTryon/                # 试穿：额度校验/扣减 → 效果图 → 视频 → 状态流转
  ├─ onTryonComplete/        # 第三方回调：更新任务 + 订阅消息通知
  └─ services/
     ├─ aigc/index.js        # 统一接口 generateImages / generateVideo（供应商可替换）
     ├─ aigc/jimeng.js       # 即梦/火山方舟实现（API Key 读云函数环境变量）
     ├─ aigc/mock.js         # Key 未配置时返回占位素材，保证链路可跑通
     └─ templates/           # 三份提示词模板（源自 .agnes）
```

适配器接口约定：

```js
// 生图
generateImages({ prompt, refImages: [url], count, aspectRatio }) → [{ url }]
// 生视频
generateVideo({ imageUrl, prompt, durationSec }) → { videoUrl, taskId }
```

---

## 8. 成本估算（供预算决策）

| 项目 | 量级 | 说明 |
|------|------|------|
| 人物三视图 | 1 次/用户 | 3 张图，建议同批次 |
| 服装四视图 | 1 次/衣物（缓存复用） | 首次试穿该衣物时生成 |
| 试穿效果图 | 1 张/次 | 每次试穿 1 次生图 |
| 转身视频 | 1 条/次 | 4-6 秒，图生视频调用 1 次 |
| 云存储 | 三视图 3-6MB/用户；四视图 1-2MB/衣物；视频 10-50MB/次 | 建议：试穿结果保留最近 50 条，超限自动清理旧视频；三视图/四视图按用户保留 |

---

## 9. 合规与隐私（对应 PRD §6/C-01~C-06）

- [x] AI 生成标识：效果图与视频均带「AI 生成」角标/水印，分享标注"AI 生成效果，仅供参考"（FR-19、C-02）；
- [ ] 深度合成备案：与开发并行启动（C-01）；
- [ ] 人脸/全身照授权：三视图使用参考图前需单独授权（C-03）；未授权只用身材参数 + 性别化形象；
- [ ] 内容安全：上传衣物/参考图接入微信内容安全或等效审核，违规拦截（C-04）；
- [ ] 未成年人：注册声明不面向 14 岁以下（C-06）；
- [ ] 数据删除：用户删除数字人时同步删除三视图与视频；删除衣物时删除四视图（FR-11）。

---

## 10. 分阶段落地计划

| 阶段 | 内容 | 产出 | 验收 |
|------|------|------|------|
| P0 云函数 + mock（2-3 天） | createAvatarViews / ensureGarmentViews / aiTryon 骨架、任务状态机、额度、mock 适配器、前端页面改造（三视图预览/进度/结果视频） | 全链路可跑通（mock 素材） | 三视图预览 → 选衣 → 生成 → 视频结果页；失败重试与退额度；删除联动 |
| P1 真实生成接入（Key 到位后 1-2 天） | `jimeng.js` 适配器实现、环境变量配置、回调/轮询接入真实生成 | 真实三视图/四视图/视频 | demo 三视图同一人；换装不漂移；转身自然 |
| P2 合规与优化（并行） | 备案、内容安全、订阅消息、成本优化（VTON 模型评估）、云存储清理策略 | 上线就绪 | 合规清单全绿 |

---

## 11. 风险与回退

| 风险 | 应对 |
|------|------|
| AI 生图三视图不一致（体型/面部漂移） | 同批次生成 + 固定参考图 + 描述前缀；demo 实测不达标则先只做单视图试穿 |
| 图生视频动作生硬/失真 | 缩短为 4 秒 180°；必要时降级为"静态效果图 + 角度切换"（现有 tryon-result 角度按钮） |
| API Key 未就绪 | mock 适配器保证全链路可演示；Key 到位只替换适配器实现 |
| 生成成本超预算 | 额度限制 + 四视图缓存复用 + 结果清理策略 |
| 真机视频播放兼容性 | 优先 MP4/H.264，走云存储 HTTPS URL，video 组件真机回归 |
| 合规不过审 | 备案与内容安全前置；AI 标识/水印/分享文案严格执行 PRD |

---

## 12. 下一步行动

1. 本设计定稿 → 提交 git；
2. 用 writing-plans 输出实现计划（P0：云函数骨架 + mock + 前端改造）；
3. 同步 PRD：AI 试穿作为唯一方案，追加变更记录（修正 C-21）；
4. 用户提供 API Key 后执行 P1。

---

*文档创建：2026-08-16（v1.0，agnes）*
*完善：2026-08-16（v1.1，对齐 PRD/云开发/免费版方案）*
*定稿：2026-08-16（v1.2，替代免费 3D，方案 A 确认）*
