# Phase 4.2 — 生产 aiTryon 接入 Try-On Engine

> 状态：**已完成（待合入 main）**。Phase 4.1 建立统一 Try-On Context 输入合同；Phase 4.2 将其落地到生产链路。
> 分支：`feature/garment-lifecycle-v0.1` · 基线：`d6a578e`

---

## 1. Engine 接入方式

旧链路与新链路并存于 `cloudfunctions/aiTryon/index.js` 的 `submit()`（图片模式）：

```
旧：getAigc() → aigc.generateImages({prompt, refImages})        [flag=false，默认]
新：构造标准 Try-On Context → tryonEngine.generate(ctx, "BALANCED")
                             → Router → Agnes Provider
```

- 仅**图片试穿**走 Engine；**视频模式完全保持 legacy**（imageTaskId → 已完成图片 → generateVideo），本阶段不重构。
- Engine 返回 `{ ok, provider, imageUrl, metadata }`，由 `adaptEngineResult()` 适配为前端已有字段（`tryonImage / tryonImageUrl / tryonVideo / garmentName / personSourceType / provider`），**前端无需改动**。

## 2. Person Asset 来源（V2，取消 composite 默认）

优先级（仅取第一个存在且非空的字段）：

```
originalPhoto > frontPhoto > anchorImage
```

- 通过已有 `cloudfunctions/services/person-asset/` 服务读取，**沿用其 ownership 检查**，不跨用户读取。
- 兼容下划线命名（`original_photo`）与标准 Context 驼峰（`originalPhoto`）。
- **`avatar_views.views.composite` 不再作为 V2 默认人物输入**。
- 若启用 Engine 路径（`TRYON_ENGINE_ENABLED=true`）且 Person Asset 无可用真实照片 → 返回 `PERSON_ASSET_REQUIRED`，**不进入 AI 生成、不伪造人物照片**。

## 3. Garment Asset 来源

- 继续保留 `resolveGarments(db, gIds, openid")`（生产 ownership 入口），**服务端解析 garments，客户端图片不作为可信来源**。
- 每件衣物转换为 Engine garment：`{ garmentId, image, category, sourceCategory, name, profile }`
  - `sourceCategory` = 原始中文（`上衣/裤子/...`）
  - `category` 经 `tryon-engine/category.js` 标准化：`上衣→tops`、`裤子→bottoms`、其余→`UNSUPPORTED_TRYON_CATEGORY`（fail closed）
- **若 `garment_profiles` 不存在，`profile = null`**，Phase 4.2 不自动创建 AI profile、不分析。

## 4. Feature Flag / 回滚

- 服务端配置：`process.env.TRYON_ENGINE_ENABLED`
  - `false`（**默认**）→ 完整走旧 aiTryon 图片链路
  - `true` → 图片试穿走 Try-On Engine（Router → Agnes）
- **上线后可立即回滚**：仅切换环境变量，无需前端配合或重新发布。
- Legacy 代码（`getAigc / aigc.generateImages / buildTryonImagePrompt`）**完整保留**作为 fallback，未删除。

## 5. Legacy fallback

- `flag=false`：人物图 = `avatar_views.views.composite`（旧行为），prompt = `buildTryonImagePrompt`（含旧逻辑），Provider = `aigc.generateImages`。
- 旧视频链路、旧缓存、旧 quota、旧 task/result 字段全部兼容。
- Engine 模式（`flag=true`）为 V2 新路径，失败可随时切回 legacy。

## 6. Cache 隔离

- `buildTryonCacheKey()` 新增 `personAssetId` + `personAssetVersion` 参数。
- 有 Person Asset 的用户与仅用 composite 的 legacy 用户 **cache key 不同**，`composite` 与 `originalPhoto` **不共用缓存结果**。
- `personAssetVersion` 取自 `person_asset.updated_at`（缺失时降级为 `legacy` 标识）。

## 7. Quota 行为（严格保序）

```
1. 参数校验 → 2. ownership → 3. Person Asset preflight → 4. Garment preflight
→ 5. Reference preflight (toHttpsRefs) → 6. consumeQuota → 7. 创建 task → 8. Engine generate
```

- **关键修正**：所有 preflight（person asset / reference `toHttpsRefs`）均移至 `consumeQuota` **之前**，故 preflight 失败天然不扣 quota。
- `toHttpsRefs` 失败（cloud:// 无法换取公网 URL）→ fail closed 抛错，**不调用 Provider、不扣 quota**。
- Engine Provider 失败 → `refundQuota`（退款）。
- 额度规则、失败语义与旧链路完全一致。

## 8. Task 新增字段（旧数据兼容，仅新增不迁移）

```
person_asset_id      -- 人物资产 ID（用于 cache 隔离 / 溯源）
person_source_type   -- original_photo | front_photo | anchor_image
strategy             -- BALANCED（默认）
provider             -- engine 实际使用的 provider（agnes / mock / ...）
```

- 存量 task 无这些字段时按 `null` 读取，**不做破坏性迁移**。

## 9. 测试结果

### 本地集成测试（真实加载 engine + person-asset + garment-asset，桩掉 wx-cloud / aigc / db）

`cloudfunctions/aiTryon/test/phase42.integration.test.js` — **16/16 通过**：

| # | 覆盖项 |
|---|---|
| 1 | feature flag=false 走 legacy aigc |
| 2 | feature flag=true 走 Engine |
| 3-5 | originalPhoto 优先 / frontPhoto fallback / anchorImage fallback |
| 6 | 仅 composite（无真实照片）→ PERSON_ASSET_REQUIRED，不进入生成 |
| 7 | bodyProfile=null 不伪造；真实 bodyProfile 仅做约束；prompt 无 `170cm/60kg` 硬编码 |
| 8-10 | 上衣→tops、裤子→bottoms、sourceCategory 保留 |
| 11 | 不支持品类（头饰）→ UNSUPPORTED_TRYON_CATEGORY fail closed |
| 12 | garments 由 resolveGarments 服务端解析（ownership） |
| 13 | garment_profiles 不存在时 profile=null，不自动创建 |
| 14 | reference preflight 失败不扣 quota |
| 15 | Engine Provider 失败 refundQuota |
| 16 | cache key 区分 personAssetId/version |
| + | legacy 返回格式兼容；Engine 成功 task 含新增字段 |

### 回归

- `tryon-engine/*.test.js`（Phase 4.1）：**39/39 绿，无回归**
- `garment-asset/` 源文件 `node --check` 通过（Phase 3，无破坏）
- `person-asset/` 源文件 `node --check` 通过
- `aiTryon/index.js` `node --check` 通过

> **环境限制标记**：本地无微信云数据库、无 AGNES/ALIYUN API Key，Provider 由 mock 兜底验证 Context 流转与路由；不伪造业务正确性。Engine 39 绿在真实 router/mock 上运行。

## 10. 明确边界（本阶段不代表结论）

- ❌ **不代表 Agnes 已被最终选定**（Router 可按 strategy/config 切换 Provider）
- ❌ **不代表 Aliyun 被排除**（仅按配置可用性选择；当前仅 Agnes + mock 可用）
- ❌ 未接入任何新 AI Provider、未配置 API、未训练模型
- ❌ 未修改前端页面、未改数据库 schema、未改 quota 规则
- ❌ 未重构视频链路、未删除 legacy / Agnes

## 11. 后续（Phase 4.3+）

- 观察 Engine 模式线上表现后，再决定是否将 `TRYON_ENGINE_ENABLED` 默认置 true
- 接入更多 Provider 前，先在其 Adapter 层补齐 preprocessing（抠图/pose/depth 等）——本阶段**统一输入合同，不做图像算法**
- 视频链路在独立阶段接入 Engine
