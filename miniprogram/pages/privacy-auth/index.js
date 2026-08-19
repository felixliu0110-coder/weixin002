const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

const DRAFT_KEY = "avatarPhotoDraft";

Page({
  onDecline() {
    wx.removeStorageSync(DRAFT_KEY);

    toast(
      "未同意授权：将不采集人脸照片，人物形象使用默认形象",
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

      wx.removeStorageSync(DRAFT_KEY);

      wx.hideLoading();

      navigate("/pages/generate-progress/index");
    } catch (err) {
      wx.hideLoading();

      toast(
        (err && err.message) || "保存失败，请重试",
        2400
      );
    } finally {
      this._submitting = false;
    }
  }
});
