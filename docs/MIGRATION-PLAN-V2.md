# V2 迁移计划

> **日期:** 2026-08-27  
> **当前基线:** feature/garment-lifecycle-v0.1  
> **目标:** 从当前 V1 代码平滑迁移到 V2 架构

---

## 一、迁移原则

1. **不破坏生产**：所有变更在 feature 分支进行，main 保持不变
2. **增量迁移**：分阶段实施，每阶段可独立验证
3. **向后兼容**：新代码兼容旧数据格式
4. **可回滚**：每个阶段都有明确的回滚方案

---

## 二、当前代码分析

### 2.1 现有云函数（8 个）

| 云函数 | 职责 | V2 去向 | 状态 |
|--------|------|---------|------|
| `auth` | 登录、档案读写 | 保留，增强 | ✅ 无需大改 |
| `createAvatarViews` | 人物三视图生成 | → `person-assets` | ⚠️ 重构 |
| `uploadGarment` | 衣物上传 | → `wardrobe` | ⚠️ 增强 |
| `aiTryon` | 试穿提交/状态/历史 | → `tryon-engine` | 🔴 大改 |
| `ensureGarmentViews` | 服装四视图（实验性） | 保留但标记实验性 | ✅ 不迁移 |
| `onTryonComplete` | 回调入口 | 保留 | ✅ 无需大改 |
| `cleanup` | 定时清理 | 保留 | ✅ 无需大改 |
| `services/` | 共享模块 | 重组 | ⚠️ 新增 Provider 层 |

### 2.2 现有数据集合（9 个）

| 集合 | V2 状态 | 变更 |
|------|---------|------|
| `avatar_profiles` | 保留 | 字段兼容 |
| `avatar_views` | → `person_assets` | 重命名/扩展 |
| `garments` | 保留 | 新增字段 |
| `garment_views` | 保留（实验性） | 不变 |
| `tryon_tasks` | 保留 | 新增字段 |
| `tryon_results` | 保留 | 兼容 |
| `favorites` | 保留 | 不变 |
| `quotas` | 保留 | 不变 |
| `deletion_jobs` | 保留 | 不变 |
| `tryon_v2_experiments` | 新增 | 实验数据隔离 |

---

## 三、迁移阶段

### Phase 1: 架构准备（Week 1-2）

**目标：** 建立新架构基础，不改变生产行为

#### 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 创建 `cloudfunctions/tryon-engine/` | 新增目录 | 新试穿引擎云函数 |
| 1.2 | 定义 `services/Provider.js` | 新增文件 | Provider 抽象接口 |
| 1.3 | 迁移 `aigc-agnes.js` → `AgnesProvider.js` | 移动+改写 | 适配新接口 |
| 1.4 | 创建 `services/TryOnRouter.js` | 新增文件 | 策略路由器 |
| 1.5 | 创建 `services/CostRouter.js` | 新增文件 | 成本路由器 |
| 1.6 | 单元测试 | `services/*.test.js` | 覆盖率 > 80% |

#### 验收标准

- [ ] `node --check` 通过所有新增文件
- [ ] 单元测试全部通过
- [ ] 现有云函数不受影响

#### 不变更

- ❌ 不修改 `cloudfunctions/aiTryon/`
- ❌ 不修改数据库 schema
- ❌ 不修改前端代码

---

### Phase 2: 数据迁移（Week 3-4）

**目标：** 扩展数据模型，兼容新旧格式

#### 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 2.1 | 扩展 `avatar_views` 集合 | 数据库操作 | 新增 `person_photo` 字段 |
| 2.2 | 创建 `person_assets` 逻辑层 | 新代码 | 管理人物资产生命周期 |
| 2.3 | 增强 `garments` 集合 | 数据库操作 | 新增 `measurements` 字段支持 |
| 2.4 | 创建 `garment_profiles` 集合 | 数据库操作 | 存储衣物数字特征 |
| 2.5 | 数据迁移脚本 | `scripts/migrate-v2.js` | 兼容旧数据 |

#### 验收标准

- [ ] 旧数据可正常读取
- [ ] 新字段可选填写
- [ ] 迁移脚本可逆

#### 不变更

- ❌ 不删除任何现有字段
- ❌ 不强制用户重新录入数据

---

### Phase 3: Provider 接入（Week 5-7）

**目标：** 接入专业 VTON Provider

#### 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 3.1 | 实现 `AliyunTryOnProvider.js` | 新增 | aitryon 标准版 |
| 3.2 | 实现 `AliyunTryOnPlusProvider.js` | 新增 | aitryon-plus |
| 3.3 | 接入 `experimentsTryOnV2` 代码 | 迁移 | 将实验代码转正 |
| 3.4 | 实现质量检测模块 | 新增 | 自动生成后质量验证 |
| 3.5 | V2-POC-01 真实执行 | 实验 | 对比 CASE-A vs CASE-B |
| 3.6 | 人工评估并记录结果 | `evaluate.md` | 填充评分数据 |

#### 验收标准

- [ ] aitryon-plus 试穿成功率 > 80%
- [ ] 服装还原度评分 > Agnes baseline
- [ ] 实验结果已记录并评估

#### 不变更

- ❌ 不删除现有 Agnes 链路
- ❌ 不修改生产 aiTryon 云函数

---

### Phase 4: 生产切换（Week 8-11）

**目标：** 逐步切换到新架构

#### 任务清单

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 4.1 | 灰度发布：10% 用户使用新引擎 | 配置开关 | 可控切换 |
| 4.2 | 监控指标：成功率/延迟/成本 | 运维 | 实时监控 |
| 4.3 | 问题修复与优化 | 迭代 | 根据反馈调整 |
| 4.4 | 全量切换：100% 用户使用新引擎 | 配置开关 | 正式切换 |
| 4.5 | 标记旧代码为 Deprecated | 代码注释 | 准备清理 |
| 4.6 | 清理不再使用的代码 | 可选 | Phase 5 |

#### 验收标准

- [ ] 生产环境无 P0 问题
- [ ] 生成成功率 ≥ 85%
- [ ] 平均延迟 < 60s
- [ ] 月成本在预算内

---

## 四、回滚方案

### 4.1 代码回滚

```bash
# 任一阶段出现问题，回退到上一 commit
git revert <commit-hash>
```

### 4.2 功能回滚

```javascript
// 通过环境变量开关控制
const USE_NEW_ENGINE = process.env.USE_NEW_ENGINE === 'true';
if (USE_NEW_ENGINE) {
  // 使用新 tryon-engine
} else {
  // 回退到旧 aiTryon
}
```

### 4.3 数据回滚

```
数据库变更采用增量方式：
- 只新增字段，不删除字段
- 新字段有默认值
- 旧代码可以忽略新字段
```

---

## 五、风险清单

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|----------|
| VTON API 效果不达预期 | 高 | 产品质量 | 保留 Agnes 降级方案 |
| 成本超出预算 | 高 | 商业模式 | 成本路由 + 额度控制 |
| 数据迁移出错 | 中 | 用户数据丢失 | 迁移前备份 + 灰度验证 |
| Provider API 变更 | 中 | 服务中断 | Provider 抽象层隔离 |
| 微信审核驳回 | 中 | 上线延迟 | 提前咨询 + 备案并行 |
| 深度合成备案周期 | 中 | 合规风险 | 优先接入已备案 Provider |

---

## 六、文档与代码映射

### 6.1 新增文件清单

```
cloudfunctions/
  tryon-engine/           # 新试穿引擎
    index.js
    submit.js
    status.js
    history.js
    router.js
    cost-router.js
    services/
      Provider.js
      AgnesProvider.js
      AliyunTryOnProvider.js
      AliyunTryOnPlusProvider.js
      MockProvider.js

docs/
  PRD-AI-Wardrobe-V2.md    # V2 产品规格
  ARCHITECTURE-AI-WARDROBE-V2.md  # V2 技术架构
  MIGRATION-PLAN-V2.md    # 本迁移计划

scripts/
  migrate-v2.js           # 数据迁移脚本
  sync-cloud-services.js  # 已有，增强
```

### 6.2 修改文件清单（仅新增，不修改生产）

```
cloudfunctions/services/
  aigc.js                 # 新增 getProvider() 方法
  storage.js              # 增强下载逻辑

miniprogram/               # 可选，后续阶段
  utils/api.js            # 新增 tryon-engine 接口
  pages/tryon-select/     # 策略选择 UI（可选）
```

---

## 七、Checklist

### Phase 1 完成标准

- [ ] `cloudfunctions/tryon-engine/` 目录创建
- [ ] `services/Provider.js` 接口定义
- [ ] `services/AgnesProvider.js` 实现
- [ ] `services/TryOnRouter.js` 实现
- [ ] 单元测试通过
- [ ] `node --check` 通过
- [ ] 现有云函数不受影响

### Phase 2 完成标准

- [ ] `avatar_views` 集合新增 `person_photo` 字段
- [ ] `garments` 集合支持 `measurements` 字段
- [ ] 数据迁移脚本可逆
- [ ] 旧数据可正常读取

### Phase 3 完成标准

- [ ] `AliyunTryOnProvider.js` 实现
- [ ] `AliyunTryOnPlusProvider.js` 实现
- [ ] V2-POC-01 实验完成
- [ ] 人工评估完成
- [ ] 实验结果记录在 `experiments/tryon-v2/`

### Phase 4 完成标准

- [ ] 灰度发布 10% 用户
- [ ] 监控指标正常
- [ ] 全量切换完成
- [ ] 旧代码标记 Deprecated

---

## 八、当前状态

| Phase | 状态 | 备注 |
|-------|------|------|
| Phase 1 | 🔄 进行中 | 本 PR 创建文档规格 |
| Phase 2 | ⏳ 待开始 | 数据迁移 |
| Phase 3 | ⏳ 待开始 | Provider 接入 |
| Phase 4 | ⏳ 待开始 | 生产切换 |

---

*本文档为 V2 迁移唯一依据。*
*最后更新：2026-08-27*
