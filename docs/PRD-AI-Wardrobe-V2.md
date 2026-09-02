# AI 智能衣橱 PRD V2

> **版本:** v2.0  
> **日期:** 2026-08-27  
> **分支:** feature/garment-lifecycle-v0.1  
> **状态:** 产品规格冻结文档

---

## 一、产品定位

### 1.1 产品名称

**AI 智能衣橱**（weixin002）

### 1.2 核心定义

AI 智能衣橱是一款微信小程序，核心价值是：

> **用户身体数据 + 个人衣橱 + AI 穿搭辅助**

**不是：**
- ❌ AI 图片生成玩具
- ❌ 单纯 Virtual Try-On 演示
- ❌ 通用图生图套壳

**而是：**
- ✅ 个人数字形象管理系统
- ✅ 数字化衣橱管理工具
- ✅ AI 驱动的穿搭决策辅助

### 1.3 目标用户

- 核心人群：18-35 岁，有网购需求、在意穿搭效果的男女
- 次要人群：服装店主、穿搭达人（用数字化衣橱做选品）
- 明确排除：14 岁以下用户

### 1.4 北极星指标

| 指标 | 说明 |
|------|------|
| 人均有效衣橱条目数 | 用户录入/上传的衣物数量 |
| 人均周试穿次数 | 成功生成的试穿效果图次数 |
| 衣橱完整度 | 有完整身体数据 + 10+ 衣物的用户占比 |

---

## 二、项目约束

### 2.1 禁止事项

| 禁止项 | 原因 |
|--------|------|
| 自训练模型 | 成本不可控、团队能力不足 |
| 自建 GPU 服务器 | 运维复杂、成本不可预测 |
| 绑定单一 AI 供应商 | 议价能力弱、供应链风险 |
| 简单 API 套壳 | 缺乏技术壁垒、易被复制 |

### 2.2 必须满足

| 要求 | 说明 |
|------|------|
| 模型可替换 | Provider 接口抽象化，一键切换 |
| AI 能力模块化 | 人物生成、试穿、视频、搭配解耦 |
| 成本可控 | 单次试穿成本透明，支持成本路由 |
| 数据资产沉淀 | 用户数据不归供应商，本地云存储 |

### 2.3 技术红线

```
业务层 → 禁止直接调用任何 AI Provider API
         ↓
        Provider Adapter 层
         ↓
        具体 Provider 实现
```

---

## 三、产品模块

### 3.1 模块总览

```
┌─────────────────────────────────────────────────────────────┐
│                     AI 智能衣橱                              │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ 用户系统  │ 身体档案  │ 真人资产  │ 衣橱系统  │   AI 服务层    │
│ (Auth)   │ (Profile)│ (Assets) │ (Wardrobe)│  (AI Services) │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

### 3.2 模块详情

#### 模块一：用户系统（User System）

| 功能 | 说明 |
|------|------|
| 微信身份 | OPENID 体系，不依赖手机号 |
| 首次引导 | 创建人物形象的引导流程 |
| 隐私授权 | 人脸/身体数据单独授权 |
| 账户管理 | 个人资料、退出登录 |
| 数据删除 | 一键删除所有个人数据 |

#### 模块二：身体档案（Body Profile）

| 功能 | 说明 |
|------|------|
| 基础参数 | 性别、身高、体重（必填） |
| 详细参数 | 三围、腿长、肩宽、臂长、鞋码、肤色（选填） |
| 缺省估算 | 仅填身高体重时给出默认体型 |
| 版本管理 | 参数修改后生成新版本（可选保留历史） |

**数据模型：**
```json
{
  "user_id": "openid_xxx",
  "gender": "male|female",
  "height_cm": 175,
  "weight_kg": 70,
  "bust_cm": 94,
  "waist_cm": 78,
  "hip_cm": 96,
  "leg_length_cm": 105,
  "shoulder_cm": 45,
  "arm_length_cm": 62,
  "shoe_size": 42,
  "skin_tone": "natural",
  "version": 1,
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

#### 模块三：真人资产（Person Assets）

| 功能 | 说明 |
|------|------|
| 人脸照片上传 | 正面照，用于提升面部一致性（选填） |
| 全身照上传 | 用于体型校准（选填） |
| 数字人生成 | AI 生成写实人物三视图（可选） |
| 锚定图生成 | AI 生成高分辨率正面全身照（推荐） |

**关键设计：**
- 原始照片作为 `person_assets` 永久保存
- 生成的三视图/锚定图作为 DERIVED 资产
- 生成失败的资产不删除原始照片

**数据模型：**
```json
{
  "user_id": "openid_xxx",
  "avatar_profile_id": "xxx",
  "person_photo_id": "cloud://...",      // 用户上传的原图
  "anchor_image_id": "cloud://...",      // AI 生成的锚定图
  "three_view_composite_id": "cloud://...", // 三视图合成图（实验性）
  "status": "ready",
  "provider": "agnes|aitryon|...",
  "created_at": 1234567890
}
```

#### 模块四：衣橱系统（Wardrobe）

| 功能 | 说明 |
|------|------|
| 衣物上传 | 相册/拍照，jpg/png |
| 衣物分类 | 上衣/裤子/头饰/鞋子/其他（手动选择） |
| 衣物名称 | 用户手动填写 |
| 尺寸标注 | 可选：size_label、measurements |
| 衣物管理 | 编辑、删除、列表 |
| 模板衣橱 | 系统预置模板衣物（只读） |

**关键设计：**
- 用户上传原图直用，不做自动抠图
- 不做自动品类识别（用户手动选择）
- 数据归属：用户只能访问自己的衣物

**数据模型：**
```json
{
  "user_id": "openid_xxx",
  "type": "upload|builtin",
  "name": "白色纯色T恤",
  "category": "上衣",
  "original_file_id": "cloud://...",
  "size_label": "M",
  "measurements": {
    "lengthCm": 65,
    "chestWidthCm": 52,
    "shoulderWidthCm": 42,
    "sleeveLengthCm": 20
  },
  "status": "ready",
  "created_at": 1234567890
}
```

#### 模块五：AI 试穿（AI Try-On）

| 功能 | 说明 |
|------|------|
| 试穿提交 | 人物资产 + 衣物 → AI 生成试穿图 |
| 异步队列 | 提交后显示进度，完成后通知 |
| 缓存复用 | 同组合 7 天内复用结果 |
| 失败重试 | 自动重试 1 次 |
| 结果管理 | 查看、收藏、保存、分享 |

**关键设计：**
- 业务层只调用 `tryOn.generate()`
- Provider 由配置决定，业务层无感知
- 试穿结果保存到云存储，不保留临时 URL

#### 模块六：AI 搭配（AI Styling）— V2 预留

| 功能 | 说明 |
|------|------|
| 场景推荐 | 根据场景推荐搭配方案 |
| 色彩协调 | 基于色彩理论的搭配建议 |
| 体型适配 | 根据身材参数推荐版型 |

**注：** V2 暂不实现，预留接口。

---

## 四、Try-On Engine 设计

### 4.1 核心原则

```
业务层（云函数）禁止直接调用任何 Provider API

所有 AI 生成请求必须经过 tryOn.generate() 统一入口
```

### 4.2 Provider 抽象层

```javascript
// Provider 接口定义（伪代码）
const TryOnProvider = {
  // 生成试穿图
  generate: async ({ personImage, garmentImage, options }) => {
    // 返回 { imageUrl, taskId, latencyMs, cost }
  },
  
  // 轮询任务状态
  poll: async (taskId) => {
    // 返回 { status, resultUrl, error }
  },
  
  // 检查是否配置
  isConfigured: () => boolean
}
```

### 4.3 Provider 实现

| Provider | 类名 | 状态 | 说明 |
|----------|------|------|------|
| Agnes | `AgnesProvider` | ✅ 现有 | 通用图生图，当前生产 |
| 阿里云 aitryon | `AliyunTryOnProvider` | 🔄 开发中 | 专业 VTON，实验阶段 |
| 阿里云 aitryon-plus | `AliyunTryOnPlusProvider` | 🔄 开发中 | 高级版 VTON，实验阶段 |
| FASHN | `FashnProvider` | 📋 规划 | 待接入 |
| 自建 IDM-VTON | `SelfHostedVtonProvider` | 📋 规划 | 长期路线 |

### 4.4 策略路由（Strategy Router）

```javascript
const TryOnRouter = {
  // 快速模式：低成本，快速响应
  FAST: {
    provider: 'agnes',
    fallback: 'mock'
  },
  
  // 均衡模式：平衡效果与成本
  BALANCED: {
    provider: 'aitryon',
    fallback: 'agnes'
  },
  
  // 高质量模式：最佳效果
  QUALITY: {
    provider: 'aitryon-plus',
    fallback: 'aitryon'
  },
  
  // 故障转移：任意 Provider 失败时自动切换
  FAILOVER: {
    providers: ['aitryon-plus', 'aitryon', 'agnes'],
    maxRetries: 2
  }
}
```

### 4.5 成本路由（Cost Router）

```
用户提交试穿请求
    ↓
检查是否有缓存（7天内同组合）
    ↓ 未命中
检查用户今日额度
    ↓ 不足
拒绝（提示额度用完）
    ↓ 充足
按策略选择 Provider
    ↓
FAST: 先用 Agnes（低成本）
BALANCED: 用 aitryon 标准版
QUALITY: 用 aitryon-plus
FAILOVER: 依次尝试，首个成功即止
    ↓
质量检测（可选）
    ↓ 质量不达标
升级 Provider（如 FAST→BALANCED）
    ↓
保存结果到云存储
    ↓
返回给用户
```

---

## 五、数据模型设计

### 5.1 Person Assets（人物资产）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | string | 用户 OPENID |
| avatar_profile_id | string | 关联的人物档案 ID |
| person_photo_id | string | 用户上传的原始全身照 |
| anchor_image_id | string | AI 生成的锚定图（高质量正面照） |
| three_view_composite_id | string | 三视图合成图（实验性） |
| status | string | ready/processing/failed |
| provider | string | agnes/aitryon/... |
| created_at | number | 时间戳 |
| updated_at | number | 时间戳 |

### 5.2 Garments（衣物）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | string | 用户 OPENID |
| type | string | upload/builtin |
| name | string | 衣物名称 |
| category | string | 上衣/裤子/头饰/鞋子/其他 |
| original_file_id | string | 用户上传原图的云存储 fileID |
| size_label | string | 用户填写的尺码标签（可选） |
| measurements | object | 平铺尺寸数据（可选） |
| status | string | ready/failed |
| created_at | number | 时间戳 |
| updated_at | number | 时间戳 |

### 5.3 Garment Profiles（衣物数字档案）— V2 新增

| 字段 | 类型 | 说明 |
|------|------|------|
| garment_id | string | 关联的衣物 ID |
| user_id | string | 用户 OPENID |
| dominant_color | string | 主色调（从图片提取） |
| pattern_type | string | 图案类型（纯色/条纹/图案/Logo） |
| category_confidence | number | 分类置信度（未来 AI 自动分类） |
| visual_embedding | string | 视觉特征向量（未来用于相似推荐） |
| created_at | number | 时间戳 |

### 5.4 Try-On Tasks（试穿任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | string | 用户 OPENID |
| person_asset_id | string | 人物资产 ID |
| garment_ids | array | 衣物 ID 列表 |
| cache_key | string | 缓存键（user_id + person_id + garment_ids） |
| type | string | ai_image/ai_video |
| strategy | string | fast/balanced/quality/failover |
| provider | string | 实际使用的 Provider |
| status | string | queued/processing/success/failed/cancelled |
| result_url | string | 试穿结果图 URL |
| saved_file_id | string | 云存储 fileID |
| task_id | string | Provider 返回的任务 ID |
| latency_ms | number | 生成耗时 |
| cost | number | 本次生成成本（分） |
| error_code | string | 失败原因码 |
| retry_count | number | 重试次数 |
| created_at | number | 时间戳 |
| updated_at | number | 时间戳 |
| completed_at | number | 完成时间戳 |

---

## 六、当前代码迁移规划

### 6.1 现状分析

| 现有模块 | 职责 | V2 去向 |
|----------|------|---------|
| `cloudfunctions/aiTryon/` | 试穿提交/状态/历史 | → 重构为 `tryon-engine` |
| `cloudfunctions/services/aigc-agnes.js` | Agnes 适配器 | → 保留为 `AgnesProvider` |
| `cloudfunctions/services/aigc.js` | Provider 选择器 | → 重构为 `TryOnRouter` |
| `cloudfunctions/aiTryon/tryonImage.js` | 试穿提示词构建 | → 删除（VTON 模型不需要 prompt） |
| `cloudfunctions/aiTryon/tryonVideo.js` | 视频生成 | → 保留，接入新 Provider 接口 |
| `cloudfunctions/createAvatarViews/` | 人物三视图生成 | → 重构为 `person-assets` 模块 |
| `cloudfunctions/ensureGarmentViews/` | 服装四视图（实验性） | → 保留但标记为实验性 |
| `cloudfunctions/uploadGarment/` | 衣物上传 | → 基本保留，增强 metadata |

### 6.2 迁移步骤

#### Phase 1: 架构整理

1. 新建 `cloudfunctions/tryon-engine/` 目录
2. 实现 `Provider` 抽象接口
3. 实现 `AgnesProvider`（从现有代码迁移）
4. 实现 `AliyunTryOnProvider`（从 experimentsTryOnV2 迁移）
5. 实现 `TryOnRouter`（策略路由）
6. 实现 `CostRouter`（成本路由）

#### Phase 2: 资产系统

1. 扩展 `avatar_views` 集合，新增 `person_photo` 字段
2. 新建 `person_assets` 集合（或复用 avatar_views）
3. 增强 `garments` 集合，支持 `measurements` 字段
4. 实现自动化的 `garment_profiles` 提取（未来）

#### Phase 3: Provider 接入

1. 完成 `AliyunTryOnProvider` 接入
2. 完成 `AliyunTryOnPlusProvider` 接入
3. 实现 `TryOnRouter` 多 Provider 切换
4. 实现质量检测和自动升级

#### Phase 4: AI 优化

1. 接入 aitryon-parsing-v1（可选）
2. 接入 aitryon-refiner（V1.5）
3. 实现服装预处理管道
4. 实现视频生成 Provider 化

---

## 七、淘汰方案

### 7.1 明确淘汰

| 被淘汰项 | 原因 | 替代方案 |
|----------|------|----------|
| Avatar composite 作为唯一人物来源 | VTON 模型需要真实人脸 | 使用 person_photo 或 anchor_image |
| 固定 prompt 方案 | 通用文生图方案效果天花板低 | 专业 VTON 模型（aitryon 等） |
| 单模型绑定 | 无法应对供应商变化 | Provider 抽象层 + 策略路由 |
| 服装四视图强制生成 | V1 不需要，成本高 | 实验性能力，按需启用 |

### 7.2 保留但标记为实验性

| 保留项 | 现状 | 说明 |
|--------|------|------|
| ensureGarmentViews | 代码存在但未在主链路调用 | 实验性增强能力，POC 验证后再决定 |
| 三视图合成图 | 当前用于试穿 | 保留用于用户预览，试穿改用真实照片 |
| POC-01 标准化 | 代码已实现但未接入生产 | 待 VTON 接入后作为预处理步骤 |

### 7.3 不迁移

| 淘汰项 | 原因 |
|--------|------|
| `tryonImage.js` 中的 prompt 构建 | VTON 模型不需要文本 prompt |
| `ensureGarmentViews` 在主链路中的调用 | 实验性能力，非必需 |

---

## 八、开发阶段规划

### Phase 1: 架构整理 ✅ 已完成

**目标：** 建立可扩展的 Provider 架构

| 任务 | 产出 |
|------|------|
| 定义 Provider 接口 | `services/tryonProvider.js` |
| 迁移 Agnes 适配 | `services/providers/AgnesProvider.js` |
| 实现基础 Router | `services/TryOnRouter.js` |
| 单元测试 | `services/*.test.js` |

**验收标准：**
- [ ] 可以切换 Provider 而不修改业务代码
- [ ] Provider 未配置时返回明确错误
- [ ] 单元测试覆盖率 > 80%

---

### Phase 2: 资产系统 ✅ 已完成

**目标：** 完善人物资产和衣物资产数据模型

| 任务 | 产出 |
|------|------|
| 扩展 avatar_views 表 | 新增 `person_photo` 字段 |
| 新增 person_assets 逻辑 | 统一管理人物资产 |
| 增强 garments 表 | 支持 measurements |
| 前端页面适配 | 支持新字段展示 |

**验收标准：**
- [ ] 用户可以上传并保存原始全身照
- [ ] 试穿时可以优先使用原始照片
- [ ] 衣物尺寸数据正确存储和读取

---

### Phase 3: Provider 接入 / Garment Asset 基础 ✅ 已完成（基础收口）

**目标：** 接入专业 VTON Provider（待 Phase 4 真正接入后定结论）；本阶段完成 Garment Asset 基础（garment_profiles + ownership + lazy create）

| 任务 | 产出 |
|------|------|
| 接入 aitryon 标准版 | `AliyunTryOnProvider.js` |
| 接入 aitryon-plus | `AliyunTryOnPlusProvider.js` |
| 实现策略路由 | `TryOnRouter` 支持 FAST/BALANCED/QUALITY |
| 实现成本路由 | 自动降级/升级逻辑 |
| POC 验证 | V2-POC-01 完成并评估 |

**验收标准：**
- [ ] aitryon-plus 试穿成功率 > 80%
- [ ] 服装还原度评分 > Agnes baseline（人工评估）
- [ ] 单次试穿成本在预算内

---

### Phase 4: 生产试穿接入 ⏳ 待开始

**目标：** 统一人物/衣物输入，将 aiTryon 接入 Try-On Engine，保留旧 Agnes 链路可回滚（详见 MIGRATION-PLAN-V2.md）

| 任务 | 产出 |
|------|------|
| 实现质量检测 | 自动生成后质量验证 |
| 接入 parsing/refiner | 可选后处理能力 |
| 视频生成 Provider 化 | 统一视频 Provider 接口 |
| 用户体验优化 | 进度展示、失败处理 |

**验收标准：**
- [ ] 生成失败率 < 15%
- [ ] 平均生成延迟 < 60s
- [ ] 用户满意度评分 > 3.5/5

---

## 九、里程碑

| 里程碑 | 目标 | 时间 |
|--------|------|------|
| M1 | 架构整理完成，Provider 接口定义完毕 | Week 2 |
| M2 | 资产系统改造完成，人物/衣物数据模型升级 | Week 4 |
| M3 | VTON Provider 接入完成，POC 验证通过 | Week 7 |
| M4 | 质量优化完成，准备生产上线 | Week 11 |

---

## 十、风险与应对

| 风险 | 等级 | 应对 |
|------|------|------|
| VTON API 效果不达预期 | 高 | 保留 Agnes 作为降级方案 |
| 成本超出预算 | 高 | 成本路由 + 额度控制 |
| 供应商 API 变更 | 中 | Provider 抽象层隔离变更影响 |
| 深度合成备案周期 | 中 | 并行启动，优先接入已备案 Provider |
| 用户照片质量参差 | 中 | 输入校验 + 质量门槛提示 |

---

## 十一、附录

### A. Provider 接口规范

```typescript
interface TryOnProvider {
  name: string;
  
  generate(params: {
    personImage: string;    // HTTPS URL
    garmentImage: string;   // HTTPS URL
    category: 'tops' | 'bottoms' | 'dress';
    options?: Record<string, any>;
  }): Promise<{
    taskId: string;
    resultUrl?: string;
    latencyMs: number;
    cost: number;
  }>;
  
  poll(taskId: string): Promise<{
    status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
    resultUrl?: string;
    error?: string;
  }>;
  
  isConfigured(): boolean;
}
```

### B. 相关文档

- `docs/PRD-我形我衣-v1.0.md` — V1 产品需求文档
- `docs/architecture.md` — 当前系统架构
- `docs/research/t1-tryon-engine-feasibility.md` — T1 引擎可行性研究
- `docs/research/t2-real-vton-benchmark.md` — T2 Benchmark 报告
- `experiments/tryon-v2/README.md` — V2-POC-01 实验说明

---

*本文档为 V2 产品开发唯一规格依据，后续开发应以此为准。*
*最后更新：2026-08-27*
