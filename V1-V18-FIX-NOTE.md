# V18 — V1 试穿状态契约修复

## 根因
V17 的 `cloudfunctions/aiTryon/services/tryon-engine/types.js` 的 `createResponse()` 只保留了通用字段，没有透传 Provider 的 `status/rawStatus/normalized/error/errorCode`。
因此 DashScope aitryon 已经 `SUCCEEDED` 时，aiTryon status handler 收到的状态字段为空，误判为 processing。

## V18 修复
- 透传 `status/rawStatus/normalized/error/errorCode`。
- 对缺失字段做兼容归一化。
- status handler 使用统一状态值判断成功/失败。
- 结果图片保存失败时不再伪装为 processing，而是记录明确错误并终止本次任务。
- 增加 `V18-RUNTIME` 运行指纹。

## 验证
- 183 个 JS 文件 `node --check`：全部通过。
- `createResponse({status:'SUCCEEDED', rawStatus:'SUCCEEDED', imageUrl:'x'})` 契约测试：通过。

## V1 范围
仍然只支持：真实 Person Asset + 1 个真实 Garment Asset + DashScope `aitryon` 图片试穿。
不启用 `aitryon-plus`、视频、批量或自动 mock fallback。
