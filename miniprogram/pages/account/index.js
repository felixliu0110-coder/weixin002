const { toast, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { loggedIn: false },
  onShow() {
    const app = getApp();
    this.setData({ loggedIn: !!(app && app.globalData && app.globalData.loggedIn) });
  },
  onLogout() {
    api.logout().then(() => {
      const app = getApp();
      if (app && app.globalData) { app.globalData.loggedIn = false; app.globalData.openid = ""; }
      toast("已退出登录");
      this._logoutTimer = setTimeout(() => reLaunch("/pages/login/index"), 500);
    }).catch((e) => {
      console.error("[account] logout failed", e);
      toast((e && e.message) || "退出失败，请重试");
    });
  },
  onUnload() { if (this._logoutTimer) { clearTimeout(this._logoutTimer); this._logoutTimer = null; } }
});
