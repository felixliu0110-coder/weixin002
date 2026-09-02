# weixin002 部署说明

## 1. 前置条件

- 微信开发者工具（已配置 appid：wxe44ebc1661569b32）
- 云开发环境已开通（当前 cloud1-d8gt95vnl0ec35c4f，见 miniprogram/config.js）
- AI Provider Key：云函数环境变量 `AGNES_API_KEY`

## 2. 环境变量（云开发控制台 → 云函数 → 配置 → 环境变量）

| 变量 | 用途 | 是否必填 |
| --- | --- | --- |
| AGNES_API_KEY | Agnes AI 生图/视频 | 生产必填 |
| SUBSCRIBE_TMPL_ID | 订阅消息模板 ID | 选填（无则不推送） |
| CALLBACK_SECRET | 回调密钥（onTryonComplete 鉴权） | 使用回调则必填 |

> 不写入真实 Key 值；final-report 只列变量名。

## 3. 云函数部署顺序（微信开发者工具 → 云开发 → 云函数，逐个「上传并部署：云端安装依赖」）

1. `services` 共享模块先同步：运行 `node scripts/sync-cloud-services.js`
2. `auth`
3. `uploadGarment`
4. `createAvatarViews`
5. `ensureGarmentViews`
6. `aiTryon`
7. `onTryonComplete`
8. `cleanup`（首次部署后到控制台配置定时触发器）

## 4. 数据库与索引（人工步骤，见 docs/implementation/migration.md §6）

- 云开发控制台 → 数据库 → 逐集合创建索引（清单见 migration.md）。
- favorites 唯一索引 user_id+result_id 创建前先清理重复数据。

## 5. 微信开发者工具人工步骤

- 项目 → 详情 → 本地设置：调试基础库 3.16.1+。
- 工具 → 构建 npm（miniprogram 有 package.json 与依赖时）。
- 上传/预览：工具 → 上传代码（需管理员/开发者权限）。
- 真机预览：工具 → 预览 → 扫码（不自动生成预览二维码）。

## 6. 发布前检查

- `npm ci && npm test && npm run verify`（miniprogram）通过。
- `npm test`（cloudfunctions/services）通过。
- config.js 的 `mockEnabled` 保持 false；cloudEnv 指向正式环境。
- 上传衣物、生成数字人、试穿、收藏、历史、删除、账户删除全链路真机回归。

## 7. 回滚

- 云函数：控制台选择历史版本回滚。
- 数据库：迁移前导出的备份重新导入（见 migration.md）。
- 代码：Git 回滚到上一个提交后重新部署受影响云函数。
