# 「我形我衣」AI 试穿 — 生图生视频优化方案

> 从图片视频生成专家视角，对现有三视图 / 四视图 / 试穿图 / 试穿视频四条生成链路做全量诊断与优化建议。
> 目标：**生成最真实、最接近实际试穿效果的结果**。

---

## 一、当前架构概览

| 环节 | 模型 | 输入 | 输出 | 分辨率 |
|------|------|------|------|--------|
| 人物三视图 | agnes-image-2.1-flash | 身材参数文本 + 可选参考图 | 1 张合成图（正面/侧面/背面并排） | 1024×1024 |
| 服装四视图 | agnes-image-2.1-flash | 服装名文本 + 可选参考图 | 1 张 2×2 合成图 | 1024×1024 |
| 试穿效果图 | agnes-image-2.1-flash | 三视图 + 衣物图（参考图）+ 提示词 | 1 张全身照 | 1024×1024 |
| 转身视频 | agnes-video-v2.0 | 效果图 + 视频提示词 | 4-5s 视频 | 1152×768 |

**核心问题一句话**：用通用文生图模型做专业虚拟试穿，靠提示词驱动而非模型架构驱动，真实感天花板很低。

---

## 二、逐链路诊断与优化

### 2.1 人物三视图 — 5 个关键问题

**问题 1：单张合成图严重损失单视图分辨率**

三视图塞进 1024×1024，每个视图实际只有约 340×1024 像素。人脸、手指、服装纹理在这个分辨率下必然模糊。

→ **优化**：改为逐视图独立生成，每张 1024×1024，三张共 3 次调用。虽然成本 ×3，但每张图的人脸和身体细节质量会有质的飞跃。同时保留合成图作为"预览缩略图"。

**问题 2：身材参数作为文本注入提示词，模型无法精确理解**

当前做法是"身高175cm、体重70kg、肩宽45cm…"直接写进 prompt。但文生图模型没有"厘米 → 像素比例"的精确映射能力，它只能做模糊的方向性调整（高/矮、胖/瘦）。

→ **优化**：
- **短期**：在文本参数之外，补充视觉锚定词，如"偏瘦体型、窄肩、长腿比例明显"等定性描述，比纯数字更有效；
- **中期**：用 ControlNet/OpenPose 的骨骼图控制比例——根据用户参数生成对应比例的骨骼参考图，模型直接按骨骼生成人体，精度远超文本描述；
- **长期**：接入 SMPL/SMPL-X 参数化人体模型，将测量值直接映射为 3D 网格 → 渲染为参考图，给模型提供精确的体型视觉参考。

**问题 3：面部一致性仅靠参考图 + 文本锚定，跨视图漂移严重**

当前提示词写"面部、五官、发型与参考图中的同一人物完全一致"，但通用文生图模型对"同一人"的理解非常弱，三次独立生成几乎不可能保证是同一张脸。

→ **优化**：
- **核心**：接入人脸保持技术（IP-Adapter FaceID / InstantID / PhotoMaker），将参考人脸编码为 embedding 注入生成过程，面部一致性可从 ~30% 跃升到 ~85%+；
- **辅助**：同一批生成时固定 seed + 相同的 prompt 前缀，减少随机性导致的漂移；
- **兜底**：如果 API 不支持上述技术，先用正面视图生成结果裁剪人脸区域，作为后续侧面/背面生成的额外参考图（side conditioning），强制模型参考同一张脸。

**问题 4：肤色描述过于粗粒度**

当前只有 4 档：light / natural / tan / deep。真实肤色的差异远不止此，且同一档内的肤色差异也会影响试穿效果的自然度。

→ **优化**：
- 从用户上传的参考图中自动提取主肤色（取人脸/手臂区域的平均色值），以 HEX 或自然语言精确描述注入提示词；
- 增加肤色修饰词：如"偏暖调自然黄种人肤色，面颊微泛红，手臂偏浅一个色号"。

**问题 5：缺少负面提示词**

当前所有 prompt 只有正向描述，没有 negative prompt。通用模型在人物生成中极易出现的瑕疵——多余手指、扭曲面部、不对称眼睛、画面文字——完全靠正向"禁止"约束，效果远不如 negative prompt。

→ **优化**：为每条链路添加 negative prompt：
```
三视图 negative: (worst quality, low quality:1.4), deformed, extra limbs, missing limbs, bad hands, bad face, asymmetric eyes, text, watermark, logo, background objects, multiple people, different person per view, cartoon, anime, painting
```

---

### 2.2 服装四视图 — 4 个关键问题

**问题 1：同三视图，2×2 合成图分辨率不足**

4 个视图挤在 1024×1024，每个视图约 512×512。面料纹理、缝线、纽扣等细节在这个分辨率下完全丢失。

→ **优化**：独立生成 4 张视图，每张 1024×1024。正面和背面各 1 张，45° 侧拍 1 张，细节特写 1 张可放大到 1536×1536 以充分呈现面料。

**问题 2：服装参考图锚定力不足**

当前仅通过"与参考图完全一致"的文本描述来约束，但模型往往会"美化"或"重新设计"服装——加个褶皱、改个色调、换个面料质感。

→ **优化**：
- **使用图生图（img2img）模式**，将原图作为基础图，denoising_strength 设为 0.3-0.5，让模型在原图基础上微调视角而非从零重绘；
- 如果 API 支持 ControlNet Canny/Depth，从原图提取边缘/深度图作为结构约束，确保版型和轮廓不变；
- 提示词中增加具体的视觉锚定词："[参考图中的]浅蓝色、明显的水洗纹理集中在膝盖和大腿前侧、右侧口袋上方有一个1cm磨损痕迹"——越具体，模型越不容易擅自修改。

**问题 3：缺少服装平铺 vs 穿着状态的区分**

四视图描述的是"服装平铺实拍"，但实际试穿时服装会有"穿上身后的垂坠、褶皱、贴合"状态。当前没有区分这两种状态。

→ **优化**：四视图保持平铺状态（作为"服装本身"的参考），但在试穿图生成时额外注入"穿着态描述"，如"站立时面料自然垂坠、腰部贴合、裤腿自然微堆在鞋面"。

**问题 4：单件 vs 多件叠穿的层次描述缺失**

当前试穿图提示词只说"人物穿着【A、B】"，没有描述叠穿层次关系（内搭 vs 外套、上衣扎进裤腰 vs 自然垂放等）。

→ **优化**：根据衣物分类自动生成层次描述：
- 上衣 + 裤子 → "上衣自然垂放在裤腰外"
- 内搭 + 外套 → "内搭从外套领口/袖口露出"
- 多层叠穿 → "由内到外依次为 A、B、C，层次分明"

---

### 2.3 试穿效果图 — 最关键的链路，6 个核心问题

**问题 1（最致命）：用通用文生图做虚拟试穿，是方向性错误**

当前方案本质是"给模型一张人 + 一张衣服，用 prompt 告诉它把衣服穿到人身上"。这不是虚拟试穿，这是"用文字描述换装"。通用模型无法做到：
- 精确地把指定服装穿到指定人身上
- 保持人体姿态不变、只替换服装区域
- 真实还原面料与身体的物理交互（贴合、褶皱、垂坠）

→ **优化**：**接入专业 VTON（Virtual Try-On）模型**，这是提升真实感最关键的一步：

| 模型 | 特点 | 接入难度 | 效果 |
|------|------|---------|------|
| **IDM-VTON** | 开源 SOTA，保持人物身份 + 服装细节，支持半身/全身 | 中（需部署） | ★★★★★ |
| **OOTDiffusion** | 开源，配对数据训练，服装还原度高 | 中 | ★★★★ |
| **CatVTON** | 轻量，支持任意姿态，推理快 | 低 | ★★★★ |
| **Kolors Virtual Try-On** | 快手出品，中文生态好 | 低（API 可用） | ★★★★ |
| **FLUX + VTON LoRA** | 基于最新 FLUX 架构的 VTON 适配 | 中 | ★★★★ |

**替代方案**（如暂时无法部署 VTON 模型）：
- 使用 Segmentation + Compositing 策略：先用人体分割模型把人的服装区域抠出，再用 Inpainting 只重绘服装区域，人体和背景保持不变。这比"从零生成换装图"真实感高得多。
- 用 Agnes 的 inpainting/editing 接口（如有），指定 mask 区域只替换服装。

**问题 2：参考图顺序依赖不可靠**

提示词中写"依据第1张参考图的人物三视图""依据第2张起的衣物参考图"，但 AIGC 模型对"第N张参考图"这种序号引用的遵循度非常不稳定。有时会把人和衣服搞混，有时会忽略某个参考图。

→ **优化**：
- 不再依赖序号，改为**在提示词中明确描述每张参考图的内容**："左侧参考图为人物正面全身照，右侧参考图为浅蓝色牛仔裤平铺图"；
- 在 API 支持时使用 named/typed reference（如 Agnes 如支持 `person_image` 和 `garment_image` 分开传参）。

**问题 3：纯白背景 + 固定站姿 = 僵硬感**

纯白背景 + 双手垂于身侧 + 正面站姿，出来的图永远像"证件照"或"产品展示图"，缺乏真实试穿的生活感。

→ **优化**：
- **短期**：提供 2-3 种预设场景选择（纯白展示 / 简约室内 / 户外自然光），让用户选；
- **中期**：增加自然姿态预设（双手插兜 / 单手叉腰 / 自然行走 / 坐姿）；
- **长期**：支持用户上传参考姿势图（如网红穿搭照），用 OpenPose 提取骨骼后作为姿势参考。

**问题 4：体型还原验证缺失**

当前没有机制验证"生成图的人体比例是否真的与用户参数匹配"。如果模型输出一个明显偏瘦/偏胖的人，用户无法判断，只能接受。

→ **优化**：
- 生成后用人体关键点检测（如 OpenPose/MediaPipe）提取肩宽比、腿身比等，与用户参数自动比对；
- 偏差超过阈值（如 >15%）自动标记"体型偏差较大"，提示用户重试或调参；
- 这个检测可在前端做（小程序端 MediaPipe 可用），不增加后端成本。

**问题 5：多件服装的参考图数量过多导致模型混淆**

选 3 件衣服就有 1 张三视图 + 3 张衣物图 = 4 张参考图。通用模型处理 4+ 张参考图时，容易发生特征串扰（衣服 A 的颜色跑到衣服 B 上）。

→ **优化**：
- 限制同时试穿 ≤2 件（上衣+下装），减少参考图数量；
- 如必须支持多件，用两步法：先生成单件试穿图，再用 inpainting 逐件叠加。

**问题 6：缺少负面提示词和画质约束**

→ **优化**：添加试穿图专用 negative prompt：
```
(worst quality:1.4), (low quality:1.4), deformed body, wrong proportions, extra arms, missing fingers, distorted face, clothing merge, color bleed, different garment than reference, added accessories not in reference, background clutter, text, watermark, cartoon, anime, illustration, painting style, mannequin, plastic skin
```
同时添加画质增强词：`RAW photo, 8k uhd, dslr, high quality, film grain, real photograph, Fujifilm XT4`

---

### 2.4 转身视频 — 4 个关键问题

**问题 1：图生视频做 180° 转身，是最容易暴露伪影的动作**

图生视频（Image-to-Video）的核心能力是"让静态图动起来"，但它对"人体持续旋转"这种大角度运动的支持非常有限。常见问题：
- 转到侧面时人脸变形/消失
- 服装在旋转过程中颜色/纹理闪烁
- 手臂/腿部的运动轨迹不自然
- 转过身后"背面"完全是模型脑补的（因为输入图只有正面）

→ **优化**：
- **核心改动**：**改为多角度静态图切换，而非连续转身视频**。用三视图中的正面/侧面/背面，生成 3 张试穿图，在结果页做平滑过渡动画（CSS/Canvas），效果比 AI 生成转身视频更真实、更快、成本更低；
- **如果坚持做视频**：缩短为 90° 转身（正面 → 侧面），减少大角度旋转带来的伪影；或改为"正面微动 + 呼吸感 + 微调角度"的自然感视频，比完整转身可靠得多；
- **进阶**：使用骨骼驱动的视频生成（如 AnimateAnyone / MagicAnimate / Champ），用骨骼序列控制转身动作，服装和人体的一致性会好很多。

**问题 2：视频分辨率 1152×768 偏低**

在手机端全屏播放时，人物面部和服装细节会明显模糊。

→ **优化**：
- 提升到 1280×720 或 1920×1080（如果模型支持）；
- 生成后对关键帧做超分辨率处理（Real-ESRGAN），再重新编码视频。

**问题 3：帧率 24fps + 81-121 帧 = 3-5 秒，转身过快不自然**

真实人原地转身 180° 通常需要 2-3 秒，但 3-5 秒视频中包含的"有效转身"可能只有 1-2 秒（前后有静止帧），导致运动速度不均匀。

→ **优化**：
- 3 秒视频只做 90° 转身，帧率保持 24fps；
- 5 秒视频可以做到"静止 1s → 转身 2s → 静止 1s → 回转 1s"的节奏，更自然。

**问题 4：视频缺少人脸/服装一致性约束**

视频生成过程中，模型可能"忘记"输入图中的人脸和服装，导致后半段出现不同的人或不同的衣服。

→ **优化**：
- 提示词中强化身份锚定："全程人物面部与参考图完全一致，绝不可改变面部特征，服装在每一帧中保持与参考图完全一致的颜色和纹理"；
- 如果 API 支持，使用 video consistency / face reference 功能；
- 生成后用帧间人脸比对（如 ArcFace），如果检测到面部漂移，自动重试。

---

## 三、全局架构级优化

### 3.1 引入专业 VTON 模型（优先级最高）

当前最大瓶颈是用通用文生图模型做虚拟试穿。换用专业 VTON 模型，真实感可提升 3-5 倍。

**推荐路径**：
1. 短期：接入 Kolors Virtual Try-On API（快手，中文生态好，有 API 服务）或字节的 VTON 能力；
2. 中期：自部署 IDM-VTON / CatVTON（开源，可部署在云函数或轻量 GPU 服务器）；
3. 长期：微调 VTON 模型，用你自己积累的试穿数据做 domain adaptation。

### 3.2 人脸一致性体系

建一条独立的人脸一致性链路：
1. 用户上传照片 → 提取人脸 embedding（ArcFace / FaceNet）
2. 每次生成时将人脸 embedding 注入模型（IP-Adapter FaceID / InstantID）
3. 生成后验证人脸相似度，低于阈值自动重试

### 3.3 体型控制体系

从纯文本参数进化到视觉控制：
1. 用户参数 → 生成参数化骨骼图（OpenPose JSON → 渲染）
2. 骨骼图作为 ControlNet 输入，精确控制人体比例
3. 生成后用关键点检测验证，偏差自动修正

### 3.4 质量验证流水线

当前生成完成后没有任何自动化质量检测。建议增加：

| 检测项 | 方法 | 触发动作 |
|--------|------|---------|
| 人脸完整性 | 人脸检测 + 关键点 | 检测失败 → 重试 |
| 面部相似度 | ArcFace 与参考图比对 | <0.6 → 标记偏差 |
| 人体关键点完整性 | OpenPose 检测 | 缺失/多余 → 重试 |
| 体型比例偏差 | 肩宽/腿长比 vs 参数 | >15% → 标记偏差 |
| 服装颜色偏差 | 色彩直方图与参考图比对 | >20% → 标记偏差 |
| 多余/缺失肢体 | 肢体计数 | 异常 → 重试 |

### 3.5 分辨率与后处理升级

| 环节 | 当前 | 建议升级 |
|------|------|---------|
| 三视图 | 1×1024×1024 合成 | 3×1024×1024 独立 + 超分到 2048×2048 |
| 四视图 | 1×1024×1024 合成 | 4×1024×1024 独立，细节特写 1536×1536 |
| 试穿图 | 1×1024×1024 | 1×1536×1536 + 超分到 2048×2048 |
| 视频 | 1152×768 24fps | 1280×720 24fps + 关键帧超分 |
| 后处理 | 无 | 人脸修复 (CodeFormer) + 超分 (Real-ESRGAN) |

---

## 四、提示词工程专项优化

### 4.1 三视图提示词优化

**当前版本**（简述）：生成三视图，正面/侧面/背面并排，纯白背景，按参数还原...

**优化版本**：
```
RAW photo, real photograph of a [gender] person, ultra realistic, shot on Fujifilm XT4, 50mm lens, f/2.8.
Three-view character sheet: front view | side view | back view, same person in all three views, consistent face and body across views.
Body: [height]cm tall, [weight]kg, shoulder [shoulderCm]cm, bust [bustCm]cm, waist [waistCm]cm, hip [hipCm]cm, [skinToneDesc], natural skin texture with visible pores and subtle pigmentation, NO smoothing, NO beauty filter.
Pose: standing naturally, arms relaxed at sides, feet shoulder-width apart, wearing form-fitting light beige underwear that doesn't conceal body contours.
Lighting: studio three-point soft lighting, even illumination, no harsh shadows.
Background: pure white seamless backdrop, no props, no decorations, no text.
Face consistency: face, eyes, nose, mouth, and hairstyle MUST be identical to the reference photo — do not alter the person's identity.

Negative: (worst quality, low quality:1.4), deformed, bad anatomy, extra limbs, missing limbs, bad hands, asymmetric face, crossed eyes, cartoon, anime, painting, illustration, different person per view, background objects, text, watermark, logo, mannequin, plastic skin, beauty filter
```

**关键变化**：
- 增加 RAW photo / 相机型号等摄影术语，引导模型生成照片级画面
- 将"禁止"项从正文中抽到 negative prompt，正/负分离更有效
- 强调 "natural skin texture with visible pores"，避免模型自动磨皮
- "NO smoothing, NO beauty filter" 比"不做美颜"更精确

### 4.2 试穿图提示词优化

**优化版本**：
```
RAW photo, ultra realistic full-body photograph of a [gender] person wearing [garmentNames], shot on Sony A7IV, 35mm lens, natural lighting.
Person: face and body identical to reference photo — same person, same proportions. [height]cm, [weight]kg, [skinToneDesc], natural unretouched skin.
Garment: wearing [garmentDescription with layer order], each garment's cut, color, pattern, fabric texture, stitching, buttons, and zippers exactly matching the corresponding reference photo. NO design changes, NO added details.
Fit: garments drape naturally according to fabric weight, wrinkles and folds follow real physics, waist/shoulder/hip fit true to size.
Pose: standing facing camera, arms relaxed at sides, feet shoulder-width apart, weight evenly distributed.
Scene: clean white background, even soft lighting from three directions, no shadows on body, no props.
Style: editorial fashion photography, sharp focus on garment details, shallow depth of field on background.

Negative: (worst quality, low quality:1.4), deformed body, wrong body proportions, extra arms, missing fingers, distorted face, beauty filter, smooth skin, clothing merge, color bleed, different garment than reference, added accessories not in reference, background clutter, text, watermark, mannequin, plastic skin, anime, cartoon, illustration, painting, low resolution, blurry, oversaturated
```

**关键变化**：
- "each garment's cut...exactly matching the corresponding reference photo" 比 "完全一致" 更具体
- 增加 "Fit" 段落描述合身感和物理褶皱
- 增加 "garment drape naturally according to fabric weight" 让模型理解不同面料的垂坠行为
- 摄影术语引导照片级输出

### 4.3 视频提示词优化

**优化版本**：
```
Cinematic video of a [gender] person standing and slowly turning 90 degrees from front to side profile, shot on stationary camera, no zoom or pan.
Person: face, body, and outfit remain EXACTLY the same as the input image throughout the entire video — zero change in facial features, body shape, or garment appearance across all frames.
Outfit: [garmentName], fabric texture and color consistent in every frame, clothing moves naturally with the turn — fabric drapes, wrinkles shift realistically as body rotates, no flickering or color shifting.
Motion: slow, smooth 90-degree turn from front-facing to side-facing over 2 seconds, then hold side pose for 1 second. Feet stay planted, no sliding. Arms remain relaxed.
Camera: fixed tripod, eye-level, no movement.
Lighting: consistent studio soft light throughout, no lighting changes.
Background: pure white, no environment.
Style: photorealistic, cinematic, 24fps, high quality, natural motion.

Negative: (worst quality, low quality:1.4), face morphing, face disappearing, body shape change, clothing color shift, fabric flickering, extra limbs, missing limbs, jumpy motion, stutter, low fps, cartoon, anime, painting, blurry frames, ghost artifacts, duplicate person, background change, camera movement
```

**关键变化**：
- 从 180° 降到 90°，大幅降低伪影概率
- "zero change in facial features...across all frames" 逐帧一致性约束
- "fabric drapes, wrinkles shift realistically as body rotates" 物理运动描述
- "no flickering or color shifting" 针对图生视频最常见的问题
- 详细的 negative prompt 覆盖视频特有伪影

---

## 五、优先级排序与落地路径

### P0 — 立即可做（不改模型，只改提示词和流程）

| 序号 | 优化项 | 预期效果 | 工作量 |
|------|--------|---------|--------|
| 1 | 添加 negative prompt 到所有 4 条链路 | 减少伪影/变形 30-50% | 0.5 天 |
| 2 | 三视图/四视图改为独立生成 | 单视图分辨率提升 3-4 倍 | 1 天 |
| 3 | 提示词增加摄影术语 + 画质词 | 画面质感明显提升 | 0.5 天 |
| 4 | 视频从 180° 降到 90° | 视频伪影减少 50%+ | 0.5 天 |
| 5 | 肤色从参考图自动提取 | 肤色还原度提升 | 1 天 |
| 6 | 多件服装增加层次描述 | 叠穿效果更自然 | 0.5 天 |

### P1 — 近期重点（1-2 周）

| 序号 | 优化项 | 预期效果 | 工作量 |
|------|--------|---------|--------|
| 7 | 接入专业 VTON 模型替代通用文生图 | 试穿真实感质变 | 3-5 天 |
| 8 | 接入人脸保持技术 (IP-Adapter FaceID) | 面部一致性 30%→85% | 2-3 天 |
| 9 | 生成后质量验证流水线 | 自动拦截低质量结果 | 2-3 天 |
| 10 | 增加姿态/场景预设选项 | 结果更自然多样 | 1-2 天 |

### P2 — 中期优化（1-2 月）

| 序号 | 优化项 | 预期效果 | 工作量 |
|------|--------|---------|--------|
| 11 | ControlNet/OpenPose 骨骼控制体型 | 体型精确还原 | 1 周 |
| 12 | 生成后人脸/体型偏差自动检测 | 参数还原可量化 | 1 周 |
| 13 | 视频后处理（超分+人脸修复） | 视频清晰度提升 | 1 周 |
| 14 | 多角度静态图 + 过渡动画替代转身视频 | 更可靠的展示方案 | 1 周 |

---

## 六、最终效果对比预测

| 指标 | 当前方案 | P0 优化后 | P1 优化后 | P2 优化后 |
|------|---------|----------|----------|----------|
| 三视图面部一致性 | ~30% | ~40% | ~85% | ~90% |
| 试穿服装还原度 | ~40% | ~50% | ~85% | ~90% |
| 体型参数还原度 | ~35% | ~40% | ~60% | ~80% |
| 视频转身自然度 | ~30% | ~50% | ~65% | ~80% |
| 单视图分辨率 | ~340×1024 | ~1024×1024 | ~1024×1024 | ~2048×2048 |
| 生成成功率（无需重试） | ~60% | ~70% | ~80% | ~85% |

> 注：百分比基于同类模型和方案的行业经验估算，具体数值需实测校准。

---

*文档日期：2026-08-19*
*基于 weixin002 仓库 main 分支 (commit 5be5722) 的全量代码审阅*
