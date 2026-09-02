/* 试穿视频提示词：源自 .agnes/jimeng-2026-08-16-2206-写实人衣匹配视频生成提示词.md
   输入为已生成的穿搭效果图（图生视频）：人物外观与服装必须与参考图完全一致 */
const { skinToneDesc } = require("./avatarViews");
const num = (x, fallback) => (typeof x === "number" && isFinite(x)) ? x : fallback;

function buildTryonVideoPrompt(profile, garmentName) {
  return `基于参考图生成动态视频：人物外观、面部、发型与所穿【${garmentName}】服装与参考图完全一致，全程不可改变。
人物全身入镜：身高${num(profile.heightCm, 170)}厘米，体重${num(profile.weightKg, 60)}公斤，鞋码${num(profile.shoeSize, 40)}码，肩宽${num(profile.shoulderCm, 40)}厘米，胸围${num(profile.bustCm, 90)}厘米，腰围${num(profile.waistCm, 70)}厘米，臀围${num(profile.hipCm, 92)}厘米，臂长${num(profile.armLengthCm, 55)}厘米，腿长${num(profile.legLengthCm, 80)}厘米，颈长${num(profile.neckLengthCm, 10)}厘米，${skinToneDesc(profile.skinTone)}。
动作：人物初始正面站姿，双手垂于身体两侧，随后缓慢原地转身180度完整展示从正面到背面的过程，转身时服装摆动与垂坠符合真实物理，双脚原地不滑动。
镜头：固定机位，无推拉摇移。
画面：纯白色背景，均匀柔和打光，自然写实，质感真实。
禁止：人物面部或服装在转身过程中变形、闪烁或跳变，多余人物与杂物，画面文字与水印。`;
}

module.exports = { buildTryonVideoPrompt };
