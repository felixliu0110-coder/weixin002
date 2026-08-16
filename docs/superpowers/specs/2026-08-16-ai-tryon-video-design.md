# 「我形我衣」AI 试穿视频方案设计文档

## 文档信息

| 项目 | 内容 |
|------|------|
| 方案名称 | AI 试穿视频生成方案（AI 仿真版数字人 + 试穿视频） |
| 文档版本 | v1.1（完善稿） |
| 日期 | 2026-08-16 |
| 状态 | 待头脑风暴确认决策点后转实现计划 |
| 关联文档 | PRD `docs/PRD-我形我衣-v1.0.md`；免费版数字人设计 `docs/superpowers/specs/2026-08-16-free-avatar-3d-design.md`；云开发接入 `docs/CLOUD-SETUP.md` |

---

## 1. 方案定位（重要）

本方案是 **AI 仿真版数字人** 的实现路径，与免费参数化数字人（Canvas 2D）**并行**，由用户选择使用哪种：

| 版本 | 生成方式 | 效果 | 成本/额度 |
|------|----------|------|-----------|
| 免费版（已实现） | 参数化建模 + Canvas 渲染 | 简洁人体，可旋转/缩放/标注 | 免费 |
| AI 仿真版（本方案） | AI 生图三视图 + 图生视频 | 照片级真实，可看转身效果 | 建议消耗额度（见 §8） |

**关键决策**：AI 仿真版不替代免费版；免费版作为默认入口和 AI 生成失败的兜底，AI 版作为“增强选项”逐步开放。

---

## 2. 核心思路

**一次性生成三视图，后续复用**：

```
身材参数 + 参考图（可选）
    ↓
AI 生图（正面/侧面/背面）→ 存云端（三视图档案）
    ↓
每次试穿：三视图正面 + 衣物图 → AI 生图（穿衣效果图）
    ↓
AI 图生视频（静态转身 180°，4-6 秒）→ 存云端
    ↓
展示 + 收藏/分享（带 AI 标识）
```

相比“每次试穿都重新生人”，三视图复用可以：降低生成成本、保证同一用户多次试穿的体型/面部一致、试穿生成只做换装。

---

## 3. 流程设计

### 3.1 一次性生成三视图（用户创建 AI 数字人时）

```
用户填写/读取身材参数（身高/体重/三围/腿长/性别/肤色）
    ↓
上传参考图（可选：人脸照/全身照，用于保持面部与体型特征）
    ↓
调用 AI 生图接口，并行生成 3 张图：
  - 正面图（front）
  - 侧面图（side，统一取左侧）
  - 背面图（back）
    ↓
提示词约束（见 §6）：
  - 固定身材参数文本（height: 165cm, bust: 88cm, waist: 66cm, hip: 92cm）
  - 简约打底（白色背心 + 短裤），便于后续换装
  - 中立姿势（arms at sides, natural stance）
  - 照片级真实感（photorealistic, studio lighting）
  - 三视图保持同一人物：固定描述前缀 + 同一参考图 + 同一次生成批次
    ↓
用户在三视图预览页确认/重新生成
    ↓
存储到云端（云存储 COS + avatar_views 集合记录 URL）
```

### 3.2 每次试穿流程

```
用户选择/上传衣物（沿用试衣页五分类流程）
    ↓
读取三视图档案（正面图作为人物参考）
    ↓
调用 AI 生图接口：
  - 输入：正面图（人物参考）+ 衣物图/衣物描述
  - 输出：穿衣效果图（照片级真实，正面试穿）
    ↓
调用 AI 图生视频接口：
  - 输入：穿衣效果图
  - 输出：静态转身视频（180°，4-6 秒，默认正面起转）
    ↓
任务入队 → 生成中（可离开，订阅消息通知）→ 完成
    ↓
展示视频 + 效果图；收藏/保存模板/分享（带 AI 标识）
```

---

## 4. 决策点与建议（头脑风暴需确认）

### 4.1 体型一致性

| 问题 | 建议 | 影响 |
|------|------|------|
| 三视图生成后，后续试穿能否保持同一体型？ | 能——三视图档案为唯一人物基准，试穿只做换装不重生成人物 | 保证同人一致性 |
| 是否需要固定参考图？ | 需要——首次生成三视图时把正面图作为参考图存档，后续所有试穿引用同一档案 | 一致性来源 |
| 体型偏差是否可接受？ | 由 demo 实测判定；AI 生图对“参数文本”遵循度有限，建议以“三视图本身”为准而非数字 | 验收标准之一 |

### 4.2 视频内容

| 问题 | 建议 | 影响 |
|------|------|------|
| 静态转身 360° 还是 180°？ | 第一版 180°（正面→侧面→背面→回正面）；360° 成本更高，后置 | 控制成本，先验证效果 |
| 视频时长 4 秒还是 8 秒？ | 4-6 秒 | 时长越长成本越高、文件越大 |
| 是否需要多帧拼接 GIF？ | 不需要，视频可直接展示；分享时小程序支持 video 组件转发封面 | 减少工作量 |

### 4.3 技术选型

| 方案 | 说明 | 建议 |
|------|------|------|
| Agnes AIGC（当前可用） | 图生图/文生图，已验证 | 第一版用它跑通全链路 |
| 专业 VTON 模型（如 IDM-VTON 类服务） | 换装保真度高 | 验证后评估是否切换 |
| Agnes Video v2.0 | 图生视频，可用 | 第一版用它 |
| Runway/Pika 等第三方 | 效果可对比 | 仅当 Agnes 视频质量不足时评估 |

### 4.4 三视图生成时机

| 选项 | 建议 |
|------|------|
| 用户创建数字人时自动生成 | ✅ 推荐：生成一次，试穿复用 |
| 用户主动触发（AI 版入口） | 作为备选，避免不了解的用户消耗额度 |
| 按需生成（首次试穿时） | 体验差（首穿等待双倍时间），不推荐 |

**细化建议**：默认“AI 版入口主动触发生成三视图”；未生成三视图前，试穿流程继续走免费版路径。

### 4.5 存储方案

| 选项 | 建议 |
|------|------|
| 全部云端（云存储） | ✅ 三视图 + 视频均存云存储，小程序只存 URL |
| 部分本地 + 部分云端 | 不推荐（本地缓存有大小限制，且跨设备不可见） |

---

## 5. 数据模型（对齐现有云集合）

### 5.1 三视图档案（新集合 `avatar_views`）

```json
{
  "_id": "av-xxx",
  "avatar_id": "avatar-xxx",
  "user_id": "user-xxx",
  "profile_snapshot": {
    "gender": "female",
    "height_cm": 165,
    "weight_kg": 50,
    "bust_cm": 88,
    "waist_cm": 66,
    "hip_cm": 92,
    "leg_length_cm": 96,
    "skin_tone": "natural"
  },
  "views": {
    "front": "https://xxx.cos.example.com/avatar-front.jpg",
    "side": "https://xxx.cos.example.com/avatar-side.jpg",
    "back": "https://xxx.cos.example.com/avatar-back.jpg"
  },
  "ref_image": "https://xxx.cos.example.com/ref.jpg",
  "status": "ready",
  "created_at": 1723780800000
}
```

### 5.2 试穿任务（扩展现有 `tryon_tasks`）

```json
{
  "_id": "task-xxx",
  "user_id": "user-xxx",
  "avatar_view_id": "av-xxx",
  "garment_id": "g-xxx",
  "type": "ai_video",
  "pose": "front",
  "status": "pending | processing | success | failed",
  "retry_count": 0,
  "tryon_image": "https://xxx.cos.example.com/tryon.jpg",
  "tryon_video": "https://xxx.cos.example.com/tryon.mp4",
  "error": "",
  "created_at": 1723780800000,
  "updated_at": 1723780860000
}
```

### 5.3 试穿结果（扩展现有 `tryon_results`）

```json
{
  "_id": "r-xxx",
  "user_id": "user-xxx",
  "avatar_id": "avatar-xxx",
  "garment_id": "g-xxx",
  "garment_name": "蓝色直筒牛仔裤",
  "tryon_image": "https://xxx.cos.example.com/tryon.jpg",
  "tryon_video": "https://xxx.cos.example.com/tryon.mp4",
  "ai_tagged": true,
  "created_at": 1723780800000
}
```

### 5.4 额度（复用现有 `quotas`）

- 生成三视图：消耗 1 次额度（每日免费 3 次，对应 FR-24a）；
- 试穿生成：消耗 1 次额度；
- 生成失败自动重试 1 次不重复扣费，仍失败退回额度（FR-21）。

---

## 6. 提示词模板

> 生成时用“占位符替换”方式组装；同一用户的**三视图必须同批次生成**，并固定“人物描述前缀”，保证三张图是同一人。

### 6.1 人物描述前缀（三视图共用）

```
Photorealistic full-body photo of an Asian {gender} {age_hint},
height {height_cm}cm, bust {bust_cm}cm, waist {waist_cm}cm, hip {hip_cm}cm,
skin tone {skin_tone}, neutral standing pose with arms at sides,
feet slightly apart, wearing a white tank top and brief shorts,
neutral light-gray studio background, soft even studio lighting,
natural skin texture, no heavy makeup, photo-realistic, high detail
```

### 6.2 视角后缀

| 视图 | 后缀 |
|------|------|
| 正面 | `front view, facing camera directly` |
| 侧面 | `profile view from the left side` |
| 背面 | `back view, seen from behind` |

### 6.3 试穿换装提示词

```
Same person and same studio lighting as the reference photo,
now wearing {garment_description}, natural standing pose with arms at sides,
full body visible, realistic fabric texture and fit on this body type,
photorealistic, high detail
```

### 6.4 图生视频提示词（Agnes Video）

```
Static full-body turn, starting from the front view, rotating smoothly
180 degrees to the back and returning to the front, camera fixed,
person stays in place, clothing and body unchanged, 4-6 seconds
```

---

## 7. 小程序集成设计

### 7.1 页面流程

```
我的数字人页（avatar-3d）
  ├─ 免费版：现有 Canvas 查看（不变）
  └─ AI 仿真版入口（消耗额度）→ 生成三视图进度页（generate-3views）
         ↓
  三视图预览页（avatar-views-preview）→ 确认/重新生成
         ↓
  试衣选择页（tryon-select，五分类，不变）
         ↓
  试穿生成页（tryon-progress）→ AI 生图 + 图生视频
         ↓
  试穿结果页（tryon-result）→ 视频播放 + 效果图 + 收藏/保存模板/分享
```

### 7.2 异步生成策略（沿用 FR-16/21）

```
用户提交试穿请求
    ↓
校验额度 → 扣减 → 任务入队（tryon_tasks: pending）
    ↓
返回生成中页面（可离开，提示“完成后通知你”）
    ↓
云函数轮询/回调更新任务状态（processing → success/failed）
    ↓
订阅消息通知用户；失败自动重试 1 次，仍失败退回额度并提示原因
    ↓
完成后跳转/用户手动进入结果页
```

需要新增：云函数（`aiTryon`：生图+生视频调度、状态流转；`onTryonComplete`：写结果+通知）、云存储目录（`avatar-views/`、`tryon-results/`）、订阅消息模板（生成完成/失败）。

### 7.3 前端改动点

| 页面 | 改动 |
|------|------|
| `avatar-3d` | 增加“生成 AI 仿真数字人”入口（消耗额度、需三视图未生成时显示） |
| 新增 `generate-3views` | 复用生成进度页样式，三视图任务进度 |
| 新增 `avatar-views-preview` | 三视图横滑预览 + 确认/重新生成/返回 |
| `tryon-select` | 选择衣物后：有 AI 三视图 → 走 AI 试穿；否则免费路径 |
| `tryon-progress` | 展示“AI 生图+转身视频生成中”，可离开 |
| `tryon-result` | video 组件播放转身视频 + 效果图；保留收藏/保存模板/分享（AI 标识） |
| `history` / `favorites` | 卡片显示视频角标，点击播放 |

---

## 8. 成本估算（供预算决策）

| 项目 | 量级 | 说明 |
|------|------|------|
| 三视图 | 3 张图/用户 | 约 1-3 次生图调用（建议一次批次） |
| 试穿效果图 | 1 张/次 | 每次试穿 1 次生图 |
| 转身视频 | 1 条/次 | 4-6 秒，图生视频调用 1 次 |
| 云存储 | 三视图约 3-6MB/用户；视频 10-50MB/次 | 建议：结果保留最近 50 条，超限自动清理旧视频；三视图永久保留 |
| 免费额度 | 每日 3 次（FR-24a） | 扣减策略见 §5.4 |

---

## 9. 合规与隐私（对应 PRD §6/C-01~C-06）

- [x] AI 生成标识：效果图与视频均带「AI 生成」角标/水印，分享标注“AI 生成效果，仅供参考”（FR-19、C-02）；
- [ ] 深度合成备案：与开发并行启动（C-01）；
- [ ] 人脸/全身照授权：三视图使用参考图前需单独授权（C-03）；未授权只用身材参数 + 性别化形象；
- [ ] 内容安全：上传衣物/参考图接入微信内容安全或等效审核，违规拦截（C-04）；
- [ ] 未成年人：注册声明不面向 14 岁以下（C-06）；
- [ ] 数据删除：用户删除数字人时同步删除三视图与视频（FR-11）。

---

## 10. 分阶段落地计划

| 阶段 | 内容 | 产出 | 验收 |
|------|------|------|------|
| P0 效果验证（1-2 天） | 用示例身材参数生成三视图 demo；用三视图生成试穿图 + 转身视频 | demo 图片/视频 | 同一人物三视图一致；换装后体型/面部不漂移；转身自然 |
| P1 云基建（2-3 天） | 云存储目录、`avatar_views` 集合、`aiTryon` 云函数、任务状态机、额度扣减 | 可调用的生成接口 | 提交→生成中→成功/失败全链路；失败重试与退额度 |
| P2 小程序集成（2-3 天） | AI 入口、三视图预览页、试穿视频播放、记录/收藏角标 | 可体验的 AI 试穿 | 端到端走通；免费版路径不受影响 |
| P3 合规与优化 | 备案、内容安全、订阅消息、成本优化（VTON 模型评估） | 上线就绪 | 合规清单全绿 |

---

## 11. 风险与回退

| 风险 | 应对 |
|------|------|
| AI 生图三视图不一致（体型/面部漂移） | 同批次生成 + 固定参考图 + 描述前缀；demo 实测不达标则先只做单视图试穿 |
| 图生视频动作生硬/失真 | 缩短为 4 秒 180°；必要时降级为“静态效果图 + 角度切换”（现有 tryon-result 角度按钮） |
| 生成成本超预算 | 额度限制 + 结果清理策略；AI 版设为可选，默认免费版 |
| 真机视频播放兼容性 | 优先 MP4/H.264，走云存储 HTTPS URL，video 组件真机回归 |
| 合规不过审 | 备案与内容安全前置；AI 标识/水印/分享文案严格执行 PRD |

---

## 12. 下一步行动（头脑风暴后）

1. 确认 §4 决策点（体型一致性口径、180° vs 360°、生成时机、额度扣减）；
2. 技术：用 Agnes AIGC + Agnes Video 生成三视图与转身视频 demo；
3. 产品 + 设计：评估 demo 质量，对比免费 Canvas 方案；
4. 定稿本设计 → 输出实现计划（writing-plans）；
5. 同步 PRD：AI 仿真版作为 FR-08/16 的增强路径，追加变更记录。

---

*文档创建：2026-08-16（v1.0，agnes）*
*完善：2026-08-16（v1.1，对齐 PRD/云开发/免费版方案）*
