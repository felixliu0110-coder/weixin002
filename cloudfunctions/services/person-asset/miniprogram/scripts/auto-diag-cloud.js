/* 自动化诊断：检查小程序运行环境 wx.cloud 状态，并直接调用 createAvatarViews 云函数看真实返回 */
const automator = require("miniprogram-automator");

const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

async function main() {
  const mini = await automator.connect({ wsEndpoint: WS });
  console.log("connected to", WS);
  mini.on("console", (msg) => {
    if (msg.type === "error" || msg.type === "warn") {
      console.log("[console " + msg.type + "]", msg.args ? msg.args.join(" ") : "");
    }
  });

  const env = await mini.evaluate(() => ({
    hasWx: typeof wx !== "undefined",
    hasCloud: !!(typeof wx !== "undefined" && wx.cloud),
    hasCallFunction: !!(typeof wx !== "undefined" && wx.cloud && typeof wx.cloud.callFunction === "function"),
    cloudEnv: (typeof wx !== "undefined" && wx.cloud && wx.cloud.DYNAMIC_CURRENT_ENV) || null
  }));
  console.log("env:", JSON.stringify(env));

  const profile = {
    gender: "female", heightCm: 165, weightKg: 50,
    bustCm: 88, waistCm: 66, hipCm: 92, legLengthCm: 82,
    neckLengthCm: 9, shoulderCm: 38, armLengthCm: 55, shoeSize: 37,
    skinTone: "natural", estimate: true
  };
  const r = await mini.evaluate((p) => new Promise((resolve) => {
    wx.cloud.callFunction({
      name: "createAvatarViews",
      data: { profile: p },
      success: (res) => resolve({ ok: true, result: res.result }),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }), profile);
  console.log("createAvatarViews result:", JSON.stringify(r, null, 2));

  // 关键：小程序端直接查询 avatar_views，看能否读到自己的记录
  const dbRes = await mini.evaluate(() => new Promise((resolve) => {
    wx.cloud.database().collection("avatar_views").orderBy("createdAt", "desc").limit(10).get({
      success: (res) => resolve({
        ok: true,
        count: res.data.length,
        docs: res.data.map((d) => ({
          id: d._id,
          openid: d._openid,
          provider: d.provider,
          views: d.views,
          status: d.status,
          createdAt: d.createdAt
        }))
      }),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }));
  console.log("avatar_views query:", JSON.stringify(dbRes, null, 2));

  await mini.disconnect();
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
