const { toast, navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

function resolveImage(src) {
  if (!src || src.indexOf("cloud://") !== 0 || !wx.cloud || !wx.cloud.getTempFileURL) return Promise.resolve(src || "");
  return new Promise((resolve) => wx.cloud.getTempFileURL({ fileList: [src], success: r => resolve((r.fileList && r.fileList[0] && r.fileList[0].tempFileURL) || src), fail: () => resolve(src) }));
}

Page({
  data: { statusBarHeight: 20, keyword: "", garments: [], filteredGarments: [], quota: { dailyFree: 3, used: 0, remaining: 3 }, avatarReady: false, personImage: "" },
  async onLoad() {
    try { const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); this.setData({ statusBarHeight: info.statusBarHeight || 20 }); } catch (e) {}
    this.loadData();
  },
  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) this.getTabBar().setData({ selected: 0, navMode: false, pill: false });
    if (this.data.garments.length || this.data.avatarReady) this.loadData();
  },
  async loadData() {
    try {
      const [garments, quota, profile] = await Promise.all([api.getMyGarments(), api.getQuota(), api.getAvatarProfile()]);
      const list = (garments || []).filter(g => g && g.type === "upload");
      const remaining = Math.max(0, (quota.dailyFree || 0) - (quota.used || 0));
      let avatarReady = false, personImage = "";
      if (profile && profile.id) {
        const asset = await api.getPersonAsset(profile.id);
        const original = asset && (asset.original_photo || asset.originalPhoto || "");
        avatarReady = !!original;
        personImage = await resolveImage(original);
      }
      this.setData({ garments: list, filteredGarments: this.filter(list, this.data.keyword), quota: Object.assign({}, quota, { used: quota.used || 0, remaining }), avatarReady, personImage });
    } catch (e) { console.error("[home] loadData failed", e); }
  },
  filter(list, keyword) { const k = (keyword || "").trim().toLowerCase(); return k ? list.filter(g => (g.name || "").toLowerCase().indexOf(k) >= 0) : list.slice(0, 6); },
  onSearchInput(e) { const keyword = e.detail.value; this.setData({ keyword, filteredGarments: this.filter(this.data.garments, keyword) }); },
  onSearch() { if (!this.data.keyword.trim()) toast("请输入衣物名称"); },
  onMore() { navigate("/pages/wardrobe/index"); },
  goTryon() { navigate(this.data.avatarReady ? "/pages/tryon-select/index" : "/pages/avatar-3d/index"); },
  goAvatar() { navigate("/pages/avatar-3d/index"); },
  openGarment(e) { navigate("/pages/garment-detail/index?id=" + e.currentTarget.dataset.id); }
});
