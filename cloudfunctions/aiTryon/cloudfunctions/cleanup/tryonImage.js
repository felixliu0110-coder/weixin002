/* 穿搭效果图提示词：人物三视图 + 衣物图（参考图）→ 穿搭效果图的合成任务描述
   参考图顺序约定：第 1 张为人物三视图，其后依次为各衣物图（与 refImages 传参顺序一致） */
const { skinToneDesc } = require("./avatarViews");
const num = (x, fallback) => (typeof x === "number" && isFinite(x)) ? x : fallback;

function buildTryonImagePrompt(profile, garmentNames, refCount) {
  const names = (garmentNames && garmentNames.length > 0) ? garmentNames.join("、") : "所选衣物";
  const hasAvatarRef = (refCount || 0) >= 1;
  const garmentRefStart = hasAvatarRef ? 2 : 1; // 衣物参考图从第几张开始编号

  const personBlock = hasAvatarRef
    ? `人物（依据第1张参考图的人物三视图）：面部、五官、发型与三视图完全一致，不可改变人物身份；身高${num(profile.heightCm, 170)}厘米，体重${num(profile.weightKg, 60)}公斤，肩宽${num(profile.shoulderCm, 40)}厘米，胸围${num(profile.bustCm, 90)}厘米，腰围${num(profile.waistCm, 70)}厘米，臀围${num(profile.hipCm, 92)}厘米，腿长${num(profile.legLengthCm, 80)}厘米，${skinToneDesc(profile.skinTone)}，身材比例与三视图一致。`
    : `人物：身高${num(profile.heightCm, 170)}厘米，体重${num(profile.weightKg, 60)}公斤，肩宽${num(profile.shoulderCm, 40)}厘米，胸围${num(profile.bustCm, 90)}厘米，腰围${num(profile.waistCm, 70)}厘米，臀围${num(profile.hipCm, 92)}厘米，腿长${num(profile.legLengthCm, 80)}厘米，${skinToneDesc(profile.skinTone)}。`;

  const garmentBlock = (garmentNames && garmentNames.length > 0 && (refCount || 0) >= garmentRefStart)
    ? `服装（依据第${garmentRefStart}张起的衣物参考图）：人物穿着【${names}】，每件服装的版型、颜色、图案、面料质地与对应衣物参考图完全一致，穿搭层次清晰，合身自然，褶皱与垂坠符合真实物理。`
    : `服装：人物穿着【${names}】，版型合身，细节真实自然。`;

  return `虚拟试衣合成：将参考衣物穿在参考人物身上，生成一张照片级全身穿搭效果图。
${personBlock}
${garmentBlock}
画面：纯白色背景，均匀柔和三点布光，人物全身正面站姿，双手自然垂于身体两侧，构图居中且完整入镜，写实摄影风格，细节清晰。
禁止：改变人物面部特征，服装变形、串色或添加参考图中没有的配饰，背景杂物，画面文字与水印。`;
}

module.exports = { buildTryonImagePrompt };
