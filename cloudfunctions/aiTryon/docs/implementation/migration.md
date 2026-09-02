# weixin002 数据迁移与索引方案（Phase 7）

## 1. 统一字段约定（新写入）

- 所有云函数新写入记录统一使用：`user_id`（归属）、`created_at`、`updated_at`。
- 兼容旧字段：`_openid`（微信自动注入）、`createdAt`、`updatedAt`。
- 读取侧统一兼容：`user_id || _openid`、`created_at || createdAt`、`updated_at || updatedAt`（已实现于 tryonCache、createAvatarViews.get、favorites 排序、deletion、history）。
- **普通请求不写旧字段、不做偷偷迁移**；旧字段保留，迁移独立进行。

## 2. 备份与导出策略（人工，云开发控制台）

1. 云开发控制台 → 数据库 → 各集合 → 右上角「导出」，选择 JSON 全量导出。
2. 迁移前导出全部集合：avatar_profiles、avatar_views、garments、garment_views、tryon_tasks、tryon_results、favorites、quotas、deletion_jobs。
3. 迁移后再导出一次做对比；保留至少 7 天备份文件。

## 3. Dry-run 统计

`cloudfunctions/services/migration.js` 提供只读统计 `collectMigrationStats(db)`：

- 统计每个集合：总数、缺 user_id/_openid 数、缺 created_at/createdAt 数、缺 updated_at/updatedAt 数、旧字段（createdAt/updatedAt）存量数。
- 使用方法：在任意云函数（或临时云函数）中 `require("./migration")` 并返回统计结果；或在 `aiTryon` 临时加 `action=migrationDryRun` 后部署调用，输出 JSON 存档。
- 校验口径：`noUserId` 应为 0（历史记录需补齐归属后再进入正式环境）；`oldCreatedAt/oldUpdatedAt` 用于评估兼容读取是否充分。

## 4. 兼容读取（已完成，代码内联）

| 位置 | 兼容逻辑 |
| --- | --- |
| `tryonCache.isCacheHit/isImageCacheHit/isCleanupCandidate` | `created_at \|\| createdAt`、`updated_at \|\| updatedAt` |
| `createAvatarViews.get` | 按 `user_id` 查询后本地取 `created_at \|\| createdAt` 最新 |
| `aiTryon.favorites` | 本地按 `created_at \|\| createdAt` 倒序 |
| `deletion.runDeletion` | 按 `user_id` 过滤清理 |
| `onTryonComplete/callback` | 结果写入统一字段 |

## 5. 独立迁移（建议步骤，人工执行）

1. 冻结写入窗口（低峰期）。
2. 全量导出备份。
3. dry-run 统计存档。
4. 逐集合按 `user_id <- user_id || _openid`、`created_at <- created_at || createdAt`、`updated_at <- updated_at || updatedAt` 补齐（建议用临时迁移云函数批量 update，每批 100 条，失败可重跑——幂等）。
5. 数量/关系校验：每集合 count 与备份一致；`tryon_tasks.user_id` 与 `tryon_results.user_id` 一致；`favorites.result_id` 有对应 tryon_results。
6. 观察 1–2 周无异常后，再考虑移除旧兼容逻辑（不要自动删除旧字段）。
7. 回滚：若异常，用备份重新导入；迁移函数幂等可重跑。

## 6. 索引清单（人工在云开发控制台创建，不自动部署）

| 集合 | 索引字段 | 用途 |
| --- | --- | --- |
| tryon_tasks | user_id + created_at（降序） | 用户任务列表/状态查询 |
| tryon_tasks | user_id + status | 进行中任务查询 |
| tryon_tasks | cache_key | 缓存复用查询（+ user_id） |
| tryon_tasks | provider_task_id | 回调/轮询按 provider 任务定位 |
| tryon_results | user_id + created_at（降序） | 历史记录 |
| tryon_results | task_id | 结果去重/收藏解析 |
| tryon_results | cache_key | 记录关联 |
| favorites | user_id + result_id（唯一） | 收藏幂等/唯一 |
| garments | user_id + created_at（降序） | 用户衣物库 |
| avatar_profiles | user_id + created_at（降序） | 用户档案 |
| avatar_views | user_id + created_at（降序） | 三视图最新查询 |
| avatar_views | user_id + avatar_profile_id | 档案关联 |
| garment_views | garment_id + user_id | 四视图缓存 |
| deletion_jobs | user_id + status | 删除作业去重 |
| quotas | user_id + date | 每日额度 |

> 说明：以上索引需在「云开发控制台 → 数据库 → 集合 → 索引管理」人工创建；未验证前不写入自动部署脚本。唯一索引（favorites.user_id+result_id）创建前需先清理重复数据。
