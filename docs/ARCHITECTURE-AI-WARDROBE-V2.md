# AI 智能衣橱 V2 技术架构

> **版本:** v2.0  
> **日期:** 2026-08-27  
> **关联文档:** `docs/PRD-AI-Wardrobe-V2.md`

---

## 一、总体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         微信小程序 (miniprogram/)                        │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐         │
│  │  主页   │  试衣   │  收藏   │  我的   │  档案   │  设置   │         │
│  └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘         │
│       │         │         │         │         │         │              │
│       └─────────┴─────────┴─────────┴─────────┴─────────┘              │
│                          ↓ wx.cloud.callFunction                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        微信云开发 (Cloud Development)                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    业务云函数层 (Business Functions)              │   │
│  │  ┌──────────┬──────────────┬──────────────┬──────────────────┐  │   │
│  │  │  auth    │ person-assets│   wardrobe   │   tryon-engine   │  │   │
│  │  │  (登录)   │  (人物资产)   │   (衣橱管理)  │    (AI 试穿引擎)  │  │   │
│  │  └────┬─────┴──────┬───────┴──────┬───────┴────────┬─────────┘  │   │
│  │       │            │              │                │             │   │
│  │       └────────────┴──────────────┴────────────────┘             │   │
│  │                              ↓                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                 共享服务层 (Shared Services)               │   │   │
│  │  │  storage  ownership  validation  quota  taskState        │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                              ↓                                    │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │              Provider Adapter 层 (AI 适配器)               │   │   │
│  │  │  ┌──────────┬──────────────┬──────────────┬────────────┐  │   │   │
│  │  │  │ Agnes    │ AliyunTryOn  │ AliyunTryOn+ │  Future    │  │   │   │
│  │  │  │ Provider │   Provider   │   Provider   │ Providers  │  │   │   │
│  │  │  └────┬─────┴──────┬───────┴──────┬───────┴─────┬──────┘  │   │   │
│  │  │       │            │              │             │          │   │   │
│  │  └───────┴────────────┴──────────────┴─────────────┘          │   │   │
│  │                            ↓                                   │   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                    TryOn Router                           │   │   │
│  │  │  FAST → BALANCED → QUALITY → FAILOVER                     │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     云数据库 (Cloud Database)                      │   │
│  │  avatar_profiles  person_assets  garments  garment_profiles      │   │
│  │  tryon_tasks  tryon_results  quotas  favorites  deletion_jobs    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     云存储 (Cloud Storage)                         │   │
│  │  person_assets/  garments/  tryon/  garment_profiles/            │   │
│  │  tryon_v2_experiments/  (实验独立目录)                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI Provider 层                                   │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│  │   Agnes AI      │  │  阿里云 DashScope│  │   其他 Provider  │        │
│  │  (图生图/视频)   │  │  (aitryon API)  │  │   (未来扩展)     │        │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、核心模块设计

### 2.1 TryOn Engine（试穿引擎）

```
cloudfunctions/tryon-engine/
├── index.js              # 云函数入口
├── submit.js             # 试穿提交逻辑
├── status.js             # 任务状态查询
├── history.js            # 试穿历史记录
├── router.js             # 策略路由器
├── cost-router.js        # 成本路由器
├── quality-check.js      # 质量检测（可选）
└── services/
    ├── Provider.js       # Provider 抽象接口
    ├── AgnesProvider.js  # Agnes 实现
    ├── AliyunTryOnProvider.js     # aitryon 标准版
    ├── AliyunTryOnPlusProvider.js # aitryon-plus
    └── MockProvider.js   # Mock 实现（开发/测试用）
```

#### Provider 接口规范

```javascript
// services/Provider.js
class TryOnProvider {
  constructor(config) {
    this.name = config.name;
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey; // 从环境变量读取
  }
  
  /**
   * 生成试穿图
   * @param {Object} params
   * @param {string} params.personImage - 人物图 HTTPS URL
   * @param {string} params.garmentImage - 衣物图 HTTPS URL
   * @param {string} params.category - tops|bottoms|dress
   * @param {Object} params.options - 额外参数
   * @returns {Promise<{taskId: string, resultUrl?: string, latencyMs: number, cost: number}>}
   */
  async generate(params) {
    throw new Error('Not implemented');
  }
  
  /**
   * 轮询任务状态
   * @param {string} taskId 
   * @returns {Promise<{status: string, resultUrl?: string, error?: string}>}
   */
  async poll(taskId) {
    throw new Error('Not implemented');
  }
  
  isConfigured() {
    return !!this.apiKey;
  }
}

module.exports = TryOnProvider;
```

#### 策略路由器

```javascript
// router.js
class TryOnRouter {
  constructor(providers) {
    this.providers = providers; // Map: name → Provider instance
    this.strategies = {
      FAST: 'agnes',
      BALANCED: 'aitryon',
      QUALITY: 'aitryon-plus',
      FAILOVER: ['aitryon-plus', 'aitryon', 'agnes']
    };
  }
  
  async generate(params, strategy = 'BALANCED') {
    const strategyName = this.strategies[strategy] || strategy;
    
    // 单 Provider 策略
    if (typeof strategyName === 'string') {
      const provider = this.providers[strategyName];
      if (!provider || !provider.isConfigured()) {
        throw new Error(`Provider ${strategyName} not configured`);
      }
      return await provider.generate(params);
    }
    
    // FAILOVER 策略：依次尝试
    for (const providerName of strategyName) {
      const provider = this.providers[providerName];
      if (!provider || !provider.isConfigured()) continue;
      
      try {
        return await provider.generate(params);
      } catch (e) {
        console.log('Provider fallback', providerName, 'failed:', e.message);
      }
    }
    
    throw new Error('All providers failed');
  }
}

module.exports = TryOnRouter;
```

### 2.2 Person Assets（人物资产）

```
cloudfunctions/person-assets/
├── index.js          # 云函数入口
├── create.js         # 创建/更新人物资产
├── get.js            # 查询人物资产
├── delete.js         # 删除人物资产
└── services/
    ├── processor.js  # 图片预处理（EXIF/缩放等）
    └── validator.js  # 输入校验
```

#### 数据流

```
用户上传照片
    ↓
云存储 (person_assets/{openid}/{timestamp}.jpg)
    ↓
avatar_profiles.body_photo_id
    ↓
[可选] AI 生成锚定图 (anchor_image)
    ↓
person_assets.anchor_image_id
```

### 2.3 Wardrobe（衣橱）

```
cloudfunctions/wardrobe/
├── index.js        # 云函数入口
├── upload.js       # 上传衣物
├── list.js         # 衣物列表
├── update.js       # 编辑衣物
├── delete.js       # 删除衣物
└── services/
    ├── validator.js    # 输入校验
    ├── security.js     # 内容安全检测
    └── processor.js    # 图片预处理（未来）
```

---

## 三、数据模型

### 3.1 数据库集合

```
┌─────────────────────┬──────────────────────────────────────────┐
│ 集合                │ 用途                                  │
├─────────────────────┼──────────────────────────────────────────┤
│ avatar_profiles     │ 用户身体参数档案                          │
│ person_assets       │ 人物照片资产（原始+生成）                  │
│ garments            │ 衣物原始数据                             │
│ garment_profiles    │ 衣物数字档案（颜色/图案/特征向量）         │
│ tryon_tasks         │ 试穿任务记录                             │
│ tryon_results       │ 试穿结果记录                             │
│ quotas              │ 每日额度                                │
│ favorites           │ 收藏                                    │
│ deletion_jobs       │ 账户删除作业                             │
│ tryon_v2_experiments│ 实验数据（隔离于生产）                    │
└─────────────────────┴──────────────────────────────────────────┘
```

### 3.2 核心集合字段

#### person_assets

```json
{
  "_id": "xxx",
  "_openid": "openid_xxx",
  "user_id": "openid_xxx",
  "avatar_profile_id": "yyy",
  "person_photo_id": "cloud://env.xxx/person_assets/xxx.jpg",
  "anchor_image_id": "cloud://env.xxx/person_assets/anchor_yyy.jpg",
  "three_view_composite_id": "cloud://env.xxx/person_assets/composite_zzz.jpg",
  "status": "ready",
  "provider": "agnes",
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

#### tryon_tasks

```json
{
  "_id": "xxx",
  "_openid": "openid_xxx",
  "user_id": "openid_xxx",
  "person_asset_id": "yyy",
  "garment_ids": ["aaa", "bbb"],
  "cache_key": "sha256_user_person_garments",
  "type": "ai_image",
  "strategy": "BALANCED",
  "provider": "aitryon",
  "status": "success",
  "result_url": "https://...",
  "saved_file_id": "cloud://env.xxx/tryon/xxx.jpg",
  "task_id": "dashscope_task_xxx",
  "latency_ms": 25000,
  "cost": 150,
  "error_code": "",
  "retry_count": 0,
  "notified": false,
  "created_at": 1234567890,
  "updated_at": 1234567890,
  "completed_at": 1234567915
}
```

---

## 四、API 端点设计

### 4.1 人物资产 API

```javascript
// POST /person-assets/create
// 创建/更新人物资产
{
  "profileId": "xxx",
  "action": "create"
}
// 返回: { ok, personAssetId, status }

// GET /person-assets/get
// 查询人物资产
{
  "action": "get"
}
// 返回: { ok, personAssetId, personPhoto, anchorImage, threeViewComposite }
```

### 4.2 试穿引擎 API

```javascript
// POST /tryon-engine/submit
// 提交试穿任务
{
  "action": "submit",
  "personAssetId": "xxx",
  "garmentIds": ["aaa", "bbb"],
  "strategy": "BALANCED"  // FAST | BALANCED | QUALITY | FAILOVER
}
// 返回: { ok, taskId, status, provider }

// POST /tryon-engine/status
// 查询任务状态
{
  "action": "status",
  "taskId": "xxx"
}
// 返回: { ok, status, resultUrl, latencyMs, cost }

// GET /tryon-engine/history
// 查询历史记录
{
  "action": "history"
}
// 返回: { ok, list: [...] }
```

### 4.3 衣橱 API

```javascript
// POST /wardrobe/upload
// 上传衣物
{
  "action": "upload",
  "fileID": "cloud://..."
}
// 返回: { ok, garmentId, name, category }

// GET /wardrobe/list
// 衣物列表
{
  "action": "list",
  "category": "上衣"  // 可选过滤
}
// 返回: { ok, list: [...] }

// POST /wardrobe/update
// 编辑衣物
{
  "action": "update",
  "garmentId": "xxx",
  "name": "新名称",
  "category": "上衣"
}
// 返回: { ok }
```

---

## 五、Provider 实现示例

### 5.1 AgnesProvider

```javascript
// services/AgnesProvider.js
const TryOnProvider = require('./Provider');

class AgnesProvider extends TryOnProvider {
  constructor() {
    super({
      name: 'agnes',
      apiUrl: 'https://apihub.agnes-ai.com/v1/images/generations'
    });
  }
  
  async generate({ personImage, garmentImage, category, options }) {
    const t0 = Date.now();
    const prompt = buildTryOnPrompt(category);
    
    const res = await requestJson('POST', this.apiUrl, {
      model: 'agnes-image-2.1-flash',
      prompt,
      size: '1024x1024',
      refImages: [personImage, garmentImage]
    });
    
    const url = res.data?.[0]?.url;
    return {
      taskId: '',  // Agnes 同步返回
      resultUrl: url,
      latencyMs: Date.now() - t0,
      cost: 5  // 约 ¥0.05
    };
  }
}

module.exports = AgnesProvider;
```

### 5.2 AliyunTryOnProvider

```javascript
// services/AliyunTryOnProvider.js
const TryOnProvider = require('./Provider');

class AliyunTryOnProvider extends TryOnProvider {
  constructor() {
    super({
      name: 'aitryon',
      apiUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis'
    });
  }
  
  async generate({ personImage, garmentImage, category, options }) {
    const t0 = Date.now();
    
    const res = await requestJson('POST', this.apiUrl, {
      model: 'aitryon',
      input: {
        person_image_url: personImage,
        top_garment_url: garmentImage
      },
      parameters: {
        resolution: -1,
        restore_face: true
      }
    }, this.apiKey);
    
    const taskId = res.output?.task_id;
    return { taskId, latencyMs: Date.now() - t0, cost: 100 };
  }
  
  async poll(taskId) {
    const res = await requestJson('GET', `/api/v1/tasks/${taskId}`, undefined, this.apiKey);
    const status = res.output?.task_status;
    const resultUrl = res.output?.results?.[0]?.url;
    return { status, resultUrl };
  }
}

module.exports = AliyunTryOnProvider;
```

---

## 六、安全设计

### 6.1 权限控制

```
所有操作必须通过 cloud.getWXContext().OPENID 获取身份
所有数据查询必须带 user_id 过滤
所有资源操作必须校验 ownership
```

### 6.2 SSRF 防护

```javascript
// 仅允许公网 HTTPS URL
// 拒绝 localhost/内网/IP 地址
// DNS 重绑定防护
// 重定向最多 3 次且每次重新校验
```

### 6.3 API Key 安全

```
所有 Provider API Key 存储在云函数环境变量
不写入代码
不返回给客户端
不记录到日志（脱敏）
```

---

## 七、监控与可观测性

### 7.1 关键指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| 生成成功率 | 成功任务/总任务 | < 85% |
| 平均延迟 | 所有任务平均耗时 | > 60s |
| 失败原因分布 | 各错误码占比 | 某错误 > 20% |
| 成本/日 | 当日总生成成本 | > 预算 120% |
| Provider 切换率 | FAILOVER 触发频率 | > 10% |

### 7.2 日志规范

```javascript
console.log('tryon-engine submit', {
  userId: openid,
  taskId,
  provider,
  strategy,
  latencyMs: Date.now() - t0
});
```

---

## 八、部署顺序

```
1. 同步共享服务到各云函数
   node scripts/sync-cloud-services.js

2. 部署顺序
   auth → person-assets → wardrobe → tryon-engine → cleanup

3. 配置环境变量
   - AGNES_API_KEY
   - DASHSCOPE_API_KEY
   - CALLBACK_SECRET（预留）
   - SUBSCRIBE_TMPL_ID
```

---

*本文档为 V2 技术架构唯一依据。*
*最后更新：2026-08-27*
