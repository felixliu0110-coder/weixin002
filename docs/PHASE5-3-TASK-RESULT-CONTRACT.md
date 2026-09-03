# Phase 5-3 Try-On Task / Result Contract

## 概述

本文档定义 V1 Try-On Task/Result 数据闭环契约，明确 tryon_tasks 与 tryon_results 的职责分离与数据关系。

## 核心原则

1. **tryon_tasks = 运行任务**
   - 记录 Try-On 任务的运行状态
   - 包含 queued/processing/success/failed/cancelled 状态
   - 是任务执行过程的真实记录

2. **tryon_results = 成功结果**
   - 只记录成功的 Try-On 结果
   - 用于用户历史展示
   - 只有 task.status === "success" 时才能创建

3. **task_id 关联 result**
   - tryon_results.task_id 关联 tryon_tasks._id
   - 一个 task 最多对应一个 result
   - 幂等：重复完成事件不创建第二条 result

4. **一次 Try-On 只允许一个 garment**
   - V1 严格限制单次试穿 1 件衣物
   - garment_ids 数组长度为 1
   - 多件衣物试穿属于后续版本

5. **status 是内部状态**
   - queued: 任务已创建，等待处理
   - processing: 任务正在执行
   - success: 任务成功完成
   - failed: 任务执行失败
   - cancelled: 任务被取消
   - 不使用 PENDING/RUNNING/SUCCEEDED 等 Provider 外部状态

6. **provider_task_id 是 Provider 外部任务 ID**
   - 用于关联 Provider（如阿里云）的异步任务
   - 初始为空字符串
   - Provider 返回 task_id 后填充
   - 用于后续轮询/回调

7. **History 来源是 tryon_results**
   - 用户历史记录从 tryon_results 读取
   - 不从 tryon_tasks 读取
   - Task 是运行状态，Result 是用户结果

8. **Result 只有 success Task 才能创建**
   - processing → result: 禁止
   - queued → result: 禁止
   - failed → result: 禁止
   - 只有 success → result: 允许

9. **provider/AI 尚未在本阶段真实调用**
   - Phase 5-3 只建立 Task/Result contract
   - 真实 Provider 调用属于后续 Phase
   - 当前使用 mock/legacy fallback

10. **Video 不属于本阶段**
    - 本阶段只处理图片 Task
    - Video Task 属于后续版本
    - 不修改 experimentsT2/experimentsTryOnV2

## Task Schema

### 当前已实际写入字段

```javascript
{
  _openid,
  user_id,
  
  // task_id 为数据库 _id，不重复存储
  
  type: "ai_image",
  stage: "image",
  
  avatar_view_id,
  person_asset_id,
  person_source_type,
  
  garment_ids: [garmentId],
  garment_name,
  
  strategy,
  provider,
  provider_task_id,  // 当前为空字符串，未来真实异步 Provider 返回后填写
  
  status,  // queued/processing/success/failed/cancelled
  
  error_code,
  error_message,
  
  cache_key,
  
  retry_count,
  
  created_at,
  createdAt,  // 兼容旧字段
  started_at,      // processing 时记录
  completed_at,    // success/failed/cancelled 时记录
  updated_at
}
```

### 未来预留字段（当前未完整启用）

```javascript
{
  model,  // 预留字段，当前 legacy/Engine 路径可能为空，禁止硬编码虚假模型名称
  
  quota_reserved,  // 预留字段，当前未实现 reserve/consume 生命周期
  quota_consumed   // 预留字段，当前仍沿用既有 quota consume/refund 机制
}
```

**重要说明**：
- `quota_reserved` / `quota_consumed` 当前不能被描述为"已经完整实现 reserve/consume 生命周期"
- 当前仍沿用既有 quota consume/refund 机制（consumeQuota / refundQuota）
- 未来 Phase 5-5 再正式收口 quota 状态字段
- `model` 是正式 Task Contract 的预留字段，禁止为了"补齐 schema"硬编码虚假的模型名称（如 `model: "aitryon"`），除非实际 Provider 已经确定并真实执行
- `provider_task_id` 当前为空字符串，未来真实异步 Provider 返回外部 task_id 后才填写，禁止当前伪造 Provider task ID

## Result Schema

```javascript
{
  _openid,
  user_id,
  task_id,
  avatar_view_id,
  garment_id,
  garment_name,
  
  tryon_image,
  tryon_image_url,
  
  tryon_video,
  
  provider,
  model,
  
  created_at,
  updated_at
}
```

## 状态流转

```
queued → processing → success
                    → failed
         → cancelled
```

- queued: created_at 记录
- processing: started_at 记录
- success/failed/cancelled: completed_at 记录

## API 契约

### submitAiTryon

输入：
```javascript
{
  avatarViewId,
  garmentIds,
  strategy  // 可选
}
```

输出：
```javascript
{
  ok: true,
  taskId,
  status,
  stage,
  provider,
  providerTaskId,
  tryonImage,
  tryonImageUrl,
  errorCode,
  errorMessage
}
```

### getAiTryonStatus

输入：
```javascript
{
  taskId
}
```

输出：
```javascript
{
  ok: true,
  taskId,
  status,
  stage,
  provider,
  providerTaskId,
  tryonImage,
  tryonImageUrl,
  tryonVideo,
  errorCode,
  errorMessage
}
```

## 禁止事项

- 禁止 submitTryon 直接写 tryon_tasks
- 禁止把 garmentImages/garmentNames 作为可信数据源
- 禁止引入 PENDING/RUNNING/SUCCEEDED 等 Provider 外部状态
- 禁止在 queued 阶段伪造 started_at
- 禁止 processing/queued/failed 状态创建 result
- 禁止创建第二条相同 task_id 的 result
- 禁止把 tryon_tasks 当历史展示集合
- 禁止假结果（/assets/img/p07-result.jpg 作为 AI 成功结果）
- 禁止修改 Try-On Engine/Provider
- 禁止新增 collection

## 后续工作

- Phase 4.3-B-1/2: Provider 异步适配
- 真实阿里云接入
- Video Task 支持
- 多件衣物试穿
