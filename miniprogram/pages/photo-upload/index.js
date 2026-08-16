const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    faceState: "none",
    bodyState: "none",
    sheetVisible: false
  },
  openFaceSheet() {
    // 记录当前要上传的是哪张照片，避免状态判断错位（重传人脸被误记为全身照）
    this._photoTarget = "face";
    this.setData({ sheetVisible: true });
  },
  openBodySheet() {
    this._photoTarget = "body";
    this.setData({ sheetVisible: true });
  },
  closePhotoSheet() { this.setData({ sheetVisible: false }); },
  choosePhoto(e) {
    const target = this._photoTarget || "face";
    this.setData(
      target === "face" ? { faceState: "done" } : { bodyState: "done" }
    );
    this.setData({ sheetVisible: false });
    toast(e.currentTarget.dataset.mode === "album" ? "已模拟从相册选择照片" : "已模拟拍照上传");
  },
  generate() {
    api.saveAvatarProfile({
      facePhoto: this.data.faceState === "done" ? "mock-face" : "",
      bodyPhoto: this.data.bodyState === "done" ? "mock-body" : ""
    }).then(() => {
      navigate("/pages/privacy-auth/index");
    }).catch(() => {
      toast("保存失败，请重试");
    });
  }
});
