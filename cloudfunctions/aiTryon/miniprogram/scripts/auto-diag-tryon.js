/* 诊断：直接调用 aiTryon submit/status，验证试穿视频是否走 Agnes 真实链路 */
const automator = require("miniprogram-automator");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

async function main() {
  const mini = await automator.connect({ wsEndpoint: WS });

  const av = await mini.evaluate(() => new Promise((resolve) => {
    wx.cloud.callFunction({
      name: "createAvatarViews",
      data: { action: "get" },
      success: (res) => resolve(res.result),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }));
  if (!av || !av.ok || !av.avatarViewId) {
    console.log("no avatar view:", JSON.stringify(av));
    await mini.disconnect();
    return;
  }
  console.log("avatarViewId:", av.avatarViewId);

  const t0 = Date.now();
  const sub = await mini.evaluate((p) => new Promise((resolve) => {
    wx.cloud.callFunction({
      name: "aiTryon",
      data: { action: "submit", avatarViewId: p.avatarViewId, garmentIds: ["garment-mock-1"], garmentNames: ["白色基础T恤"] },
      success: (res) => resolve(res.result),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }), { avatarViewId: av.avatarViewId });
  console.log("submit(" + ((Date.now() - t0) / 1000).toFixed(1) + "s):", JSON.stringify(sub));

  if (sub && sub.ok && sub.taskId) {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      const st = await mini.evaluate((taskId) => new Promise((resolve) => {
        wx.cloud.callFunction({
          name: "aiTryon",
          data: { action: "status", taskId },
          success: (res) => resolve(res.result),
          fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
        });
      }), sub.taskId);
      console.log("status[" + i + "] " + ((Date.now() - t0) / 1000).toFixed(1) + "s:", JSON.stringify(st));
      if (st && (st.status === "success" || st.status === "failed")) break;
    }
  }

  await mini.disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
