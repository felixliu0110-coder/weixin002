# POC-01: Deterministic Garment Reference Normalization

> **Status: EXPERIMENTAL — NOT VERIFIED**
>
> POC-01 当前只验证 deterministic preprocessing，不验证 AI Provider 效果。

## Known Facts

1. 当前 Agnes baseline 已真实成功。
2. 当前真实 baseline 存在 garment fidelity 不足。
3. **尚未证明**问题来自 reference preprocessing。
4. POC-01 用于验证"确定性标准化是否能提升 Provider 对 garment reference 的理解"这一假设。
5. POC-01 成功 ≠ 生产可用。
6. 必须经过真实 Agnes A/B 才能决定是否生产化。
7. 如果 A/B 无明显提升，应删除/停止该方向。

**Normalization 是待验证假设。** 不能声称"Normalization 可以提升效果"。

## Goal

验证一个单纯的假设：

> "把用户随手拍摄的衣物图片进行确定性标准化，是否能够让后续 Try-On Provider 更稳定地理解 garment reference。"

本 POC 第一版只验证：

```
Original  vs  Deterministic Normalized Reference
```

不引入其它变量。

## What It Does

纯确定性图片处理，仅包含：

1. EXIF Orientation 纠正
2. 最大边限制（仅缩小，不放大）
3. 保持宽高比 resize
4. 固定 1024×1024 canvas
5. 居中放置，保持比例
6. 不拉伸

### Default Parameters

```javascript
{
  maxSide: 1600,
  canvasWidth: 1024,
  canvasHeight: 1024
}
```

### What It Does NOT Do

- ❌ No segmentation / SAM / YOLO
- ❌ No AI background removal
- ❌ No object detection / garment classification
- ❌ No perspective correction / geometric warping
- ❌ No AI enhancement / sharpening / denoise / color correction
- ❌ No OCR
- ❌ No Provider API calls (Agnes / 通义 / 即梦 / 豆包 etc.)
- ❌ Background is preserved as-is

### Resize Behavior

| Input | Output (normalized) |
|-------|-------------------|
| 4000×3000 | 1600×1200 → placed in 1024×1024 canvas |
| 800×600 | 800×600 → placed in 1024×1024 canvas (no upscale) |

## Usage

```bash
cd poc/garment-reference
npm install
node -e "
const { normalizeGarment } = require('./normalize');
normalizeGarment('input/photo.jpg', 'output/photo_normalized.jpg')
  .then(console.log)
  .catch(console.error);
"
```

### API

```javascript
const { normalizeGarment } = require("./normalize");

const result = await normalizeGarment(inputPath, outputPath, {
  maxSide: 1600,       // default
  canvasWidth: 1024,   // default
  canvasHeight: 1024   // default
});

// result:
// {
//   inputWidth, inputHeight,
//   normalizedWidth, normalizedHeight,
//   canvasWidth, canvasHeight,
//   scale, offsetX, offsetY,
//   outputPath
// }
```

## Testing

```bash
npm test
```

Tests cover: landscape, portrait, square, maxSide downscale, small image no-upscale, canvas output size, aspect ratio, centered offset, parameter override, illegal parameters, non-existent file, unparseable image, EXIF orientation, deterministic output.

## Dependencies

| Package | License | Purpose |
|---------|---------|---------|
| sharp | Apache-2.0 | Image processing (EXIF, resize, composite) |

POC dependencies are isolated in `poc/garment-reference/package.json` and do not affect production `npm install`.

## Directory Structure

```
poc/garment-reference/
├── README.md
├── package.json
├── normalize/
│   ├── index.js              # Core normalization logic
│   └── normalize.test.js     # Test suite
├── evaluation/
│   ├── README.md             # Evaluation protocol
│   ├── schema.json           # Evaluation record schema
│   └── cases.example.json    # Placeholder examples
├── input/
│   └── .gitkeep              # Place test images here (not committed)
└── output/
    └── .gitkeep              # Normalized output goes here
```

## What Is NOT Verified

- ❌ Normalization 是否真正提升 Try-On 效果
- ❌ 哪种 Provider 对 normalized reference 响应更好
- ❌ 是否值得引入生产流程
- ❌ garments schema 是否需要新增 normalized_file_id 字段

以上均需真实 A/B 实验后才能决定。

## Scope Boundary

- 本 POC 完全独立于生产代码
- 不修改 miniprogram/、cloudfunctions/、services/
- 不修改 garments schema
- 不修改 aiTryon 流程
- 生产是否保存 Normalized Reference：等真实 A/B 后决定
