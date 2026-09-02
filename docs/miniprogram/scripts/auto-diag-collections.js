/* 诊断：检查云数据库各集合是否存在 */
const automator = require("miniprogram-automator");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

const COLLECTIONS = [
  "avatar_profiles", "avatar_views", "garment_views",
  "tryon_tasks", "tryon_results", "favorites", "quotas"
];

async function main() {
  const mini = await automator.connect({ wsEndpoint: WS });
  for (const name of COLLECTIONS) {
    const r = await mini.evaluate((c) => new Promise((resolve) => {
      wx.cloud.database().collection(c).limit(1).get({
        success: (res) => resolve({ ok: true, count: res.data.length }),
        fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
      });
    }), name);
    const exists = r.ok || !/collection not exists|DATABASE_COLLECTION_NOT_EXIST/i.test(r.errMsg || "");
    console.log((exists ? "OK  " : "MISS") + " " + name + (exists ? "" : "  <- 需创建"));
  }
  await mini.disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
