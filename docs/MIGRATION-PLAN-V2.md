# V2 迁移计划

> **日期:** 2026-08-27（V2 基线校正）
> **当前基线:** feature/garment-lifecycle-v0.1
> **目标:** 从当前 V1 代码平滑迁移到 V2 架构

---

## 一、迁移原则

1. **不破坏生产**：所有变更在 feature 分支进行，main 保持不变
2. **增量迁移**：分阶段实施，每阶段独立可验证、可回滚
3. **向后兼容**：新代码兼容旧数据格式，数据库不做破坏性迁移
4. **可回滚**：每个阶段都有明确的回滚方案

---

## 二、阶段总览（当前真实进度）

### Phase 0 — Specification Freeze（规格冻结）✅ 已完成

- PRD V2
- Architecture V2
- Migration Plan V2（本文档）

### Phase 1 — Try-On Engine Foundation（试穿引擎基础）✅ 已完成

- Provider 抽象接口
- TryOnRouter（策略路由）
- Agnes Provider（现有生产能力保留）
- Aliyun Provider 接口（未强制接入生产）
- Mock Provider

### Phase 2 — Person Asset Foundation（人物资产基础）✅ 已完成

- person-asset service
- person_assets 数据层
- 与 avatar_views 兼容

### Phase 3 — Garment Asset Foundation（衣物资产基础）✅ 已完成（本次收口后）

- garment-asset service
- garment_profiles 数据层（仅扩展资料，不含 garments 越界字段）
- 与 garments 关联（garment_id → garments._id，一件衣物最多一个 profile）
- ownership 限制（user_id === 当前 openid）
- lazy create（getOrCreateGarmentProfile 真实实现）

### Phase 4 — Production Try-On Integration（生产试穿接入）⏳ 当前待开始

内容只写：

1. 统一人物输入
2. 统一衣物输入
3. 将 aiTryon 接入 Try-On Engine
4. 保留旧 Agnes 能力
5. 暂不强制切换 Provider
6. 增加 feature flag
7. 保证旧链路可回滚

暂时不写（须在真正接入后再决定）：

- 阿里云必须成为生产 Provider
- Agnes 必须退出
- 灰度比例
- 模型优劣结论

---

## 三、Phase 4 任务清单（待开始，仅规划）

| # | 任务 | 说明 |
|---|------|------|
| 4.1 | 统一人物输入接口 | 以 person_assets 为统一来源 |
| 4.2 | 统一衣物输入接口 | 以 garments + garment_profiles 为统一来源 |
| 4.3 | aiTryon 接入 Try-On Engine | 业务层统一经 tryOn.generate() |
| 4.4 | 保留旧 Agnes 链路 | 可回滚，不删除 |
| 4.5 | 增加 feature flag | 控制新旧引擎切换 |
| 4.6 | 旧链路回归验证 | 保证回滚可用 |

---

## 四、回滚方案

### 4.1 代码回滚

```bash
git revert <commit-hash>
```

### 4.2 功能回滚

```javascript
const USE_NEW_ENGINE = process.env.USE_NEW_ENGINE === 'true';
if (USE_NEW_ENGINE) { /* 新 tryon-engine */ } else { /* 旧 aiTryon */ }
```

### 4.3 数据回滚

- 只新增字段，不删除字段
- 新字段有默认值
- 旧代码可忽略新字段

---

## 五、风险清单

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| VTON API 效果不达预期 | 高 | 保留 Agnes 降级方案 |
| 成本超出预算 | 高 | 成本路由 + 额度控制 |
| 数据迁移出错 | 中 | 迁移前备份 + 灰度验证 |
| Provider API 变更 | 中 | Provider 抽象层隔离 |
| 微信审核驳回 | 中 | 提前咨询 + 备案并行 |

---

## 六、当前状态

| Phase | 状态 | 备注 |
|-------|------|------|
| Phase 0 | ✅ 已完成 | 规格冻结（PRD/Architecture/Migration Plan） |
| Phase 1 | ✅ 已完成 | Try-On Engine 基础（Provider/Router/Agnes/Mock） |
| Phase 2 | ✅ 已完成 | Person Asset 基础 |
| Phase 3 | ✅ 已完成 | Garment Asset 基础（本次收口） |
| Phase 4 | ⏳ 待开始 | 生产试穿接入（未接入任何新 Provider） |

---

*本文档为 V2 迁移唯一依据。Phase 4 及以后不在本任务范围内。*
*最后更新：2026-08-27*
