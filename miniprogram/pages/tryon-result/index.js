const { toast } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    angle: "正面",
    collectVisible: false,
    templateVisible: false,
    tplName: "",
    tplCategory: "",
    categories: ["上衣", "裤子", "头饰", "鞋子", "其他"],
    result: { tryonImage: "/assets/img/p07-result.jpg", tryonVideo: "", garmentName: "AI 试穿" }
  },
  onLoad() {
    const r = wx.getStorageSync("aiTryonResult") || {};
    this.setData({
      result: Object.assign({ tryonImage: "/assets/img/p07-result.jpg", tryonVideo: "", garmentName: "AI 试穿" }, r)
    });
  },
  onAngle(e) {
    const angle = e.detail.label;
    this.setData({ angle });
    toast("已切换至「" + angle + "」视角（真实实现将切换生成图）");
  },
  onCollect() { this.setData({ collectVisible: true }); },
  closeCollect() { this.setData({ collectVisible: false }); },
  collectYes() {
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      tryonVideo: this.data.result.tryonVideo,
      saved: true
    }).then(() => {
      toast("已收藏并保存到相册");
    });
  },
  collectNo() {
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      tryonVideo: this.data.result.tryonVideo,
      saved: true
    }).then(() => {
      toast("已收藏");
    });
  },
  onSaveTemplate() {
    this.setData({
      templateVisible: true,
      tplName: this.data.result.garmentName
    });
  },
  closeTemplate() { this.setData({ templateVisible: false }); },
  onTplName(e) { this.setData({ tplName: e.detail.value }); },
  onTplCategory(e) { this.setData({ tplCategory: e.currentTarget.dataset.cat }); },
  confirmSaveTemplate() {
    const name = (this.data.tplName || "").trim();
    if (!name) {
      toast("请输入衣物名称");
      return;
    }
    if (!this.data.tplCategory) {
      toast("请选择衣物分类");
      return;
    }
    this.setData({ templateVisible: false });
    api.saveToTemplates({
      category: this.data.tplCategory,
      name,
      image: "/assets/img/p07-result.jpg"
    }).then(() => {
      toast("已保存到模板（" + this.data.tplCategory + "）");
    });
  },
  onShare() { toast("分享卡片已生成，含「AI 生成效果，仅供参考」标识"); }
});
