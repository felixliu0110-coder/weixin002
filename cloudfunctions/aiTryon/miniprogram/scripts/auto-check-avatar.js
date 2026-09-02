/* 精简验证：进入 avatar-3d 页，读取页面 data 的 views.composite，判断是否真实 AI 图 */
const automator = require("miniprogram-automator");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

async function main() {
  const mini = await automator.connect({ wsEndpoint: WS });
  await mini.reLaunch("/pages/avatar-3d/index");
  await new Promise((r) => setTimeout(r, 2500));
  const page = await mini.currentPage();
  const d = await page.data();
  const views = (d.views && d.views.composite) || "";
  const real = /^https:\/\/platform-outputs\.agnes-ai\.space\//.test(views);
  console.log("views.composite =", views);
  console.log("real AI image:", real ? "YES" : "NO");
  await mini.disconnect();
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
