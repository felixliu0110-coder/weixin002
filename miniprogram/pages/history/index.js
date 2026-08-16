const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { records: [], manageMode: false, delSelected: [] },
  onLoad() {
    this.loadRecords();
  },
  onShow() {
    // 试穿记录已移入「我的」体系：页面为普通页，底部 Tab 高亮「我的」
    this.loadRecords();
  },
  loadRecords() {
    api.getHistory().then((records) => {
      this.setData({ records });
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
  onLongPress(e) {
    if (!this.data.manageMode) {
      this.setData({ manageMode: true, delSelected: [e.detail.id] });
    }
  },
  onDelete() {
    const ids = this.data.delSelected;
    if (ids.length === 0) return;
    wx.showModal({
      title: "删除试穿记录",
      content: `将删除 ${ids.length} 条试穿记录，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("history", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false, delSelected: [] });
            this.loadRecords();
          });
        }
      }
    });
  },
  openResult() {
    navigate("/pages/tryon-result/index");
  }
});
