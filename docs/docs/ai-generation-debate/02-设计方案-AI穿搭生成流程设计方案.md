# 「我形我衣」AI 穿搭生成流程设计方案

> 从 AI 生图生视频 + 专业摄影双重视角，重新设计整条生成链路。
> 模型无关——当前用 Agnes，后续可无缝切换 OpenAI / Seedance / 任意模型。
> 不涉及前端后端实现，只管"输入什么 → 怎么处理 → 输出什么"。

---

## 一、设计原则

### 1.1 五条铁律

| # | 原则 | 理由 |
|---|------|------|
| 1 | **一张图只做一个任务** | 合成图（三视图并排、2×2 四视图）本质是多任务压缩，每个子视图分辨率和细节都被压缩。拆开独立生成，质量提升 3-4 倍。 |
| 2 | **参考图 > 文本描述** | 模型对视觉参考的遵循度远超文本。"肩宽45cm"不如一张正确比例的骨骼图，"与参考图一致"不如把参考图作为 img2img 基底。 |
| 3 | **正负分离** | 正向 prompt 描述"要什么"，negative prompt 描述"不要什么"。当前只有正向没有负向，等于只踩油门不踩刹车。 |
| 4 | **验证闭环** | 生成完不是终点，必须有自动化质量检测。不合格的结果不能给用户看，要么重试要么降级。 |
| 5 | **身份锚定贯穿全程** | 从三视图到试穿图到视频，人脸和体型必须始终是同一个人。每一步都要有机制保证身份连续性，不能只靠提示词里的"完全一致"。 |

### 1.2 模型无关的抽象层

所有生成调用统一走适配器接口，换模型只改适配器实现，流程不变：

```
生成请求 → 适配器接口 → [Agnes / OpenAI / Seedance / ...]
                    ↑
            统一的输入输出格式
```

适配器接口定义（模型无关）：

| 接口 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `text2img` | prompt, negative_prompt, width, height, ref_images, seed | image_urls | 文生图 / 图生图 |
| `img2img` | prompt, negative_prompt, init_image, strength, seed | image_urls | 基于原图重绘 |
| `text2video` | prompt, negative_prompt, init_image, duration_sec, seed | video_task_id | 图生视频（异步） |
| `getVideoStatus` | video_task_id | status, video_url | 轮询视频状态 |
| `faceEncode` | face_image | face_embedding | 人脸编码（如模型支持） |
| `faceDecode` | face_embedding, prompt, ... | image_urls | 用人脸编码生成（如模型支持） |

> 注：`faceEncode` / `faceDecode` 为可选接口。模型不支持时降级为 ref_images 方案，不影响主流程。

---

## 二、完整流程设计

### 2.0 总览

```
阶段一：人物建档 ──────────────────────────────────────────────
  用户参数 + 参考照片
    → 步骤1: 生成正面全身图（身份锚定）
    → 步骤2: 基于正面图生成侧面图（身份延续）
    → 步骤3: 基于正面图生成背面图（身份延续）
    → 步骤4: 自动质量验证
    → 三张图存档，后续所有环节引用

阶段二：服装建档 ──────────────────────────────────────────────
  服装原图 + 品类标签
    → 步骤5: 生成服装正面图
    → 步骤6: 生成服装侧面图
    → 步骤7: 生成服装细节特写
    → 步骤8: 生成服装背面图
    → 步骤9: 自动质量验证
    → 四张图缓存，与服装原图 1:1 绑定

阶段三：试穿合成 ──────────────────────────────────────────────
  人物正面图 + 服装视图 + 穿搭描述
    → 步骤10: 生成正面试穿效果图
    → 步骤11: 生成侧面试穿效果图
    → 步骤12: 生成背面试穿效果图
    → 步骤13: 自动质量验证
    → 三张试穿图存档

阶段四：动态展示 ──────────────────────────────────────────────
  正面试穿图（主）+ 侧面/背面试穿图（辅助）
    → 步骤14A: 图生视频 — 微动态自然感视频（推荐）
    → 步骤14B: 图生视频 — 小角度转身视频（备选）
    → 步骤14C: 静态多角度切换 + 过渡动画（最稳兜底）
    → 自动质量验证
```

### 2.1 与当前方案的核心差异

| 环节 | 当前方案 | 新方案 | 改进理由 |
|------|---------|--------|---------|
| 三视图 | 1 张合成图 | 3 张独立图，逐张级联生成 | 分辨率 ×3，面部一致性由级联保证 |
| 四视图 | 1 张合成图 | 4 张独立图 | 分辨率 ×4，细节充分保留 |
| 试穿图 | 1 张正面图 | 3 张（正/侧/背），级联生成 | 多角度展示，视频素材更充足 |
| 视频 | 180° 转身 | 微动态 / 90° 转身 / 多角度切换 | 降低伪影概率，提升成功率 |
| 验证 | 无 | 每步自动检测 | 不合格结果自动拦截重试 |
| 身份锚定 | 仅靠提示词文本 | 级联参考图 + 可选人脸编码 | 身份一致性从 ~30% 提升到 ~80%+ |

---

## 三、阶段一：人物建档（详细设计）

### 3.1 输入

| 输入项 | 来源 | 必填 | 用途 |
|--------|------|------|------|
| 性别 | 用户填写 | 是 | 人体基础方向 |
| 身高 | 用户填写（cm） | 是 | 体型比例 |
| 体重 | 用户填写（kg） | 是 | 体型胖瘦 |
| 肩宽 | 用户填写（cm） | 否 | 肩部比例 |
| 胸围 | 用户填写（cm） | 否 | 上身比例 |
| 腰围 | 用户填写（cm） | 否 | 腰部比例 |
| 臀围 | 用户填写（cm） | 否 | 下身比例 |
| 臂长 | 用户填写（cm） | 否 | 手臂比例 |
| 腿长 | 用户填写（cm） | 否 | 腿部比例 |
| 颈长 | 用户填写（cm） | 否 | 颈部比例 |
| 鞋码 | 用户填写 | 否 | 脚部比例参考 |
| 肤色 | 用户选择 / 从参考图提取 | 否 | 皮肤色调 |
| 人脸参考图 | 用户上传（需授权） | 否 | 面部身份锚定 |
| 全身参考图 | 用户上传（需授权） | 否 | 体型参考 |

### 3.2 参数预处理

用户填的原始数字不能直接塞进提示词——模型不理解"175cm"对应多高的人。需要一个预处理层把测量值翻译成模型能理解的视觉描述：

```
参数翻译规则（示例）：

身高 → 比例词：
  < 155cm → "petite, noticeably shorter than average"
  155-165cm → "below average height"  
  165-175cm → "average height"
  175-185cm → "tall, above average"
  > 185cm → "very tall, noticeably above average"

体重+身高 → 体型词（结合 BMI）：
  BMI < 18.5 → "slender, visibly thin, narrow frame"
  BMI 18.5-22 → "lean, naturally proportioned"
  BMI 22-25 → "average build, slightly filled out"
  BMI 25-28 → "solid build, broader frame"
  BMI > 28 → "full-figured, substantial build"

肩宽+腰围+臀围 → 身型词：
  肩≈臀>腰 → "hourglass silhouette"
  肩>臀 → "inverted triangle, broader shoulders"
  臀>肩 → "pear shape, wider hips"
  肩≈腰≈臀 → "rectangular, minimal waist definition"

肤色（从参考图提取）→ 精确描述：
  提取人脸区域 L*a*b* 色值 → 转自然语言
  例：L=68, a=12, b=22 → "warm medium skin tone with golden undertone, 
       slightly lighter on inner arms"
```

### 3.3 生成步骤

#### 步骤 1：正面全身图（身份锚定图）

这是整条链路最关键的一张图——后续侧面/背面/试穿图全部以它为身份参考。

**输入**：
- 预处理后的参数描述
- 人脸参考图（如有）→ ref_images[0]
- 全身参考图（如有）→ ref_images[1]

**Prompt**：

```
RAW photo, full-body portrait of a [gender] person standing facing camera, 
shot on medium format digital camera, 80mm lens, f/8, studio lighting.

[parameterTranslation: 体型比例描述]
[skinTone: 精确肤色描述], natural unretouched skin with visible pores, 
subtle skin texture, NO smoothing, NO beauty filter.

[faceAnchor: 面部与参考照片为同一人，五官/脸型/发型完全一致]

Pose: standing naturally, arms relaxed at sides, feet shoulder-width apart, 
weight evenly distributed, wearing form-fitting light beige underwear that 
doesn't conceal body contours.

Lighting: studio three-point lighting setup — key light 45° camera left at 
eye level, fill light camera right 2 stops below key, rim light behind 
subject at 45° creating subtle edge separation. Even illumination on body, 
gentle shadow transitions.

Background: pure white seamless paper backdrop, no props, no furniture, 
no floor visible.

Style: editorial fashion photography, sharp focus edge-to-edge, 
natural color reproduction, no color grading, no vintage tone.

Quality: 8K UHD, ultra detailed, professional photography, real photograph.
```

**Negative Prompt**：

```
(worst quality, low quality:1.4), deformed, bad anatomy, extra limbs, 
missing limbs, extra fingers, missing fingers, fused fingers, bad hands, 
asymmetric face, crossed eyes, distorted facial features, beauty filter, 
smooth plastic skin, retouched skin, heavy makeup, cartoon, anime, 
illustration, painting, 3D render, mannequin, text, watermark, logo, 
background objects, multiple people, cropped body, head cropped, 
low resolution, blurry, oversaturated, unnatural colors, flash reflection
```

**特殊处理**：
- 如模型支持 `faceEncode`/`faceDecode`，对人脸参考图编码后注入，这是身份一致性的最强保障；
- 生成后对结果做人脸检测，确保人脸完整且清晰——如果不合格，自动重试（最多 2 次）；
- 保存此图为 `anchor_image`，后续所有生成步骤都引用它。

#### 步骤 2：侧面全身图

**关键设计：以前一步的正面图为强制参考**，确保是同一个人。

**输入**：
- prompt（同正面，但改为侧面描述）
- anchor_image → ref_images[0]（强制参考）

**Prompt**：

```
RAW photo, full-body portrait of the SAME person from step 1, 
now shown from exact left side profile (90 degrees from front), 
shot on medium format digital camera, 80mm lens, f/8, studio lighting.

This is the EXACT SAME person as the reference image — identical face, 
identical body, identical proportions, just viewed from the side.

[parameterTranslation: 同正面]
[skinTone: 同正面]

Pose: same standing pose as reference image viewed from the side — 
arms relaxed, feet shoulder-width, profile facing camera left.

Lighting: same studio three-point setup adjusted for side view — 
key light now illuminating the visible side of face and body, 
rim light creating edge definition on front silhouette.

Background: pure white seamless paper backdrop, identical to reference.

Style: same editorial fashion photography style as reference image, 
consistent color and exposure.
```

**Negative Prompt**：同正面 + 额外增加：

```
different person than reference, changed face, changed body proportions, 
front-facing pose, back-facing pose, inconsistent lighting
```

**级联机制**：
- anchor_image 作为 ref_images[0] 传入；
- 提示词中用 "the SAME person as the reference image" 代替"第1张参考图"这种序号引用，模型遵循度更高；
- 生成后做人脸比对（与 anchor_image 的面部特征相似度），低于阈值重试。

#### 步骤 3：背面全身图

**输入**：
- prompt（背面描述）
- anchor_image → ref_images[0]

**Prompt**：

```
RAW photo, full-body portrait of the SAME person from step 1, 
now shown from exact back view (180 degrees from front), 
shot on medium format digital camera, 80mm lens, f/8, studio lighting.

This is the EXACT SAME person as the reference image — identical body 
build, identical proportions, same hairstyle visible from behind, 
just viewed from the back.

[parameterTranslation: 同正面，聚焦可从背面观察的指标]
[skinTone: 同正面，尤其后颈/手臂肤色]

Pose: same standing pose viewed from behind — arms relaxed at sides, 
shoulder width and back curvature matching the reference image.

Lighting: same studio setup — rim light now serves as key illumination 
on back, fill light softening shadows on sides.

Background: pure white seamless paper backdrop, identical to reference.

Style: consistent with reference image in color, exposure, and quality.
```

**Negative Prompt**：同正面 +：

```
different person, front-facing, side-facing, visible face, 
inconsistent body width, different shoulder width than reference
```

### 3.4 质量验证（自动）

| 检查项 | 方法 | 通过标准 | 不通过动作 |
|--------|------|---------|-----------|
| 人脸存在性 | 人脸检测 | 正面图检出 1 张完整人脸 | 重试（≤2 次） |
| 人体完整性 | 人体检测 + 关键点 | 检出完整人体，头/肩/腰/膝/脚均在画面内 | 重试 |
| 多余/缺失肢体 | 关键点计数 | 恰好 2 臂 2 腿 | 重试 |
| 面部相似度 | 与参考图 ArcFace 比对（如有参考图） | 相似度 ≥ 0.5 | 标记偏差，可接受 |
| 侧面/背面与正面一致 | 体型比例比对 | 肩宽比偏差 ≤ 15% | 标记偏差 |
| 肤色一致性 | 肤色提取比对 | 三图肤色差 ΔE ≤ 10 | 重试 |

验证通过后，三张图（正面/侧面/背面）连同原始参数一起存入 `avatar_views`，作为该用户的人物基准。

---

## 四、阶段二：服装建档（详细设计）

### 4.1 输入

| 输入项 | 来源 | 必填 |
|--------|------|------|
| 服装原图 | 用户上传 | 是 |
| 服装名称 | 用户填写 / 识别 | 是 |
| 服装品类 | 用户选择（上衣/裤子/外套/裙子/鞋/配饰） | 是 |

### 4.2 品类感知处理

不同品类的服装，四视图的重点不同。不能所有品类用同一个模板。

```
品类适配规则：

上衣/外套：
  正面 → 正面平铺，展示门襟/领口/前图案
  侧面 → 45° 挂拍，展示袖型/肩线/厚度
  细节 → 面料纹理 + 缝线/纽扣/拉链特写
  背面 → 背面平铺，展示后背设计/肩缝

裤子/裙子：
  正面 → 正面平铺，展示腰头/门襟/裤腿
  侧面 → 侧缝线展示 + 口袋细节
  细节 → 面料纹理 + 腰头内侧/拉链/水洗标
  背面 → 臀部区域 + 后口袋设计

鞋子：
  正面 → 正面俯拍
  侧面 → 侧面展示鞋型/鞋底厚度
  细节 → 鞋面材质/鞋底纹理/鞋标
  背面 → 鞋跟/后跟设计

配饰（帽子/围巾/包）：
  正面 → 正面展示
  侧面 → 侧面展示厚度/立体感
  细节 → 材质纹理/五金件/缝线
  背面 → 背面设计
```

### 4.3 生成步骤

#### 步骤 5-8：四张独立服装视图

**核心策略：img2img 而非 txt2img**

服装四视图的关键要求是"与原图一模一样"，不是"生成一件差不多的衣服"。所以应该用 img2img 模式——把原图作为基底，只在视角上做变换，颜色/纹理/细节尽量保留。

**步骤 5：正面图**

```
Input: 服装原图 → init_image, strength=0.4-0.5

Prompt:
Product photography of [garmentName], [categorySpecificDescription], 
front view flat lay shot on white seamless background, 
even studio lighting with soft shadows, 
every detail of cut/color/fabric/stitching/buttons identical to the original, 
professional catalog photography, sharp focus, accurate color reproduction.

Negative:
(worst quality, low quality:1.4), different design than original, 
added details, removed details, changed color, changed pattern, 
wrinkles on mannequin, worn look, mannequin, body, person wearing, 
text, watermark, background objects, shadow on garment, color cast
```

**步骤 6：侧面图**

```
Input: 服装原图 → ref_images[0], 正面图 → ref_images[1]

Prompt:
Product photography of [garmentName], [categorySideDescription], 
45-degree angle view showing three-dimensional shape and silhouette, 
same fabric color and texture as reference image, 
same stitching and details visible from this angle, 
white background, even studio lighting, catalog photography style.

Negative: 同正面 + different garment than reference, front view, back view
```

**步骤 7：细节特写**

```
Input: 服装原图 → ref_images[0]

Prompt:
Macro detail shot of [garmentName], extreme close-up showing 
fabric weave texture, stitch quality, [buttonZipperDetail], 
and material surface characteristics, 
shot on white background with raking light to emphasize texture, 
professional textile photography, 1:1 magnification.

Negative: (worst quality, low quality:1.4), blurry, out of focus, 
different fabric than reference, added texture, smoothed texture, 
full garment visible, person, mannequin
```

**步骤 8：背面图**

```
Input: 服装原图 → ref_images[0], 正面图 → ref_images[1]

Prompt:
Product photography of [garmentName], back view flat lay shot, 
showing [backDesignElements], same fabric color and construction 
as reference image, white background, even studio lighting, 
catalog photography style, every back detail identical to original.

Negative: 同正面 + front view, side view, different back design than original
```

### 4.4 质量验证

| 检查项 | 方法 | 通过标准 |
|--------|------|---------|
| 服装完整性 | 边缘检测 | 服装完整在画面内，无裁切 |
| 颜色一致性 | 与原图色彩直方图比对 | ΔE ≤ 15（允许轻微光照差异） |
| 背景纯净度 | 背景区域白色检测 | 背景区域 >95% 为白色/近白色 |
| 无人体出现 | 人体检测 | 未检出人体 |

---

## 五、阶段三：试穿合成（详细设计）

### 5.1 核心策略变更

**当前方案**：通用文生图 + 提示词描述"把衣服穿到人身上"
**新方案**：分段合成 + 身份级联 + 层次描述

即使用通用模型，也可以通过流程设计大幅提升真实感。关键是：
1. 用人物正面图作为强参考，保证人不变
2. 用服装视图作为强参考，保证衣服不变
3. 用精确的层次/合身描述引导模型理解穿搭物理

### 5.2 穿搭层次引擎

根据用户选择的服装组合，自动生成穿搭层次描述：

```
层次规则引擎：

单件上衣：
  → "wearing [garmentName] as outer layer, 
     garment fits naturally on torso, 
     [fabricBehavior: 轻薄→drapes softly / 厚实→holds structure]"

上衣 + 裤子：
  → "wearing [topName] on upper body and [bottomName] on lower body,
     [topName] [tuckOption: 扎进→tucked into waistband / 垂放→hangs loosely over waistband],
     waistline transition between top and bottom is natural"

内搭 + 外套：
  → "wearing [innerName] as base layer visible at neckline and cuffs, 
     with [outerName] worn open/closed over it,
     layering visible at collar, sleeves, and hem"

上衣 + 裤子 + 外套：
  → "three-layer outfit: [innerName] as base, [bottomName] on lower body, 
     [outerName] as outermost layer,
     each layer's fabric and fit independent but coordinated"

连衣裙：
  → "wearing [dressName] as single piece, 
     dress falls naturally from shoulders to [lengthDescription: 膝上/及膝/脚踝]"

鞋类：
  → "wearing [shoeName], [鞋与裤脚关系: 裤腿堆叠在鞋面 / 裤腿塞入靴筒 / 露出完整鞋面]"
```

### 5.3 合身度描述引擎

根据用户体型参数和服装版型，自动生成合身度描述：

```
合身度规则：

紧身上衣 + 正常体型 → "garment fits snugly, fabric stretches slightly over chest and shoulders, no loose areas"
宽松上衣 + 瘦体型 → "garment drapes loosely, oversized silhouette, fabric hangs with visible folds and air gap between fabric and body"
修身上衣 + 丰满体型 → "garment fits closely, fabric follows body contours, slight stretching over fuller areas, natural fabric tension visible"
正常版型 + 正常体型 → "garment fits naturally, neither tight nor loose, fabric rests comfortably on body with natural ease"
```

### 5.4 生成步骤

#### 步骤 10：正面试穿效果图

**输入**：
- 人物正面图（anchor_image）→ ref_images[0]
- 服装正面图 → ref_images[1]
- 服装侧面图 → ref_images[2]（如有）
- 穿搭层次描述 + 合身度描述

**Prompt**：

```
RAW photo, full-body fashion photograph of a [gender] person 
wearing [outfitDescription with layerEngine output], 
shot on Sony A7IV, 50mm lens, f/4, natural studio lighting.

Person: EXACTLY the same person as reference image [0] — 
identical face, identical body build, identical proportions, 
identical skin tone. Do not alter any physical feature.

[fitDescription from fitEngine]

Garment details: each garment's cut, color, pattern, fabric texture, 
stitching, buttons, and zippers match the corresponding reference image 
EXACTLY. No design changes, no added details, no removed details. 
Fabric behavior: [fabricBehavior based on material type — 
cotton→soft drape / denim→rigid hold / silk→fluid movement / wool→structured fall].

Pose: standing naturally facing camera, arms relaxed at sides, 
feet shoulder-width apart, weight evenly distributed, 
slight natural asymmetry in stance (not rigidly symmetrical).

Scene: clean white background, studio soft lighting — 
key light 45° camera left, fill light camera right, 
rim light creating edge definition. 
Even illumination on garments to show true colors and texture.

Style: editorial fashion lookbook photography, 
sharp focus on garment details, 
accurate color reproduction, no color grading.
```

**Negative Prompt**：

```
(worst quality, low quality:1.4), deformed body, wrong proportions, 
extra arms, missing arms, extra legs, missing legs, fused fingers, 
bad hands, distorted face, changed face, different person than reference, 
beauty filter, smooth plastic skin, retouched, 
clothing merge, color bleed between garments, 
different garment than reference, added accessories not in reference, 
missing garment details, simplified fabric texture, 
background clutter, text, watermark, logo, 
mannequin, cartoon, anime, illustration, painting, 
low resolution, blurry, oversaturated, flash, shadow on garment
```

#### 步骤 11：侧面试穿效果图

**输入**：
- 人物正面图（anchor_image）→ ref_images[0]
- 正面试穿图（刚生成）→ ref_images[1]
- 服装侧面图 → ref_images[2]

**级联逻辑**：以正面试穿图为身份+服装的强参考，确保侧面图中的人和衣服都是正面试穿图中的同一套。

**Prompt**：

```
RAW photo, full-body fashion photograph of the SAME person wearing 
the SAME outfit as reference image [1], 
now shown from exact left side profile (90 degrees from front),
same camera and lighting setup.

Person: identical to reference — same face, same body, same skin tone.
Outfit: identical garments as reference — same clothes, same fit, 
same colors, same textures, just viewed from the side.

Side view reveals: garment silhouette from profile, 
how fabric drapes over the body's side contour, 
sleeve fit and arm position from side angle, 
garment length and hemline from profile.

Pose: same standing pose as reference, viewed from side profile.
Lighting: studio setup adjusted for side view.
Background: identical pure white.
Style: consistent with reference image.
```

#### 步骤 12：背面试穿效果图

同上逻辑，参考正面试穿图，生成背面视角。

### 5.5 质量验证

| 检查项 | 方法 | 通过标准 | 不通过动作 |
|--------|------|---------|-----------|
| 人脸完整 | 人脸检测 | 正面试穿图检出完整人脸 | 重试 |
| 人脸一致 | 与 anchor_image ArcFace 比对 | ≥ 0.45 | 标记偏差 |
| 人体完整 | 关键点检测 | 头到脚完整入镜 | 重试 |
| 肢体正常 | 关键点计数 | 2臂2腿 | 重试 |
| 服装颜色 | 与服装图色彩比对 | 主要色彩 ΔE ≤ 20 | 标记偏差 |
| 穿搭层次 | 分区检测 | 上衣/下装分区清晰无融合 | 重试 |
| 背景纯净 | 背景检测 | >90% 白色/近白色 | 标记偏差 |

---

## 六、阶段四：动态展示（详细设计）

### 6.1 三种模式（按真实感排序）

| 模式 | 方式 | 真实感 | 成功率 | 成本 | 推荐度 |
|------|------|--------|--------|------|--------|
| A. 微动态 | 图生视频，人物微动+呼吸+布料微摆 | ★★★★ | ~85% | 1 次视频调用 | ★★★★★ |
| B. 小角度转身 | 图生视频，正面→侧面 90° | ★★★ | ~60% | 1 次视频调用 | ★★★ |
| C. 多角度切换 | 三张试穿图 + 前端过渡动画 | ★★★★★ | ~95% | 0 次视频调用 | ★★★★ |

**推荐策略**：默认模式 A（微动态），用户可选模式 B 或 C。

### 6.2 模式 A：微动态自然感视频（推荐默认）

**设计理念**：不做大动作，让图"活起来"就够了。微动态的成功率远高于大动作，且观感更自然。

**输入**：正面试穿图 → init_image

**Prompt**：

```
Cinematic video, subtle natural micro-movements of a person standing 
in a fashion photograph, the person is alive and breathing gently — 
chest rises and falls subtly, fabric responds with micro-drape shifts, 
hair moves slightly from air current, fingers make small natural adjustments, 
weight shifts imperceptibly from one foot to the other.

Person face and body: EXACTLY the same as input image in every frame — 
no face morphing, no body change, no clothing change, no color shift.

Garment behavior: fabric maintains consistent texture and color, 
light wrinkles shift naturally with micro-movement, 
loose areas (sleeves, hem) sway very slightly.

Camera: completely static, fixed tripod, no zoom, no pan, no tilt.
Duration: 3 seconds of gentle, living stillness.

Style: photorealistic, natural, no filter, no color grading changes.
```

**Negative Prompt**：

```
(worst quality, low quality:1.4), face morphing, face change, 
body shape change, clothing color shift, fabric flickering, 
large movement, walking, turning, arm raising, head turning, 
camera movement, zoom, pan, shaky footage, stuttering frames, 
low fps, cartoon, anime, painting, blurry frames, ghost artifacts, 
double exposure, duplicate person, background change
```

**关键约束**：
- 微动态而非大动作——"breathing gently"比"turning around"稳定得多
- 3 秒够用——足够展示"这是个真人穿着真衣服"的感觉，再长反而容易穿帮
- 静态机位——任何镜头运动都会增加伪影概率

### 6.3 模式 B：小角度转身视频

**输入**：正面试穿图 → init_image，侧面试穿图 → ref_images[0]（辅助参考）

**Prompt**：

```
Cinematic video, person slowly turns from front-facing to left-side profile 
over 2 seconds, then holds side pose for 1 second.

Person: face and outfit remain EXACTLY the same as input image 
throughout the entire video — identical in every frame.

Turn mechanics: rotation is smooth and continuous, 
feet stay planted on the ground (no sliding), 
arms remain relaxed at sides during turn, 
torso rotates naturally from hips and shoulders together.

Garment behavior: as body turns, fabric follows naturally — 
front wrinkles smooth out, side wrinkles form, 
loose fabric sways with the turn, 
drape lines shift consistently with viewing angle.

Camera: fixed tripod, no movement, eye-level.
Lighting: consistent throughout, no lighting change as person turns.
Background: pure white, unchanged.

Style: photorealistic, 24fps, smooth motion, natural physics.
```

**Negative Prompt**：

```
(worst quality, low quality:1.4), face morphing, face disappearing 
at side angle, body shape change, clothing color shift, 
fabric flickering, texture shimmer, 
fast turn, jerky motion, stuttering, 
feet sliding on floor, arms flailing, 
camera movement, zoom, pan, 
low fps, blurry frames, ghost, duplicate person, 
background change, lighting change, 
cartoon, anime, painting
```

### 6.4 模式 C：多角度切换 + 过渡动画

**不调用视频生成 API**，纯前端实现：

```
输入：正面试穿图 + 侧面试穿图 + 背面试穿图
展示方式：
  - 默认显示正面图
  - 用户左滑 → 平滑淡入侧面图
  - 再左滑 → 平滑淡入背面图
  - 可自动循环播放：正面(1.5s) → 渐变(0.5s) → 侧面(1.5s) → 渐变(0.5s) → 背面(1.5s)
  - 过渡动画用 opacity crossfade + 轻微 scale 变化模拟景深
```

**优势**：
- 三张图都是 AI 生成的高质量静态图，真实感最高
- 100% 成功率，没有视频伪影
- 零视频生成成本
- 可以无限次循环播放不损失画质

**劣势**：
- 没有"真人微动"的感觉
- 过渡不如连续视频流畅

### 6.5 质量验证（视频模式 A/B）

| 检查项 | 方法 | 通过标准 | 不通过动作 |
|--------|------|---------|-----------|
| 首帧一致性 | 视频首帧与输入图比对 | SSIM ≥ 0.85 | 重试 |
| 末帧人脸 | 末帧人脸检测 | 检出完整人脸 | 降级为模式 C |
| 帧间人脸漂移 | 抽帧 ArcFace 比对 | 首末帧相似度 ≥ 0.4 | 降级为模式 C |
| 服装颜色稳定 | 抽帧主色彩比对 | ΔE ≤ 15 | 降级为模式 C |
| 无伪影 | 帧间差分检测异常区域 | 无大面积跳变 | 重试或降级 |

---

## 七、适配器模型切换指南

### 7.1 切换到 OpenAI（DALL-E / GPT-Image）

| 差异点 | 处理方式 |
|--------|---------|
| DALL-E 不支持 negative prompt | 将关键负面约束写入正向 prompt 末尾："IMPORTANT: Do NOT [...]" |
| DALL-E 3 的 ref_image 通过 vision 传入 | 在 prompt 中明确引用"the person shown in the uploaded image" |
| 支持 inpainting/edit | 试穿图可改用 edit 模式：保留人体 + mask 服装区域重绘 |
| 无 img2img strength 参数 | 用 edit 模式的 mask 精度替代 |

### 7.2 切换到 Seedance

| 差异点 | 处理方式 |
|--------|---------|
| Seedance 视频模型对运动描述更敏感 | 视频提示词可增加更细致的运动时间线描述 |
| 可能支持 ControlNet 骨骼 | 接入后可用骨骼图精确控制体型和姿势 |
| 可能支持 face reference | 直接使用 faceEncode/faceDecode 接口，身份一致性最优 |

### 7.3 切换到专业 VTON 模型

| 变化 | 说明 |
|------|------|
| 试穿步骤简化为单次调用 | VTON 模型直接接受 人物图+服装图 → 输出试穿图，无需复杂的 prompt 工程 |
| 不再需要服装四视图 | VTON 模型用原图即可，四视图可作为展示素材但非生成必需 |
| 侧面/背面试穿图 | 可用 VTON 模型+侧面/背面人物图生成，或仍用级联方式 |

---

## 八、提示词工程规范

### 8.1 Prompt 结构模板（所有生成步骤统一）

```
[画质锚定] + [任务定义] + [身份/参考锚定] + [细节描述] + [场景/光影] + [风格]

示例：
RAW photo, 8K UHD                        ← 画质锚定
full-body portrait of a person            ← 任务定义
SAME person as reference image            ← 身份锚定
[parameterTranslation] [skinTone]         ← 细节描述
studio three-point lighting, white bg     ← 场景/光影
editorial fashion photography             ← 风格
```

### 8.2 Negative Prompt 结构模板

```
[画质排除] + [人体异常] + [面部异常] + [风格偏移] + [内容污染] + [格式问题]

示例：
(worst quality, low quality:1.4)         ← 画质排除
deformed, extra limbs, bad hands          ← 人体异常
distorted face, asymmetric eyes           ← 面部异常
cartoon, anime, painting, 3D              ← 风格偏移
text, watermark, background objects       ← 内容污染
blurry, low resolution, cropped           ← 格式问题
```

### 8.3 关键写作规则

| 规则 | 说明 | 示例 |
|------|------|------|
| 用"SAME person as reference"代替序号 | "第1张参考图"模型遵循度低，"reference image"更直接 | ✅ SAME person as reference image ❌ 依据第1张参考图 |
| 物理描述优于抽象描述 | "fabric drapes softly following gravity"比"自然垂坠"更精确 | ✅ wrinkles shift as body turns ❌ 褶皱自然 |
| 摄影术语引导画质 | 相机型号/镜头/光圈让模型切换到照片生成模式 | ✅ shot on Sony A7IV, 50mm ❌ 写实风格 |
| 逐帧/逐视图显式声明一致性 | 视频中"every frame"比"全程"更有效 | ✅ identical in every frame ❌ 全程一致 |
| 禁止项要具体 | "no extra fingers"比"无异常"有效 | ✅ no fabric flickering ❌ 无画面问题 |

---

## 九、降级与兜底策略

### 9.1 生成失败分级

| 等级 | 触发条件 | 处理方式 |
|------|---------|---------|
| 可接受 | 面部相似度 0.4-0.5，颜色偏差 15-20% | 展示结果 + 标注"AI 生成效果，可能与实际略有差异" |
| 需重试 | 人脸缺失/肢体异常/严重颜色偏差 | 自动重试 ≤2 次，每次微调 prompt（换 seed / 微调描述词） |
| 降级 | 重试 2 次仍不合格 | 三视图降级为单正面图；视频降级为模式 C（静态切换） |
| 全失败 | 降级后仍无法生成 | 展示友好错误 + 退回额度 + "当前生成服务繁忙，请稍后重试" |

### 9.2 重试策略

```
重试规则：
  第 1 次失败：相同 prompt 重试（可能是模型随机性导致）
  第 2 次失败：微调 prompt 重试
    - 三视图：增加 "especially consistent facial features" 强调
    - 试穿图：简化层次描述（可能模型无法处理多件叠穿）
    - 视频：缩短时长（5s → 3s）或降低动作幅度
  第 3 次仍失败：降级 + 退回额度
```

---

## 十、完整流程图

```
用户建档
  │
  ├─ 性别/身高/体重/三围/肤色 ─→ 参数翻译引擎 ─→ 视觉描述词
  ├─ 人脸参考图 ─────────────────→ 人脸编码（可选）─→ face_embedding
  └─ 全身参考图 ─────────────────→ 体型参考 ─→ ref_image
       │
       ▼
  ┌─────────────────────────────────────────────────┐
  │ 阶段一：人物建档                                  │
  │  Step 1: 正面全身图 ← [参数词 + 参考图 + face_emb] │
  │  Step 2: 侧面全身图 ← [正面图作参考]               │
  │  Step 3: 背面全身图 ← [正面图作参考]               │
  │  Step 4: 质量验证 ─→ 通过则存档                    │
  └──────────────────┬──────────────────────────────┘
                     │ avatar_views 存档
                     ▼
  ┌─────────────────────────────────────────────────┐
  │ 阶段二：服装建档（按需）                           │
  │  服装原图 + 品类 ─→ 品类适配引擎                   │
  │  Step 5: 正面图 ← img2img(原图, strength=0.4)     │
  │  Step 6: 侧面图 ← ref[原图+正面图]                │
  │  Step 7: 细节图 ← ref[原图]                       │
  │  Step 8: 背面图 ← ref[原图+正面图]                │
  │  Step 9: 质量验证 ─→ 通过则缓存                    │
  └──────────────────┬──────────────────────────────┘
                     │ garment_views 缓存
                     ▼
  ┌─────────────────────────────────────────────────┐
  │ 阶段三：试穿合成                                  │
  │  服装组合 ─→ 层次引擎 + 合身度引擎                  │
  │  Step 10: 正面试穿 ← [人物正面图+服装图+层次描述]  │
  │  Step 11: 侧面试穿 ← [正面试穿图+服装侧面图]      │
  │  Step 12: 背面试穿 ← [正面试穿图+服装背面图]      │
  │  Step 13: 质量验证 ─→ 通过则存档                   │
  └──────────────────┬──────────────────────────────┘
                     │ tryon_results 存档
                     ▼
  ┌─────────────────────────────────────────────────┐
  │ 阶段四：动态展示                                  │
  │  Step 14A: 微动态视频 ← 正面试穿图（推荐默认）     │
  │  Step 14B: 转身视频   ← 正面试穿图（可选）         │
  │  Step 14C: 多角度切换 ← 三张试穿图（兜底）         │
  │  质量验证 ─→ 视频不合格则降级为 14C                 │
  └─────────────────────────────────────────────────┘
```

---

*文档日期：2026-08-19*
*定位：模型无关的 AI 穿搭生成流程设计方案*
*适用模型：Agnes / OpenAI / Seedance / 任意 VTON 模型*
