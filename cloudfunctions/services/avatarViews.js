/* 人物三视图提示词：源自 .agnes/jimeng-2026-08-16-7722-真人写实三视图生成提示词文档.md */
const SKIN_TONE_MAP = {
  light: "自然偏浅肤色",
  natural: "自然黄种人肤色",
  tan: "小麦色肤色",
  deep: "偏深肤色"
};

function skinToneDesc(skinTone) {
  return SKIN_TONE_MAP[skinTone] || "自然黄种人肤色";
}

function buildAvatarViewsPrompt(profile) {
  return `真人写实等比例三视图人物设定图，同一张图内横向并排展示完整人物的正面视图、左侧面视图、背面视图，三个视图的人物完全为同一人，站姿统一为双手自然垂于身体两侧、双脚分开与肩同宽，全程不做任何美颜美化、不加滤镜、不磨皮、不拉长腿、不调整五官比例，完全按照真实人体参数等比例还原：身高${profile.heightCm}cm、体重${profile.weightKg}kg、鞋码${profile.shoeSize}码，肩宽${profile.shoulderCm}cm，胸围${profile.bustCm}cm、腰围${profile.waistCm}cm、臀围${profile.hipCm}cm，臂长${profile.armLengthCm}cm，腿长${profile.legLengthCm}cm，颈长${profile.neckLengthCm}cm，${skinToneDesc(profile.skinTone)}，皮肤表面保留真实的细微毛孔、色素沉淀和自然肌理。纯白色纯净背景，均匀三点柔光打光，无多余道具、无装饰、无环境元素，画面仅展示三个视角的完整真人全身像，所有身体部位比例严格写实、不存在任何夸张美化效果。`;
}

module.exports = { buildAvatarViewsPrompt, skinToneDesc };
