const test = require("node:test");
const assert = require("node:assert");
const mock = require("./mock");

test("getAvatarProfile 返回 PRD 示例档案并含示例标记", async () => {
  const profile = await mock.getAvatarProfile();
  assert.strictEqual(profile.heightCm, 165);
  assert.strictEqual(profile.weightKg, 50);
  assert.strictEqual(profile.bustCm, 88);
  assert.strictEqual(profile.waistCm, 66);
  assert.strictEqual(profile.hipCm, 92);
  assert.strictEqual(profile.isExample, true);
});

test("getAvatarProfile 含建模所需全部字段", async () => {
  const profile = await mock.getAvatarProfile();
  assert.ok(profile.neckLengthCm > 0);
  assert.ok(profile.shoulderCm > 0);
  assert.ok(profile.armLengthCm > 0);
  assert.ok(profile.shoeSize > 0);
  assert.strictEqual(typeof profile.skinTone, "string");
});

test("getQuota 返回每日 3 次示例额度", async () => {
  const quota = await mock.getQuota();
  assert.strictEqual(quota.dailyFree, 3);
  assert.strictEqual(quota.used, 0);
});

test("submitTryon 生成任务并在默认策略下成功", async () => {
  const task = await mock.submitTryon({ avatarId: "a1", garmentId: "g1", pose: "front" });
  assert.strictEqual(task.status, "success");
  assert.ok(task.resultUrls.length > 0);
});
