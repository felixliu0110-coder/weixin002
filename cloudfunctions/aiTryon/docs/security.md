# weixin002 安全设计

## 1. 身份与授权

- 身份一律来自云函数上下文 `cloud.getWXContext().openid`；客户端传入的 openid/user_id 不作为授权依据。
- 资源访问统一走 `services/ownership.js`：未登录 AUTH_REQUIRED；不存在 NOT_FOUND；
  归属不符或无归属 FORBIDDEN。
- 覆盖范围：avatar_profiles、avatar_views、garments、garment_views、tryon_tasks、
  tryon_results、favorites、quotas、deletion_jobs。

## 2. 客户端输入边界

- 客户端只提交业务 ID：profileId、garmentId、garmentIds、imageTaskId、taskId。
- `garmentName/garmentImage/fileID/fileIDs/tryonImageUrl/refImages/providerTaskId` 均不作为
  生成依据或授权依据；由服务端从数据库取得真实字段。
- 上传衣物：服务端验证 fileID 格式、大小（≤10MB）、内容安全后落库；
  删除时按 garments 记录联动删原图与四视图，客户端不能指定 fileID。
- 照片参考图：createAvatarViews 只接受档案中的云存储 fileID（临时 URL 由服务端生成）。

## 3. SSRF 防护（services/storage.js）

- 仅 http/https；拒绝 localhost/.local、回环、RFC1918、链路本地、CGNAT、组播/保留、
  IPv6 loopback/link-local/ULA。
- DNS 解析后的 IP 同样检查，并通过 lookup 回调固定使用已验证 IP（防 DNS 重绑定）。
- 重定向最多 3 次且每次重新校验；连接/读取超时 15s；响应上限 10MB，超限立即中断；
  Content-Type 白名单（图片类）；错误信息不泄露内部网络细节。

## 4. Quota 并发安全（services/quota.js）

- 云数据库事务原子扣减，防止并发超扣；每日限额（默认 3 次，可用环境变量/配置调整）。
- Provider 失败按任务回补（refundQuota），不重复扣费；重复提交幂等（同组合进行中任务复用）。

## 5. 回调安全（onTryonComplete）

- 必须携带与 `CALLBACK_SECRET` 一致的 secret（timingSafeEqual 比较），未配置密钥拒绝全部回调。
- 状态机校验 + task_id 幂等（同状态重复回调直接返回；结果按 task_id 去重）。
- 边界说明：当前 AI Provider（Agnes）为主动轮询协议，无官方签名回调；
  `CALLBACK_SECRET` 为内部/预留回调的不可猜测令牌机制。

## 6. 生产环境无 Mock 回退

- `miniprogram/config.js` 的 `mockEnabled` 默认 false；配置了 cloudEnv 后任何服务失败
  直接抛错并展示失败态，绝不回退本地 Mock。
- Mock 仅在本地开发/无云环境且显式 `mockEnabled: true` 时启用。

## 7. 数据隔离与删除

- 历史/收藏查询与删除按当前用户过滤（aiTryon action=history/favorites/deleteHistory/favoriteDelete）。
- 收藏幂等：user_id + result_id 唯一。
- 账户删除（deleteAccount）：deletion_jobs 状态机 + 遍历全部业务集合 +
  联动删除用户云存储文件；幂等可重试。

## 8. 合规

- 内容安全：上传衣物 imgSecCheck；AI 生成结果带「AI 生成」标识；
  分享文案含"AI 生成效果，仅供参考"。
- 人脸照片单独授权、最小化收集、可删除；未授权不采集。

## 9. 已知边界 / 未完成

- 照片上传页（photo-upload）仍为模拟选择，未接入真实 chooseMedia 上传；
  服务端已对照片字段做 fileID 白名单校验，接真实上传时按 uploadGarment 同模式接入即可。
- Provider 429/5xx/timeout 统一按 PROVIDER_ERROR 处理并自动重试 1 次；
  429 重试退避由适配器实现。
- 内容安全检测依赖微信 imgSecCheck，需要云开发环境具备该开放能力权限。
