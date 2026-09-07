const { toast, navigate } = require("../../utils/interaction");

Page({
  data: {
    fbText: "",
    formOk: false
  },
  onInput(e) { this.setData({ fbText: e.detail.value }); },
  onSubmit() {
    if (!this.data.fbText.trim()) {
      // 空反馈直接提交会污染反馈通道
      toast("请先填写反馈内容");
      return;
    }
    this.setData({ formOk: true });
    toast("感谢你的反馈");
  },
  goProfile() { navigate("/pages/profile/index"); }
});
