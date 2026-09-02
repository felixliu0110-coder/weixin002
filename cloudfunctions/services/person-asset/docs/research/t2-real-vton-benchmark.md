# T2 Real VTON Benchmark — 研究报告

> **执行日期:** 2026-08-26  
> **分支:** feature/garment-lifecycle-v0.1  
> **执行环境:** Node.js v26.6.0 / Windows  
> **状态:** BLOCKED（API Key 未配置）

---

## 一、执行摘要

| 项目 | 结论 |
|------|------|
| 实验状态 | **BLOCKED** — 当前环境未配置 AGNES_API_KEY 和 ALIYUN_API_KEY |
| Runner 可用性 | ✅ 已实现，可直接运行 |
| 阻塞解除方式 | 见 §六 "如何执行" |
| 核心发现（基于文献研究） | 专业 VTON > Agnes 通用图生图（理论预期，待实测验证） |

---

## 二、实验设计

### 2.1 实验矩阵

| 维度 | 数量 | 详情 |
|------|------|------|
| 人物 | 2 | person-a（女性全身正面照）、person-b（男性全身正面照） |
| 服装 | 5 | 白色纯色T恤、条纹衬衫、图案/Logo上衣、牛仔裤、半身裙 |
| Provider | 3 | A: Agnes baseline / B: aitryon 标准版 / C: aitryon-plus 高级版 |
| **总实验数** | **30** | 2 × 5 × 3 |

### 2.2 评分体系

| 维度 | 权重 | 说明 |
|------|------|------|
| 衣服身份保持 | 30 | 颜色/图案/版型与参考图一致 |
| 版型保持 | 20 | 服装剪裁、廓形准确 |
| Logo/纹理 | 15 | 细节纹理、印花保留度 |
| 人物一致性 | 15 | 面部/体型与参考人物一致 |
| 穿着自然度 | 10 | 褶皱、垂坠、贴合真实感 |
| 成本 | 5 | 单次生成成本（越低越好） |
| 速度 | 5 | 延迟（越低越好） |

### 2.3 阻塞条件

| ID | 条件 | 影响 |
|----|------|------|
| **B1** | `AGNES_API_KEY` 未配置 | A 组全部 BLOCKED |
| **B2** | `ALIYUN_API_KEY` 未配置 | B/C 组全部 BLOCKED |
| B3 | 缺少人物/衣物图片 | 对应实验无法执行 |

**当前状态:** B1 + B2 → **所有 30 个实验 BLOCKED**

---

## 三、Provider 对比分析

### 3.1 A 组：Agnes Baseline（当前生产链路）

**技术原理：** 通用图生图模型 + 参考图 + prompt

```
输入: 人物全身照（base64）+ 衣物图（base64）+ prompt
模型: agnes-image-2.1-flash
分辨率: 1024×1024
输出: 1 张穿搭效果图（URL）
```

**Prompt 结构（来自 `cloudfunctions/aiTryon/tryonImage.js`）：**
```
虚拟试穿合成：将参考衣物穿在参考人物身上，生成一张照片级全身穿搭效果图。
人物（依据第1张参考图的人物三视图）：面部、五官、发型与三视图完全一致...
服装（依据第2张起的衣物参考图）：人物穿着【XXX】，每件服装的版型、颜色、图案、面料质地与对应衣物参考图完全一致...
画面：纯白色背景，均匀柔和三点布光，人物全身正面站姿...
禁止：改变人物面部特征，服装变形、串色或添加参考图中没有的配饰...
```

**已知问题（来自 T1 / 辩论报告）：**
1. 用通用文生图做虚拟试穿是方向性错误
2. 服装还原度约 40%（预估）
3. 人物面部一致性约 30%（预估）
4. 无法精确替换服装区域，保持人体姿态不变
5. 服装颜色/图案容易漂移或被"美化"

### 3.2 B 组：阿里云 aitryon（标准版）

**技术原理：** 专业 VTON 模型（DressOnModel）

**官方 API（基于 DashScope）：**
```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multi-modal-matching/generation

Request:
{
  "model": "aitryon",
  "input": {
    "image": {"url": "人物全身正面照URL"},
    "garment_image": {"url": "衣物原图URL"}
  },
  "parameters": {
    "size": "1024x1024",
    "category": "tops|bottoms|dress",
    "n": 1,
    "restore_face": false
  }
}

Response（异步）:
{
  "output": {
    "task_id": "xxx",
    "task_status": "SUCCEEDED"
  },
  "results": [{"url": "试穿结果图URL"}]
}
```

**支持能力：**
- 人物全身正面照（必需）
- 上装 / 下装 / 连衣裙
- restore_face（可选，人脸修复）
- 1024 / 1280 分辨率

**计费（预估，需官方确认）：**
- 约 ¥0.5 - 2 / 次

### 3.3 C 组：阿里云 aitryon-plus（高级版）

**技术原理：** 增强版 VTON 模型

**官方 API（基于 DashScope）：**
```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multi-modal-matching/generation

Request:
{
  "model": "aitryon-plus",
  "input": { ... 同标准版 ... },
  "parameters": {
    "size": "1280x1280",
    "category": "tops|bottoms|dress",
    "n": 1,
    "restore_face": true    // Plus 默认支持更高质量人脸修复
  }
}
```

**计费（预估，需官方确认）：**
- 约 ¥1 - 5 / 次

### 3.4 对比总结

| 维度 | A: Agnes | B: aitryon | C: aitryon-plus |
|------|----------|------------|-----------------|
| 模型类型 | 通用图生图 | 专业 VTON | 专业 VTON（增强） |
| 服装还原度（预估） | ~40% | ~80% | ~90% |
| 人物一致性（预估） | ~30% | ~75% | ~85% |
| 天然支持 | 无 | 是 | 是 |
| 人脸修复 | 无 | 可选 | 默认 |
| 分辨率 | 1024×1024 | 1024×1024 | 1280×1280 |
| 单次成本（预估） | ¥0.02-0.1 | ¥0.5-2 | ¥1-5 |
| 延迟（预估） | 10-30s | 5-30s | 10-60s |
| 部署复杂度 | 低（已有） | 中（需新云函数） | 中（需新云函数） |

---

## 四、Avatar Composite  vs  标准化全身正面图

### 4.1 当前设计：Avatar Composite

```
用户照片 → createAvatarViews → avatar_views.composite（三视图合成图）
                                    ↓
                              aiTryon → 试穿效果图
```

**问题：**
1. 三视图合成图只有一张 1024×1024 的图，包含 3 个小人（每人约 340×1024px）
2. 人物面部分辨率极低（340px 宽），作为 VTON 参考质量差
3. 合成图是 AI 生成的"近似人"，不是用户真实照片
4. VTON 专用模型期望的是真实人体照片，不是合成三视图

### 4.2 新设计：标准化全身正面图

```
用户照片 → 预处理（EXIF纠正 + 等比缩放）→ normalized_person_image
                                    ↓
                              aitryon → 试穿效果图
```

**优势：**
1. 使用用户真实照片（高分辨率人脸）
2. VTON 模型专为真实人体照片设计
3. 无需先生成三视图（省掉 1-2 次调用）
4. 人物一致性显著提升

### 4.3 建议

**应该彻底取消 "Avatar composite → Try-On" 的旧设计**，改为直接使用标准化全身正面图作为 VTON 输入。

理由：
- VTON 模型的训练数据是真实人体照片，不是合成三视图
- 合成三视图的人在面部细节和身体比例上都有显著失真
- 省去生成三视图的步骤，降低试穿总成本和延迟

---

## 五、Garment Preprocessing 分析

### 5.1 POC-01 现状

POC-01 已实现确定性预处理：
- EXIF Orientation 纠正
- maxSide 等比缩放（不放大）
- 固定 canvas 居中放置
- 不改变背景

**但 POC-01 ≠ 生产能力**（如 AGENTS.md 所述）

### 5.2 aitryon 对 Garment 的要求

根据阿里官方文档（需实测确认）：
- 衣物图片要求：纯色背景、正面平铺、无遮挡
- 建议分辨率：512×512 以上
- 不支持带复杂背景的衣物图

### 5.3 建议

**Garment preprocessing 有必要**，但目的不同：
- 不是为了提升 Agnes 效果
- 而是为了满足 aitryon 模型的输入要求
- 应在接入 aitryon 时作为前置步骤

---

## 六、是否需要 aitryon-parsing-v1 和 aitryon-refiner

### 6.1 aitryon-parsing-v1（图片分割）

**用途：** 将人物全身照分割为人物主体 + 背景

**是否必要：**
- **否** — aitryon 模型本身处理输入图片，不需要外部分割
- 除非用户照片背景复杂（非纯色），可能需要先清理背景
- 可作为可选后处理，非必须

### 6.2 aitryon-refiner（精修）

**用途：** 对试穿结果进行局部精修（人脸/手部/服装细节）

**是否必要：**
- **否** — V1 不需要
- 可作为 V1.5 增值功能
- Plus 版本已内置部分精修能力

---

## 七、成本估算

### 7.1 单次完整试穿成本（1 件上装）

| Provider | 人物建档 | 试穿 | 合计 |
|----------|---------|------|------|
| A: Agnes | 2 次（锚定图+三视图）× ¥0.05 = ¥0.1 | 1 次 × ¥0.05 = ¥0.05 | **¥0.15** |
| B: aitryon | 0 次（直接用原图） | 1 次 × ¥1 = ¥1 | **¥1.00** |
| C: aitryon-plus | 0 次 | 1 次 × ¥3 = ¥3 | **¥3.00** |

### 7.2 月成本预测（1000 次试穿）

| Provider | 月成本 |
|----------|--------|
| A: Agnes | ¥150 |
| B: aitryon | ¥1,000 |
| C: aitryon-plus | ¥3,000 |

### 7.3 结论

- aitryon 单次成本是 Agnes 的 5-20 倍
- 但效果提升可能值得（服装还原度 40% → 80-90%）
- 需要用户付费意愿支撑

---

## 八、微信小程序接入架构

### 8.1 推荐架构

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  微信小程序   │────▶│  experimentsT2   │────▶│  阿里云 DashScope │
│  (weixin002) │     │  实验云函数      │     │  aitryon API     │
└──────────────┘     └─────────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │  云数据库        │
                    │  (实验结果记录)  │
                    └─────────────────┘
```

### 8.2 关键设计点

1. **独立云函数**：`experimentsT2` 与生产 `aiTryon` 完全隔离
2. **API Key 管理**：通过云函数环境变量配置，不写入代码/Git
3. **异步任务**：aitryon 返回 task_id，云函数轮询结果
4. **结果存储**：实验结果写独立集合 `t2_benchmarks`，不影响生产数据
5. **前端展示**：实验完成后，前端通过轮询获取结果

### 8.3 是否需要 GPU

**否。** aitryon 是 SaaS API，无需自备 GPU。
Agnes 也是 SaaS API，同样不需要 GPU。

---

## 九、是否应该保留 Agnes

### 9.1 Agnes 的价值

1. **成本极低**：¥0.02-0.1/次 vs ¥0.5-5/次
2. **已有生产链路**：无需改动现有代码架构
3. **三视图生成**：Agnes 仍可用于生成人物三视图/锚定图
4. **视频生成**：Agnes 的图生视频能力不可替代

### 9.2 建议

**保留 Agnes，但改变职责：**

| 功能 | 当前 | 建议 |
|------|------|------|
| 人物三视图生成 | Agnes | ✅ 保留 Agnes |
| 试穿效果图生成 | Agnes | ❌ 改用 aitryon |
| 图生视频 | Agnes | ✅ 保留 Agnes |
| 衣物四视图生成 | Agnes | ❌ 可取消（V1 不需要） |

**Agnes 负责：** 人物建档 + 视频生成  
**aitryon 负责：** 试穿效果图生成

---

## 十、是否需要重新设计 Avatar

### 10.1 当前 Avatar 设计

```
用户上传照片 → Agnes 生成三视图合成图 → avatar_views.composite
```

### 10.2 建议修改

```
用户上传照片 → 直接存入 avatar_views.person_photo（原始照片）
                → 可选：Agnes 生成高质量锚定图
                → 试穿时直接用原始照片或锚定图
```

**改动点：**
1. `avatar_views` 集合新增 `person_photo` 字段（原始上传照片）
2. 试穿时优先使用 `person_photo` 而非 `composite`
3. 保留 `composite` 用于预览（用户确认"这就是我"）

---

## 十一、T3 建议

基于 T2 的阻塞状态和文献研究，T3 应聚焦于：

1. **解除阻塞**：配置 AGNES_API_KEY 和 ALIYUN_API_KEY
2. **实际执行 T2**：运行 30 个实验，获取真实数据
3. **人工评估**：对成功结果进行 blind scoring
4. **决策**：根据实验数据决定生产方案

---

## 十二、最终回答 12 个问题

| # | 问题 | 答案 |
|---|------|------|
| 1 | 专业 VTON 是否明显优于 Agnes？ | **理论上是**（待实测验证）。VTON 模型专为服装替换设计，服装还原度预计 80-90% vs Agnes 的 ~40% |
| 2 | aitryon vs aitryon-plus 哪个更值得？ | **aitryon 标准版**更值得。Plus 成本高 2-3 倍，效果提升有限 |
| 3 | Avatar composite 是否应该退出 Try-On 主链路？ | **是**。直接用标准化全身正面图替代 |
| 4 | Garment preprocessing 是否有必要？ | **是**（针对 aitryon 输入要求），但不是为了 Agnes |
| 5 | 是否需要 aitryon-parsing-v1？ | **否**。模型自身处理输入 |
| 6 | 是否需要 aitryon-refiner？ | **否**（V1），可作为 V1.5 增值 |
| 7 | 单次真实试穿预计成本？ | aitryon: ¥0.5-2 / aitryon-plus: ¥1-5 |
| 8 | 微信小程序架构如何接入？ | 独立云函数 `experimentsT2` → 阿里云 DashScope API |
| 9 | 是否需要 GPU？ | **否**。SaaS API，无需自备 GPU |
| 10 | 是否应该保留 Agnes？ | **是**。负责人物建档 + 视频生成，放弃试穿生图 |
| 11 | 是否需要重新设计 Avatar？ | **是**。新增 `person_photo` 字段，试穿用原始照片 |
| 12 | T3 应该做什么？ | 解除 API Key 阻塞 → 执行真实实验 → 人工评估 → 生产决策 |

---

## 附录：如何执行真实 T2 实验

### 步骤 1：配置环境变量

在云函数 `experimentsT2` 的环境变量中设置：
```
AGNES_API_KEY = sk-xxxxxxxxxxxxxxxx
ALIYUN_API_KEY = LTAI5xxxxxxxxxxxxx
```

### 步骤 2：部署云函数

```bash
# 在微信开发者工具中
# 右键 cloudfunctions/experimentsT2 → 上传并部署
```

### 步骤 3：调用实验

```javascript
wx.cloud.callFunction({
  name: 'experimentsT2',
  data: { action: 'run' }
}).then(res => {
  console.log('T2 Results:', res.result);
});
```

### 步骤 4：查看结果

```bash
cat experiments/t2/results.json
```

---

*报告生成时间：2026-08-26*  
*基于 T1 可行性研究 + 代码审阅 + 文献调研*  
*真实实验数据需配置 API Key 后执行*
