# 云开发接入说明

## 一、开通云开发

1. 微信开发者工具工具栏点「云开发」；
2. 按引导开通并创建一个环境（如 `woxingwoyi`）；
3. 复制环境 ID（形如 `cloud1-xxxx`）。

## 二、填写环境 ID

打开 `miniprogram/config.js`，把环境 ID 填到 `cloudEnv`：

```js
module.exports = {
  cloudEnv: "cloud1-xxxx"   // ← 你的环境 ID
};
```

填好后数据自动存入云数据库；留空则继续使用本地模拟数据（不影响运行）。

## 三、创建云数据库集合

在云开发控制台「数据库」中创建以下集合（权限保持默认"仅创建者可读写"即可）：

- `avatar_profiles`（数字人档案）
- `avatar_views`（AI 三视图档案）
- `garment_views`（衣物四视图缓存，与单张衣物图 1:1）
- `tryon_tasks`（试穿任务）
- `tryon_results`（试穿结果/记录）
- `favorites`（收藏）
- `quotas`（每日额度）

## 四、部署云函数（AI 试穿链路）

项目含 4 个云函数：`createAvatarViews`（人物三视图）、`ensureGarmentViews`（衣物四视图）、`aiTryon`（试穿效果图+转身视频）、`onTryonComplete`（生成完成回调）。部署前先同步共享模块：

```bash
node scripts/sync-cloud-services.js
```

### 方式 A：微信开发者工具 CLI（已验证可用）

开发者工具路径按本机安装位置调整（示例 `D:\刘小伟\微信web开发者工具\cli.bat`）：

```bash
"D:\刘小伟\微信web开发者工具\cli.bat" cloud functions deploy --env cloud1-xxxx --names createAvatarViews ensureGarmentViews aiTryon onTryonComplete --project D:\weixin002 --remote-npm-install
```

说明：
- `--env` 填你的云环境 ID（当前 `cloud1-d8gt95vnl0ec35c4f`）；
- `--remote-npm-install` 让云端安装 `wx-server-sdk`，本地无需 `node_modules`；
- 共享模块必须以**单层文件**存在于各函数目录（`aigc.js`/`avatarViews.js` 等），不要放进子目录——当前开发者工具 CLI 对嵌套子目录打包存在 EISDIR bug，`sync-cloud-services.js` 已按单层同步。

### 方式 B：开发者工具图形界面

1. 打开项目，左侧展开 `cloudfunctions/`；
2. 对每个函数目录右键 →「上传并部署：云端安装依赖」。

## 五、配置环境变量（API Key）

AI 生成服务（Agnes AIGC）的密钥通过云函数环境变量注入，未配置时自动回退 mock 占位：

1. 微信开发者工具 →「云开发」控制台 →「云函数」；
2. 逐个选择 `createAvatarViews`、`ensureGarmentViews`、`aiTryon`，点「配置」；
3. 在「环境变量」中添加 `AGNES_API_KEY`，值为你的 Agnes API Key；
4. 同页把「执行超时时间」改为 **60 秒**（默认 3 秒不足以完成真实生图/视频任务创建）。

> `onTryonComplete` 不需要该 Key。`createAvatarViews`（人物三视图）、`ensureGarmentViews`（衣物四视图）、`aiTryon`（试穿效果图 + 转身视频）三个函数都需要配置。Key 配置后自动从 mock 切换为真实生成；其中 `aiTryon` 的视频为异步任务，前端会轮询到生成完成。

## 六、说明

- 衣物模板数据为内置资源（未上云），后续可迁入 `garments` 集合；
- 图片目前使用本地资源；如需把用户上传/生成的图片存入云存储，属于完整接入方案，可后续升级；
- AI 生成未配置 Key 时走 mock（返回占位 URL，前端自动回退本地素材）；配置 `AGNES_API_KEY` 后走真实 Agnes 生图/生视频。
- Agnes 图生图/图生视频的参考图需要**公网可访问的 HTTPS URL**（微信云存储的 `cloud://` 文件 ID 需先转临时链接）；当前内置素材为本地资源，真实上传衣物接入云存储后需在调用前转链，属后续接入项。

## 七、验证

填好环境 ID、建好集合后，重新编译进入小程序：

- 「我的 → 试穿记录」、收藏页等有数据；改动档案后重新进入仍在（说明已写入云端）；
- 清缓存重进数据不丢；
- 云开发控制台对应集合能看到新增记录。

云函数部署验证：

```bash
"D:\刘小伟\微信web开发者工具\cli.bat" cloud functions list --env cloud1-xxxx --project D:\weixin002
```

应看到 4 个函数均为 Active 状态（`cli cloud functions info --env ... --names createAvatarViews aiTryon` 可查看状态）。
