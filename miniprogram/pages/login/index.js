const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { agreed: true },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    toast(agreed ? "已同意《用户协议》和《隐私政策》" : "需同意协议后才能使用人脸相关功能");
  },
  onLogin() {
    // 【临时诊断】验证跳转到 09 页是否白屏（页面栈 2 层）；测试后改回 basic-info
    navigate("/pages/privacy-auth/index");
  }
});
