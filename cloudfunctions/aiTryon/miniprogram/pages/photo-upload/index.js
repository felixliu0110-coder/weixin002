const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const DRAFT_KEY = "avatarPhotoDraft";
const DRAFT_TTL = 30 * 60 * 1000;

function readDraft() {
  const draft = wx.getStorageSync(DRAFT_KEY) || {};
  if (draft.updatedAt && Date.now() - draft.updatedAt > DRAFT_TTL) {
    wx.removeStorageSync(DRAFT_KEY);
    return {};
  }
  return draft;
}

Page({
  data: {
    faceState: "none",
    bodyState: "none",
    sheetVisible: false
  },

  onLoad() {
    const draft = readDraft();

    api.getAvatarProfile().then((profile) => {
      if (!profile) return;

      const facePhoto = profile.face_photo_id || profile.facePhoto || "";
      const bodyPhoto = profile.body_photo_id || profile.bodyPhoto || "";

      this._existingFacePhoto = facePhoto;
      this._existingBodyPhoto = bodyPhoto;

      const nextDraft = Object.assign({}, readDraft(), {
        existingFacePhoto: facePhoto,
        existingBodyPhoto: bodyPhoto,
        updatedAt: Date.now()
      });

      wx.setStorageSync(DRAFT_KEY, nextDraft);

      this.setData({
        faceState: draft.faceTempPath || facePhoto ? "done" : "none",
        bodyState: draft.bodyTempPath || bodyPhoto ? "done" : "none"
      });
    }).catch(() => {
      this.setData({
        faceState: draft.faceTempPath ? "done" : "none",
        bodyState: draft.bodyTempPath ? "done" : "none"
      });
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

    if (this._choosingPhoto) return;

    this._choosingPhoto = true;
    this.setData({ sheetVisible: false });
    wx.showLoading({ title: "读取中", mask: true });

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

        const draft = Object.assign({}, readDraft(), {
          updatedAt: Date.now()
        });

        if (target === "face") {
          draft.faceTempPath = f.tempFilePath;
          draft.facePhoto = "";
          this.setData({ faceState: "done" });
        } else {
          draft.bodyTempPath = f.tempFilePath;
          draft.bodyPhoto = "";
          this.setData({ bodyState: "done" });
        }

        wx.setStorageSync(DRAFT_KEY, draft);
        toast("照片已选择");
      })
      .catch((err) => {
        if (err && err.errMsg && /cancel/i.test(err.errMsg)) return;

        toast(
          (err && err.message) || "照片选择失败，请重试",
          2400
        );
      })
      .finally(() => {
        this._choosingPhoto = false;
        wx.hideLoading();
      });
  },

  generate() {
    const draft = Object.assign({}, readDraft(), {
      existingFacePhoto: this._existingFacePhoto || "",
      existingBodyPhoto: this._existingBodyPhoto || "",
      updatedAt: Date.now()
    });

    wx.setStorageSync(DRAFT_KEY, draft);

    navigate("/pages/privacy-auth/index");
  }
});
