const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { quota: { dailyFree: 0, used: 0, remaining: 0 }, quotaPercent: 0, historyCount: 0, user: { nickname: "微信用户" }, avatarReady: false, personImage: "" },

  loadAvatarState() {
    return api.getAvatarProfile().then((profile) => {
      if (!profile || !profile.id) throw new Error("NO_PROFILE");
      return api.getPersonAsset(profile.id);
    }).then((asset) => {
      const avatarReady = !!asset && !!asset.original_photo;
      if (avatarReady && asset.original_photo && asset.original_photo.indexOf("cloud://") === 0 && wx.cloud && wx.cloud.getTempFileURL) {
        return new Promise(resolve => wx.cloud.getTempFileURL({ fileList:[asset.original_photo], success:r=>resolve((r.fileList&&r.fileList[0]&&r.fileList[0].tempFileURL)||asset.original_photo), fail:()=>resolve(asset.original_photo) })).then(personImage => this.setData({ avatarReady, personImage }));
      }
      this.setData({ avatarReady, personImage: avatarReady ? asset.original_photo : "" });
    }).catch(() => {
      this.setData({ avatarReady: false, personImage: "" });
    });
  },

  onLoad() {
    api.getQuota().then((quota) => {
      const used = quota.used || 0;
      const dailyFree = quota.dailyFree || 0;
      const remaining = Math.max(0, dailyFree - used);
      const quotaPercent = dailyFree > 0 ? Math.min(100, Math.round(used / dailyFree * 100)) : 0;
      this.setData({ quota: Object.assign({}, quota, { used, remaining }), quotaPercent });
    }).catch(() => {});

    // 试穿记录数动态获取（原为硬编码 12）
    api.getHistory().then((records) => {
      this.setData({ historyCount: (records || []).length });
    }).catch(() => this.setData({ historyCount: 0 }));

    this.loadAvatarState();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2, navMode: false, pill: true });
    }
    api.getQuota().then((quota) => {
      const used = quota.used || 0, dailyFree = quota.dailyFree || 0;
      const remaining = Math.max(0, dailyFree - used);
      const quotaPercent = dailyFree > 0 ? Math.min(100, Math.round(used / dailyFree * 100)) : 0;
      this.setData({ quota: Object.assign({}, quota, { used, remaining }), quotaPercent });
    }).catch(() => {});
    api.getHistory().then(records => this.setData({ historyCount: (records || []).length })).catch(() => {});
    this.loadAvatarState();
  },

  onSettings() { navigate("/pages/account/index"); },
  onQuota() { toast("今日剩余 " + this.data.quota.remaining + " 次免费试穿"); },
  goAccount() { navigate("/pages/account/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); },
  goHistory() { navigate("/pages/history/index"); },
  goPrivacy() { navigate("/pages/privacy-manage/index"); },
  goFeedback() { navigate("/pages/feedback-about/index"); }
});
