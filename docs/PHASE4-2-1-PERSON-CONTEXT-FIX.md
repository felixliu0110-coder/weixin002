# Phase 4.2.1 — Person Context Binding Fix

> 状态：**已完成（代码 + 测试 + 已推送）**
> 父提交：`6fd0080ea471346c3419a6029157c7d784446a59`（Phase 4.2）
> Commit：`fix: repair person context binding in aiTryon`

## 修复的三个真实问题

### 1. avatarViewId 真正关联 Person Asset

**之前（错误）**：`resolvePersonAsset()` 接收 `avatarViewId` 却始终调用 `getCurrentPersonAsset(openid)`，即"取当前用户最新 Person Asset"，与传入的 `avatarViewId` 完全无关——若 avatarViewId 指向 profile-A，却可能偷偷返回属于 profile-B 的最新 asset。

**之后（正确）**：
```
avatarViewId
  → getOwnedDoc("avatar_views", id, openid)   # ownership 已校验
  → avatar_views.avatar_profile_id
  → person-asset.findByAvatarProfileId(profileId, openid)
      ├─ where { avatar_profile_id, user_id: openid }   # 强制 ownership
      ├─ orderBy updated_at desc
      ├─ 优先取具可用人物照片（original_photo/front_photo/anchor_image）者
      └─ 无匹配 → null（绝不偷用最新 asset）
```

新增最小查询能力：
- `repository.findByAvatarProfileId(avatarProfileId, openid)` — 纯 DB 查询，双重 ownership
- `service.findByAvatarProfileId(avatarProfileId, openid)` — 暴露给 aiTryon，含防御性 ownership 校验

### 2. Body Profile 来源修正

`avatar_views.profile_snapshot` 是 Avatar Generation 已固化的真实身体档案。之前 aiTryon 读取了它却**从未映射**进 Try-On Context，而是用了 Person Asset 的 `bodyProfile`（可能为空或过期）。

修正映射（`profile_snapshot` 下划线 → Context 驼峰）：

| profile_snapshot | bodyProfile |
|---|---|
| gender | gender |
| height_cm | heightCm |
| weight_kg | weightKg |
| shoulder_cm | shoulderCm |
| bust_cm | bustCm |
| waist_cm | waistCm |
| hip_cm | hipCm |
| leg_length_cm | legLengthCm |
| arm_length_cm | armLengthCm |
| neck_length_cm | neckLengthCm |

优先级：`profile_snapshot 真实字段` > `Person Asset bodyProfile 补充` > `null`
- 只映射存在且为合法 number 的字段，缺失保持 undefined
- **禁止 170cm/60kg 默认、禁止 BMI/性别推算、禁止 AI 猜测**

### 3. Prompt 责任边界清理

之前 aiTryon 既 `require("promptBuilder")` 又 `promptBuilder.build(context)`，生成了 `prompt` 变量却**未传给 Engine**（`tryonEngine.generate(context)` 只用 context），属于无效代码。

修正：
- aiTryon 移除 `promptBuilder` 的 require / build / 变量
- aiTryon 只负责：业务参数 → 标准 Context → Engine
- Prompt 完全由 Try-On Engine 内部基于 Context 构建（未改动 `promptBuilder.js` 本身）

## 人物来源优先级（不变）
`originalPhoto > frontPhoto > anchorImage`，`three_view_composite` 永不作为默认。`composite` 且无真实照片 → `PERSON_ASSET_REQUIRED`。

## Cache
继续含 `personAssetId` + `personAssetVersion` + `avatarViewId`，不同 Person Asset / 不同版本不共用缓存，隔离级别未降低。

## Quota / Legacy / 视频
- Quota 规则未改：`preflight → consume → provider failure refund`
- `TRYON_ENGINE_ENABLED` 默认 `false`，legacy 完整保留
- 视频链路未改动，`mode===video` 仍走 legacy

## 允许修改范围核对
- ✅ `cloudfunctions/aiTryon/index.js`
- ✅ `cloudfunctions/services/person-asset/repository.js`（+`findByAvatarProfileId`）
- ✅ `cloudfunctions/services/person-asset/index.js`（暴露方法）
- ✅ `cloudfunctions/aiTryon/test/phase421.test.js`（新增 18 用例）
- ✅ `cloudfunctions/services/person-asset/repository.test.js`（新增 7 用例）
- ✅ `docs/PHASE4-2-1-PERSON-CONTEXT-FIX.md`
- ❌ 禁止目录：未触碰（见最终反馈第 6 项）

## 测试覆盖（18 + 7 项）
1. avatarViewId 精确匹配 ✓
2. 多 asset：profile-A 不会被 profile-B 的最新顶替 ✓
3. 对应 profile 无 asset → PERSON_ASSET_REQUIRED ✓
4. ownership 不匹配 → fail closed ✓
5. profile_snapshot → bodyProfile ✓
6. height_cm → heightCm ✓
7. weight_kg → weightKg ✓
8. shoulder/bust/waist/hip/leg/arm/neck 映射 ✓
9. 缺失字段保持 null ✓
10. 禁止 170/60 伪造 ✓
11. Person Asset 仅补充快照缺失字段 ✓
12. originalPhoto > frontPhoto > anchorImage ✓
13. composite 不作为默认 ✓
14. aiTryon 不再生成独立 prompt ✓
15. Engine 正常调用 ✓
16. cache key 含 avatarViewId + personAssetId + version ✓
17. legacy 全绿 ✓
18. quota failure / refund ✓
+ repository 7 项 ownership 测试 ✓
