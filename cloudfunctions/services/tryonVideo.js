/* 试穿视频提示词：源自 .agnes/jimeng-2026-08-16-2206-写实人衣匹配视频生成提示词.md */
const { skinToneDesc } = require("./avatarViews");

function buildTryonVideoPrompt(profile, garmentName) {
  return `纯白色纯净背景，均匀三点柔光打光，无多余道具、无装饰、无多余环境元素，画面全程聚焦完整人物全身：
人物严格按照真实人体参数等比例还原：身高${profile.heightCm}cm、体重${profile.weightKg}kg、鞋码${profile.shoeSize}码，肩宽${profile.shoulderCm}cm，胸围${profile.bustCm}cm、腰围${profile.waistCm}cm、臀围${profile.hipCm}cm，臂长${profile.armLengthCm}cm，腿长${profile.legLengthCm}cm，颈长${profile.neckLengthCm}cm，${skinToneDesc(profile.skinTone)}，皮肤表面保留真实的细微毛孔、色素沉淀和自然肌理，全程不做任何美颜美化。
人物身上穿着指定参考服装【${garmentName}】，服装100%还原参考原图所有真实特征，版型、颜色、面料纹理、缝线、纽扣/拉链细节、水洗效果、自然使用痕迹和原图完全一致，不对服装做任何外观优化、不刻意提升质感、不添加任何原图不存在的高级效果。
人物初始站姿为双手自然垂于身体两侧、双脚分开与肩同宽，随后缓慢原地静态转身180度，镜头保持固定不动，完整自然展示人物从正面转向背面的全过程，依次呈现人物着装的正面、侧转过程、背面的完整全身效果，全程所有身体部位比例严格写实，服装与人体贴合自然，不出现任何夸张美化效果，完整呈现普通人日常着装的真实自然状态。
全局强制规则：全程无滤镜无后期美化，所有画面保持原生真实质感，允许视觉效果不够精致好看。`;
}

module.exports = { buildTryonVideoPrompt };
