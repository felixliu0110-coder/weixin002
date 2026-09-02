const { toast, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: {
    delVisible: false,
    revokeVisible: false
  },
  onDataInfo() { toast("已授权：微信信息、人脸照片、身体参数"); },
  onExport() { toast("正在生成导出文件，稍后通知下载（模拟）"); },
  openDel() { this.setData({ delVisible: true }); },
  closeDel() { this.setData({ delVisible: false }); },
  confirmDel() {
    if (this._deleting) return;
    this._deleting = true;
    this.setData({ delVisible: false });
    api.deleteUserData().then(() => {
      this._deleting = false;
      // 数据已删除：重置登录态并回到登录页，不能停留在已失效的数据页上
      const app = getApp();
      if (app && app.globalData) app.globalData.loggedIn = false;
      toast("已提交删除，将在 7 天内完成清理");
      setTimeout(() => reLaunch("/pages/login/index"), 1200);
    }).catch(() => {
      this._deleting = false;
      toast("删除失败，请重试");
    });
  },
  openRevoke() { this.setData({ revokeVisible: true }); },
  closeRevoke() { this.setData({ revokeVisible: false }); },
  confirmRevoke() {
    this.setData({ revokeVisible: false });
    toast("已撤回授权，数据将异步清理");
  }
});
