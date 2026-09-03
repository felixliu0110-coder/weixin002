const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const CATEGORIES = ["上衣", "裤子"];

Page({
  data: { garments: [], byCat: {}, loading: true },
  onShow() { this.load(); },
  load() {
    this.setData({ loading: true });
    api.getMyGarments().then((list) => {
      const byCat = {};
      CATEGORIES.forEach(c => byCat[c] = []);
      (list || []).forEach(g => { (byCat[g.category] = byCat[g.category] || []).push(g); });
      this.setData({ garments: list || [], byCat, loading: false });
    }).catch(() => { this.setData({ loading: false }); toast("加载失败"); });
  },
  // 仅读取当前用户衣物（api.getMyGarments 已按 openid 隔离）
  onTap(e) { navigate("/pages/garment-detail/index?id=" + e.currentTarget.dataset.id); },
  onAdd() { navigate("/pages/garment-add/index"); },
  onTryon(e) {
    const id = e.currentTarget.dataset.id;
    // 单选：直接进入试穿，由 tryon-select 处理单件选择态
    wx.setStorageSync("aiTryonPending", { garmentId: id, garmentIds: [id] });
    navigate("/pages/tryon-select/index");
  }
});
