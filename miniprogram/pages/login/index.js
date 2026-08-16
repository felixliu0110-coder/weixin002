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
    // 真实微信登录（wx.login/手机号快捷登录）待后端接口就绪后接入
    const app = getApp();
    if (app && app.globalData) app.globalData.loggedIn = true;
    navigate("/pages/basic-info/index");
  }
});
