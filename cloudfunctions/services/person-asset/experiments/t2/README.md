# T2 Real VTON Benchmark

> **Status:** POC / Research — 不修改生产代码  
> **Branch:** feature/garment-lifecycle-v0.1  
> **Date:** 2026-08-26

---

## 一、目标

验证专业 AI 试衣模型是否明显优于当前 Agnes 通用图生图方案。

| 实验组 | 说明 |
|--------|------|
| **A: Agnes baseline** | 当前生产链路（agnes-image-2.1-flash + refImages） |
| **B: aitryon（标准版）** | 阿里云百炼 AI试衣 API 基础版 |
| **C: aitryon-plus（高级版）** | 阿里云百炼 AI试衣 Plus API |

## 二、实验矩阵

- **人物 × 2**：至少 2 个真实全身正面照
- **服装 × 5**：白色纯色 T-shirt、条纹衬衫、图案/Logo 上衣、牛仔裤、半身裙/连衣裙
- **每组 × 3 种 Provider** = 30 个实验样本

## 三、评分维度（满分 100）

| 维度 | 权重 | 说明 |
|------|------|------|
| 衣服身份保持 | 30 | 颜色/图案/版型与参考图一致 |
| 版型保持 | 20 | 服装剪裁、廓形准确 |
| Logo/纹理 | 15 | 细节纹理、印花保留度 |
| 人物一致性 | 15 | 面部/体型与参考人物一致 |
| 穿着自然度 | 10 | 褶皱、垂坠、贴合真实感 |
| 成本 | 5 | 单次生成成本（越低越好） |
| 速度 | 5 | 延迟（越低越好） |

## 四、阻塞条件

| ID | 阻塞项 | 严重程度 | 处理 |
|----|--------|---------|------|
| B1 | AGNES_API_KEY 未配置 | P0 | BLOCKED：A 组无法执行 |
| B2 | ALIYUN_API_KEY 未配置 | P0 | BLOCKED：B/C 组无法执行 |
| B3 | 无可用人物全身正面图 | P1 | 使用项目内现有图片（p17-avatar.jpg） |
| B4 | 无可用衣物图 | P1 | 使用项目内现有图片 |

## 五、输出

- `docs/research/t2-real-vton-benchmark.md` — 完整研究报告
- `experiments/t2/README.md` — 本文件
- `experiments/t2/cases.json` — 实验用例定义
- `experiments/t2/results.json` — 实验结果
- `experiments/t2/evaluate.md` — 评估分析

## 六、执行方式

```bash
# 本地执行（需配置环境变量）
node experiments/t2/t2-runner.js

# 或部署到云函数后调用
wx.cloud.callFunction({ name: 'experimentsT2', data: { action: 'run' } })
```

## 七、隔离保证

- 不修改 `cloudfunctions/aiTryon/` 任何文件
- 不修改 `miniprogram/` 任何文件
- 不写生产数据库集合（tryon_tasks / tryon_results / garments / avatar_views）
- API Key 仅从环境变量读取，不写入代码/Git
