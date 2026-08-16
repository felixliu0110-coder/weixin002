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

let templates = [
  { id: "g-tee", name: "白色基础T恤", category: "上衣", image: "/assets/img/p06-tee.jpg" },
  { id: "g-shirt", name: "蓝色条纹衬衫", category: "上衣", image: "/assets/img/p06-shirt.jpg" },
  { id: "g-hoodie", name: "米白连帽卫衣", category: "上衣", image: "/assets/img/p06-hoodie.jpg" },
  { id: "g-jeans", name: "蓝色直筒牛仔裤", category: "裤子", image: "/assets/img/p06-jeans.jpg" },
  { id: "g-pants", name: "浅灰休闲裤", category: "裤子", image: "/assets/img/p06-pants.jpg" },
  { id: "g-skirt", name: "粉色半身裙", category: "其他", image: "/assets/img/p06-skirt.jpg" }
];

const homeTemplates = [
  { id: "t-dress", name: "粉色连衣裙", category: "连衣裙", image: "/assets/img/p17-dress.jpg" },
  { id: "t-shirt", name: "蓝色衬衫", category: "上装", image: "/assets/img/p17-shirt.jpg" },
  { id: "t-white", name: "白色衬衫", category: "上装", image: "/assets/img/p17-white.jpg" }
];

let history = [
  { id: "r1", garmentName: "针织连衣裙", date: "8月14日", image: "/assets/img/p13-1.jpg", aiTagged: true },
  { id: "r2", garmentName: "蓝色衬衫", date: "8月13日", image: "/assets/img/p13-2.jpg", aiTagged: true },
  { id: "r3", garmentName: "白色T恤", date: "8月12日", image: "/assets/img/p13-3.jpg", aiTagged: true },
  { id: "r4", garmentName: "牛仔裤·平铺", date: "8月12日", image: "/assets/img/p13-4.jpg", aiTagged: true, contain: true },
  { id: "r5", garmentName: "牛仔裤休闲裤", date: "8月11日", image: "/assets/img/p13-5.jpg", aiTagged: true }
];

let favorites = [
  { id: "f1", garmentName: "粉色针织连衣裙", date: "8月15日", image: "/assets/img/p07-result.jpg", aiTagged: true },
  { id: "f2", garmentName: "蓝色衬衫搭配", date: "8月14日", image: "/assets/img/p14-right.jpg", aiTagged: true }
];

const userInfo = {
  nickname: "小云",
  userId: "wx_e44ebc",
  wechatBound: true,
  phoneBound: false
};

module.exports = {
  async getAvatarProfile() { await delay(400); return JSON.parse(JSON.stringify(avatarProfile)); },
  async saveAvatarProfile(data) { await delay(300); Object.assign(avatarProfile, data); return { ok: true }; },
  async getGarmentTemplates() { await delay(400); return JSON.parse(JSON.stringify(templates)); },
  async getHomeTemplates() { await delay(300); return JSON.parse(JSON.stringify(homeTemplates)); },
  async uploadGarment(imagePath, params) {
    await delay(600);
    return {
      id: "g-upload-" + Date.now(),
      image: imagePath,
      name: (params && params.name) || "上传衣物",
      category: (params && params.category) || "其他",
      status: "ok"
    };
  },
  async submitTryon(params) {
    await delay(900);
    return { taskId: "task-" + Date.now(), status: "success", pose: params.pose || "front", resultUrls: ["/assets/img/p07-result.jpg"] };
  },
  async getTryonStatus(taskId) { await delay(300); return { taskId, status: "success" }; },
  async getHistory() { await delay(400); return JSON.parse(JSON.stringify(history)); },
  async getFavorites() { await delay(300); return JSON.parse(JSON.stringify(favorites)); },
  async deleteItems(kind, ids) {
    await delay(300);
    if (kind === "history") history = history.filter((i) => !ids.includes(i.id));
    if (kind === "favorites") favorites = favorites.filter((i) => !ids.includes(i.id));
    if (kind === "templates") templates = templates.filter((i) => !ids.includes(i.id));
    return { ok: true };
  },
  async saveToTemplates(params) {
    await delay(300);
    const item = {
      id: "t-user-" + Date.now(),
      name: params.name || "我的保存",
      category: params.category || "其他",
      image: params.image || "/assets/img/p07-result.jpg"
    };
    templates.push(item);
    return { ok: true, id: item.id };
  },
  async recognizeGarment() {
    // 模拟识别：真实能力需接入图像分类 AI（暂缓项）
    await delay(500);
    return { category: "连衣裙", name: "粉色针织连衣裙" };
  },
  async getQuota() { await delay(200); return JSON.parse(JSON.stringify(quota)); },
  async getUserInfo() { await delay(200); return JSON.parse(JSON.stringify(userInfo)); },
  async saveUserInfo(data) {
    await delay(300);
    if (data.nickname) userInfo.nickname = data.nickname;
    return JSON.parse(JSON.stringify(userInfo));
  },
  async logout() { await delay(300); return { ok: true }; },
  async saveResult(result) {
    await delay(300);
    const item = {
      id: "f-" + Date.now(),
      garmentName: result.garmentName || "新收藏试穿",
      date: "刚刚",
      image: result.image || "/assets/img/p07-result.jpg",
      aiTagged: true
    };
    favorites.unshift(item);
    return { ok: true, id: item.id };
  },
  async deleteUserData() { await delay(500); return { ok: true }; }
};
