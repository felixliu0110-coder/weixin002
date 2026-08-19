const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    faceState: "none",
    bodyState: "none",
    sheetVisible: false
  },

  onLoad() {
    // 编辑已有的人物时恢复已经保存的照片。
    // 首次创建没有照片时保持空状态。
    api.getAvatarProfile().then((profile) => {
      if (!profile) return;

      const facePhoto = profile.face_photo_id || profile.facePhoto || "";
      const bodyPhoto = profile.body_photo_id || profile.bodyPhoto || "";

      this._existingFacePhoto = facePhoto;
      this._existingBodyPhoto = bodyPhoto;

      this.setData({
        faceState: facePhoto ? "done" : "none",
        bodyState: bodyPhoto ? "done" : "none"
      });
    }).catch(() => {
      // 获取已有档案失败时保持空状态，不阻断照片页面。
    });
  },

  openFaceSheet() {
    this._photoTarget = "face";
    this.setData({ sheetVisible: true });
  },

  openBodySheet() {
    this._photoTarget = "body";
    this.setData({ sheetVisible: true });
  },

  closePhotoSheet() {
    this.setData({ sheetVisible: false });
  },

  choosePhoto(e) {
    const target = this._photoTarget || "face";
    const sourceType = e.currentTarget.dataset.mode === "camera"
      ? ["camera"]
      : ["album"];

    if (this._uploadingPhoto) return;

    this._uploadingPhoto = true;
    this.setData({ sheetVisible: false });
    wx.showLoading({ title: "上传中", mask: true });

    new Promise((resolve, reject) => {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType,
        success: resolve,
        fail: reject
      });
    })
      .then((res) => {
        const f = res.tempFiles && res.tempFiles[0];

        if (!f || !f.tempFilePath) {
          throw new Error("未选择照片");
        }

        if (f.size && f.size > 10 * 1024 * 1024) {
          throw new Error("照片大小不能超过10MB");
        }

        const match = (f.tempFilePath || "").match(/\.([a-zA-Z0-9]+)$/);
        const ext = match ? match[1].toLowerCase() : "jpg";

        const cloudPath =
          "avatar-photos/" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2, 8) +
          "." +
          ext;

        return wx.cloud.uploadFile({
          cloudPath,
          filePath: f.tempFilePath
        });
      })
      .then((up) => {
        if (!up || !up.fileID) {
          throw new Error("照片上传失败");
        }

        if (target === "face") {
          this._existingFacePhoto = up.fileID;
          this.setData({ faceState: "done" });
        } else {
          this._existingBodyPhoto = up.fileID;
          this.setData({ bodyState: "done" });
        }

        toast("照片上传成功");
      })
      .catch((err) => {
        const message =
          err && err.message
            ? err.message
            : "照片上传失败，请重试";

        toast(message, 2400);
      })
      .finally(() => {
        this._uploadingPhoto = false;
        wx.hideLoading();
      });
  },

  generate() {
    const data = {};

    // 有已有照片或刚刚上传的新照片时，继续保存对应 cloud:// fileID。
    // 没有照片时不传字段，避免用空字符串覆盖已有照片。
    if (this._existingFacePhoto) {
      data.facePhoto = this._existingFacePhoto;
    }

    if (this._existingBodyPhoto) {
      data.bodyPhoto = this._existingBodyPhoto;
    }

    api.saveAvatarProfile(data)
      .then(() => {
        navigate("/pages/privacy-auth/index");
      })
      .catch(() => {
        toast("保存失败，请重试");
      });
  }
});
