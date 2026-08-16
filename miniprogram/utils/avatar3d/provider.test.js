const test = require("node:test");
const assert = require("node:assert");
const provider = require("./provider");

test("generate 默认返回免费版模型并保留档案", async () => {
  const model = await provider.generate({ gender: "female", heightCm: 165, weightKg: 50 });
  assert.strictEqual(model.kind, "free");
  assert.strictEqual(model.profile.heightCm, 165);
});

test("generate({kind:'free'}) 显式指定同样可用", async () => {
  const model = await provider.generate({ gender: "male", heightCm: 175, weightKg: 65 }, { kind: "free" });
  assert.strictEqual(model.kind, "free");
});

test("AI 版生成器未实现时明确抛错", async () => {
  await assert.rejects(() => provider.generate({}, { kind: "ai" }), /not implemented/);
});
