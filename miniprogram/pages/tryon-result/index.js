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
  // 云文件 ID / 网络图先下载再存相册；包内资源路径直接保存
  saveToAlbum(src, done, fail) {
    if (!src) { fail && fail("无图可保存"); return; }
    const doSave = (path) => wx.saveImageToPhotosAlbum({
      filePath: path,
      success: () => done && done(),
      fail: (e) => fail && fail((e && e.errMsg) || "保存失败")
    });
    if (src.indexOf("cloud://") === 0 || src.indexOf("http") === 0) {
      if (src.indexOf("cloud://") === 0 && wx.cloud) {
        wx.cloud.downloadFile({ fileID: src, success: (r) => doSave(r.tempFilePath), fail: () => fail && fail("图片下载失败") });
      } else {
        wx.downloadFile({ url: src, success: (r) => doSave(r.tempFilePath), fail: () => fail && fail("图片下载失败") });
      }
    } else {
      doSave(src);
    }
  },
  collectYes() {
    // 是：收藏 + 保存到相册
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      tryonVideo: this.data.result.tryonVideo,
      saved: true
    }).then(() => {
      this._collecting = false;
      this.saveToAlbum(this.data.result.tryonImage,
        () => toast("已收藏并保存到相册"),
        () => toast("已收藏；保存到相册失败，可在相册权限开启后重试"));
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },
  collectNo() {
    // 否：仅收藏
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      tryonVideo: this.data.result.tryonVideo,
      saved: false
    }).then(() => {
      this._collecting = false;
      toast("已收藏");
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
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
  onShare() {
    // 触发系统分享（onShareAppMessage 见下）；同时保留提示
    toast("分享内容含「AI 生成效果，仅供参考」标识");
  },
  onShareAppMessage() {
    // 分享卡片必须标注 AI 生成（AGENTS.md §9 合规强制）
    return {
      title: "「" + (this.data.result.garmentName || "AI 试穿") + "」AI 试穿效果（AI 生成效果，仅供参考）",
      path: "/pages/login/index",
      imageUrl: this.data.result.tryonImage
    };
  }
});
