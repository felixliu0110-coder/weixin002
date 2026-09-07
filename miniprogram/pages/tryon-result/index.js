const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    collectVisible: false,
    collecting: false,
    result: { tryonImage: "", tryonVideo: "", garmentName: "AI 试穿", garments: [] }
  },
  onLoad() {
    const r = wx.getStorageSync("aiTryonResult") || {};
    // 禁止默认 AI 示例图片：无真实图片则返回选择页
    if (!r.tryonImage && !r.tryonImageUrl) {
      navigate("/pages/tryon-select/index", { reLaunch: true });
      return;
    }
    this.setData({
      result: Object.assign({ tryonImage: "", tryonVideo: "", garmentName: "AI 试穿", garments: [] }, r),
      collecting: false
    });
  },

  /* ---------- 收藏 ---------- */
  onCollect() {
    if (this._collecting) return;
    this.setData({ collectVisible: true });
  },
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
    // 是：收藏 + 保存图片到相册
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      taskId: this.data.result.imageTaskId || this.data.result.taskId || "",
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      saved: true
    }).then(() => {
      this._collecting = false;
      this.setData({ collecting: true });
      this.saveToAlbum(this.data.result.tryonImage,
        () => toast("已收藏并保存到相册"),
        () => toast("已收藏；保存到相册失败，可在相册权限开启后重试"));
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },

  collectNo() {
    // 否：仅收藏（图片）
    if (this._collecting) return;
    this._collecting = true;
    this.setData({ collectVisible: false });
    api.saveAiResult({
      taskId: this.data.result.imageTaskId || this.data.result.taskId || "",
      garmentName: this.data.result.garmentName,
      tryonImage: this.data.result.tryonImage,
      saved: false
    }).then(() => {
      this._collecting = false;
      this.setData({ collecting: true });
      toast("已收藏");
    }).catch(() => {
      this._collecting = false;
      toast("收藏失败，请重试");
    });
  },

  onRetry() {
    const r = this.data.result || {};
    const garmentId = r.garmentId || (r.garments && r.garments[0] && r.garments[0].id) || "";
    if (!garmentId) return toast("找不到这次试穿的衣物，请从衣橱重新选择");
    const g = (r.garments || []).find(x => x.id === garmentId);
    wx.setStorageSync("aiTryonPending", {
      garmentId, garmentIds: [garmentId], garmentNames: [g ? g.name : (r.garmentName || "所选衣物")],
      garmentImages: [g ? g.image : ""], garmentCategories: [g ? (g.category || "上衣") : "上衣"],
      displayName: g ? g.name : (r.garmentName || "所选衣物")
    });
    navigate("/pages/tryon-progress/index");
  },

  /* ---------- 分享 ---------- */
  onShare() {
    // 分享按钮由 open-type="share" 触发系统分享，这里仅做提示
    toast("分享内容含「AI 生成效果，仅供参考」标识");
  },
  onShareAppMessage() {
    // 分享卡片：仅分享图片（不分享视频）
    return {
      title: "「" + (this.data.result.garmentName || "AI 试穿") + "」AI 试穿效果（AI 生成效果，仅供参考）",
      path: "/pages/home/index",
      imageUrl: this.data.result.tryonImage
    };
  },

});
