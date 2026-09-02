# T0 Try-On Capability Benchmark

## 实验说明

本目录存放 T0 真实 Try-On 能力基线实验的数据和脚本。

### 文件列表

- `t0-benchmark.js` — 在微信开发者工具控制台中执行的 T0 实验脚本
- `results.json` — 实验结果记录（实验完成后填写）

### 执行方法

**方法一：微信开发者工具控制台（推荐）**

1. 打开微信开发者工具，加载 `D:\weixin002` 项目
2. 切换到「调试器 → Console」面板
3. 将 `t0-benchmark.js` 的内容全部复制粘贴到控制台
4. 按 Enter 执行
5. 观察输出，记录 avatarViewId、garmentId、taskId、result URL

**方法二：miniprogram-automator（需 DevTools 开启调试）**

```bash
# 在微信开发者工具中开启调试端口（默认 9420 或 15066）
cd miniprogram
node scripts/auto-t0-benchmark.js
```

### 实验设计

| 实验 | 输入 | 目的 |
|---|---|---|
| T0-A | avatarComposite + garmentOriginal | 生产链路 baseline |
| T0-B | garmentOriginal only | 验证 Agnes 对单件衣物的理解 |
| T0-C | avatarComposite only | 验证人物 identity 保持能力 |
| T0-D | garment + avatar（顺序交换） | 验证 refImages 顺序敏感性 |

### 评分表

每个生成结果从以下维度评分（0-5）：

| 维度 | 说明 |
|---|---|
| Garment identity | 衣服是否像原图 |
| Garment color | 颜色是否一致 |
| Garment pattern/logo | 图案/Logo 是否保留 |
| Garment silhouette | 版型/轮廓是否正确 |
| Collar | 领口是否准确 |
| Sleeves | 袖子是否准确 |
| Length | 衣长比例是否合理 |
| Material appearance | 面料质感是否真实 |
| Human identity | 人脸是否与 avatar 一致 |
| Body proportions | 身材比例是否合理 |
| Overall naturalness | 整体穿着自然度 |

总分 = 各维度之和（满分 55）