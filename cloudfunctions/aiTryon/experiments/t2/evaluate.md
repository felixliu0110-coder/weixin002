# T2 Benchmark 评估指南

## 评估方法

实验完成后，对每个 SUCCESS 结果进行人工评分（0-5 分制）：

### 评分表模板

```json
{
  "experimentId": "A-person-a-garment-1",
  "provider": "A",
  "resultUrl": "https://...",
  "scores": {
    "garmentIdentity": 3,
    "fitSilhouette": 2,
    "logoTexture": 2,
    "personConsistency": 2,
    "naturalness": 2,
    "cost": 5,
    "speed": 4
  },
  "totalScore": 18,
  "maxScore": 55,
  "notes": "服装颜色略有偏差，人物面部基本一致"
}
```

### 评分标准

| 分数 | 标准 |
|------|------|
| 5 | 完美，无可挑剔 |
| 4 | 优秀，微小瑕疵 |
| 3 | 良好，有明显瑕疵但不影响使用 |
| 2 | 一般，瑕疵明显 |
| 1 | 差，基本不可用 |
| 0 | 完全失败 |

### 成本/速度评分说明

- **成本**：按实际价格换算，Agnes 得 5 分，aitryon 得 2-3 分，aitryon-plus 得 1-2 分
- **速度**：30s 以内得 5 分，30-60s 得 3 分，60s+ 得 1 分

## 横向对比方法

对每个人物 × 每件衣物的 3 个结果进行盲评：
1. 打乱顺序，隐藏 Provider 标签
2. 分别打分
3. 恢复顺序，统计平均分

## 决策标准

| 条件 | 决策 |
|------|------|
| aitryon 平均分 > Agnes + 20% | 生产迁移到 aitryon |
| aitryon-plus 平均分 > aitryon + 15% | 考虑使用 plus |
| Agnes 平均分 > aitryon | 保留 Agnes |
| 所有 Provider 平均分 < 3 | 需要更高级模型（如 IDM-VTON） |
