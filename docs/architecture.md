# weixin002 系统架构

## 1. 总体结构

```
微信小程序（miniprogram/，20 页面）
  └─ utils/api.js（业务 API 层，唯一数据访问入口）
        │  wx.cloud.callFunction / wx.cloud.database / wx.cloud.storage
        ▼
微信云开发（云函数 + 云数据库 + 云存储）
  ├─ auth            登录、档案读写（profileGet/profileSave）
  ├─ createAvatarViews   人物三视图生成/查询（AI）
  ├─ ensureGarmentViews  服装四视图生成/查询（AI，缓存）
  ├─ uploadGarment   上传衣物：内容安全 + garments 落库 + 删除联动
  ├─ aiTryon         试穿提交/状态/历史/收藏/额度/账户删除
  ├─ onTryonComplete 回调入口（CALLBACK_SECRET 鉴权，预留）
  └─ cleanup         定时清理过期任务
        ▼
AI Provider（services/aigc.js 适配器）
  ├─ aigc-agnes.js   Agnes 生图 + 视频任务（当前生产）
  └─ aigc-mock.js    仅本地/测试占位
```

## 2. 核心链路

### 2.1 数字人三视图
创建向导保存档案（auth.profileSave）→ generate-progress 调 createAvatarViews（传 profileId）→
服务端查档案（owner check）→ 从档案取照片 fileID → 临时 URL → AI 生图 → 存云存储 → avatar_views。

### 2.2 上传衣物
前端 chooseMedia → wx.cloud.uploadFile（garments/）→ uploadGarment.action=create：
下载校验大小（≤10MB）→ 内容安全 imgSecCheck → garments 落库（original_file_id）→ 返回 garmentId。

### 2.3 服装四视图
ensureGarmentViews（只传 garmentId）→ 服务端解析衣物（garments 集合 / 内置白名单）→
取 original_file_id 临时 URL 作参考图 → AI 生图 → 云存储 garment_views（按 user_id 隔离缓存）。

### 2.4 试穿（图片 + 视频解耦）
- 图片任务（aiTryon submit，mode=image）：服务端解析 avatar_views + garments → 扣额度（事务）→
  AI 效果图 → 云存储 tryon → tryon_results 落记录 → 立即返回 success。
- 视频任务（mode=video）：只传 imageTaskId → 服务端校验图片任务成功 →
  用服务端保存的效果图 URL 创建 AI 视频任务 → 轮询完成。
- 缓存：user_id + cache_key（图片/视频分开），7 天内命中复用。

## 3. 数据集合与字段约定

| 集合 | 用途 | 归属/时间字段 |
| --- | --- | --- |
| avatar_profiles | 用户档案 | user_id、created_at、updated_at（兼容 _openid/createdAt/updatedAt） |
| avatar_views | 人物三视图 | user_id、avatar_profile_id |
| garments | 上传衣物 | user_id、original_file_id、name、category、status |
| garment_views | 服装四视图 | user_id、garment_id |
| tryon_tasks | 试穿任务 | user_id、cache_key、provider_task_id、status/stage、error_code/message、created_at/updated_at/completed_at |
| tryon_results | 试穿记录 | user_id、task_id、cache_key、tryon_image、tryon_video |
| favorites | 收藏 | user_id、result_id（唯一） |
| quotas | 每日额度 | user_id、date、used、limit |
| deletion_jobs | 账户删除作业 | user_id、status |

## 4. 状态机

- tryon_tasks：`queued -> processing -> success`；`queued -> failed`；`processing -> failed`；
  `queued/processing -> cancelled`；拒绝其他跳转（services/taskState.js）。
- deletion_jobs：`requested -> processing -> completed/failed`（services/deletion.js）。

## 5. 共享模块（services/，部署前用 scripts/sync-cloud-services.js 同步到各云函数）

aigc / aigc-agnes / aigc-mock / avatarViews / builtinGarments / callback / deletion / errors /
garments / garmentViews / migration / ownership / quota / storage / taskState / tryonCache /
tryonImage / tryonVideo / validation

## 6. 定时任务

- cleanup：分批清理超过宽限期的 tryon_tasks（失败 7 天、成功 30 天），云开发控制台配置定时触发。
