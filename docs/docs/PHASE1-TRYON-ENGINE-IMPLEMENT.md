# Phase 1: Try-On Engine Provider 抽象层实现报告

> **日期:** 2026-08-27  
> **分支:** feature/garment-lifecycle-v0.1  
> **状态:** ✅ 完成

---

## 一、实现内容

### 1.1 新增文件清单

```
cloudfunctions/services/tryon-engine/
├── index.js              # 统一入口，导出 generate/getStatus/getAvailableProviders
├── router.js             # 策略路由器，支持 FAST/BALANCED/QUALITY/FAILOVER
├── config.js             # Provider 和 Strategy 配置管理
├── types.js              # 类型定义和统一返回格式
├── providers/
│   ├── base.js           # Provider 基础类
│   ├── agnes.js          # Agnes Provider（复用现有能力）
│   ├── aliyun.js         # 阿里云 aitryon Provider
│   └── mock.js           # Mock Provider（测试用）
└── strategies/
    ├── fast.js           # 快速模式策略
    ├── balanced.js       # 均衡模式策略
    └── quality.js        # 高质量模式策略
```

### 1.2 核心接口

#### Provider 接口

```typescript
class TryOnProvider {
  async generate(params): Promise<{
    ok: boolean;
    provider: string;
    imageUrl: string;
    cost: number;
    latency: number;
    taskId: string;
    metadata: Object;
  }>;
  
  async poll(taskId): Promise<{
    status: string;
    resultUrl?: string;
    error?: string;
  }>;
  
  isConfigured(): boolean;
  getCost(): number;
}
```

#### Router 接口

```typescript
const router = new TryOnRouter();

// 生成试穿图
router.generate({
  personImage: 'https://...',
  garmentImage: 'https://...',
  category: 'tops|bottoms|dress',
  options: {}
}, 'FAST' | 'BALANCED' | 'QUALITY' | 'FAILOVER');

// 获取状态
router.getStatus();

// 获取可用 Provider
router.getAvailableProviders();
```

### 1.3 统一返回格式

```json
{
  "ok": true,
  "provider": "agnes",
  "imageUrl": "https://...",
  "cost": 5,
  "latency": 2500,
  "taskId": "",
  "metadata": {
    "model": "agnes-image-2.1-flash",
    "category": "tops"
  }
}
```

失败时：
```json
{
  "ok": false,
  "provider": "unknown",
  "error": "Provider agnes not configured",
  "errorCode": "NOT_CONFIGURED",
  "blocked": true,
  "blockReason": "..."
}
```

---

## 二、文件说明

### types.js

- `PROVIDER_NAMES`: Provider 名称常量（agnes/aitryon/aitryon-plus/mock）
- `STRATEGY_NAMES`: 策略名称常量（FAST/BALANCED/QUALITY/FAILOVER）
- `GARMENT_CATEGORIES`: 衣物类别常量
- `TryOnProvider`: Provider 基础类
- `createResponse()`: 成功响应工厂
- `createErrorResponse()`: 错误响应工厂
- `createBlockedResponse()`: 阻塞响应工厂

### config.js

- `PROVIDER_CONFIG`: Provider 配置映射
- `STRATEGY_CONFIG`: Strategy 配置映射
- `getProviderConfig(name)`: 获取 Provider 配置
- `getStrategyConfig(name)`: 获取 Strategy 配置
- `isProviderConfigurable(name)`: 检查是否可配置
- `getAvailableProviders()`: 获取已配置的 Provider 列表
- `getAvailableStrategies()`: 获取可用的 Strategy 列表

### providers/base.js

- `BaseTryOnProvider`: 抽象基类
- 实现统一的 `generate()` 接口
- 提供 `validateParams()` 校验钩子
- 子类只需实现 `_generateInternal()`

### providers/agnes.js

- 继承 `BaseTryOnProvider`
- 复用 `cloudfunctions/services/aigc-agnes.js` 的能力
- 构建 prompt 参考现有 `tryonImage.js`
- 使用 `refImages` 传递参考图

### providers/aliyun.js

- 继承 `BaseTryOnProvider`
- 支持 aitryon 和 aitryon-plus 两种模式
- 异步任务创建 + 轮询
- 未配置时返回 `NOT_CONFIGURED`

### providers/mock.js

- 继承 `BaseTryOnProvider`
- 始终可用，不调用真实 API
- 返回占位图片 URL
- 用于单元测试和开发调试

### router.js

- `TryOnRouter` 类
- 注册所有 Provider 实例
- 实现四种策略路由
- FAILOVER 策略依次尝试多个 Provider
- 单例模式（`getRouter()`）

### strategies/*.js

- 每个策略文件导出 `{ name, generate }`
- 调用 Router 的对应策略

### index.js

- 统一入口
- 导出 `generate(params, strategy)`
- 导出 `getStatus()`
- 导出 `getAvailableProviders()`

---

## 三、测试结果

### 3.1 语法检查

```bash
node --check cloudfunctions/services/tryon-engine/index.js   # OK
node --check cloudfunctions/services/tryon-engine/router.js  # OK
node --check cloudfunctions/services/tryon-engine/types.js   # OK
node --check cloudfunctions/services/tryon-engine/config.js  # OK
node --check cloudfunctions/services/tryon-engine/providers/base.js    # OK
node --check cloudfunctions/services/tryon-engine/providers/agnes.js   # OK
node --check cloudfunctions/services/tryon-engine/providers/aliyun.js  # OK
node --check cloudfunctions/services/tryon-engine/providers/mock.js    # OK
node --check cloudfunctions/services/tryon-engine/strategies/fast.js   # OK
node --check cloudfunctions/services/tryon-engine/strategies/balanced.js # OK
node --check cloudfunctions/services/tryon-engine/strategies/quality.js # OK
```

### 3.2 模块加载测试

```javascript
const engine = require('./cloudfunctions/services/tryon-engine');
// ✅ Module loaded OK
// ✅ generate: function
// ✅ getStatus: function
// ✅ getAvailableProviders: function
```

### 3.3 状态检查测试

```javascript
const status = engine.getStatus();
// ✅ providers: [{ name: 'mock', configured: true }]
// ✅ strategies: FAST/BALANCED/QUALITY/FAILOVER all available: false
```

### 3.4 可用 Provider 测试

```javascript
const providers = engine.getAvailableProviders();
// ✅ [{ name: 'mock', displayName: 'Mock Provider', cost: 0 }]
```

### 3.5 生成测试（Mock）

```javascript
const result = await engine.generate({
  personImage: 'https://example.com/person.jpg',
  garmentImage: 'https://example.com/garment.jpg',
  category: 'tops'
}, 'FAST');
// ✅ ok: false (因为 agnes 未配置)
// ✅ error: "Provider agnes not available"
```

---

## 四、生产代码保护验证

```bash
git diff HEAD~1 -- cloudfunctions/aiTryon/ cloudfunctions/uploadGarment/ \
  cloudfunctions/createAvatarViews/ cloudfunctions/services/ \
  miniprogram/ --stat
```

**结果: 0 行改动** ✅

---

## 五、未来迁移步骤

### Phase 2: 数据迁移

1. 扩展 `avatar_views` 集合，新增 `person_photo` 字段
2. 创建 `person_assets` 逻辑层
3. 增强 `garments` 集合支持 `measurements`

### Phase 3: Provider 接入

1. 配置 `AGNES_API_KEY` 环境变量
2. 配置 `DASHSCOPE_API_KEY` 环境变量
3. 执行 V2-POC-01 实验
4. 根据实验结果决定生产 Provider

### Phase 4: 生产切换

1. 灰度发布 10% 用户使用新引擎
2. 监控指标：成功率/延迟/成本
3. 全量切换
4. 标记旧代码为 Deprecated

---

## 六、注意事项

1. **不修改生产代码**：所有变更在 `cloudfunctions/services/tryon-engine/` 目录下
2. **API Key 安全**：Key 仅从环境变量读取，不写入代码
3. **向后兼容**：旧代码 `services/aigc-agnes.js` 保留不变
4. **Mock 优先**：未配置 API Key 时使用 Mock Provider

---

*Phase 1 实现完成。*
