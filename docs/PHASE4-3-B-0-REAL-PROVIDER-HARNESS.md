# Phase 4.3-B-0 — 真实 Provider 测试通道准备

> 状态：**已完成，待人工触发真实调用**
> 基线：`1c39b86a7f1fd4fa12d19a331c6f463acbe17b2f`
> 分支：`feature/garment-lifecycle-v0.1`

## 目标

为阿里云 DashScope aitryon / aitryon-plus 建立**真实调用的人工测试通道**，
**不进入生产**、**不切换生产 Provider**、**不修改前端**。

## 修改范围（最小）

| 类型 | 文件 | 说明 |
|------|------|------|
| M | `tryon-engine/providers/aliyun.js` | 修正品类映射 |
| A | `tryon-engine/real-provider-test.js` | 真实测试工具（Fail-Closed）|
| A | `tryon-engine/providers/aliyun.test.js` | Provider 单元测试（全 mock）|
| A | `docs/PHASE4-3-B-0-REAL-PROVIDER-HARNESS.md` | 本文件 |

未修改：`aiTryon/`、`person-asset/`、`garment-asset/`、`garments.js`、`uploadGarment/`、
`createAvatarViews/`、`ensureGarmentViews/`、`tryonVideo/`、`miniprogram/`、`quota`、`cache`、数据库。

## 1. Aliyun Provider 边界（P0-1 ~ P0-6 延续）

Provider Adapter 边界保持不变：

- **不重新解释 Context**：只从 `ctx.person.personImage` / `ctx.garments[0]` 提取
- **不重新选人物图 / garment**

品类映射（本阶段核心修正）：

| category | API 字段 |
|----------|----------|
| `tops`   | `input.top_garment_url` |
| `bottoms`| `input.bottom_garment_url` |
| `dress`  | 拒绝（`PROVIDER_CAPABILITY_UNSUPPORTED`）|

保留参数：

- `parameters.resolution = -1`
- `parameters.restore_face = true`

## 2. 真实测试工具 `real-provider-test.js`

### Fail-Closed（默认关闭）

仅当**全部满足**时才允许请求阿里云：

```
RUN_REAL_TRYON_TEST=true
DASHSCOPE_API_KEY        (存在且非空)
TRYON_PERSON_URL          (真实人物图 URL)
TRYON_GARMENT_URL         (真实服装图 URL)
TRYON_CATEGORY            ∈ {tops, bottoms}
TRYON_MODEL               ∈ {aitryon, aitryon-plus}
```

缺任一变量 / category 非法 / model 非法 → `process.exit(1)`，**绝不发起 API 请求**。

### 安全约束

- API Key 与真实图片 URL **禁止写死**，仅通过环境变量读取
- 不下载结果图、不落盘、不提交产物
- 单次调用、不循环、不压测、不并发、不无限重试
- 使用 DashScope 异步模式：`POST /image-synthesis` → `GET /tasks/{task_id}` 轮询
- 输出：provider / model / category / task_id / 时间戳 / latency_ms / task_status / result_url（或 error_code/error_message）

### 人工执行示例（仅供演示，勿提交真实值）

```bash
export RUN_REAL_TRYON_TEST=true
export DASHSCOPE_API_KEY="sk-..."
export TRYON_PERSON_URL="https://..."
export TRYON_GARMENT_URL="https://..."
export TRYON_CATEGORY="tops"      # 或 bottoms
export TRYON_MODEL="aitryon"      # 或 aitryon-plus
node cloudfunctions/services/tryon-engine/real-provider-test.js
```

## 3. 单元测试（不联网）

`aliyun.test.js` — 完全 mock `submitTask` / `pollTask`：

1. tops → `top_garment_url` ✓
2. bottoms → `bottom_garment_url` ✓
3. tops 不出现 `bottom_garment_url` ✓
4. bottoms 不出现 `top_garment_url` ✓
5. personImage 来自 `ctx.person.personImage` ✓
6. garmentImage 来自 `ctx.garments[0].image` ✓
7. `restore_face === true` ✓
8. `resolution === -1` ✓
9. dress 仍被拒绝 ✓
10. task_id → 轮询 → result URL ✓

`real-provider-test.test.js` — Fail-Closed（劫持 `process.exit` + require 拦截）：

- 缺 6 个变量逐一验证 → 不请求 API（9 个用例）
- category 非 tops/bottoms → 不请求
- model 非 aitryon/aitryon-plus → 不请求
- 全变量合法 → checkEnvironment 通过（但仍不自动调用）

## 4. 生产状态（未改变）

- `TRYON_ENGINE_ENABLED = false`（保持）
- legacy fallback 保留
- Aliyun **未**设为正式生产 Provider
- Agnes / Mock 未删除
- Router strategy 未改变
- Video 未修改

## 5. 测试结果

```
node --test *.test.js providers/*.test.js
# tests 91 / pass 91 / fail 0
```

其中本阶段新增：

- `aliyun.test.js`：13/13
- `real-provider-test.test.js`：9/9

## 6. 安全审计

- [x] 无真实 API Key / Secret 提交
- [x] 无真实图片 URL 提交
- [x] `DASHSCOPE_API_KEY` 仅作为环境变量名引用
- [x] CI / 自动测试：零真实 Provider 调用
- [x] 禁止目录变更 = 0
- [x] 无递归 tree 异常

## 后续（Phase 4.3-B-1+）

待人工用真实环境变量执行 `real-provider-test.js`，根据真实 API 响应：

- 验证 `bottoms → bottom_garment_url` 的 DashScope 实际行为
- 决定是否支持更多品类 / model
- **本阶段不做最终生产 Provider 选择**
