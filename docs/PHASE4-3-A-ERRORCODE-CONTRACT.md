# Phase 4.3-A 最后 P1 修正 — Validation Error Code 契约

## 问题

`validateContext` 已在校验逻辑中区分三类错误（多 garment / 不支持品类 / 参数结构），
但 `index.js` 在统一处理 validation error 时，曾将所有错误**统一打回**
`errorCode: INVALID_TRYON_CONTEXT`，导致：

- 错误信息里虽含 `MULTI_GARMENT_NOT_SUPPORTED` / `UNSUPPORTED_TRYON_CATEGORY`，
- **但真正返回给上层的 `errorCode` 总是 `INVALID_TRYON_CONTEXT`**。

上层（aiTryon / 前端）据此做分支处理时会误判。

## 修正内容

### 1. `context.js` — `validateContext` 返回精确 errorCode

返回值从 `{ valid, errors }` 扩展为 `{ valid, errors, errorCode }`：

| 场景 | `errorCode` |
|------|-------------|
| 0 件 / >=2 件 garment（不满足「恰好一件」） | `MULTI_GARMENT_NOT_SUPPORTED` |
| 单件 garment 品类不在生产范围（含 dress / 头饰 / 鞋子 / 其他） | `UNSUPPORTED_TRYON_CATEGORY` |
| person 图片缺失、结构/参数错误 | `INVALID_TRYON_CONTEXT` |

`errors` 为 `[{ code, message }]` 结构化数组，便于上层按需消费。

### 2. `index.js` — 透传 errorCode，不再二次覆盖

```js
const v = validateContext(ctx);
if (!v.valid) {
  const errorMessage = (v.errors || [])
    .map((e) => (typeof e === 'string' ? e : e && e.message) || '')
    .filter(Boolean)
    .join('; ');
  return { ok: false, error: errorMessage, errorCode: v.errorCode, ... };
}
```

`v.errorCode` 直接透传，保证：
- 多 garment → `MULTI_GARMENT_NOT_SUPPORTED`
- 不支持品类 → `UNSUPPORTED_TRYON_CATEGORY`
- 参数/结构错误 → `INVALID_TRYON_CONTEXT`

`index.js` 中「全部品类不支持」的提前检查（早于通用校验）已正确返回
`UNSUPPORTED_TRYON_CATEGORY`，本次保持一致。

## 错误码契约（对外合同）

```
MULTI_GARMENT_NOT_SUPPORTED   ← 多/0 件 garment（Image MVP 仅支持恰好一件）
UNSUPPORTED_TRYON_CATEGORY    ← 品类不在当前生产范围（tops/bottoms 之外）
INVALID_TRYON_CONTEXT         ← 其它 person/结构/参数错误
```

测试**断言实际返回对象的 `errorCode`**，而非仅检查 error message。

## 测试

- `context.test.js`：新增 5 项 errorCode 精确断言（16 用例）
- `engine.test.js`：多 garment 断言 `errorCode === MULTI_GARMENT_NOT_SUPPORTED`（核心修复点），0 件 garment 同步修正（19→... 见汇总）
- `boundary.test.js`：改用 `v.errorCode` 精确断言（19 用例）
- 全量：**69/69 pass, 0 fail**（串行执行，避免模块缓存竞态）

## 范围

- 仅修改 `tryon-engine/context.js`、`index.js`、对应测试
- 未触碰 aiTryon / person-asset / garment-asset / garments / uploadGarment / createAvatarViews / ensureGarmentViews / tryonVideo / miniprogram
- 未改变 Router/Provider 边界、未引入新 Provider、未调用真实 AI Provider
- 未改变 4.3-A 已确定的行为（仅修正 errorCode 精确度）
