/* 免费版参数化数字人建模：profile → avatarModel（纯数据，无 canvas 依赖，可单测） */

const TAU = Math.PI * 2;

const SKIN_TONES = [
  { key: "light", color: "#F2D5C4" },
  { key: "natural", color: "#E8B895" },
  { key: "wheat", color: "#C68B5E" },
  { key: "deep", color: "#8D5A3B" }
];

const GENDER_DEFAULTS = {
  female: {
    shoulderCm: 38, bustCm: 88, waistCm: 66, hipCm: 92,
    legRatio: 0.58, neckLengthCm: 10, armLengthCm: 55, shoeSize: 38,
    hairStyle: "long", hairColor: "#3B2F2A", weightKg: 52
  },
  male: {
    shoulderCm: 44, bustCm: 96, waistCm: 82, hipCm: 94,
    legRatio: 0.56, neckLengthCm: 12, armLengthCm: 58, shoeSize: 42,
    hairStyle: "short", hairColor: "#241B16", weightKg: 68
  }
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function skinFromValue(v) {
  if (v === undefined || v === null || v === "") return "natural";
  if (typeof v === "string") return SKIN_TONES.some((s) => s.key === v) ? v : "natural";
  if (v < 25) return "light";
  if (v < 55) return "natural";
  if (v < 80) return "wheat";
  return "deep";
}

function buildModel(profile) {
  const gender = profile.gender === "male" ? "male" : "female";
  const d = GENDER_DEFAULTS[gender];
  const estimate = profile.estimate !== false;

  const heightCm = Number(profile.heightCm) || 165;
  const weightKg = Number(profile.weightKg) || d.weightKg;
  const shoulderCm = estimate || !profile.shoulderCm ? d.shoulderCm : Number(profile.shoulderCm);
  const bustCm = estimate || !profile.bustCm ? d.bustCm : Number(profile.bustCm);
  const waistCm = estimate || !profile.waistCm ? d.waistCm : Number(profile.waistCm);
  const hipCm = estimate || !profile.hipCm ? d.hipCm : Number(profile.hipCm);
  const legLengthCm = Number(profile.legLengthCm) || Math.round(heightCm * d.legRatio);
  const neckLengthCm = Number(profile.neckLengthCm) || d.neckLengthCm;
  const armLengthCm = Number(profile.armLengthCm) || d.armLengthCm;
  const shoeSize = Number(profile.shoeSize) || d.shoeSize;
  const skinKey = skinFromValue(profile.skinTone);
  const skin = SKIN_TONES.find((s) => s.key === skinKey).color;
  const hairStyle = d.hairStyle;
  const hairColor = d.hairColor;

  // 纵向关键点（y 向上，地面 y=0）
  const headTopY = heightCm;
  const headH = clamp(heightCm * 0.132, 20, 26);
  const headBaseY = headTopY - headH;
  const neckBaseY = headBaseY - neckLengthCm;
  const shoulderY = neckBaseY - 2;
  const hipY = legLengthCm;
  const torsoH = Math.max(18, shoulderY - hipY);
  const chestY = shoulderY - torsoH * 0.3;
  const waistY = hipY + torsoH * 0.42;
  const crotchY = Math.max(0, hipY - 6);
  const kneeY = hipY * 0.5;
  const ankleY = Math.max(3, shoeSize * 0.14);
  const footLen = 8 + shoeSize * 0.42;

  const shoulderHalf = shoulderCm / 2;
  const upperArm = armLengthCm * 0.46;
  const foreArm = armLengthCm * 0.42;
  const handLen = armLengthCm * 0.12;

  const chestR = bustCm / TAU * 0.92;
  const waistR = waistCm / TAU * 0.92;
  const hipR = hipCm / TAU * 0.92;
  const headR = headH * 0.44;
  const neckR = 4;
  const upperArmR = 3.1 + weightKg * 0.006;
  const foreArmR = 2.6 + weightKg * 0.005;
  const handR = 2.2;
  const thighR = 5.6 + hipCm * 0.008;
  const shinR = 4.2 + weightKg * 0.004;
  const footR = 2.6;
  const legX = clamp(hipR * 0.45, 5, 8);

  const bodyColor = skin;
  const accent = "#E3A595";

  const segments = [
    { name: "head", a: [0, headBaseY + 2, 0], b: [0, headTopY, 0], r: headR, color: bodyColor },
    { name: "neck", a: [0, neckBaseY, 0], b: [0, headBaseY, 0], r: neckR, color: bodyColor },
    { name: "chest", a: [0, shoulderY, 0], b: [0, waistY, 0], r: chestR, color: bodyColor },
    { name: "waist", a: [0, waistY, 0], b: [0, hipY, 0], r: waistR, color: bodyColor },
    { name: "hip", a: [0, hipY, 0], b: [0, crotchY, 0], r: hipR, color: bodyColor },
    { name: "shorts", a: [-hipR * 0.8, hipY - 2, 2], b: [hipR * 0.8, hipY - 2, 2], r: 3.2, color: accent },
    { name: "arm-r-upper", a: [shoulderHalf, shoulderY, 0], b: [shoulderHalf + upperArm, shoulderY - 2, 0], r: upperArmR, color: bodyColor },
    { name: "arm-r-fore", a: [shoulderHalf + upperArm, shoulderY - 2, 0], b: [shoulderHalf + upperArm + foreArm, shoulderY - 4, 0], r: foreArmR, color: bodyColor },
    { name: "arm-r-hand", a: [shoulderHalf + upperArm + foreArm, shoulderY - 4, 0], b: [shoulderHalf + upperArm + foreArm + handLen, shoulderY - 4, 0], r: handR, color: bodyColor },
    { name: "arm-l-upper", a: [-shoulderHalf, shoulderY, 0], b: [-shoulderHalf - upperArm, shoulderY - 2, 0], r: upperArmR, color: bodyColor },
    { name: "arm-l-fore", a: [-shoulderHalf - upperArm, shoulderY - 2, 0], b: [-shoulderHalf - upperArm - foreArm, shoulderY - 4, 0], r: foreArmR, color: bodyColor },
    { name: "arm-l-hand", a: [-shoulderHalf - upperArm - foreArm, shoulderY - 4, 0], b: [-shoulderHalf - upperArm - foreArm - handLen, shoulderY - 4, 0], r: handR, color: bodyColor },
    { name: "leg-r-thigh", a: [legX, hipY, 0], b: [legX, kneeY, 0], r: thighR, color: bodyColor },
    { name: "leg-r-shin", a: [legX, kneeY, 0], b: [legX, ankleY, 0], r: shinR, color: bodyColor },
    { name: "leg-r-foot", a: [legX, ankleY, 0], b: [legX, ankleY, footLen], r: footR, color: bodyColor },
    { name: "leg-l-thigh", a: [-legX, hipY, 0], b: [-legX, kneeY, 0], r: thighR, color: bodyColor },
    { name: "leg-l-shin", a: [-legX, kneeY, 0], b: [-legX, ankleY, 0], r: shinR, color: bodyColor },
    { name: "leg-l-foot", a: [-legX, ankleY, 0], b: [-legX, ankleY, footLen], r: footR, color: bodyColor }
  ];

  const hair = [{ shape: "cap", center: [0, headTopY - headH * 0.22, 0], r: headR * 1.02, color: hairColor }];
  if (hairStyle === "long") {
    hair.push(
      { shape: "strand", a: [headR * 0.7, headBaseY + headH * 0.55, -headR * 0.35], b: [headR * 0.95, neckBaseY - 3, -headR * 0.45], r: 3.2, color: hairColor },
      { shape: "strand", a: [-headR * 0.7, headBaseY + headH * 0.55, -headR * 0.35], b: [-headR * 0.95, neckBaseY - 3, -headR * 0.45], r: 3.2, color: hairColor }
    );
  }

  const measures = [
    { label: "身高", value: Math.round(heightCm), a: [0, headTopY, 0], b: [0, 0, 0] },
    { label: "肩宽", value: Math.round(shoulderCm), a: [-shoulderHalf, shoulderY, 0], b: [shoulderHalf, shoulderY, 0] },
    { label: "胸围", value: Math.round(bustCm), a: [-chestR, chestY, 0], b: [chestR, chestY, 0] },
    { label: "腰围", value: Math.round(waistCm), a: [-waistR, waistY, 0], b: [waistR, waistY, 0] },
    { label: "臀围", value: Math.round(hipCm), a: [-hipR, hipY, 0], b: [hipR, hipY, 0] },
    { label: "腿长", value: Math.round(legLengthCm), a: [-legX - 3, hipY, 0], b: [-legX - 3, 0, 0] }
  ];

  return {
    kind: "free",
    version: "free-v1",
    profile: {
      gender, heightCm, weightKg, shoulderCm, bustCm, waistCm, hipCm,
      legLengthCm, neckLengthCm, armLengthCm, shoeSize, skinTone: skinKey, estimate
    },
    body: { heightCm, skin, hairColor, hairStyle, segments, hair, measures }
  };
}

module.exports = buildModel;
module.exports.skinFromValue = skinFromValue;
module.exports.GENDER_DEFAULTS = GENDER_DEFAULTS;
