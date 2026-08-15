const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    // 延迟启动动画，避免页面初始化时立即高频 setData
    this._startTimer = setTimeout(() => {
      this._timer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 45) {
          clearInterval(this._timer);
          toast("生成完成 · AI 生成效果，仅供参考");
          this._navTimer = setTimeout(() => navigate("/pages/tryon-result/index"), 1600);
        }
      }, 100);
    }, 300);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
