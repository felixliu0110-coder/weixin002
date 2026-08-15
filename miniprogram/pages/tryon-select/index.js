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
    buttonText: "开始试穿",
    uploadVisible: false
  },
  onLoad() {
    api.getGarmentTemplates().then((templates) => {
      this.setData({
        templates: templates.map((t) => Object.assign({}, t, { selected: false }))
      });
    });
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
    const mode = e.currentTarget.dataset.mode;
    this.setData({ uploadVisible: false });
    toast(mode === "album" ? "已从相册选择衣物，进入预处理" : "已拍照上传，进入预处理");
    setTimeout(() => navigate("/pages/image-preview/index"), 1000);
  }
});
