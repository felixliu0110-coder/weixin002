const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const DRAFT_KEY = "avatarPhotoDraft";

Page({
  onDecline() {
    wx.removeStorageSync(DRAFT_KEY);

    toast(
      "未授权照片：不会建立真人人物照片资产；可稍后返回补充",
      2400
    );

    wx.navigateBack({
      fail: () => navigate("/pages/photo-upload/index")
    });
  },

  async uploadDraftPhoto(tempFilePath, prefix) {
    if (!tempFilePath) return "";

    const match = tempFilePath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match ? match[1].toLowerCase() : "jpg";

    const cloudPath =
      "avatar-photos/" +
      Date.now() +
      "-" +
      prefix +
      "-" +
      Math.random().toString(36).slice(2, 8) +
      "." +
      ext;

    const result = await wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath
    });

    if (!result || !result.fileID) {
      throw new Error("照片上传失败");
    }

    return result.fileID;
  },

  async onAccept() {
    if (this._submitting) return;

    this._submitting = true;

    wx.showLoading({
      title: "处理中",
      mask: true
    });

    const draft = wx.getStorageSync(DRAFT_KEY) || {};

    try {
      const data = {};
      let hasNewPhoto = false;

      if (draft.faceTempPath) {
        data.facePhoto = await this.uploadDraftPhoto(
          draft.faceTempPath,
          "face"
        );
        hasNewPhoto = true;
      }

      if (draft.bodyTempPath) {
        data.bodyPhoto = await this.uploadDraftPhoto(
          draft.bodyTempPath,
          "body"
        );
        hasNewPhoto = true;
      }

      if (hasNewPhoto) {
        await api.saveAvatarProfile(data);
      }

      const profile = await api.getAvatarProfile();
      if (!profile || !profile.id) {
        throw new Error("人物档案创建失败");
      }

      // V1：真实人物照片直接建立 Person Asset。
      await api.getPersonAsset(profile.id, {
        ensure: true,
        originalPhoto: data.bodyPhoto || profile.body_photo_id || profile.bodyPhoto || "",
        frontPhoto: data.facePhoto || profile.face_photo_id || profile.facePhoto || ""
      });

      wx.removeStorageSync(DRAFT_KEY);
      wx.hideLoading();
      navigate("/pages/home/index", { reLaunch: true });
    } catch (err) {
      wx.hideLoading();

      console.error("[privacy-auth] accept failed", err);
      toast(
        (err && err.message) || "保存失败，请重试",
        2600
      );
    } finally {
      this._submitting = false;
    }
  }
});
