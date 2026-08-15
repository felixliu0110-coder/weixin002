const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    let p = 0;
    this._timer = setInterval(() => {
      p += 1;
      this.setData({ percent: p });
      if (p >= 70) {
        clearInterval(this._timer);
        toast("数字人已生成");
        setTimeout(() => navigate("/pages/avatar-3d/index"), 1400);
      }
    }, 45);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
  }
});
