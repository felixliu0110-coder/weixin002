const { toast, reLaunch } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { delVisible: false },
  onDataInfo() {
    toast("当前保存的数据包括人物照片、身体参数、衣物与试穿记录");
  },
  openDel() { this.setData({ delVisible: true }); },
  closeDel() { this.setData({ delVisible: false }); },
  confirmDel() {
    if (this._deleting) return;
    this._deleting = true;
    this.setData({ delVisible: false });
    api.deleteUserData().then((res) => {
      this._deleting = false;
      const app = getApp();
      if (app && app.globalData) app.globalData.loggedIn = false;
      toast(res && res.status === "completed" ? "数据已删除" : "删除任务已提交", 2000);
      setTimeout(() => reLaunch("/pages/login/index"), 800);
    }).catch(() => {
      this._deleting = false;
      toast("删除失败，请重试");
    });
  }
});
