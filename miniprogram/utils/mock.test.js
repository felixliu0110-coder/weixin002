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

test("getMyGarments 返回上传衣物（mock），deleteItems(myGarments) 可删除", async () => {
  const item = await mock.uploadGarment("cloud://mock/x.png", { name: "测试上衣", category: "上衣" });
  const list = await mock.getMyGarments();
  assert.ok(list.some((g) => g.id === item.id && g.image === "cloud://mock/x.png"));
  await mock.deleteItems("myGarments", [item.id]);
  const after = await mock.getMyGarments();
  assert.ok(!after.some((g) => g.id === item.id));
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
  // 图片模式：提交即出图完成（视频由用户后续选择生成）
  const t = await mock.submitAiTryon({ avatarViewId: "av-1", garmentIds: ["g-tee"] });
  assert.strictEqual(t.status, "success");
  assert.ok(t.tryonImage.includes("/assets/img/p07-result.jpg"));
  // 视频模式：提交后轮询至完成
  const tv = await mock.submitAiTryon({ avatarViewId: "av-1", garmentIds: ["g-tee"], mode: "video" });
  assert.strictEqual(tv.status, "processing");
  const s1 = await mock.getAiTryonStatus(tv.taskId);
  assert.strictEqual(s1.stage, "video");
  const s2 = await mock.getAiTryonStatus(tv.taskId);
  assert.strictEqual(s2.status, "success");
  assert.ok(s2.tryonVideo.includes(".mp4"));
  // 删除联动：删除模板衣物后四视图缓存被清理
  const before = await mock.ensureGarmentViews("g-del-test", "测试衣物");
  assert.strictEqual(before.cached, false);
  await mock.deleteItems("library", ["g-del-test"]);
  const after = await mock.ensureGarmentViews("g-del-test", "测试衣物");
  assert.strictEqual(after.cached, false);
});

test("mock uploadGarment + updateGarment size_label / measurements 兼容旧数据", async () => {
  const item = await mock.uploadGarment("cloud://mock/x2.png", { name: "兼容测试", category: "上衣" });
  // 旧数据：无 size_label / measurements
  const list = await mock.getMyGarments();
  const oldItem = list.find((g) => g.id === item.id);
  assert.ok(oldItem);
  assert.strictEqual(oldItem.size_label, undefined);
  assert.strictEqual(oldItem.measurements, undefined);
  // 更新尺寸
  const updated = await mock.updateGarment(item.id, { size_label: "XL", measurements: { lengthCm: 75.5 } });
  assert.strictEqual(updated.size_label, "XL");
  assert.strictEqual(updated.measurements.lengthCm, 75.5);
  // 再查一次确认
  const list2 = await mock.getMyGarments();
  const reloaded = list2.find((g) => g.id === item.id);
  assert.strictEqual(reloaded.size_label, "XL");
  assert.strictEqual(reloaded.measurements.lengthCm, 75.5);
  // 清空尺码
  const cleared = await mock.updateGarment(item.id, { size_label: null });
  assert.strictEqual(cleared.size_label, undefined);
});
