/* 数据访问层：页面只依赖本文件。真实接口就绪后替换内部实现。 */
const mock = require("./mock");

module.exports = {
  getAvatarProfile: mock.getAvatarProfile,
  saveAvatarProfile: mock.saveAvatarProfile,
  getGarmentTemplates: mock.getGarmentTemplates,
  getHomeTemplates: mock.getHomeTemplates,
  uploadGarment: mock.uploadGarment,
  submitTryon: mock.submitTryon,
  getTryonStatus: mock.getTryonStatus,
  getHistory: mock.getHistory,
  getFavorites: mock.getFavorites,
  getQuota: mock.getQuota,
  saveResult: mock.saveResult,
  deleteUserData: mock.deleteUserData
};
