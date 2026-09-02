# weixin002 基线记录（Phase 0）

日期：2026-08-18　基线提交：`4626ef9`（main）

## 1. 仓库状态

- 工作树：仅 1 个未跟踪文件 `upload_58846a64-af21-4a5a-91cb-86ac3c52ef86.jpg`（本机测试上传临时文件，Phase 10 处理）。
- 分支：main；本地与 origin/main 一致；无未提交改动。
- 仓库结构：
  - `miniprogram/`：微信小程序（20 个页面，4 个 Tab）
  - `cloudfunctions/`：7 个云函数 + `services/` 共享模块
  - `docs/`：PRD、云开发说明；`weixin002/`：openDesign HTML 原型（只读）
  - `scripts/`：同步共享模块、诊断脚本

## 2. 命令结果

| 命令 | 结果 |
| --- | --- |
| `npm ci`（miniprogram） | 成功，361 packages |
| `npm test`（miniprogram） | 14/14 通过 |
| `npm run verify` | OK：20 pages、19 nav targets、4 tabs、资源/图标全解析 |
| `npm test`（cloudfunctions/services） | 17/17 通过 |

说明：`miniprogram/package.json` 原先缺少 `verify` 脚本，本次补充为 `node scripts/verify.js`（`miniprogram/scripts/verify.js` 保留原样）。

## 3. 云函数清单（7 个）

| 云函数 | 职责 | 数据集合 |
| --- | --- | --- |
| `auth` | 微信身份登录（返回 openid） | 无 |
| `createAvatarViews` | 生成/查询人物三视图（AI） | avatar_views |
| `ensureGarmentViews` | 生成/查询服装四视图（AI，缓存复用） | garment_views |
| `uploadGarment` | 上传衣物内容安全检测 + 删除联动（原图/四视图） | garment_views |
| `aiTryon` | 试穿提交/状态/历史/删除（图片+视频，缓存复用） | tryon_tasks、tryon_results |
| `onTryonComplete` | 试穿完成回调（任务状态更新 + 结果落库） | tryon_tasks、tryon_results |
| `cleanup` | 定时清理过期任务（定时触发） | tryon_tasks |

## 4. 数据集合

- avatar_views（人物三视图）
- garment_views（服装四视图）
- tryon_tasks（试穿任务）
- tryon_results（试穿结果/记录）
- favorites（前端 api.js 直接读写）
- avatar_profiles（前端 api.js 直接读写）
- quotas（前端 api.js 直接读写）
- garments（前端 api.js 保留映射，未实际使用）

## 5. Storage 使用

- `services/storage.js`：`downloadToBuffer`（下载公网图片）+ `saveRemoteImage`（保存到云存储返回 `cloud://`）。
- 目录：avatar_views / garment_views / tryon / garments（上传原图）。
- 现状：无 SSRF 防护（协议/主机/重定向/大小/类型均未限制）。

## 6. AI Provider

- `services/aigc.js`：`getAigc()` → 有 `AGNES_API_KEY` 用 `aigc-agnes.js`，否则回退 `aigc-mock.js`。
- `aigc-agnes.js`：生图同步（agnes-image-2.1-flash）、视频异步任务（agnes-video-v2.0）+ 轮询。
- `aigc-mock.js`：占位 URL（placeholder.example.com）。
- 现状：production 无 Mock 开关，Key 未配置即静默 mock（Phase 4/8 需收紧）。

## 7. Mock 使用点（前端）

- `miniprogram/utils/api.js`：所有方法在未配置云环境/云函数报错/结果含占位 URL 时回退 `utils/mock.js`。
- `utils/mock.js`：本地内存示例数据（衣物库、历史、收藏、账户、AI 占位）。
- 现状：生产环境无显式开关，任意失败都会 fallback 到 Mock（违反任务强制规则）。

## 8. 定时任务

- `cleanup` 云函数：分批扫描 tryon_tasks，删除超过宽限期的失败/成功任务（定时触发，触发配置在云开发控制台，无代码内定时器）。

## 9. 基线已知问题（供后续阶段）

1. Ownership：`aiTryon.history/deleteHistory` 未按 user_id 过滤（单用户阶段注释）；`onTryonComplete` 无签名校验；`status` 未校验任务归属。
2. 客户端可信输入：`uploadGarment.deleteGarment` 信任客户端 fileIDs；`ensureGarmentViews` 信任客户端 garmentImage URL；`createAvatarViews` 信任 event.refImages；`aiTryon` video 模式信任 tryonImageUrl。
3. SSRF：`storage.downloadToBuffer` 无协议/IP/重定向/大小/类型限制。
4. Quota：前端 `getQuota` 只读示例；无服务端扣减。
5. 状态机：onTryonComplete 任意 status 可写，无合法迁移校验。
6. 幂等：callback/收藏/删除缺少幂等键（favorites 无 user_id+result_id 唯一约束）。
7. 账户删除：前端 `deleteUserData` 直接客户端删库（权限模型脆弱），无服务端 deletion_jobs。
8. 字段不统一：createdAt/created_at、updated_at/updatedAt 混用。
9. Mock fallback：前端任意失败回退 mock，无 production 开关。
10. 本机文件：`upload_*.jpg` 未跟踪；`project.private.config.json` 未隔离。

## 10. 保留物

- PRD、设计稿、HTML 原型（weixin002/）、DESIGN-HANDOFF、AGENTS.md 全部保留。
