# Phase 4.1 — Try-On 输入合同统一与生产接入准备

> 状态：✅ 已完成（本次收口）
> 分支：`feature/garment-lifecycle-v0.1`
>  Commit 主题：`refactor: normalize try-on context and provider inputs`

## 1. 新输入合同（统一 Try-On Context）

Engine 入口 `generate(params, strategy)` 现在优先接受标准 Try-On Context：

```js
{
  person: { assetId, originalPhoto, frontPhoto, anchorImage, bodyProfile },
  garments: [{ garmentId, image, category, name, profile }],
  options: { strategy, mode: 'image', preserveFace: true, background: 'keep' }
}
```

- `person`：人物资产来源，由 Engine 内部按 `originalPhoto > frontPhoto > anchorImage` 优先级选择主图。
- `garments`：衣物列表，每件携带已规范化的 `category`（`tops`/`bottoms`，未来 `dress`）与原始 `sourceCategory`（中文业务枚举）。
- `options`：策略/模式/面部保持/背景控制。

旧调用 `generate({ personImage, garmentImage, category }, strategy)` 仍兼容：Engine 在 `context.normalizeContext` 内将其转为标准 Context，新代码应优先使用标准 Context。

## 2. category mapper（中文业务枚举 → Try-On 内部枚举）

新增 `services/tryon-engine/category.js`：

| 生产 `garments.category`（中文） | Try-On 内部枚举 |
|---|---|
| 上衣 | `tops` |
| 裤子 | `bottoms` |
| 连衣裙（预留，当前生产无此枚举） | `dress` |
| 头饰 / 鞋子 / 其他 | `UNSUPPORTED_TRYON_CATEGORY` |

- 不支持品类**不默默当成服装**，而是保留 `UNSUPPORTED` 标记，由 Engine 在上层统一返回 `UNSUPPORTED_TRYON_CATEGORY` 错误。
- `normalizeGarmentCategory(garment)` 输出同时保留 `sourceCategory`（原始）与规范化后 `category`，Provider 无需感知中文业务枚举。

## 3. Person Asset 来源优先级

Engine（`context.normalizePerson`）按以下优先级选择主人物图：

1. `person.originalPhoto`
2. `person.frontPhoto`
3. `person.anchorImage`

`avatar composite` / `three_view_composite` **不作为默认 Try-On 输入**。选中的来源类型写入 `person.personSourceType`（`original_photo` / `front_photo` / `anchor_image`），并在生成结果 `metadata.personSourceType` 中回传，便于追溯。

## 4. Garment Asset 输入

- Provider 收到规范化的 `garments[]`，每件含 `image` / 已映射的 `category`（`tops`/`bottoms`）/ `sourceCategory`（中文原值）/ `name` / `profile`。
- Engine 在路由前过滤掉 `category === UNSUPPORTED` 的衣物；若**全部** garments 均不支持，直接返回 `UNSUPPORTED_TRYON_CATEGORY`，不进入任何 Provider。
- 多件 garments 可同时传入，Engine 取第一件有效品类衣物作为当前 Provider 的主试穿目标（为后续多件协同预留扩展点）。

## 5. Prompt Builder（provider-neutral）

新增 `services/tryon-engine/promptBuilder.js`：

- 输入标准 Context `{ person, garments, options }`，输出 `{ prompt, constraints, meta }`。
- 原则：
  - 人物：以 `person.originalPhoto` 为主要人物依据。
  - 身体：仅当真实 `bodyProfile` 存在时使用，且只作为版型/合身度**约束**；不存在时**绝不伪造** `170cm`/`60kg` 等固定值。
  - 服装：以 `garment image` 为主要服装依据。
  - 目标：只改变服装，不重写人物身份/面部，保持人物原图场景（除非 `options.background` 明确指定）。
- 不支持品类（头饰/鞋子/其他）不进入生成依据，`meta.garmentCount` 仅统计有效品类。

## 6. Agnes Provider 修正

`providers/agnes.js` 本次重点修复：

- **删除写死的 `170cm`/`60kg`**：身体参数改为从 `params.person.bodyProfile` 读取；无 `bodyProfile` 时不伪造任何身体数据，仅以真实人物图为依据。
- 生成要求统一通过 `promptBuilder.build()` 构造 provider-neutral prompt，Agnes 不再硬编码完整 prompt。
- 人物主图优先级遵循 Engine 标准化结果（`person.originalPhoto` 优先，回退 `personImage`）。

## 7. 为什么没有加入 preprocessing

本阶段目标是**统一输入合同**，不是重新设计图像算法。因此**未添加**抠图、人体分割、pose、depth、background removal、normalization 等预处理。若未来某 Provider 明确需要，将在对应 Provider Adapter 或独立的 Processor 层按需增加，不影响本层 Context 合同。

## 8. 为什么暂时没有修改 aiTryon

按阶段划分，本任务是 **Phase 4.1（Engine 自身稳定）**。生产 `cloudfunctions/aiTryon/` 暂未接入，避免把 Engine 重构与生产链路切换耦合。Engine 已通过 mock Provider 在本地/无 API Key 环境完成端到端验证，待 Phase 4.2 再将 `aiTryon` 接入 Engine。

## 9. Phase 4.2 将做什么

1. 将生产 `aiTryon` 接入 Try-On Engine（调用 `generate` 标准 Context）。
2. 在 Engine 上层引入 feature flag，保留旧 Agnes 链路可回滚。
3. 按真实接入结果再决定 Provider 切换/灰度策略（不预先承诺阿里云为生产 Provider 或 Agnes 退出）。
4. 补充 Engine ↔ `aiTryon` 集成的端到端测试与回归用例。

## 验证

- `node --check` 全部源文件通过。
- `node --test` Try-On Engine 测试 **39/39 通过**：
  - `category.test.js` — 中文映射 / `UNSUPPORTED_TRYON_CATEGORY` 判定。
  - `context.test.js` — 旧参数兼容 / `normalizeGarmentCategory` 保留 `sourceCategory` / 人物来源优先级。
  - `promptBuilder.test.js` — 无写死 `170cm`/`60kg` / 真实 `bodyProfile` 约束 / 不支持品类不计入 `garmentCount`。
  - `engine.test.js` — 标准 Context 生成 / 不支持品类错误码 / `personSourceType` metadata / 旧参数兼容兜底到 mock。

> 环境说明：本地 Node 无微信云数据库、无 AGNES/ALIYUN API Key，端到端生成由 mock Provider 兜底验证路由与 Context 流转，未伪造业务正确性。
