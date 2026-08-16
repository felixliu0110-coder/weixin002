/* 人物三视图提示词：源自 .agnes/jimeng-2026-08-16-7722-真人写实三视图生成提示词文档.md */
const num = (x, fallback) => (typeof x === "number" && isFinite(x)) ? x : fallback;

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
  const gender = profile.gender === "male" ? "男性" : "女性";
  return `一位${gender}的数字人物形象，全身像，同一画面并排展示正面、侧面、背面三个角度，站姿自然，身高${num(profile.heightCm, 170)}厘米，体重${num(profile.weightKg, 60)}公斤，肩宽${num(profile.shoulderCm, 40)}厘米，臂长${num(profile.armLengthCm, 55)}厘米，腿长${num(profile.legLengthCm, 80)}厘米，胸围${num(profile.bustCm, 90)}厘米，腰围${num(profile.waistCm, 70)}厘米，臀围${num(profile.hipCm, 92)}厘米，鞋码${num(profile.shoeSize, 40)}码，颈长${num(profile.neckLengthCm, 10)}厘米，${skinToneDesc(profile.skinTone)}，纯白色背景，均匀三点柔光，写实风格，画面干净无多余元素`;
}

module.exports = { buildAvatarViewsPrompt, skinToneDesc };
