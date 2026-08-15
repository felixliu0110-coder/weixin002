/* 环形进度：canvas 2d 绘制（真机兼容，替代 conic-gradient + mask） */
Component({
  properties: {
    percent: { type: Number, value: 0 }
  },
  lifetimes: {
    ready() {
      this.initCanvas();
    }
  },
  observers: {
    percent(v) {
      this.setData({ percent: Math.max(0, Math.min(100, v)) });
      this.draw();
    }
  },
  methods: {
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select("#ringCanvas").fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const width = res[0].width;
        const height = res[0].height;
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        this._canvas = canvas;
        this._ctx = ctx;
        this._size = Math.min(width, height);
        this.draw();
      });
    },
    draw() {
      if (!this._ctx || !this._size) return;
      const ctx = this._ctx;
      const s = this._size;
      const cx = s / 2;
      const cy = s / 2;
      const r = s / 2 - 12;
      const p = Math.max(0, Math.min(100, this.data.percent || 0)) / 100;

      ctx.clearRect(0, 0, s, s);
      // 未填充轨道
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#F0D6CC";
      ctx.lineWidth = 22;
      ctx.stroke();
      // 进度弧
      if (p > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
        ctx.strokeStyle = "#E3A595";
        ctx.lineWidth = 22;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }
  }
});
