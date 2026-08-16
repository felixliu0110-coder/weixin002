const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    faceState: "none",
    bodyState: "none",
    sheetVisible: false
  },
  openPhotoSheet() { this.setData({ sheetVisible: true }); },
  closePhotoSheet() { this.setData({ sheetVisible: false }); },
  choosePhoto(e) {
    const mode = e.currentTarget.dataset.mode;
    if (this.data.faceState !== "done") {
      this.setData({ faceState: "done" });
    } else {
      this.setData({ bodyState: "done" });
    }
    this.setData({ sheetVisible: false });
    toast(mode === "album" ? "已模拟从相册选择照片" : "已模拟拍照上传");
  },
  generate() {
    api.saveAvatarProfile({
      facePhoto: this.data.faceState === "done" ? "mock-face" : "",
      bodyPhoto: this.data.bodyState === "done" ? "mock-body" : ""
    });
    navigate("/pages/privacy-auth/index");
  }
});
