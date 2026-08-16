const test = require("node:test");
const assert = require("node:assert");
const { buildAvatarViewsPrompt } = require("./avatarViews");
const { buildGarmentViewsPrompt } = require("./garmentViews");
const { buildTryonVideoPrompt } = require("./tryonVideo");

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

test("buildGarmentViewsPrompt 包含服装名与四视图要求", () => {
  const p = buildGarmentViewsPrompt("浅蓝色水洗直筒牛仔裤");
  assert.ok(p.includes("浅蓝色水洗直筒牛仔裤"));
  assert.ok(p.includes("2x2均等排布"));
  assert.ok(p.includes("正面平拍") && p.includes("背面平拍"));
});

test("buildTryonVideoPrompt 包含参数与180度转身", () => {
  const p = buildTryonVideoPrompt(profile, "白色基础T恤");
  assert.ok(p.includes("165厘米") && p.includes("白色基础T恤"));
  assert.ok(p.includes("原地转身180度"));
  assert.ok(p.includes("自然写实"));
});
