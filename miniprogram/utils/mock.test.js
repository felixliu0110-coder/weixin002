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

test("mock AI 接口可用且返回占位素材", async () => {
  const views = await mock.getAvatarViews();
  assert.ok(views.views.composite.includes("/assets/img/p05-avatar.jpg"));
  const gv = await mock.ensureGarmentViews("g-tee", "白色基础T恤");
  assert.strictEqual(gv.status, "ready");
  const cached = await mock.ensureGarmentViews("g-tee", "白色基础T恤");
  assert.strictEqual(cached.cached, true);
  const t = await mock.submitAiTryon({ avatarViewId: "av-1", garmentIds: ["g-tee"] });
  assert.strictEqual(t.status, "processing");
  const s1 = await mock.getAiTryonStatus(t.taskId);
  assert.strictEqual(s1.stage, "garment_views");
  const s2 = await mock.getAiTryonStatus(t.taskId);
  assert.strictEqual(s2.stage, "video");
  const s3 = await mock.getAiTryonStatus(t.taskId);
  assert.strictEqual(s3.status, "success");
  assert.ok(s3.tryonVideo.includes(".mp4"));
  // 删除联动：删除模板衣物后四视图缓存被清理
  const before = await mock.ensureGarmentViews("g-del-test", "测试衣物");
  assert.strictEqual(before.cached, false);
  await mock.deleteItems("library", ["g-del-test"]);
  const after = await mock.ensureGarmentViews("g-del-test", "测试衣物");
  assert.strictEqual(after.cached, false);
});
