# V1-V20 FIX NOTE

## 根因
V19 已正确把 DashScope `UNKNOWN` 任务识别为终态 `PROVIDER_TASK_NOT_FOUND`，但前端 `tryon-progress.retry()` 在 `aiTryonPending` 已被首次提交流程删除后，会退回到当前页面保存的旧 `taskId`，再次执行 `poll()`。

因此用户点击“重新生成”时实际上没有重新调用 `aiTryon action=submit`，而是在重复查询已经不存在的旧 aitryon provider task，于是每次都得到 `PROVIDER_TASK_NOT_FOUND`。

## V20 修复
- 首次提交成功后，将完整的单件衣物重提交上下文保存到 `aiTryonTask.retryPayload`。
- Provider/业务任务失败后，将本地 `aiTryonTask.status` 标记为 `failed`，避免旧 task 被误认为仍可轮询。
- `retry()` 优先使用 `aiTryonPending` / `retryPayload` 调用 `submitTask()`，创建全新的 aitryon provider task。
- 仅当没有失败状态且缺少重提交上下文时，才允许继续轮询已有 task。
- 页面重新进入时，如果本地任务已经 failed 且存在 retryPayload，直接展示失败态，不再轮询旧 task。
- 未修改 Provider、额度、数据库历史记录删除策略；历史 task 保留。

## 验证目标
点击“重新生成”后必须出现新的 `action=submit` 调用和新的 `providerTaskId`。新 `providerTaskId` 不得等于之前的 `f4832f4f-f878-45f3-8655-6100fea504eb`。


## V20.1 重要补强
即使 V19 产生的旧失败任务没有 `retryPayload`，V20 也提供 `aiTryon action=retry`：服务端从用户自己的旧失败任务读取 `avatar_profile_id` 与 `garment_ids`，重新执行 V1 submit，创建新的 aitryon provider task。这样不要求用户返回选择页，也不依赖本地缓存是否完整。
