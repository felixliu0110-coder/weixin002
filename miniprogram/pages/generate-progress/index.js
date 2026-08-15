const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    // 延迟启动动画，避免页面初始化时立即高频 setData
    this._startTimer = setTimeout(() => {
      this._timer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 70) {
          clearInterval(this._timer);
          toast("数字人已生成");
          this._navTimer = setTimeout(() => navigate("/pages/avatar-3d/index"), 1400);
        }
      }, 80);
    }, 300);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
