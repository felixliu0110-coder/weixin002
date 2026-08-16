/* 交互封装（迁移自 weixin002/assets/proto.js） */
const config = require("../config");
const wxApi = typeof wx !== "undefined" ? wx : (global.__wx || {});

const TAB_ROUTES = ["/pages/home/index", "/pages/tryon-select/index", "/pages/favorites/index", "/pages/profile/index"];

function toast(msg, ms) {
  if (!wxApi.showToast) return;
  wxApi.showToast({ title: msg, icon: "none", duration: ms || 1900 });
}

/* 试穿提交前请求订阅授权；未配置模板 ID 时静默跳过 */
function requestSubscribe() {
  const tmplId = (config && config.subscribeTmplId) || "";
  if (!tmplId || typeof wx === "undefined" || typeof wx.requestSubscribeMessage !== "function") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({ tmplIds: [tmplId], success: resolve, fail: resolve });
  });
}

let lastNavTime = 0;
function doNavigate(to) {
  const url = to.startsWith("/") ? to : "/" + to;
  if (TAB_ROUTES.includes(url) && wxApi.switchTab) {
    wxApi.switchTab({ url });
  } else if (wxApi.navigateTo) {
    wxApi.navigateTo({ url });
  }
}
function navigate(to) {
  // 600ms 内防重复跳转（快速连点只执行一次）
  const now = Date.now();
  if (now - lastNavTime < 600) return;
  lastNavTime = now;
  doNavigate(to);
}

function navigateAfter(to, ms, msg) {
  const now = Date.now();
  if (now - lastNavTime < 600) return;
  lastNavTime = now;
  if (msg) toast(msg, Math.min(ms, 2400));
  // 延迟到达后直接执行底层跳转，不再过 navigate 的防重复锁：
  // 否则延迟期间用户的任何一次 navigate 都会与本次延迟跳转叠加成双重跳转
  setTimeout(() => doNavigate(to), ms || 1800);
}

let lastReloadTime = 0;
function reLaunch(to) {
  // 800ms 内防重复 reLaunch
  const now = Date.now();
  if (now - lastReloadTime < 800) return;
  lastReloadTime = now;
  const url = to.startsWith("/") ? to : "/" + to;
  if (wxApi.reLaunch) {
    wxApi.reLaunch({ url });
  }
}

function getCurrentPage() {
  try {
    const pages = getCurrentPages();
    return pages[pages.length - 1];
  } catch (e) { return null; }
}

function openSheet(id) {
  const page = getCurrentPage();
  if (page && page.selectComponent) {
    const comp = page.selectComponent("#" + id);
    if (comp) comp.setData({ visible: true });
  }
}

function closeSheet(id) {
  const page = getCurrentPage();
  if (page && page.selectComponent) {
    const comp = page.selectComponent("#" + id);
    if (comp) comp.setData({ visible: false });
  }
}

function ring(percent, duration, cb) {
  /* 环形进度由 ring-progress 组件实现；此处为兼容调用（原型 OD.ring 迁移） */
  if (typeof cb === "function") setTimeout(cb, duration || 3000);
}

module.exports = {
  toast,
  requestSubscribe,
  navigate,
  navigateAfter,
  reLaunch,
  openSheet,
  closeSheet,
  ring,
  __resetNavLock: () => { lastNavTime = 0; lastReloadTime = 0; }
};
