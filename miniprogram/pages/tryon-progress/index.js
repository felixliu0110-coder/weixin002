const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    let p = 0;
    this._timer = setInterval(() => {
      p += 1;
      this.setData({ percent: p });
      if (p >= 45) {
        clearInterval(this._timer);
        toast("生成完成 · AI 生成效果，仅供参考");
        setTimeout(() => navigate("/pages/tryon-result/index"), 1600);
      }
    }, 65);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
  }
});
