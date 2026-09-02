/* 诊断：检查 storage 里的 avatarViewId 是否真实；对比 "av-current" 与真实 ID 的 submit 结果 */
const automator = require("miniprogram-automator");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

async function main() {
  const mini = await automator.connect({ wsEndpoint: WS });

  const store = await mini.evaluate(() => {
    let out = {};
    try {
      out.avatarViewId = wx.getStorageSync("avatarViewId");
      out.aiTryonTask = wx.getStorageSync("aiTryonTask");
      out.uploadedGarment = wx.getStorageSync("uploadedGarment");
    } catch (e) { out.err = String(e); }
    return out;
  });
  console.log("storage:", JSON.stringify(store));

  const av = await mini.evaluate(() => new Promise((resolve) => {
    wx.cloud.callFunction({
      name: "createAvatarViews",
      data: { action: "get" },
      success: (res) => resolve(res.result),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }));
  console.log("latest avatarViewId:", av && av.avatarViewId);

  for (const id of ["av-current", av && av.avatarViewId]) {
    if (!id) continue;
    const r = await mini.evaluate((p) => new Promise((resolve) => {
      wx.cloud.callFunction({
        name: "aiTryon",
        data: { action: "submit", avatarViewId: p, garmentIds: ["garment-mock-1"], garmentNames: ["白色基础T恤"] },
        success: (res) => resolve(res.result),
        fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
      });
    }), id);
    console.log("submit[" + id + "]:", JSON.stringify(r).slice(0, 300));
  }

  await mini.disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
