const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { openid } = cloud.getWXContext();
  // 微信身份登录：openid 由平台自动注入，无需 wx.login/code2Session
  console.log("auth login", "openid=" + (openid ? "set" : "EMPTY"));
  return { ok: true, loggedIn: !!openid, openid: openid || "", ts: Date.now() };
};
