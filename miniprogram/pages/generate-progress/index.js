const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    // rAF 驱动进度动画：约 3.2 秒平滑走到 100%
    this._startTimer = setTimeout(() => {
      const DURATION = 3200;
      const start = Date.now();
      const step = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(100, Math.round((elapsed / DURATION) * 100));
        if (p !== this.data.percent) this.setData({ percent: p });
        if (p < 100) {
          this._raf = requestAnimationFrame(step);
        } else {
          toast("数字人已生成");
          this._navTimer = setTimeout(() => navigate("/pages/avatar-3d/index"), 1200);
        }
      };
      this._raf = requestAnimationFrame(step);
    }, 300);
  },
  onUnload() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._navTimer) clearTimeout(this._navTimer);
  }
});
