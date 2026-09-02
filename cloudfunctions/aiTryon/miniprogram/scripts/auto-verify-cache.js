/* 验证试穿结果复用：真实提交 → 等视频完成 → 同参数再提交，期望 cached:true 秒回 */
const automator = require("miniprogram-automator");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";
const WAIT_MS = Number(process.env.AUTOTEST_WAIT || 10 * 60 * 1000);

const GARMENT_IDS = ["g-cache-verify-1"];
const GARMENT_NAMES = ["缓存验证衣物"];

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

  const submit = (avatarViewId) => mini.evaluate((p) => new Promise((resolve) => {
    wx.cloud.callFunction({
      name: "aiTryon",
      data: {
        action: "submit",
        avatarViewId: p,
        garmentIds: GARMENT_IDS,
        garmentNames: GARMENT_NAMES
      },
      success: (res) => resolve(res.result),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }), avatarViewId);

  const t0 = Date.now();
  const first = await submit(av.avatarViewId);
  console.log("first submit(" + ((Date.now() - t0) / 1000).toFixed(1) + "s):", JSON.stringify(first).slice(0, 220));
  if (!first.ok || !first.taskId) {
    console.log("first submit failed, abort");
    await mini.disconnect();
    return;
  }

  // 轮询第一次任务直到 success / failed / 超时
  let final = null;
  while (Date.now() - t0 < WAIT_MS) {
    await new Promise((r) => setTimeout(r, 12000));
    const st = await mini.evaluate((taskId) => new Promise((resolve) => {
      wx.cloud.callFunction({
        name: "aiTryon",
        data: { action: "status", taskId },
        success: (res) => resolve(res.result),
        fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
      });
    }), first.taskId);
    console.log("poll " + ((Date.now() - t0) / 1000).toFixed(0) + "s:", st.status, st.tryonVideo ? "video=ok" : "video=pending");
    if (st.status === "success" || st.status === "failed") { final = st; break; }
  }
  if (!final) {
    console.log("timeout waiting first task");
    await mini.disconnect();
    return;
  }

  // 第二次同参数提交：期望 cached:true
  const t1 = Date.now();
  const second = await submit(av.avatarViewId);
  console.log("second submit(" + ((Date.now() - t1) / 1000).toFixed(1) + "s):", JSON.stringify(second).slice(0, 300));
  if (second.ok && second.cached === true && second.status === "success") {
    console.log("CACHE VERIFY: PASS (cached=true, 秒回, 未调 Agnes)");
  } else {
    console.log("CACHE VERIFY: FAIL ->", JSON.stringify(second));
  }
  await mini.disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
