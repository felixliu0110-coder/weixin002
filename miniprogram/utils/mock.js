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
  legLengthCm: 96,
  neckLengthCm: 9,
  skinTone: "light",
  modelVersion: "v1-demo",
  status: "ready",
  isExample: true
};

const quota = { userId: "u-demo", dailyFree: 3, used: 0, resetDate: "2026-08-16", isExample: true };

const templates = [
  { id: "g-tee", name: "白色基础T恤", category: "上装", image: "/assets/img/p06-tee.webp" },
  { id: "g-shirt", name: "蓝色条纹衬衫", category: "上装", image: "/assets/img/p06-shirt.webp" },
  { id: "g-hoodie", name: "米白连帽卫衣", category: "上装", image: "/assets/img/p06-hoodie.webp" },
  { id: "g-jeans", name: "蓝色直筒牛仔裤", category: "下装", image: "/assets/img/p06-jeans.webp" },
  { id: "g-pants", name: "浅灰休闲裤", category: "下装", image: "/assets/img/p06-pants.webp" },
  { id: "g-skirt", name: "粉色半身裙", category: "下装", image: "/assets/img/p06-skirt.webp" }
];

const homeTemplates = [
  { id: "t-dress", name: "粉色连衣裙", category: "连衣裙", image: "/assets/img/p17-dress.webp" },
  { id: "t-shirt", name: "蓝色衬衫", category: "上装", image: "/assets/img/p17-shirt.webp" },
  { id: "t-white", name: "白色衬衫", category: "上装", image: "/assets/img/p17-white.webp" }
];

const history = [
  { id: "r1", garmentName: "针织连衣裙", date: "8月14日", image: "/assets/img/p13-1.webp", aiTagged: true },
  { id: "r2", garmentName: "蓝色衬衫", date: "8月13日", image: "/assets/img/p13-2.webp", aiTagged: true },
  { id: "r3", garmentName: "白色T恤", date: "8月12日", image: "/assets/img/p13-3.webp", aiTagged: true },
  { id: "r4", garmentName: "牛仔裤·平铺", date: "8月12日", image: "/assets/img/p13-4.webp", aiTagged: true, contain: true },
  { id: "r5", garmentName: "牛仔裤休闲裤", date: "8月11日", image: "/assets/img/p13-5.webp", aiTagged: true }
];

module.exports = {
  async getAvatarProfile() { await delay(400); return JSON.parse(JSON.stringify(avatarProfile)); },
  async saveAvatarProfile(data) { await delay(300); Object.assign(avatarProfile, data); return { ok: true }; },
  async getGarmentTemplates() { await delay(400); return JSON.parse(JSON.stringify(templates)); },
  async getHomeTemplates() { await delay(300); return JSON.parse(JSON.stringify(homeTemplates)); },
  async uploadGarment(imagePath) {
    await delay(600);
    return { id: "g-upload-" + Date.now(), image: imagePath, category: "上装", status: "ok" };
  },
  async submitTryon(params) {
    await delay(900);
    return { taskId: "task-" + Date.now(), status: "success", pose: params.pose || "front", resultUrls: ["/assets/img/p07-result.webp"] };
  },
  async getTryonStatus(taskId) { await delay(300); return { taskId, status: "success" }; },
  async getHistory() { await delay(400); return JSON.parse(JSON.stringify(history)); },
  async getQuota() { await delay(200); return JSON.parse(JSON.stringify(quota)); },
  async saveResult(result) { await delay(300); return { ok: true, id: "r-" + Date.now() }; },
  async deleteUserData() { await delay(500); return { ok: true }; }
};
