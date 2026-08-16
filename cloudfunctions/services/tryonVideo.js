/* 试穿视频提示词：源自 .agnes/jimeng-2026-08-16-2206-写实人衣匹配视频生成提示词.md */
const { skinToneDesc } = require("./avatarViews");
const num = (x, fallback) => (typeof x === "number" && isFinite(x)) ? x : fallback;

function buildTryonVideoPrompt(profile, garmentName) {
  return `纯白色背景，均匀柔和打光，画面聚焦完整人物全身：身高${num(profile.heightCm, 170)}厘米，体重${num(profile.weightKg, 60)}公斤，鞋码${num(profile.shoeSize, 40)}码，肩宽${num(profile.shoulderCm, 40)}厘米，胸围${num(profile.bustCm, 90)}厘米，腰围${num(profile.waistCm, 70)}厘米，臀围${num(profile.hipCm, 92)}厘米，臂长${num(profile.armLengthCm, 55)}厘米，腿长${num(profile.legLengthCm, 80)}厘米，颈长${num(profile.neckLengthCm, 10)}厘米，${skinToneDesc(profile.skinTone)}。
人物穿着【${garmentName}】这件服装，服装的版型、颜色和面料细节与参考图一致。
人物初始站姿自然，双手垂于身体两侧，随后缓慢原地转身180度，镜头保持固定，完整展示人物从正面到背面的过程，自然写实，质感真实。`;
}

module.exports = { buildTryonVideoPrompt };
