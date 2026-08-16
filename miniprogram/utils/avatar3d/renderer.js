/* 轻量 3D 渲染器：小程序 canvas 2d + 数学投影（无第三方依赖）。
   模型为胶囊线段（圆头粗线）集合，按投影后 z 排序从远到近绘制。 */

const DEG = Math.PI / 180;

function rotateX(p, deg) {
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r);
  return [p[0], p[1] * c + p[2] * s, -p[1] * s + p[2] * c];
}

function rotateY(p, deg) {
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}

function projectPoint(p, view, opts) {
  const f = opts.f || 900;
  const s0 = opts.height / (opts.heightCm * 1.22) * (view.zoom || 1);
  let q = rotateY(p, view.rotateY || 0);
  q = rotateX(q, view.rotateX || 0);
  const zc = q[2] + f;
  const k = f / zc;
  return [opts.width / 2 + q[0] * k * s0, opts.height / 2 + opts.height * 0.05 - q[1] * k * s0, q[2], k];
}

class AvatarRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.model = null;
    this.view = { rotateY: 0, rotateX: 0, zoom: 1 };
    this.measure = false;
    this.width = 0;
    this.height = 0;
  }

  init(canvas, model, size) {
    this.canvas = canvas;
    this.ctx = size.ctx || canvas.getContext("2d");
    this.model = model;
    this.width = size.width;
    this.height = size.height;
  }

  setMeasure(on) { this.measure = !!on; }

  setView(view) {
    Object.assign(this.view, view);
    this.render();
  }

  render() {
    if (!this.ctx || !this.model) return;
    const { width: w, height: h, ctx, view } = this;
    const opts = { width: w, height: h, heightCm: this.model.body.heightCm, f: 900 };
    const s = h / (this.model.body.heightCm * 1.22) * view.zoom;
    ctx.clearRect(0, 0, w, h);

    // 地面阴影
    ctx.save();
    ctx.fillStyle = "rgba(31,29,27,0.10)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 36, this.model.body.heightCm * 0.16 * s, this.model.body.heightCm * 0.024 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const items = this.model.body.segments.map((seg) => {
      const pa = projectPoint(seg.a, view, opts);
      const pb = projectPoint(seg.b, view, opts);
      return { seg, pa, pb, z: (pa[2] + pb[2]) / 2 };
    });
    items.sort((m, n) => n.z - m.z);

    ctx.save();
    ctx.lineCap = "round";
    for (const it of items) {
      const { seg, pa, pb } = it;
      const k = (pa[3] + pb[3]) / 2;
      const lw = seg.r * k * s * 2;
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = Math.max(1, lw);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }
    ctx.restore();

    // 发型覆盖层（后画，保证盖住头顶）
    const hairItems = this.model.body.hair.map((h) => {
      if (h.shape === "cap") {
        const pc = projectPoint(h.center, view, opts);
        return { h, pa: pc, pb: pc, z: pc[2] };
      }
      const pa = projectPoint(h.a, view, opts);
      const pb = projectPoint(h.b, view, opts);
      return { h, pa, pb, z: (pa[2] + pb[2]) / 2 };
    });
    hairItems.sort((m, n) => n.z - m.z);
    ctx.save();
    ctx.lineCap = "round";
    for (const it of hairItems) {
      const { h, pa, pb } = it;
      const k = (pa[3] + pb[3]) / 2;
      if (h.shape === "cap") {
        const r = Math.max(1, h.r * k * s);
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.arc(pa[0], pa[1], r, Math.PI, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = h.color;
        ctx.lineWidth = Math.max(1, h.r * k * s * 2);
        ctx.beginPath();
        ctx.moveTo(pa[0], pa[1]);
        ctx.lineTo(pb[0], pb[1]);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (this.measure) this.drawMeasures(view, opts);
  }

  drawMeasures(view, opts) {
    const { ctx } = this;
    ctx.save();
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 1.4;
    for (const m of this.model.body.measures) {
      const pa = projectPoint(m.a, view, opts);
      const pb = projectPoint(m.b, view, opts);
      ctx.strokeStyle = "rgba(201,143,128,0.95)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      const mx = (pa[0] + pb[0]) / 2;
      const my = (pa[1] + pb[1]) / 2;
      const text = m.label + " " + m.value + "cm";
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillRect(mx - tw / 2 - 3, my - 9, tw + 6, 14);
      ctx.fillStyle = "#7A5A4E";
      ctx.fillText(text, mx, my + 3);
    }
    ctx.restore();
  }

  exportImage() {
    return new Promise((resolve, reject) => {
      if (typeof wx === "undefined" || !wx.canvasToTempFilePath) {
        reject(new Error("canvasToTempFilePath unavailable"));
        return;
      }
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(err)
      });
    });
  }

  destroy() {
    this.canvas = null;
    this.ctx = null;
    this.model = null;
  }
}

module.exports = AvatarRenderer;
module.exports.rotateX = rotateX;
module.exports.rotateY = rotateY;
module.exports.projectPoint = projectPoint;
