const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { agreed: false },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    toast(agreed ? "已同意《用户协议》和《隐私政策》" : "需同意协议后才能使用人脸相关功能");
  },
  onLogin() {
    // 隐私合规：协议需用户主动勾选同意，未勾选不允许进入
    if (!this.data.agreed) {
      toast("请先阅读并同意《用户协议》和《隐私政策》");
      return;
    }
    // 真实微信登录：云函数获取微信身份（openid），存本地后进入
    const app = getApp();
    const enter = () => {
      if (app && app.globalData) app.globalData.loggedIn = true;
      navigate("/pages/basic-info/index");
    };
    if (wx.cloud && wx.cloud.callFunction) {
      wx.cloud.callFunction({ name: "auth", data: { action: "login" } })
        .then((res) => {
          const r = res.result || {};
          wx.setStorageSync("userOpenid", r.openid || "");
          if (app && app.globalData) app.globalData.openid = r.openid || "";
          enter();
        })
        .catch(() => enter()); // 云函数未部署/异常时回退本地进入（不阻塞演示）
    } else {
      enter();
    }
  }
});
