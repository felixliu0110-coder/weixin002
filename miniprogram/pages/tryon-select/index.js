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
    selected: [],
    buttonText: "开始试穿",
    uploadVisible: false
  },
  onLoad() {
    api.getGarmentTemplates().then((templates) => {
      this.setData({ templates });
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
    const selected = this.data.selected.includes(id)
      ? this.data.selected.filter((x) => x !== id)
      : [...this.data.selected, id];
    this.setData({
      selected,
      buttonText: selected.length > 0 ? "开始试穿（已选 " + selected.length + " 件）" : "开始试穿"
    });
    toast(selected.includes(id) ? "已选择「" + name + "」" : "已取消选择");
  },
  startTryon() {
    if (this.data.selected.length === 0) {
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
