/* 诊断：小程序端自写自读 avatar_views，确认 _openid 归属与权限行为 */
const automator = require("miniprogram-automator");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

async function main() {
  const mini = await automator.connect({ wsEndpoint: WS });
  console.log("connected");

  const r = await mini.evaluate(() => new Promise((resolve) => {
    const db = wx.cloud.database();
    db.collection("avatar_views").add({
      data: { _diag: true, diagAt: Date.now(), createdAt: Date.now() },
      success: (addRes) => {
        db.collection("avatar_views").orderBy("createdAt", "desc").limit(5).get({
          success: (q) => resolve({
            added: addRes._id,
            count: q.data.length,
            docs: q.data.map((d) => ({ id: d._id, openid: d._openid, diag: d._diag, createdAt: d.createdAt }))
          }),
          fail: (e2) => resolve({ added: addRes._id, queryFail: (e2 && e2.errMsg) || String(e2) })
        });
      },
      fail: (e) => resolve({ addFail: (e && e.errMsg) || String(e) })
    });
  }));
  console.log("self write/read:", JSON.stringify(r, null, 2));

  await mini.disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
