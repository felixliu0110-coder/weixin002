# V2 开发总约束（Development Contract）

> **日期:** 2026-08-27
> **分支:** feature/garment-lifecycle-v0.1
> **性质:** V2 开发共同契约，所有阶段必须遵守

---

## 一、产品原则

**AI 智能衣橱**

- ✅ 是个人数字形象管理 + 数字化衣橱 + AI 穿搭辅助
- ❌ **不是** AI 生图工具
- ❌ **不是** VTON 套壳
- ❌ **不是** 阿里云套壳

判断准绳：任何新增能力必须服务于"用户身体数据 + 个人衣橱 + AI 穿搭辅助"的核心闭环；纯模型 demo、纯套壳能力不在产品范围内。

---

## 二、技术原则

- **不训练基础模型**：不自建/微调基础生成模型，成本与能力均不可控
- **不自建 GPU 推理集群**：运维复杂、成本不可预测，优先使用托管 Provider
- **Provider 可替换**：所有 AI 能力经 Provider 抽象层，一键切换，不绑定单一供应商
- **业务层不能直接调用 Provider**：业务云函数 → tryon-engine / asset service → Provider Adapter → 具体 Provider
- **数据资产归项目**：用户数据不归供应商，存储于项目云存储/云数据库
- **成本可控**：单次试穿成本透明，支持成本路由与额度控制

---

## 三、开发纪律

1. **影响范围先行**：生产代码改动前必须先说明影响范围（涉及哪些集合/云函数/前端页面/Provider），经确认后再改
2. **数据库不做破坏性迁移**：只新增字段、不删除字段、新字段有默认值、旧代码可忽略新字段
3. **旧数据必须兼容**：迁移脚本可逆，旧数据可正常读取
4. **每一阶段独立可回滚**：单个阶段失败可独立 revert，不影响其它阶段
5. **不提前实现下一阶段功能**：Phase N 的代码/配置不得提前承担 Phase N+1 的职责（如 Phase 3 不承担推荐/相似度/Provider 接入）

---

## 四、当前真实进度

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 0 — Specification Freeze | ✅ 已完成 | PRD V2 / Architecture V2 / Migration Plan V2 |
| Phase 1 — Try-On Engine Foundation | ✅ 已完成 | Provider 抽象 / Router / Agnes / Aliyun 接口 / Mock |
| Phase 2 — Person Asset Foundation | ✅ 已完成 | person-asset service / person_assets / 兼容 avatar_views |
| Phase 3 — Garment Asset Foundation | ✅ 已完成（本次收口后） | garment-asset service / garment_profiles / ownership / lazy create |
| Phase 4 — Production Try-On Integration | ⏳ 待开始 | 统一输入输出、aiTryon 接入 Try-On Engine、保留旧 Agnes 可回滚 |

---

## 五、与本次收口的关系

本契约由 Phase 3 收口同步确立，作为后续 Phase 4 及更远期开发的约束基线。本次收口仅修正 garment-asset 越界实现与文档状态，**不**修改前端、**不**修改生产 Try-On、**不**接入任何新 Provider。

---

*最后更新：2026-08-27*
