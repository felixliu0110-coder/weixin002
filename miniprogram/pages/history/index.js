const { navigate } = require("../../utils/interaction");
const api = require("../../utils/api");

Page({
  data: { records: [] },
  onLoad() {
    this.loadRecords();
  },
  onShow() {
    // 试穿记录已移入「我的」体系：页面为普通页，底部 Tab 高亮「我的」
    this.loadRecords();
  },
  loadRecords() {
    api.getHistory().then((records) => {
      this.setData({ records });
    });
  },
  openResult() {
    navigate("/pages/tryon-result/index");
  }
});
