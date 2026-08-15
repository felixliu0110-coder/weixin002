const config = require("./config");

App({
  onLaunch() {
    if (wx.cloud && config.cloudEnv && config.cloudEnv.trim() !== "") {
      wx.cloud.init({ env: config.cloudEnv, traceUser: true });
    }
  },
  globalData: {
    loggedIn: false
  }
});
