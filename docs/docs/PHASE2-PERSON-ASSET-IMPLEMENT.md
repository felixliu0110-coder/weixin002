# Phase 2: Person Asset 基础系统实现报告

> **日期:** 2026-08-27  
> **分支:** feature/garment-lifecycle-v0.1  
> **状态:** ✅ 完成

---

## 一、实现内容

### 1.1 新增文件清单

```
cloudfunctions/services/person-asset/
├── index.js        # 服务入口，导出 CRUD 方法
├── repository.js   # 数据库操作层
├── analyzer.js     # 基础分析能力（不含 AI）
└── types.js        # 类型定义和常量
```

### 1.2 核心能力

| 方法 | 说明 |
|------|------|
| `createPersonAsset(params)` | 创建人物资产 |
| `getPersonAsset(assetId, openid)` | 获取人物资产 |
| `getCurrentPersonAsset(openid)` | 获取当前用户最新资产 |
| `updatePersonAnalysis(assetId, openid, analysis)` | 更新人物分析 |
| `setAnchorImage(assetId, openid, fileID, provider)` | 设置锚定图 |
| `setOriginalPhoto(assetId, openid, fileID)` | 设置原始照片 |
| `deletePersonAsset(assetId, openid)` | 删除人物资产 |
| `listPersonAssets(openid, limit)` | 列出用户资产 |
| `getPersonAssetStatus(openid)` | 获取资产状态 |
| `preflightCheck(assetId, openid)` | 预处理检查 |

---

## 二、数据结构

### 2.1 person_assets 集合

```json
{
  "_id": "xxx",
  "user_id": "openid_xxx",
  "openid": "openid_xxx",
  "avatar_profile_id": "yyy",
  
  "original_photo": "cloud://env.xxx/xxx.jpg",
  "front_photo": "cloud://env.xxx/xxx.jpg",
  "anchor_image": "cloud://env.xxx/xxx.jpg",
  "three_view_composite": "cloud://env.xxx/xxx.jpg",
  
  "source": "upload",
  "provider": "agnes",
  
  "body_analysis": {
    "height_cm": 175,
    "weight_kg": 70,
    "skin_tone": "natural",
    "body_type": "normal",
    "confidence": 0.7
  },
  
  "status": "ready",
  "error_code": "",
  "error_message": "",
  
  "created_at": 1234567890,
  "updated_at": 1234567890
}
```

### 2.2 枚举常量

```javascript
// 人物来源
PERSON_SOURCE = {
  UPLOAD: 'upload',
  GENERATED: 'generated'
}

// 资产状态
ASSET_STATUS = {
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
}

// 图片类型
IMAGE_TYPE = {
  ORIGINAL: 'original',
  ANCHOR: 'anchor',
  THREE_VIEW: 'three_view',
  ANALYSIS: 'analysis'
}
```

---

## 三、兼容性设计

### 3.1 与 avatar_views 的关系

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| avatar_views.views.composite | person_assets.three_view_composite | 三视图合成图 |
| avatar_views.provider | person_assets.provider | Provider |
| avatar_views.status | person_assets.status | 状态 |
| n/a | person_assets.original_photo | 用户上传原图（新增） |
| n/a | person_assets.anchor_image | AI 生成锚定图（新增） |

### 3.2 兼容查询

`getCompatible()` 方法：
1. 优先查询 `person_assets`
2. 如果不存在，回退到 `avatar_views`
3. 返回统一格式

---

## 四、使用示例

### 4.1 创建人物资产

```javascript
const { getPersonAssetService } = require('./cloudfunctions/services/person-asset');

const service = getPersonAssetService(db);

const result = await service.createPersonAsset({
  openid: 'oXXXXX',
  avatarProfileId: 'profile_xxx',
  originalPhoto: 'cloud://env.xxx/photo.jpg'
});
```

### 4.2 设置锚定图

```javascript
await service.setAnchorImage(
  assetId,
  openid,
  'cloud://env.xxx/anchor.jpg',
  'agnes'
);
```

### 4.3 获取当前资产

```javascript
const asset = await service.getCurrentPersonAsset(openid);
```

---

## 五、测试验证

### 5.1 语法检查

```bash
node --check cloudfunctions/services/person-asset/index.js   # OK
node --check cloudfunctions/services/person-asset/repository.js  # OK
node --check cloudfunctions/services/person-asset/analyzer.js   # OK
node --check cloudfunctions/services/person-asset/types.js      # OK
```

### 5.2 模块加载

```javascript
const { getPersonAssetService } = require('./cloudfunctions/services/person-asset');
// ✅ Module loaded OK
```

---

## 六、后续步骤

### Phase 3: Provider 接入

1. 配置 AGNES_API_KEY
2. 配置 DASHSCOPE_API_KEY
3. 实现 `createAnchorImage()` 方法
4. 连接 tryon-engine 进行试穿

### Phase 4: 前端集成

1. 修改 photo-upload 页面
2. 支持原始照片上传
3. 显示人物资产状态

---

## 七、禁止事项验证

- ✅ 未修改 cloudfunctions/aiTryon/
- ✅ 未修改 cloudfunctions/services/tryon-engine/
- ✅ 未修改 miniprogram/
- ✅ 未接入任何 AI 模型
- ✅ 未修改前端

---

*Phase 2 实现完成。*
