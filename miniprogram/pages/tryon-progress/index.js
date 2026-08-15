const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    // 定时器驱动：约 4 秒平滑走到 100%（requestAnimationFrame 在小程序逻辑层不可用）
    this._startTimer = setTimeout(() => {
      this._timer = setInterval(() => {
        const p = this.data.percent + 1;
        this.setData({ percent: p });
        if (p >= 100) {
          clearInterval(this._timer);
          toast("生成完成 · AI 生成效果，仅供参考");
          this._navTimer = setTimeout(() => navigate("/pages/tryon-result/index"), 1400);
        }
      }, 40);
    }, 300);
  },
  onUnload() {
    if (this._timer) clearInterval(this._timer);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
