# C 成本与稳定性优化设计（AI 生成链路）

*创建：2026-08-16（v1.0）*

## 1. 背景与目标

「我形我衣」AI 试穿真实链路（Agnes）已上线：人物三视图、衣物四视图、试穿效果图、转身视频均由 Agnes 生成。当前存在成本浪费与稳定性隐患：

1. 每次试穿都重新调用 Agnes 生成效果图 + 视频（成本大头），无复用；
2. 模板衣物与用户上传衣物均为本地图片路径，`ensureGarmentViews` 调 Agnes 图生图必然失败，前端每次白调云函数等回退；
3. 视频进度固定 0.9s 轮询、3 分钟上限，Agnes 高峰期可能超时误报，且轮询频繁浪费云函数/Agnes 查询；
4. `tryon_tasks` 无限增长，无清理；
5. 云函数无日志埋点，问题定位依赖人工截图。

**目标**：在不改变现有功能与 UI 的前提下，显著降低 Agnes 调用成本、提升生成链路稳定性。

**非目标**：云存储接入（依赖"数据上云范围"决策）、更换 AI 模型、UI/交互改动。

## 2. 架构前提：模型无关

AIGC 适配器已解耦（`aigc.js` 的 `getAigc()` 按环境变量选择 Agnes / mock）。本方案所有改动均位于业务层（云函数状态机、前端轮询、清理、日志），**与具体模型无关**；后续更换模型只需新增适配器文件并切换环境变量，本方案的缓存、去重、清理全部复用。

**缓存键不绑定模型**：按「用户 + 数字人 + 衣物组合」计算，换模型后旧结果可直接复用。

## 3. 详细设计

### 3.1 试穿结果复用（去重缓存）

`tryon_tasks` 新增字段 `cache_key`：

```
cache_key = sha1(openid + "|" + avatarViewId + "|" + sortedGarmentIds.join(",") + "|" + "ai_video")
```

`aiTryon` submit 流程调整：

1. 参数校验后，先用 `cache_key` 查询 `status = "success"` 且 `createdAt >= now - 7d`（`CACHE_TTL_MS = 7 * 24 * 3600 * 1000`）的最新任务；
2. **命中**：直接返回 `{ ok: true, taskId: 旧任务._id, status: "success", cached: true, tryonImage, tryonVideo, garmentName }`，不再调用 Agnes；
3. 未命中：正常创建任务（写入 `cache_key`）。

前端无需改动：`submitAiTryon` 拿到 `status: "success"` 后照常存 `aiTryonTask`，`tryon-progress` 轮询 `status` 立即返回成功并展示结果。

边界：
- 失败任务不参与复用；
- 命中但 `tryon_video` 为空的历史记录：`status` 分支已有补全逻辑，命中后前端轮询会自动补全真实视频 URL；
- mock 模式不受影响。

### 3.2 跳过无效四视图生成

`api.js` 的 `ensureGarmentViews` 增加前置判断：`garmentImage` 不是公网 HTTPS URL（不以 `http://` / `https://` 开头）时，**直接返回 `mock.ensureGarmentViews(...)`，不调用云函数**。

影响：模板衣物（本地资源路径）、用户上传衣物（临时路径）不再白调云函数与 Agnes。云函数 `ensureGarmentViews` 保留，待云存储接入后对真实公网图启用。

### 3.3 轮询退避

`tryon-progress` 轮询间隔从固定 0.9s 改为动态退避：

```
间隔序列：2000ms → 3000ms → 5000ms → 8000ms → 12000ms（封顶 12s，循环使用）
总上限：12 分钟（按时间计，不再按次数）
```

超时后不再误报失败，提示"生成仍在后台进行，可稍后在试穿记录查看"，保留重试按钮。保留现有 `onHide/onShow` 定时器清理与失败态展示。

间隔序列与上限导出为常量，便于单测。

### 3.4 定时清理

新增云函数 `cleanup`，每天 02:00 定时触发（`config.json` 定时触发器），执行：

- 删除 `tryon_tasks`：`status = "failed"` 且 `updated_at < now - 7d`；
- 删除 `tryon_tasks`：`status = "success"` 且 `createdAt < now - 30d`。

删除前 `console.log` 清理数量。`scripts/sync-cloud-services.js` 遍历目录自动同步共享模块；部署命令追加 `cleanup`。

### 3.5 日志

在 `createAvatarViews`、`ensureGarmentViews`、`aiTryon`（submit/status）、`cleanup` 关键节点加 `console.log`（openid 脱敏、耗时、ok/error）。`docs/CLOUD-SETUP.md` 补充"开启云函数日志"说明，配合 CloudBase MCP 排查。

## 4. 数据模型

| 集合 | 字段 | 说明 |
| --- | --- | --- |
| `tryon_tasks` | `cache_key` | 去重键（sha1），建议建索引 |

## 5. 测试与验证

1. services 单测：`cache_key` 生成、去重命中逻辑（mock db）、清理条件；
2. 小程序单测：退避间隔序列与上限；
3. automator 冒烟：
   - 同一"数字人 + 衣物"组合第二次提交返回 `cached: true` 且秒回成功；
   - 模板衣物提交不触发 `ensureGarmentViews` 云函数（本地 mock 四视图）；
4. 部署 5 个云函数（含新 `cleanup`）+ 前端编译，真机确认生成流程不受影响。

## 6. 风险与回退

| 风险 | 应对 |
| --- | --- |
| 复用导致用户看到旧结果 | 7 天 TTL；后续可加"强制重新生成"按钮（本次不做） |
| 清理误删 | 宽限期 7/30 天；仅清理 `tryon_tasks`，不动用户收藏/记录 |
| 定时触发器部署失败 | 不影响主链路；`cleanup` 手动触发兜底 |

## 7. 涉及文件

- `cloudfunctions/aiTryon/index.js`（去重缓存 + 日志）
- `cloudfunctions/createAvatarViews/index.js`（日志）
- `cloudfunctions/ensureGarmentViews/index.js`（日志）
- `cloudfunctions/cleanup/`（新云函数 + config.json 定时触发器）
- `cloudfunctions/services/`（如有共享工具，如 cacheKey）
- `miniprogram/utils/api.js`（ensureGarmentViews 公网 URL 判断）
- `miniprogram/pages/tryon-progress/index.js`（轮询退避）
- `miniprogram/utils/mock.js`（如需要）
- `docs/CLOUD-SETUP.md`（日志说明、cleanup 部署）
- `scripts/sync-cloud-services.js`（自动覆盖新目录）
