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
  ["165cm", "50kg", "38码", "38cm", "88cm", "66cm", "92cm", "55cm", "96cm", "9cm", "自然黄种人肤色"].forEach((s) => {
    assert.ok(p.includes(s), "缺少 " + s);
  });
  assert.ok(p.includes("正面视图") && p.includes("左侧面视图") && p.includes("背面视图"));
});

test("buildGarmentViewsPrompt 包含服装名与四视图要求", () => {
  const p = buildGarmentViewsPrompt("浅蓝色水洗直筒牛仔裤");
  assert.ok(p.includes("浅蓝色水洗直筒牛仔裤"));
  assert.ok(p.includes("2x2均等排布"));
  assert.ok(p.includes("正面平拍") && p.includes("背面平拍"));
});

test("buildTryonVideoPrompt 包含参数与180度转身", () => {
  const p = buildTryonVideoPrompt(profile, "白色基础T恤");
  assert.ok(p.includes("165cm") && p.includes("白色基础T恤"));
  assert.ok(p.includes("原地静态转身180度"));
  assert.ok(p.includes("无滤镜"));
});
