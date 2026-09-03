# Phase 5-2 Builtin Garment Reference Asset Boundary

## 概述

本文档定义 V1 builtin Garment 的资源边界，明确区分 displayImage（UI 展示资源）与 provider reference asset（AI Provider 可信资源）。

## 核心原则

1. **builtin 是真实 Garment entity**
   - builtin 与 upload 同为 Garment 实体的两种类型
   - 每个 garment 必须包含 `{id, name, category, type}`
   - type 只能是 `"builtin"` 或 `"upload"`

2. **displayImage 是 UI asset**
   - 用于小程序前端展示
   - builtin 的 displayImage 为本地路径（如 `/assets/img/p06-tee.jpg`）
   - upload 的 displayImage 为 CloudBase fileID
   - displayImage 不作为 Provider 输入

3. **provider reference asset 是另一层资源**
   - 用于 AI Provider 生成四视图/试穿图
   - 必须是可信的 Cloud Storage 资源
   - 通过 `referenceAsset` 字段表达

4. **builtin referenceAsset 当前可以为 null**
   - builtin 当前没有真实 Cloud Storage reference
   - referenceAsset 为 null 表示不可用于 AI 试穿
   - 后续资源部署工作可将 builtin reference 上传到 CloudBase

5. **没有可信 reference 时不得进入真实 Provider**
   - `hasProviderReference(garment)` 返回 false 时，不得调用真实 Provider
   - 应返回 `BUILTIN_GARMENT_REFERENCE_UNAVAILABLE` 错误

6. **upload 的 reference 来自 garments.original_file_id**
   - upload 类型 garment 的 referenceAsset 从数据库记录取得
   - fileId 必须来自服务端 garments 记录，不信任客户端

7. **不允许客户端伪造 reference**
   - 客户端提交的 garmentImage/fileID 不作为生成依据
   - reference 必须由服务端从可信数据源取得

8. **CloudBase 固定 builtin reference asset 属于后续资源部署工作**
   - 本阶段不伪造 builtin 的 CloudBase fileID
   - 不创建不存在的 `garments/builtin/g-tee.jpg` 等文件

9. **本阶段没有真实 Provider 调用**
   - Phase 5-2 只负责 Garment 数据边界定义
   - 真实 Provider 调用属于后续 Phase

## 数据结构

### builtin Garment

```javascript
{
  id: "g-tee",
  name: "白色基础T恤",
  category: "上衣",
  type: "builtin",
  displayImage: "/assets/img/p06-tee.jpg",  // UI 展示
  referenceAsset: null                       // 无可信 Provider 资源
}
```

### upload Garment

```javascript
{
  id: "abc123",
  name: "我的T恤",
  category: "上衣",
  type: "upload",
  displayImage: "cloud://xxx/original.jpg",  // UI 展示
  referenceAsset: {
    kind: "cloud-file",
    fileId: "cloud://xxx/original.jpg"       // 可信 Provider 资源
  }
}
```

## 判断函数

```javascript
function hasProviderReference(garment) {
  if (!garment || !garment.referenceAsset) return false;
  if (garment.referenceAsset.kind === "cloud-file") {
    return !!garment.referenceAsset.fileId;
  }
  return false;
}
```

- builtin: `hasProviderReference()` 返回 `false`
- upload: `hasProviderReference()` 返回 `true`（当 fileId 非空）

## 错误码

- `BUILTIN_GARMENT_REFERENCE_UNAVAILABLE`: 该系统模板暂时无法用于 AI 试穿
  - HTTP 400
  - 用于 builtin 没有 referenceAsset 时

## 禁止事项

- 把小程序本地 `/assets/img/...` 当成 Provider HTTP 图片
- 伪造 fileID 或 public URL
- 把空 originalFileId 当成真实 reference
- 根据 displayImage、`/assets/...`、ID 前缀推导 provider reference
- 在 Try-On Engine 中偷偷兜底 builtin reference

## 后续工作

- Phase 5-3/4.3-B-2: 决定 builtin 有 referenceAsset 时是否允许进入 Try-On
- 资源部署: 将 builtin reference asset 上传到 CloudBase Storage
- Provider 集成: 在有可信 reference 后接入真实 AI Provider
