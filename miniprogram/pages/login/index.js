const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { agreed: true },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    toast(agreed ? "已同意《用户协议》和《隐私政策》" : "需同意协议后才能使用人脸相关功能");
  },
  onLogin() {
    // 真实微信登录（wx.login/手机号快捷登录）待后端接口就绪后接入
    navigate("/pages/basic-info/index");
  }
});
