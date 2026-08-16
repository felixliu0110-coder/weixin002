const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    tabs: [
      { label: "模板衣物", value: "lib" },
      { label: "上传衣物", value: "upload" }
    ],
    tab: "lib",
    templates: [],
    selectedCount: 0,
    manageMode: false,
    delCount: 0,
    buttonText: "开始试穿",
    uploadVisible: false
  },
  onLoad() {
    this.loadTemplates();
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, navMode: false, pill: false });
    }
  },
  onTab(e) {
    const tab = e.detail.value;
    this.setData({ tab });
    if (tab === "upload") {
      this.setData({ uploadVisible: true });
    } else {
      toast("已显示模板衣物库");
    }
  },
  toggleGarment(e) {
    const id = e.detail.id;
    const name = e.detail.name;
    const templates = this.data.templates.map((t) =>
      t.id === id ? Object.assign({}, t, { selected: !t.selected }) : t
    );
    const count = templates.filter((t) => t.selected).length;
    const chosen = templates.find((t) => t.id === id);
    this.setData({
      templates,
      selectedCount: count,
      buttonText: count > 0 ? "开始试穿（已选 " + count + " 件）" : "开始试穿"
    });
    toast(chosen.selected ? "已选择「" + name + "」" : "已取消选择");
  },
  loadTemplates() {
    api.getGarmentTemplates().then((templates) => {
      this.setData({
        templates: templates.map((t) => Object.assign({}, t, { selected: false, del: false })),
        selectedCount: 0,
        buttonText: "开始试穿"
      });
    });
  },
  toggleManage() {
    const manageMode = !this.data.manageMode;
    const templates = this.data.templates.map((t) => Object.assign({}, t, { del: false }));
    this.setData({ manageMode, templates, delCount: 0 });
  },
  onItemTap(e) {
    if (this.data.manageMode) {
      const id = e.detail.id;
      const templates = this.data.templates.map((t) =>
        t.id === id ? Object.assign({}, t, { del: !t.del }) : t
      );
      const delCount = templates.filter((t) => t.del).length;
      this.setData({ templates, delCount });
    } else {
      this.toggleGarment(e);
    }
  },
  onLongPress(e) {
    if (!this.data.manageMode) {
      const id = e.detail.id;
      const templates = this.data.templates.map((t) =>
        t.id === id ? Object.assign({}, t, { del: true }) : Object.assign({}, t, { del: false })
      );
      this.setData({ manageMode: true, templates, delCount: 1 });
    }
  },
  onDelete() {
    const ids = this.data.templates.filter((t) => t.del).map((t) => t.id);
    if (ids.length === 0) return;
    wx.showModal({
      title: "删除模板衣物",
      content: `将删除 ${ids.length} 件模板衣物，删除后不可恢复。`,
      confirmText: "删除",
      confirmColor: "#C0392B",
      success: (res) => {
        if (res.confirm) {
          api.deleteItems("templates", ids).then(() => {
            toast("已删除");
            this.setData({ manageMode: false, delCount: 0 });
            this.loadTemplates();
          });
        }
      }
    });
  },
  startTryon() {
    if (this.data.selectedCount === 0) {
      toast("请先选择一件衣物");
      return;
    }
    navigate("/pages/tryon-progress/index");
  },
  openUpload() { this.setData({ uploadVisible: true }); },
  closeUpload() { this.setData({ uploadVisible: false }); },
  pickPhoto(e) {
    if (this._picking) return;
    this._picking = true;
    const mode = e.currentTarget.dataset.mode;
    this.setData({ uploadVisible: false });
    toast(mode === "album" ? "已从相册选择衣物，进入预处理" : "已拍照上传，进入预处理");
    setTimeout(() => navigate("/pages/image-preview/index"), 1000);
  }
});
