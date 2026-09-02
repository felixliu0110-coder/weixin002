# Phase 3: Garment Asset 基础系统实现报告（收口版）

> **日期:** 2026-08-27（V2 基线校正收口）
> **分支:** feature/garment-lifecycle-v0.1
> **状态:** ✅ 完成（已收口，边界明确）

---

## 一、实现内容

### 1.1 文件清单

```
cloudfunctions/services/garment-asset/
├── index.js          # 服务入口，公开 API（收口）
├── repository.js     # 数据库操作层（ownership 限制 + getOrCreate）
├── analyzer.js       # generateReport / preflightCheck（无 AI/网络）
├── types.js          # 类型定义、schema、validate/createDefaultDoc/mapFromGarment
├── types.test.js     # 类型与边界测试
├── analyzer.test.js  # 分析器测试
├── repository.test.js# 仓库/ownership/getOrCreate 测试
├── index.test.js     # 公开 API 收口测试
└── getOrCreate.test.js # getOrCreate 完整流程测试
```

### 1.2 garment_profiles 的正式职责

`garments` 是衣物实体；`garment_profiles` 是衣物理解**扩展资料**。
关系：`garments._id` → `garment_profiles.garment_id`，一件衣物最多一个 profile。

**允许字段：** garment_id / user_id / category / color / style / material / pattern / season / occasion / ai_tags / features / source / status / created_at / updated_at

**禁止字段（仍属 garments）：** name / original_file_id / size_label / measurements / type

### 1.3 公开 API（仅下列）

| 方法 | 说明 |
|------|------|
| `createGarmentProfile()` | 创建衣物数字档案 |
| `getGarmentProfile()` | 按 profileId 获取（归属校验） |
| `getGarmentProfileByGarmentId()` | 按 garmentId 获取（归属校验） |
| `updateGarmentProfile()` | 更新（仅当前用户） |
| `deleteGarmentProfile()` | 删除（仅当前用户） |
| `listGarmentProfiles()` | 列出当前用户档案 |
| `getOrCreateGarmentProfile()` | 真实 getOrCreate（见下文流程） |
| `preflightCheck()` | 预处理检查 |

**已删除（不在此阶段承担）：** importFromGarment / batchCreate / calculateSimilarity / listByCategory / countGarmentProfiles / updateStatus / getGarmentAssetStatus，以及推荐/相似度/批量迁移/AI 分析/统计业务。

---

## 二、getOrCreateGarmentProfile 真实流程

```
garmentId
  ↓ 读取 garments
不存在 → NOT_FOUND
  ↓ ownership 校验（user_id !== openid → FORBIDDEN）
builtin → FORBIDDEN
  ↓ status != ready → INVALID_ARGUMENT
查询 garment_profiles（garment_id + user_id）
  ↓ 存在 → 返回
不存在 → 新建（category 从 garments.category 初始化，source=manual，status=ready）
```

禁止返回未经 profile 创建流程处理的 garments 对象冒充 profile。

---

## 三、analyzer.js 边界

- `generateReport()`：仅读取已有 profile 字段生成报告，不推断新服装属性。
- `preflightCheck()`：仅基于已有字段做校验。
- **禁止：** AI API / 网络调用 / Embedding / 向量 / 相似推荐 / 自动品类识别 / 模型调用。

---

## 四、测试验证

### 4.1 语法检查

```bash
node --check cloudfunctions/services/garment-asset/index.js    # OK
node --check cloudfunctions/services/garment-asset/repository.js  # OK
node --check cloudfunctions/services/garment-asset/analyzer.js   # OK
node --check cloudfunctions/services/garment-asset/types.js      # OK
```

### 4.2 单元测试（Phase 3 全部通过）

- types.test.js：mapFromGarment 不含越界字段、createDefaultDoc 正确、缺字段失败、拒绝越界字段
- analyzer.test.js：generateReport/preflightCheck 行为正确
- repository.test.js：ownership/builtin/非 ready/已有不重复/create 初始化/更新删除仅当前用户
- index.test.js：公开 API 收口、创建/getOrCreate/更新删除归属
- getOrCreate.test.js：完整 getOrCreate 流程（NOT_FOUND/FORBIDDEN/INVALID_ARGUMENT/初始化/复用/不冒充 garments）

> **环境说明：** 本地 Node 无法模拟微信云数据库原生链；本套件使用兼容微信链式 API（collection/doc/where/limit/orderBy/get/add/update/remove）的 fakeDB 运行可观测行为断言，不伪造通过。tryon-engine / person-asset 目录当前无 `*.test.js` 文件，本次收口未新增其测试，仅确认未修改其代码。

---

## 五、禁止事项验证

- ✅ 未修改 cloudfunctions/aiTryon/
- ✅ 未修改 cloudfunctions/uploadGarment/
- ✅ 未修改 cloudfunctions/services/tryon-engine/
- ✅ 未修改 cloudfunctions/services/person-asset/
- ✅ 未修改 miniprogram/
- ✅ 未修改 garments / avatar_views schema
- ✅ 未接入阿里云真实 API / Agnes 新 API
- ✅ 未修改生产 Prompt / quota / cache
- ✅ 保留现有 garments 集合不变

---

*Phase 3 收口完成。Phase 4 不在本任务范围内，待后续单独启动。*
