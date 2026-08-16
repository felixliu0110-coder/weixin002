const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { favorites: [], manageMode: false, delSelected: [] },
  onLoad() {
    this.loadFavorites();
  },
  onShow() {
    this.loadFavorites();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, navMode: false, pill: false });
    }
  },
  loadFavorites() {
    api.getFavorites().then((favorites) => {
      this.setData({ favorites });
    });
  },
  toggleManage() {
    this.setData({ manageMode: !this.data.manageMode, delSelected: [] });
  },
  onItemTap(e) {
    if (this.data.manageMode) {
      const id = e.detail.id;
      const delSelected = this.data.delSelected.includes(id)
        ? this.data.delSelected.filter((x) => x !== id)
        : [...this.data.delSelected, id];
      this.setData({ delSelected });
    } else {
      navigate("/pages/tryon-result/index");
    }
  },
  onDelete() {
    const ids = this.data.delSelected;
    if (ids.length === 0) return;
    wx.showModal({
      title: "取消收藏",
      content: `将删除 ${ids.length} 条收藏，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("favorites", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false, delSelected: [] });
            this.loadFavorites();
          });
        }
      }
    });
  },
  openResult() {
    navigate("/pages/tryon-result/index");
  }
});
