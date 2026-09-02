const { toast, navigate, showModal } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { garment: null, editing: false, name: "", sizeLabel: "", measurements: {} },
  onLoad(q) {
    if (!q || !q.id) return toast("参数错误");
    api.getMyGarments().then((list) => {
      const g = (list || []).find(x => x.id === q.id);
      if (!g) { this.setData({ garment: null }); return; }
      const m = g.measurements || {};
      this.setData({ garment: g, name: g.name || "", sizeLabel: g.size_label || "", measurements: m });
    }).catch(() => toast("加载失败"));
  },
  toggleEdit() { this.setData({ editing: !this.data.editing }); },
  onName(e) { this.setData({ name: e.detail.value }); },
  onSize(e) { this.setData({ sizeLabel: e.detail.value }); },
  save() {
    const d = this.data;
    if (!d.name.trim()) return toast("请输入名称");
    api.updateGarment(d.garment.id, {
      name: d.name.trim(),
      size_label: d.sizeLabel.trim() || null,
      measurements: Object.keys(d.measurements).length ? d.measurements : null
    }).then(() => { toast("已保存"); this.setData({ editing: false }); this.onLoad({ id: d.garment.id }); })
      .catch(() => toast("保存失败"));
  },
  // 删除走现有 deleteMyGarments（服务端按 openid 校验归属，禁止前端直连 db）
  onDelete() {
    const id = this.data.garment.id;
    showModal({ title: "删除衣物", content: "删除后不可恢复", confirmColor: "#C0392B" }).then((res) => {
      if (!res.confirm) return;
      api.deleteMyGarments([id]).then(() => { toast("已删除"); setTimeout(() => wx.navigateBack(), 400); })
        .catch(() => toast("删除失败"));
    });
  },
  onTryon() {
    const g = this.data.garment;
    wx.setStorageSync("aiTryonPending", { garmentId: g.id, garmentIds: [g.id], garmentName: g.name, garmentImage: g.image, garmentCategory: g.category });
    wx.switchTab({ url: "/pages/wardrobe/index" }); // 回到衣橱后再进入试穿流程
    setTimeout(() => wx.navigateTo({ url: "/pages/tryon-select/index" }), 300);
  }
});
