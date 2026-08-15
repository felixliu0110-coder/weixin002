const { navigate } = require("../../utils/interaction");

Page({
  data: {
    fbText: "",
    formOk: false
  },
  onInput(e) { this.setData({ fbText: e.detail.value }); },
  onSubmit() {
    if (!this.data.fbText.trim()) {
      // 原型未做空内容校验，保持与原型一致：直接进入成功态
    }
    this.setData({ formOk: true, fbText: "" });
  },
  goProfile() { navigate("/pages/profile/index"); }
});
