# V1 V19 修复说明

## 根因
DashScope aitryon 任务查询已经返回 UNKNOWN，当前 V18 将 UNKNOWN 当成非终态，导致 tryon_tasks 永久保持 processing，小程序永久停留在生成页。

## V19 修复
1. `UNKNOWN` 进入明确终态，错误码统一为 `PROVIDER_TASK_NOT_FOUND`。
2. DashScope 任务查询 HTTP 404 / 明确 not found 也进入同一终态，而不是无限 processing。
3. Provider 真实 FAILED/CANCELED 继续按原逻辑处理。
4. Provider 查询瞬时网络错误仍保留 processing，避免把一次网络抖动误判为 AI 失败。
5. Provider 终态失败/UNKNOWN 使用任务创建日期对应的 quota 文档退款，而不是当前日期，避免跨日任务退款失败。
6. 结果图片保存失败现在会持久化 `failed` 并执行额度退款，不再只给前端返回失败而数据库仍停留 processing。
7. 不删除历史 `tryon_tasks`，仅让旧死任务可以被明确收敛。

## V1 边界
仍然只使用 `aitryon`、单人物 + 单衣物、图片试穿；不启用 `aitryon-plus`、视频、批量或 mock fallback。
