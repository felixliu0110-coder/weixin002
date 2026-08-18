const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { records: [], manageMode: false, delSelectedMap: {}, delCount: 0 },
  onShow() {
    // 试穿记录已移入「我的」体系：页面为普通页，底部 Tab 高亮「我的」
    // 仅在 onShow 加载（onLoad 后必触发 onShow，双处调用会重复请求）
    this.loadRecords();
  },
  loadRecords() {
    api.getHistory().then((records) => {
      this.setData({ records });
    }).catch(() => this.setData({ records: [] }));
  },
  toggleManage() {
    this.setData({ manageMode: !this.data.manageMode, delSelectedMap: {}, delCount: 0 });
  },
  onItemTap(e) {
    if (this.data.manageMode) {
      // 选中态存进 map（WXML 不支持数组方法调用，AGENTS.md §7）
      const id = e.detail.id;
      const delSelectedMap = Object.assign({}, this.data.delSelectedMap);
      if (delSelectedMap[id]) {
        delete delSelectedMap[id];
      } else {
        delSelectedMap[id] = true;
      }
      this.setData({ delSelectedMap, delCount: Object.keys(delSelectedMap).length });
    } else {
      const item = this.data.records.find((r) => r.id === e.detail.id);
      if (item && item.image) {
        wx.setStorageSync("aiTryonResult", {
          tryonImage: item.image,
          tryonVideo: item.videoUrl || "",
          garmentName: item.garmentName
        });
      }
      navigate("/pages/tryon-result/index");
    }
  },
  onLongPress(e) {
    if (!this.data.manageMode) {
      this.setData({ manageMode: true, delSelectedMap: { [e.detail.id]: true }, delCount: 1 });
    }
  },
  onDelete() {
    const ids = Object.keys(this.data.delSelectedMap);
    if (ids.length === 0) {
      toast("请先选择要删除的记录");
      return;
    }
    wx.showModal({
      title: "删除试穿记录",
      content: `将删除 ${ids.length} 条试穿记录，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("history", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false, delSelectedMap: {}, delCount: 0 });
            this.loadRecords();
          }).catch(() => {
            toast("删除失败，请重试");
          });
        }
      }
    });
  }
});
