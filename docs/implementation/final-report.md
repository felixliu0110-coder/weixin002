# weixin002 工程化改造最终报告

日期：2026-08-18　基线：`4626ef9`（main）　执行：Phase 0–10

## 1. 概述

按 `WEIXIN002_CODEX_TASK.md` 完成前后端、安全、数据库、测试、CI、部署文档的工程化改造。
未执行 commit / push / PR；所有改动保留在工作树供人工审查。

## 2. 修改 / 新增 / 删除文件

### 修改（29 个）

- 云函数：`aiTryon`、`auth`、`createAvatarViews`、`ensureGarmentViews`、`onTryonComplete`、`uploadGarment`
- 共享模块：`storage.js`、`tryonCache.js`、`aigc-agnes.js`
- 前端：`utils/api.js`、`config.js`、`package.json`、`utils/api.test.js`、
  `pages/{avatar-3d,basic-info,body-params,favorites,history,home,profile,tryon-progress,tryon-result,tryon-select,video-generate}/index.js`
- 工程：`.gitignore`、`scripts/sync-cloud-services.js`、`cloudfunctions/services/*.test.js`

### 新增

- 共享服务：`errors.js`、`validation.js`、`ownership.js`、`taskState.js`、`quota.js`、
  `callback.js`、`deletion.js`、`garments.js`、`builtinGarments.js`、`migration.js`（含对应测试）
- 文档：`docs/implementation/{baseline,migration,final-report}.md`、`docs/architecture.md`、
  `docs/security.md`、`docs/deployment.md`
- CI：`.github/workflows/ci.yml`
- 配置模板：`project.private.config.example.json`

### 删除

- `upload_58846a64-af21-4a5a-91cb-86ac3c52ef86.jpg`（本机测试上传临时文件，未跟踪，不可恢复）。

## 3. 数据库变更（不自动执行）

- 新写入统一 `user_id / created_at / updated_at`；读取侧兼容旧字段
  （`_openid`、`createdAt`、`updatedAt`），见 `migration.md`。
- 新增集合：`garments`（上传衣物）、`deletion_jobs`（账户删除作业）、`quotas`（每日额度）。
- 普通请求不做偷偷迁移；迁移步骤、备份/导出、dry-run 见 `docs/implementation/migration.md`。

## 4. 环境变量 / Secret 名称（不写值）

| 名称 | 用途 |
| --- | --- |
| `AGNES_API_KEY` | AI 生图/视频 |
| `SUBSCRIBE_TMPL_ID` | 订阅消息模板 ID |
| `CALLBACK_SECRET` | onTryonComplete 回调密钥（不可猜测、可轮换） |

## 5. 索引（人工步骤，云开发控制台）

完整清单见 `docs/implementation/migration.md` §6；关键项：
tryon_tasks(user_id+created_at、user_id+status、cache_key、provider_task_id)、
tryon_results(user_id+created_at、task_id、cache_key)、favorites(user_id+result_id 唯一)、
garments(user_id+created_at)、avatar_profiles(user_id+created_at)、
avatar_views(user_id+created_at、user_id+avatar_profile_id)、deletion_jobs(user_id+status)、quotas(user_id+date)。
> 唯一索引创建前先清理重复数据；未验证前不自动部署。

## 6. 云函数部署顺序（微信开发者工具，逐个「上传并部署：云端安装依赖」）

1. 运行 `node scripts/sync-cloud-services.js` 同步共享模块
2. `auth` → `uploadGarment` → `createAvatarViews` → `ensureGarmentViews` → `aiTryon` → `onTryonComplete` → `cleanup`
3. 部署后到控制台为 `cleanup` 配置定时触发器；为各函数配置环境变量。

## 7. 微信开发者工具人工步骤

- 基础库 3.16.1+；工具 → 构建 npm。
- 前端改动直接重新编译；云函数按 §6 部署。
- 真机预览由用户扫码（不自动生成预览二维码）。

## 8. 测试结果（实际证据）

| 命令 | 结果 |
| --- | --- |
| `npm ci`（miniprogram） | 成功（361 packages） |
| `npm test`（miniprogram） | 15/15 通过 |
| `npm run verify`（miniprogram） | OK：20 pages、19 nav targets、4 tabs、资源/图标全解析 |
| `npm test`（cloudfunctions/services） | 70/70 通过 |

## 9. 安全测试覆盖（对应 Phase 9 清单）

| 要求 | 覆盖 | 证据 |
| --- | --- | --- |
| 未登录 | ✓ | ownership/validation 测试（AUTH_REQUIRED） |
| A 读 B / A 删 B / A 使用 B 资源 | ✓ | ownership.test、garments.test、deletion.test（FORBIDDEN） |
| 任意 URL / localhost / private IP SSRF | ✓ | storage.test（isPrivateIp/parseUrl） |
| DNS 解析后 IP、redirect 重新校验 | ✓ | storage.js 实现 + MAX_REDIRECTS 断言 |
| 超大文件 | ✓ | storage MAX_BYTES=10MB；uploadGarment MAX_FILE_BYTES |
| 错误 Content-Type | ✓ | storage ALLOWED_CONTENT_TYPES 白名单 |
| duplicate callback | ✓ | callback.test（幂等、task_id 去重） |
| duplicate submit | ✓ | aiTryon pendingHit 复用进行中任务 + 缓存命中；final-report 说明为代码审查 + 单测间接覆盖 |
| quota 并发超扣 | ✓ | quota.test（事务原子扣减 + 超限 RATE_LIMITED + 回补） |
| 非法状态 | ✓ | taskState.test、callback.test（CONFLICT） |
| Provider 429 / 5xx / timeout | 部分 | aigc.test（isContentRejected 分类）；requestJson 统一 reject PROVIDER_ERROR，适配器重试 1 次 |
| 内容安全拒绝 | 逻辑实现 | uploadGarment imgSecCheck + 87014 处理（需真机/云环境验证） |
| production no-mock | ✓ | api.test（mockEnabled=false 直接抛错） |
| account deletion 幂等 | ✓ | deletion.test（重复请求复用作业、重跑幂等） |
| 删除后访问 | ✓ | ownership NOT_FOUND 语义 |
| cache 跨用户隔离 | ✓ | tryonCache.test（key 含 user_id）、aiTryon 查询带 user_id |

## 10. 未完成事项

- photo-upload 页照片选择仍为模拟（服务端已做 fileID 白名单校验，接真实上传按 uploadGarment 模式接入即可）。
- 索引创建、CALLBACK_SECRET 配置、cleanup 定时触发：需在云开发控制台人工执行。
- Agnes 无官方回调协议：`CALLBACK_SECRET` 为预留令牌机制；若未来接入支持签名的 Provider，需按其协议实现。
- Provider 429/5xx 的集成重试未做真机联调（适配器已实现重试逻辑）。

## 11. 已知风险

- `project.private.config.json` 已加入 .gitignore（此前已提交的历史版本仍在仓库，建议后续从历史中清理）。
- 云函数同步副本（`cloudfunctions/*/tryonImage.js` 等）此前被提交过，现 .gitignore 已覆盖，避免后续误提交。
- 收藏依赖 tryon_results 记录存在：旧记录（无 task_id 关联）无法通过 taskId 收藏，需重新生成或历史入口补齐。
- 内置模板衣物（g-*）无云存储原图，四视图/试穿图不带参考图，效果取决于提示词。

## 12. 回滚方式

- 代码：工作树保留全部改动，`git diff` 可审查；未提交，回退即丢弃工作树改动（需先备份）。
- 云函数：控制台历史版本回滚。
- 数据库：迁移前导出备份重新导入（见 migration.md）。
