const { toast } = require("../../utils/interaction");
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
    this.setData({ delVisible: false });
    api.deleteUserData().then(() => {
      toast("已提交删除，将在 7 天内完成清理");
    });
  },
  openRevoke() { this.setData({ revokeVisible: true }); },
  closeRevoke() { this.setData({ revokeVisible: false }); },
  confirmRevoke() {
    this.setData({ revokeVisible: false });
    toast("已撤回授权，数据将异步清理");
  }
});
