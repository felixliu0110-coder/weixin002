const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { percent: 0 },
  onReady() {
    // rAF 驱动进度动画：约 3 秒平滑走到 100%
    this._startTimer = setTimeout(() => {
      const DURATION = 3000;
      const start = Date.now();
      const step = () => {
        const elapsed = Date.now() - start;
        const p = Math.min(100, Math.round((elapsed / DURATION) * 100));
        if (p !== this.data.percent) this.setData({ percent: p });
        if (p < 100) {
          this._raf = requestAnimationFrame(step);
        } else {
          toast("生成完成 · AI 生成效果，仅供参考");
          this._navTimer = setTimeout(() => navigate("/pages/tryon-result/index"), 1400);
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
