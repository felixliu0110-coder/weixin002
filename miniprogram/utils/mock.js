/* 原型示例数据，标注示例标记；带模拟延迟。真实接口就绪后由 api.js 替换。 */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const avatarProfile = {
  id: "avatar-demo",
  userId: "u-demo",
  gender: "female",
  heightCm: 165,
  weightKg: 50,
  bustCm: 88,
  waistCm: 66,
  hipCm: 92,
  legLengthCm: 88,
  neckLengthCm: 9,
  skinTone: "light",
  modelVersion: "v1-demo",
  status: "ready",
  isExample: true
};

const quota = { userId: "u-demo", dailyFree: 3, used: 0, resetDate: "2026-08-16", isExample: true };

const templates = [
  { id: "t-dress", name: "粉色连衣裙", category: "连衣裙", image: "/assets/img/p17-dress.png" },
  { id: "t-shirt", name: "蓝色衬衫", category: "上装", image: "/assets/img/p17-shirt.png" },
  { id: "t-white", name: "白色衬衫", category: "上装", image: "/assets/img/p17-white.png" }
];

const history = [
  { id: "r1", garmentName: "粉色连衣裙", date: "2026-08-15", image: "/assets/img/p07-result.png", aiTagged: true },
  { id: "r2", garmentName: "蓝色衬衫", date: "2026-08-14", image: "/assets/img/p13-1.png", aiTagged: true }
];

module.exports = {
  async getAvatarProfile() { await delay(400); return JSON.parse(JSON.stringify(avatarProfile)); },
  async saveAvatarProfile(data) { await delay(300); Object.assign(avatarProfile, data); return { ok: true }; },
  async getGarmentTemplates() { await delay(400); return JSON.parse(JSON.stringify(templates)); },
  async uploadGarment(imagePath) {
    await delay(600);
    return { id: "g-upload-" + Date.now(), image: imagePath, category: "上装", status: "ok" };
  },
  async submitTryon(params) {
    await delay(900);
    return { taskId: "task-" + Date.now(), status: "success", pose: params.pose || "front", resultUrls: ["/assets/img/p07-result.png"] };
  },
  async getTryonStatus(taskId) { await delay(300); return { taskId, status: "success" }; },
  async getHistory() { await delay(400); return JSON.parse(JSON.stringify(history)); },
  async getQuota() { await delay(200); return JSON.parse(JSON.stringify(quota)); },
  async saveResult(result) { await delay(300); return { ok: true, id: "r-" + Date.now() }; },
  async deleteUserData() { await delay(500); return { ok: true }; }
};
