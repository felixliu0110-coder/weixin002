/* 交互封装（迁移自 weixin002/assets/proto.js） */
const wxApi = typeof wx !== "undefined" ? wx : (global.__wx || {});

const TAB_ROUTES = ["/pages/home/index", "/pages/tryon-select/index", "/pages/history/index", "/pages/profile/index"];

function toast(msg, ms) {
  if (!wxApi.showToast) return;
  wxApi.showToast({ title: msg, icon: "none", duration: ms || 1900 });
}

function navigate(to) {
  const url = to.startsWith("/") ? to : "/" + to;
  if (TAB_ROUTES.includes(url) && wxApi.switchTab) {
    wxApi.switchTab({ url });
  } else if (wxApi.navigateTo) {
    wxApi.navigateTo({ url });
  }
}

function navigateAfter(to, ms, msg) {
  if (msg) toast(msg, Math.min(ms, 2400));
  setTimeout(() => navigate(to), ms || 1800);
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

module.exports = { toast, navigate, navigateAfter, openSheet, closeSheet, ring };
