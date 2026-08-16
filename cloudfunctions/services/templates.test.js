const test = require("node:test");
const assert = require("node:assert");
const { buildAvatarViewsPrompt } = require("./avatarViews");
const { buildGarmentViewsPrompt } = require("./garmentViews");
const { buildTryonVideoPrompt } = require("./tryonVideo");
const { buildTryonImagePrompt } = require("./tryonImage");

const profile = {
  heightCm: 165, weightKg: 50, shoeSize: 38,
  shoulderCm: 38, bustCm: 88, waistCm: 66, hipCm: 92,
  armLengthCm: 55, legLengthCm: 96, neckLengthCm: 9,
  skinTone: "natural"
};

test("buildAvatarViewsPrompt 包含全部身材参数", () => {
  const p = buildAvatarViewsPrompt(profile);
  ["165厘米", "50公斤", "38码", "38厘米", "88厘米", "66厘米", "92厘米", "55厘米", "96厘米", "9厘米", "自然黄种人肤色"].forEach((s) => {
    assert.ok(p.includes(s), "缺少 " + s);
  });
  assert.ok(p.includes("正面") && p.includes("侧面") && p.includes("背面"));
});

test("buildAvatarViewsPrompt 有参考图时锚定人物一致性", () => {
  const withRef = buildAvatarViewsPrompt(profile, 1);
  assert.ok(withRef.includes("与参考图中的同一人物完全一致"));
  const noRef = buildAvatarViewsPrompt(profile, 0);
  assert.ok(!noRef.includes("参考图中的同一人物"));
});

test("buildGarmentViewsPrompt 包含服装名与四视图要求", () => {
  const p = buildGarmentViewsPrompt("浅蓝色水洗直筒牛仔裤", 1);
  assert.ok(p.includes("浅蓝色水洗直筒牛仔裤"));
  assert.ok(p.includes("2x2均等排布"));
  assert.ok(p.includes("正面平拍") && p.includes("背面平拍"));
  assert.ok(p.includes("与参考图完全一致"));
});

test("buildTryonVideoPrompt 包含参数与180度转身", () => {
  const p = buildTryonVideoPrompt(profile, "白色基础T恤");
  assert.ok(p.includes("165厘米") && p.includes("白色基础T恤"));
  assert.ok(p.includes("原地转身180度"));
  assert.ok(p.includes("自然写实"));
  assert.ok(p.includes("与参考图完全一致"));
});

test("buildTryonImagePrompt 三视图+衣物参考图齐全时锚定两方", () => {
  const p = buildTryonImagePrompt(profile, ["白色基础T恤", "浅蓝色牛仔裤"], 3);
  assert.ok(p.includes("第1张参考图的人物三视图"), "缺少三视图锚定");
  assert.ok(p.includes("完全一致，不可改变人物身份"));
  assert.ok(p.includes("白色基础T恤") && p.includes("浅蓝色牛仔裤"));
  assert.ok(p.includes("第2张起的衣物参考图"), "缺少衣物参考图锚定");
  assert.ok(p.includes("165厘米") && p.includes("88厘米") && p.includes("自然黄种人肤色"));
  assert.ok(p.includes("禁止"));
});

test("buildTryonImagePrompt 无参考图时降级为纯参数描述", () => {
  const p = buildTryonImagePrompt(profile, ["白色基础T恤"], 0);
  assert.ok(!p.includes("三视图"), "不应包含三视图锚定");
  assert.ok(p.includes("白色基础T恤"));
  assert.ok(p.includes("165厘米"));
});
