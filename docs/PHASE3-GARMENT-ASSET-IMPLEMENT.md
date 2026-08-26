# Phase 3: Garment Asset 基础系统实现报告

> **日期:** 2026-08-27  
> **分支:** feature/garment-lifecycle-v0.1  
> **状态:** ✅ 完成

---

## 一、实现内容

### 1.1 新增文件清单

```
cloudfunctions/services/garment-asset/
├── index.js        # 服务入口，导出 CRUD 方法
├── repository.js   # 数据库操作层
├── analyzer.js     # 基础分析能力（不含 AI）
└── types.js        # 类型定义和常量
```

### 1.2 核心能力

| 方法 | 说明 |
|------|------|
| `createGarmentProfile(params)` | 创建衣物数字档案 |
| `importFromGarment(garment, openid)` | 从 garments 集合导入 |
| `getGarmentProfile(profileId, openid)` | 获取衣物数字档案 |
| `getProfileByGarmentId(garmentId, openid)` | 根据 garment_id 获取 |
| `updateGarmentProfile(profileId, openid, updates)` | 更新衣物数字档案 |
| `deleteGarmentProfile(profileId, openid)` | 删除衣物数字档案 |
| `listGarmentProfiles(openid, limit)` | 列出用户档案 |
| `listByCategory(openid, category, limit)` | 按类别筛选 |
| `countGarmentProfiles(openid)` | 统计数量 |
| `batchCreate(profiles)` | 批量创建 |
| `preflightCheck(profileId, openid)` | 预处理检查 |
| `calculateSimilarity(profile1, profile2)` | 计算相似度 |
| `getGarmentAssetStatus(openid)` | 获取状态统计 |

---

## 二、数据库设计

### 2.1 garment_profiles 集合

```json
{
  "_id": "xxx",
  "garment_id": "yyy",           // 关联 garments 集合 ID
  "user_id": "openid_xxx",
  
  "category": "tops",            // 衣物类别
  "name": "白色纯色T恤",
  "size_label": "M",
  "measurements": {
    "lengthCm": 65,
    "chestWidthCm": 52,
    "shoulderWidthCm": 42,
    "sleeveLengthCm": 20
  },
  
  // 视觉特征
  "color": ["white"],
  "dominant_color": "white",
  "pattern": "solid",
  "style": "casual",
  "material": "cotton",
  
  // 使用场景
  "season": ["spring", "summer"],
  "occasion": ["daily", "casual"],
  
  // AI 分析结果（预留）
  "ai_tags": [],
  "features": {
    "silhouette": "regular",
    "fit": "regular",
    "length": "regular",
    "sleeve": "short",
    "neckline": "round"
  },
  "visual_embedding": "",
  
  // 状态
  "status": "ready",
  "error_code": "",
  "error_message": "",
  
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

### 2.2 枚举常量

```javascript
// 衣物类别
GARMENT_CATEGORY = {
  TOP: 'tops',
  BOTTOM: 'bottoms',
  DRESS: 'dress',
  ACCESSORY: 'accessory',
  SHOES: 'shoes',
  OTHER: 'other'
}

// 图案类型
PATTERN_TYPE = {
  SOLID: 'solid',
  STRIPE: 'stripe',
  PATTERN: 'pattern',
  LOGO: 'logo',
  FLORAL: 'floral',
  PLAID: 'plaid',
  POLKA_DOT: 'polka_dot',
  GRADIENT: 'gradient'
}

// 风格类型
STYLE_TYPE = {
  CASUAL: 'casual',
  FORMAL: 'formal',
  SPORTS: 'sports',
  VINTAGE: 'vintage',
  MODERN: 'modern',
  BOHEMIAN: 'bohemian',
  MINIMALIST: 'minimalist',
  STREETWEAR: 'streetwear'
}

// 材质类型
MATERIAL_TYPE = {
  COTTON: 'cotton',
  DENIM: 'denim',
  SILK: 'silk',
  WOOL: 'wool',
  LINEN: 'linen',
  LEATHER: 'leather',
  SYNTHETIC: 'synthetic',
  BLEND: 'blend',
  KNIT: 'knit',
  CHIFFON: 'chiffon',
  VELVET: 'velvet',
  OTHER: 'other'
}

// 季节类型
SEASON_TYPE = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
  ALL_SEASON: 'all_season'
}

// 场合类型
OCCASION_TYPE = {
  DAILY: 'daily',
  WORK: 'work',
  DATE: 'date',
  PARTY: 'party',
  SPORTS: 'sports',
  FORMAL: 'formal',
  CASUAL: 'casual',
  TRAVEL: 'travel'
}
```

---

## 三、兼容性设计

### 3.1 与 garments 集合的关系

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| garments._id | garment_profiles.garment_id | 关联 ID |
| garments.name | garment_profiles.name | 衣物名称 |
| garments.category | garment_profiles.category | 类别 |
| garments.size_label | garment_profiles.size_label | 尺码标签 |
| garments.measurements | garment_profiles.measurements | 尺寸数据 |
| n/a | garment_profiles.color | 颜色（新增） |
| n/a | garment_profiles.pattern | 图案（新增） |
| n/a | garment_profiles.style | 风格（新增） |
| n/a | garment_profiles.material | 材质（新增） |
| n/a | garment_profiles.season | 季节（新增） |
| n/a | garment_profiles.occasion | 场合（新增） |
| n/a | garment_profiles.ai_tags | AI 标签（预留） |
| n/a | garment_profiles.features | 视觉特征（预留） |

### 3.2 数据迁移策略

1. 新建 `garment_profiles` 集合
2. 保留原有 `garments` 集合不变
3. `importFromGarment()` 方法用于导入
4. 查询时优先查 `garment_profiles`，回退到 `garments`

---

## 四、使用示例

### 4.1 创建衣物档案

```javascript
const { getGarmentAssetService } = require('./cloudfunctions/services/garment-asset');

const service = getGarmentAssetService(db);

const result = await service.createGarmentProfile({
  garmentId: 'garment_xxx',
  openid: 'oXXXXX',
  metadata: {
    category: 'tops',
    name: '白色纯色T恤',
    size_label: 'M'
  }
});
```

### 4.2 从 garments 导入

```javascript
const garment = await db.collection('garments').doc('garment_xxx').get();
const profile = await service.importFromGarment(garment.data, 'oXXXXX');
```

### 4.3 计算相似度

```javascript
const similarity = service.calculateSimilarity(profile1, profile2);
// { similarity: 75.5, matching: true }
```

---

## 五、测试验证

### 5.1 语法检查

```bash
node --check cloudfunctions/services/garment-asset/index.js    # OK
node --check cloudfunctions/services/garment-asset/repository.js  # OK
node --check cloudfunctions/services/garment-asset/analyzer.js   # OK
node --check cloudfunctions/services/garment-asset/types.js      # OK
```

### 5.2 模块加载

```javascript
const svc = require('./cloudfunctions/services/garment-asset');
console.log(typeof svc.getGarmentAssetService);  // 'function'
```

---

## 六、后续步骤

### Phase 4: AI 优化

1. 实现自动色彩提取（可选）
2. 接入图案识别 API（可选）
3. 实现相似推荐算法

---

## 七、禁止事项验证

- ✅ 未修改 cloudfunctions/aiTryon/
- ✅ 未修改 cloudfunctions/services/tryon-engine/
- ✅ 未修改 cloudfunctions/services/person-asset/
- ✅ 未修改 miniprogram/
- ✅ 未接入任何 AI 模型
- ✅ 保留现有 garments 集合不变

---

*Phase 3 实现完成。*
