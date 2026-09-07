const { toast, navigate } = require("../../utils/interaction");

Page({
  data: { agreed: false },
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({ agreed });
    toast(agreed ? "已同意《用户协议》和《隐私政策》" : "需同意协议后才能使用人脸相关功能");
  },
  onLogin() {
    // 隐私合规：协议需用户主动勾选同意，未勾选不允许进入
    if (!this.data.agreed) {
      toast("请先阅读并同意《用户协议》和《隐私政策》");
      return;
    }
    // 真实微信登录：云函数获取微信身份（openid），存本地后进入
    const app = getApp();
    const enter = async () => {
      if (app && app.globalData) app.globalData.loggedIn = true;
      try {
        const profileRes = await wx.cloud.callFunction({ name: "auth", data: { action: "profileGet" } });
        const r = profileRes && profileRes.result || {};
        if (!r.ok) throw new Error(r.message || "人物档案读取失败");
        navigate(r.empty ? "/pages/basic-info/index" : "/pages/home/index");
      } catch (e) {
        console.error("[login] profile bootstrap failed", e);
        toast((e && e.message) || "读取人物档案失败，请重试");
      }
    };
    if (wx.cloud && wx.cloud.callFunction) {
      wx.cloud.callFunction({ name: "auth", data: { action: "login" } })
        .then((res) => {
          const r = res && res.result || {};
          if (!r.ok || !r.loggedIn || !r.openid) {
            const err = new Error(r.message || "微信身份校验失败");
            err.cloudResult = r;
            throw err;
          }
          wx.setStorageSync("userOpenid", r.openid);
          if (app && app.globalData) app.globalData.openid = r.openid;
          return enter();
        })
        .catch((e) => {
          console.error("[login] auth failed", e);
          toast((e && e.message) || "登录失败，请稍后重试");
        });
    } else {
      console.error("[login] wx.cloud unavailable");
      toast("云服务未就绪，请检查小程序云开发配置");
    }
  }
});
