const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");
const provider = require("../../utils/avatar3d/provider");
const AvatarRenderer = require("../../utils/avatar3d/renderer");

function dist(a, b) {
  return Math.sqrt(Math.pow(a.clientX - b.clientX, 2) + Math.pow(a.clientY - b.clientY, 2));
}

Page({
  data: {
    renderFailed: false,
    measureOn: false,
    rotating: false,
    profile: { heightCm: "--", weightKg: "--", waistCm: "--", legLengthCm: "--" }
  },
  onLoad() {
    api.getAvatarProfile().then((profile) => this.setData({ profile }));
  },
  onReady() {
    this.initCanvas();
  },
  initCanvas() {
    this.setData({ renderFailed: false });
    const load = () => {
      const model = wx.getStorageSync("avatarModel");
      if (model && model.kind === "free") return Promise.resolve(model);
      return api.getAvatarProfile().then((profile) => provider.generate(profile));
    };
    load().then((model) => {
      wx.createSelectorQuery()
        .select("#avatarCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            this.setData({ renderFailed: true });
            return;
          }
          const canvas = res[0].node;
          const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio) || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          const ctx = canvas.getContext("2d");
          ctx.scale(dpr, dpr);
          this.renderer = new AvatarRenderer();
          this.renderer.init(canvas, model, { width: res[0].width, height: res[0].height, ctx });
          this.renderer.render();
        });
    }).catch(() => this.setData({ renderFailed: true }));
  },
  onTouchStart(e) {
    this._touches = e.touches;
  },
  onTouchMove(e) {
    if (!this.renderer) return;
    const t = e.touches;
    const view = this.renderer.view;
    // 节流：每帧最多渲染一次，避免触摸事件高频触发 setData
    if (this._rafPending) return;
    this._rafPending = true;
    this._animFrame = setTimeout(() => {
      this._rafPending = false;
      if (t.length === 1 && this._touches && this._touches.length === 1) {
        const dx = t[0].clientX - this._touches[0].clientX;
        const dy = t[0].clientY - this._touches[0].clientY;
        view.rotateY = (view.rotateY + dx * 0.6 + 360) % 360;
        view.rotateX = Math.max(-20, Math.min(20, view.rotateX + dy * 0.3));
        this.renderer.render();
      } else if (t.length === 2 && this._touches && this._touches.length === 2) {
        const d0 = dist(this._touches[0], this._touches[1]);
        const d1 = dist(t[0], t[1]);
        view.zoom = Math.max(0.8, Math.min(1.6, view.zoom * (d1 / Math.max(d0, 1))));
        this.renderer.render();
      }
      this._touches = t;
    }, 16);
  },
  onTouchEnd(e) {
    this._touches = e.touches || [];
  },
  onRotate() {
    const on = !this.data.rotating;
    this.setData({ rotating: on });
    toast(on ? "自动旋转已开启" : "已停止自动旋转");
    if (on) {
      this._autoTimer = setInterval(() => {
        if (!this.renderer) return;
        this.renderer.view.rotateY = (this.renderer.view.rotateY + 1.2) % 360;
        this.renderer.render();
      }, 33);
    } else if (this._autoTimer) {
      clearInterval(this._autoTimer);
      this._autoTimer = null;
    }
  },
  onMeasure() {
    const on = !this.data.measureOn;
    this.setData({ measureOn: on });
    if (this.renderer) {
      this.renderer.setMeasure(on);
      this.renderer.render();
    }
    toast(on ? "身材标注已开启" : "身材标注已关闭");
  },
  onConfirm() {
    toast("身材档案已保存");
  },
  retry() {
    this.initCanvas();
  },
  edit() {
    navigate("/pages/basic-info/index");
  },
  goTryon() {
    navigate("/pages/tryon-select/index");
  },
  onUnload() {
    if (this._autoTimer) clearInterval(this._autoTimer);
    if (this._animFrame) clearTimeout(this._animFrame);
    this._rafPending = false;
    if (this.renderer) this.renderer.destroy();
  }
});
