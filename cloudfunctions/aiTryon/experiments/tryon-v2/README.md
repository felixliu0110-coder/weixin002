# V2-POC-01：真实 Try-On 最小实验

> **执行日期:** 2026-08-26  
> **分支:** feature/garment-lifecycle-v0.1  
> **环境:** 微信云开发 cloud1-d8gt95vnl0ec35c4f

---

## 一、实验目的

验证一个问题：

> **真实人物照片作为 Try-On 人物输入，是否比当前 Avatar Composite 更适合作为专业 VTON 输入？**

这是 T2 研究得出的核心假设。本轮只做一次最小对照实验，不扩展其他变量。

## 二、为什么只做两个 Case

| Case | 人物来源 | 衣物来源 | 目的 |
|------|---------|---------|------|
| **CASE-A** | 用户真实 body_photo | 用户上传真实 garment | 验证真实照片输入效果 |
| **CASE-B** | avatar_views.composite | 同一件真实 garment | 验证当前合成图输入效果 |

**唯一变量 = personSourceType**  
所有其他条件（衣物、模型、参数、分辨率）完全一致。

## 三、只使用一个 Provider

- **Provider:** Alibaba Cloud aitryon-plus
- **禁止:** aitryon 标准版 / FASHN / Agnes Try-On / Refiner / Parsing / 多 Provider / Router

## 四、官方 API 地址

```
POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis
Headers:
  Content-Type: application/json
  Authorization: Bearer $DASHSCOPE_API_KEY
  X-DashScope-Async: enable

Body:
{
  "model": "aitryon-plus",
  "input": {
    "person_image_url": "...",
    "top_garment_url": "..."
  },
  "parameters": {
    "resolution": -1,
    "restore_face": true
  }
}
```

## 五、模型参数

| 参数 | 值 | 说明 |
|------|-----|------|
| model | aitryon-plus | 高级版 VTON 模型 |
| resolution | -1 | 默认分辨率（按输入自适应） |
| restore_face | true | 启用人脸修复 |
| X-DashScope-Async | enable | 异步任务模式 |

## 六、API Key 来源

- 环境变量：`DASHSCOPE_API_KEY`
- **不写入代码 / 不提交 Git**
- 仅从云函数环境变量读取
- 如果未配置，实验状态标记为 `BLOCKED_API_KEY_MISSING`

## 七、结果 URL 有效期处理

阿里云 DashScope 返回的结果 URL 仅 **24 小时有效**。

实验云函数在任务 SUCCEEDED 后：
1. 立即用 `https.get()` 下载图片二进制
2. 上传到微信云存储（独立目录 `tryon_v2_experiments/`）
3. 记录云存储 fileID 作为永久结果

**不信任临时 URL 作为最终结果。**

## 八、人工评估方法

生成后，由人工在 `experiments/tryon-v2/evaluate.md` 中填写评分：

| 维度 | 权重 | 评分（0-5） |
|------|------|------------|
| 服装身份还原 | 30 | _ |
| 版型/结构 | 20 | _ |
| Logo/图案/纹理 | 15 | _ |
| 人物一致性 | 15 | _ |
| 身材比例 | 10 | _ |
| 穿着自然度 | 10 | _ |
| **总分** | **100** | **_** |

另记录显性问题：
- [ ] 是否有明显脸变
- [ ] 是否有身体比例变化
- [ ] 是否有衣服变形
- [ ] 是否有 Logo/图案丢失
- [ ] 是否有手部异常
- [ ] 是否有明显不自然边缘

## 九、实验事实 vs 未验证结论

### 实验事实（待生成后填写）
- CASE-A resultUrl: ____
- CASE-B resultUrl: ____
- CASE-A latencyMs: ____
- CASE-B latencyMs: ____
- 人工评分: ____

### 尚未验证的结论（禁止提前声称）
- ❌ "VTON 一定比 Agnes 好"
- ❌ "真实人物一定比 Avatar Composite 好"
- ❌ "Plus 一定比标准版更值得"
- ❌ "应该替换生产链路"

这些结论必须等实际生成结果 + 人工评估后决定。

---

## 十、生产隔离保证

以下**绝对不修改**：
- `cloudfunctions/aiTryon/` — 生产试穿云函数
- `cloudfunctions/uploadGarment/` — 生产上传云函数
- `cloudfunctions/createAvatarViews/` — 生产人物生成云函数
- `cloudfunctions/services/` — 生产共享模块
- `miniprogram/` — 小程序前端代码
- `tryon_tasks` / `tryon_results` — 生产数据库集合
- `garments` / `avatar_views` / `quotas` — 生产数据集合
- `POC-01` — 衣物标准化 POC
- `PRD` / `AGENTS.md` / `main` — 文档和主干分支

实验数据写入：
- 实验集合：`tryon_v2_experiments`（如可创建）
- 降级存储：`experiments/tryon-v2/results.json`（本地文件）

---

## 十一、如何运行

### 部署实验云函数
```bash
# 在微信开发者工具中
# 右键 cloudfunctions/experimentsTryOnV2 → 上传并部署（云端安装依赖）
```

### 调用实验
```javascript
wx.cloud.callFunction({
  name: 'experimentsTryOnV2',
  data: { action: 'run' }
}).then(res => console.log(res.result));
```

### 本地语法检查
```bash
node --check cloudfunctions/experimentsTryOnV2/index.js
```

---

*本实验仅为研究验证，不影响生产环境。*
