/* 原型示例数据，标注示例标记。真实接口就绪后由 api.js 替换。 */

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
  shoulderCm: 38,
  armLengthCm: 55,
  shoeSize: 38,
  skinTone: "light",
  estimate: true,
  modelVersion: "v1-demo",
  status: "ready",
  isExample: true
};

const quota = { userId: "u-demo", dailyFree: 3, used: 0, resetDate: "2026-08-16", isExample: true };

let garmentLibrary = [
  { id: "g-tee", name: "白色基础T恤", category: "上衣", image: "/assets/img/p06-tee.jpg" },
  { id: "g-shirt", name: "蓝色条纹衬衫", category: "上衣", image: "/assets/img/p06-shirt.jpg" },
  { id: "g-hoodie", name: "米白连帽卫衣", category: "上衣", image: "/assets/img/p06-hoodie.jpg" },
  { id: "g-jeans", name: "蓝色直筒牛仔裤", category: "裤子", image: "/assets/img/p06-jeans.jpg" },
  { id: "g-pants", name: "浅灰休闲裤", category: "裤子", image: "/assets/img/p06-pants.jpg" },
  { id: "g-skirt", name: "粉色半身裙", category: "其他", image: "/assets/img/p06-skirt.jpg" }
];

let myTemplates = [];

const homeTemplates = [
  { id: "t-dress", name: "粉色连衣裙", category: "连衣裙", image: "/assets/img/p17-dress.jpg" },
  { id: "t-shirt", name: "蓝色衬衫", category: "上装", image: "/assets/img/p17-shirt.jpg" },
  { id: "t-white", name: "白色衬衫", category: "上装", image: "/assets/img/p17-white.jpg" }
];

let history = [
  { id: "r1", garmentName: "针织连衣裙", date: "8月14日", image: "/assets/img/p13-1.jpg", aiTagged: true, videoUrl: "/assets/video/mock-turn.mp4" },
  { id: "r2", garmentName: "蓝色衬衫", date: "8月13日", image: "/assets/img/p13-2.jpg", aiTagged: true },
  { id: "r3", garmentName: "白色T恤", date: "8月12日", image: "/assets/img/p13-3.jpg", aiTagged: true },
  { id: "r4", garmentName: "牛仔裤·平铺", date: "8月12日", image: "/assets/img/p13-4.jpg", aiTagged: true, contain: true },
  { id: "r5", garmentName: "牛仔裤休闲裤", date: "8月11日", image: "/assets/img/p13-5.jpg", aiTagged: true }
];

let favorites = [
  { id: "f1", garmentName: "粉色针织连衣裙", date: "8月15日", image: "/assets/img/p07-result.jpg", aiTagged: true, videoUrl: "/assets/video/mock-turn.mp4" },
  { id: "f2", garmentName: "蓝色衬衫搭配", date: "8月14日", image: "/assets/img/p14-right.jpg", aiTagged: true }
];

const userInfo = {
  nickname: "小云",
  userId: "wx_e44ebc",
  wechatBound: true,
  phoneBound: false
};

const avatarViews = {
  status: "ready",
  views: { composite: "/assets/img/p05-avatar.jpg" },
  provider: "mock",
  isExample: true
};

let garmentViewsCache = {};
let aiTryonTasks = {};

async function mockCreateAvatarViews(profile) {
  // mock：立即生成，三视图占位用原型数字人图
  return { avatarViewId: "av-mock-" + Date.now(), status: "ready", views: avatarViews.views };
}

async function mockEnsureGarmentViews(garmentId, garmentName) {
  if (garmentViewsCache[garmentId] && garmentViewsCache[garmentId].status === "ready") {
    return { ok: true, cached: true, status: "ready", views: garmentViewsCache[garmentId].views };
  }
  const views = { composite: "/assets/img/p06-tee.jpg" };
  garmentViewsCache[garmentId] = { status: "ready", views };
  return { ok: true, cached: false, status: "ready", views };
}

async function mockSubmitAiTryon(params) {
  const taskId = "task-ai-" + Date.now();
  aiTryonTasks[taskId] = {
    taskId,
    status: "processing",
    stage: "garment_views",
    poll: 0,
    tryonImage: "/assets/img/p07-result.jpg",
    tryonVideo: "/assets/video/mock-turn.mp4"
  };
  return { taskId, status: "processing" };
}

async function mockGetAiTryonStatus(taskId) {
  const t = aiTryonTasks[taskId];
  if (!t) {
    return {
      taskId,
      status: "processing",
      stage: "garment_views",
      tryonImage: "/assets/img/p07-result.jpg",
      tryonVideo: "/assets/video/mock-turn.mp4"
    };
  }
  t.poll = (t.poll || 0) + 1;
  if (t.poll === 1) return { taskId, status: "processing", stage: "garment_views" };
  if (t.poll === 2) return { taskId, status: "processing", stage: "video" };
  t.status = "success";
  return { taskId, status: "success", stage: "video", tryonImage: t.tryonImage, tryonVideo: t.tryonVideo };
}

module.exports = {
  getAvatarProfile() { return Promise.resolve(JSON.parse(JSON.stringify(avatarProfile))); },
  saveAvatarProfile(data) { Object.assign(avatarProfile, data); return Promise.resolve({ ok: true }); },
  getGarmentTemplates() { return Promise.resolve(JSON.parse(JSON.stringify(garmentLibrary))); },
  getGarmentLibrary() { return Promise.resolve(JSON.parse(JSON.stringify(garmentLibrary))); },
  getMyTemplates() { return Promise.resolve(JSON.parse(JSON.stringify(myTemplates))); },
  async addToMyTemplates(ids) {
    const items = garmentLibrary.filter(
      (i) => ids.includes(i.id) && !myTemplates.some((m) => m.id === i.id)
    );
    myTemplates = myTemplates.concat(items);
    return { ok: true, count: items.length };
  },
  getHomeTemplates() { return Promise.resolve(JSON.parse(JSON.stringify(homeTemplates))); },
  async uploadGarment(imagePath, params) {
    const item = {
      id: "g-upload-" + Date.now(),
      image: imagePath,
      name: (params && params.name) || "上传衣物",
      category: (params && params.category) || "其他",
      status: "ok"
    };
    garmentLibrary.push(item);
    return item;
  },
  async submitTryon(params) {
    return { taskId: "task-" + Date.now(), status: "success", pose: params.pose || "front", resultUrls: ["/assets/img/p07-result.jpg"] };
  },
  getTryonStatus(taskId) { return Promise.resolve({ taskId, status: "success" }); },
  getHistory() { return Promise.resolve(JSON.parse(JSON.stringify(history))); },
  getFavorites() { return Promise.resolve(JSON.parse(JSON.stringify(favorites))); },
  async deleteItems(kind, ids) {
    if (kind === "history") history = history.filter((i) => !ids.includes(i.id));
    if (kind === "favorites") favorites = favorites.filter((i) => !ids.includes(i.id));
    if (kind === "myTemplates") myTemplates = myTemplates.filter((i) => !ids.includes(i.id));
    if (kind === "library") garmentLibrary = garmentLibrary.filter((i) => !ids.includes(i.id));
    if (kind === "library" || kind === "myTemplates") {
      ids.forEach((id) => { delete garmentViewsCache[id]; });
    }
    return { ok: true };
  },
  async saveToTemplates(params) {
    const item = {
      id: "t-user-" + Date.now(),
      name: params.name || "我的保存",
      category: params.category || "其他",
      image: params.image || "/assets/img/p07-result.jpg"
    };
    garmentLibrary.push(item);
    return { ok: true, id: item.id };
  },
  async recognizeGarment() {
    // 模拟识别：真实能力需接入图像分类 AI（暂缓项）
    return { category: "连衣裙", name: "粉色针织连衣裙" };
  },
  getQuota() { return Promise.resolve(JSON.parse(JSON.stringify(quota))); },
  getUserInfo() { return Promise.resolve(JSON.parse(JSON.stringify(userInfo))); },
  async saveUserInfo(data) {
    if (data.nickname) userInfo.nickname = data.nickname;
    return JSON.parse(JSON.stringify(userInfo));
  },
  async logout() { return { ok: true }; },
  async saveResult(result) {
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
  getAvatarViews() { return Promise.resolve(JSON.parse(JSON.stringify(avatarViews))); },
  createAvatarViews: mockCreateAvatarViews,
  ensureGarmentViews: mockEnsureGarmentViews,
  submitAiTryon: mockSubmitAiTryon,
  getAiTryonStatus: mockGetAiTryonStatus,
  async saveAiResult(result) {
    const item = {
      id: "f-ai-" + Date.now(),
      garmentName: result.garmentName || "AI 试穿",
      date: "刚刚",
      image: result.tryonImage || "/assets/img/p07-result.jpg",
      videoUrl: result.tryonVideo || "/assets/video/mock-turn.mp4",
      aiTagged: true
    };
    favorites.unshift(item);
    return { ok: true, id: item.id };
  },
  async deleteUserData() { return { ok: true }; }
};
