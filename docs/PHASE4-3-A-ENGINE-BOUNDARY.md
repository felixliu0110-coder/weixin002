# Phase 4.3-A — Try-On Engine Boundary Cleanup

> 收口 Try-On Engine 架构边界。**不进入真实 Provider 选择，不修改业务层（aiTryon / person-asset / garment-asset）。**

## 1. Standard Try-On Context 是唯一上游输入合同

`context.js` 的 `normalizeContext()` 是唯一入口。无论外部传入标准 Context 还是旧参数
（`{ personImage, garmentImage, category }`），最终都收敛为：

```js
{
  person: { assetId, originalPhoto, frontPhoto, anchorImage,
            personImage, personSourceType, bodyProfile },
  garments: [{ garmentId, image, category, sourceCategory, name, profile }],
  options: { strategy, mode, preserveFace, background }
}
```

业务层（aiTryon）只负责**构造 Context**，不再构造 Prompt、不再组装 provider 参数。

## 2. normalizeContext 负责规范化

`context.js` 的职责：

- **人物优先级**：`originalPhoto → frontPhoto → anchorImage`，结果写入 `person.personImage` + `personSourceType`
  - `avatar composite` / `three_view_composite` **不作为**默认 Try-On 输入
- **bodyProfile**：真实数据优先（avatar_view `profile_snapshot` > Person Asset 补充），缺失即为 `null`
  - **禁止** 170cm/60kg 等伪造默认值，禁止根据 BMI/性别推测
- **旧参数兼容**：`{ personImage, garmentImage, category }` 在 context.js 中统一转换为标准 Context

## 3. Router 只负责 Provider 选择

`router.js` 的职责（**且仅有这些**）：

1. 检查 `strategy` 是否合法
2. 根据 strategy 配置列出候选 Provider
3. 选择**已配置**（`isConfigured() === true`）的 Provider
4. 将**标准 Context 原样**交给 `provider.generate(ctx)`
5. 统一返回结果

Router **不再负责**：

- ❌ 选择人物图片 → 由 `context.normalizePerson` 完成
- ❌ 选择 / 过滤 garment → 由 `context.normalizeGarments` + Engine 校验完成
- ❌ category 业务枚举映射 → 由 `category.toTryOnCategory` 完成
- ❌ 组装 `personImage / garmentImage / category` 旧字段 → 由 context.js 旧参数兼容统一转换
- ❌ 自动 Mock 兜底 → Mock 仅供测试/开发显式调用

## 4. Provider 自己负责 API Payload

Provider Adapter 边界（`providers/*.js`）：

- 接收 Engine 已标准化的**标准 Context**
- 自行从 `ctx.person.personImage` / `ctx.garments[0]` 提取所需字段
- 自行映射为自己 API 的请求结构

当前 Provider **自己就是 Adapter**——不新增 `providerMapper.js` / `adapterFactory.js` /
`requestBuilder.js` / `payloadBuilder.js` 等额外层。

## 5. Router 不再选择 Person / Garment

- 人物主图：统一为 `ctx.person.personImage`（Engine 已按优先级决定）
  - Provider **禁止** `originalPhoto || personImage`、`frontPhoto || ...` 重新选图
- 单件 garment：统一为 `ctx.garments[0]`（Engine 已校验恰好一件且品类受支持）
- Router 不偷偷取 `garments[0]` 继续生成——多件由 Engine 明确拒绝

## 6. Image MVP 单次只允许一个 garment

`validateContext` 要求**恰好一件**：

- `garments.length === 0` → 拒绝
- `garments.length > 1` → 拒绝（`MULTI_GARMENT_NOT_SUPPORTED`），**不偷偷用第一个**
- 恰好 1 件 → 通过

避免"看似支持多衣物，实际悄悄只试穿第一件"。多衣物组合属于未来功能。

## 7. 当前生产品类只有 tops / bottoms

`category.js`：

- `isSupportedForTryOn()` 仅放行 `tops` / `bottoms`
- `dress`：映射层已预留定义，但**未经验证，不进入生产生成链** → `UNSUPPORTED_TRYON_CATEGORY`
- `头饰` / `鞋子` / `其他` / 未知 → `UNSUPPORTED_TRYON_CATEGORY`

不新增连衣裙业务 UI，不修改 `garments` 集合枚举。

## 8. Mock 只用于测试/开发，不是生产 fallback

- ✅ Mock 保留：单元测试、本地开发、无真实 API Key 环境
- ❌ Router 真实生成路径**不再** `无真实 Provider → Mock → 返回成功`
- 没有任何真实 Provider 可用时，Engine **返回明确失败**，不返回 placeholder 成功
- `engine.test.js` 改为「显式测试 Mock Provider」+「无真实 Provider 时不能伪成功」

## 9. Provider 最终生产选择暂未确定

- ✅ 保留 Agnes、Aliyun（aitryon / aitryon-plus）候选实现
- ❌ 本阶段**不**决定最终生产 Provider
- Aliyun bottoms 映射（`P1-1`）：当前 DashScope aitryon API 字段固定为 `top_garment_url`，
  无法确认 bottoms 参数格式 → **保守拒绝** `PROVIDER_CAPABILITY_UNSUPPORTED`，待 4.3-B 真实验证后决定
- Strategy（FAST / BALANCED / QUALITY / FAILOVER）暂不做产品化改造

## 10. Video 不属于本阶段

- 视频链路完全不动
- 单次 Image Try-On 边界收口，与视频无关

## 越界清单（本阶段未做）

- ❌ 未修改 `aiTryon/index.js`（业务层）
- ❌ 未修改 `person-asset` / `garment-asset`
- ❌ 未修改前端 / 数据库 schema / quota / cache 业务
- ❌ 未接入或删除任何 Provider，未做真实 API 调用
- ❌ 未选择最终生产 AI Provider（留待 4.3-B）

## 验证

```bash
# 语法检查
node --check cloudfunctions/services/tryon-engine/*.js
node --check cloudfunctions/services/tryon-engine/providers/*.js

# 全量测试
node --test cloudfunctions/services/tryon-engine/*.test.js
node --test cloudfunctions/aiTryon/test/*.test.js   # legacy 回归

# 回归
node --test cloudfunctions/services/garment-asset/*.test.js
node --test cloudfunctions/services/person-asset/*.test.js
```

测试覆盖：人物优先级回归、Router 不覆盖/不重新选图、Provider 收标准 Context、
多 garment 拒绝、品类支持范围、Mock 不伪成功、bodyProfile 不伪造、旧参数兼容等。
