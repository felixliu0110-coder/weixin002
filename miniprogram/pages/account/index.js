const { toast, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    user: { nickname: "小云", userId: "wx_e44ebc", wechatBound: true, phoneBound: false }
  },
  onLoad() {
    api.getUserInfo().then((user) => {
      this.setData({ user });
    });
  },
  onEditName() {
    wx.showModal({
      title: "修改昵称",
      editable: true,
      placeholderText: "请输入新昵称",
      content: this.data.user.nickname,
      success: (res) => {
        if (res.confirm) {
          const nickname = (res.content || "").trim();
          if (!nickname) {
            toast("昵称不能为空");
            return;
          }
          api.saveUserInfo({ nickname }).then((user) => {
            this.setData({ user });
            toast("昵称已更新");
          });
        }
      }
    });
  },
  onWechat() {
    toast(this.data.user.wechatBound ? "已绑定微信账号" : "绑定微信账号（待接入真实登录）");
  },
  onPhone() {
    toast(this.data.user.phoneBound ? "已绑定手机号" : "绑定手机号（待接入）");
  },
  onLogout() {
    api.logout().then(() => {
      const app = getApp();
      if (app && app.globalData) app.globalData.loggedIn = false;
      toast("已退出登录");
      this._logoutTimer = setTimeout(() => reLaunch("/pages/login/index"), 800);
    });
  },
  onUnload() {
    // 页面销毁时清理延迟跳转，避免卸载后仍被强制 reLaunch
    if (this._logoutTimer) { clearTimeout(this._logoutTimer); this._logoutTimer = null; }
  }
});
