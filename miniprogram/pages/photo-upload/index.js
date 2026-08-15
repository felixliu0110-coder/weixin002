const { toast, navigate } = require("../../utils/interaction");

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
    // 原型 data-nav=09-privacy-auth.html；隐私授权页在批 4 实现
    navigate("/pages/privacy-auth/index");
  }
});
