/* 人物三视图提示词：源自 .agnes/jimeng-2026-08-16-7722-真人写实三视图生成提示词文档.md
   结构：任务定义 → 人物（参考图锚定+身材参数）→ 画面规格 → 禁止项 */
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

function buildAvatarViewsPrompt(profile, refCount) {
  const gender = profile.gender === "male" ? "男性" : "女性";
  const faceAnchor = (refCount || 0) > 0
    ? "面部、五官、发型与参考图中的同一人物完全一致，不可改变人物身份，"
    : "";
  return `生成一位${gender}数字人物的写实三视图，同一画面并排展示正面、侧面、背面三个全身角度，三个视角人物等高、朝向清晰、比例一致。
人物：${faceAnchor}站姿自然，双臂自然下垂，身高${num(profile.heightCm, 170)}厘米，体重${num(profile.weightKg, 60)}公斤，肩宽${num(profile.shoulderCm, 40)}厘米，臂长${num(profile.armLengthCm, 55)}厘米，腿长${num(profile.legLengthCm, 80)}厘米，胸围${num(profile.bustCm, 90)}厘米，腰围${num(profile.waistCm, 70)}厘米，臀围${num(profile.hipCm, 92)}厘米，鞋码${num(profile.shoeSize, 40)}码，颈长${num(profile.neckLengthCm, 10)}厘米，${skinToneDesc(profile.skinTone)}，身穿贴身浅色基础内衣（不遮挡身材轮廓）。
画面：纯白色背景，均匀三点柔光，写实风格，画面干净无多余元素。
禁止：三个视角人物不一致，面部变形，肢体缺失或多余，画面文字与水印。`;
}

module.exports = { buildAvatarViewsPrompt, skinToneDesc };
