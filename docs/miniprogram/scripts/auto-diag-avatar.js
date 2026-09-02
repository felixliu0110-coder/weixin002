/* 自动化诊断：驱动微信开发者工具跑「生成数字人三视图」真实链路
   连接 ws://127.0.0.1:15066 → 进入 generate-progress → 等待真实生成
   读取页面 data（percent/error/errorMsg）并截图，最后进 avatar-3d 读 views.composite。 */
const automator = require("miniprogram-automator");
const fs = require("fs");
const path = require("path");

const OUT = process.env.AUTOTEST_OUT || path.join(process.env.TEMP || "C:/Users/刘小伟/AppData/Local/Temp", "autotest-avatar-diag");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";
const WAIT_MS = Number(process.env.AUTOTEST_WAIT || 150000);

async function waitFor(mini, predicate, timeoutMs, label) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) return true;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("timeout waiting for " + label + (lastErr ? " (" + lastErr.message + ")" : ""));
}

async function currentPath(mini) {
  return (await mini.currentPage()).path;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const mini = await automator.connect({ wsEndpoint: WS });
  console.log("connected to", WS);
  mini.on("console", (msg) => {
    if (msg.type === "error" || msg.type === "warn") {
      console.log("[console " + msg.type + "]", msg.args ? msg.args.join(" ") : "");
    }
  });
  mini.on("error", (e) => console.log("[mini error]", e && e.message));

  console.log(">>> reLaunch generate-progress");
  await mini.reLaunch("/pages/generate-progress/index");
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/generate-progress/index"), 10000, "generate-progress");
  await new Promise((r) => setTimeout(r, 1000));

  let page = await mini.currentPage();
  let d = await page.data();
  console.log("initial data: percent=" + d.percent + " error=" + d.error + " errorMsg=" + (d.errorMsg || ""));

  // 轮询生成结果：error 出现 / 跳转 avatar-3d / 超时
  const t0 = Date.now();
  let avatar = null;
  while (Date.now() - t0 < WAIT_MS) {
    try {
      const p = await currentPath(mini);
      if (p === "pages/avatar-3d/index") {
        avatar = await (await mini.currentPage()).data();
        console.log(">>> reached avatar-3d");
        break;
      }
      page = await mini.currentPage();
      d = await page.data();
      if (d.error) {
        console.log(">>> generate failed: errorMsg=" + (d.errorMsg || ""));
        await mini.screenshot({ path: path.join(OUT, "generate-failed.png") });
        break;
      }
      if (d.percent >= 100) {
        console.log(">>> percent reached 100 (mock/成功路径)");
      }
    } catch (e) { /* 页面切换期间忽略 */ }
    await new Promise((r) => setTimeout(r, 800));
  }

  const elapsed = Math.round((Date.now() - t0) / 1000);
  console.log("elapsed=" + elapsed + "s");
  await mini.screenshot({ path: path.join(OUT, "final-" + Date.now() + ".png") });

  if (avatar) {
    const views = (avatar.views && avatar.views.composite) || "";
    console.log("avatar-3d views.composite =", views);
    console.log("real AI image:", /^https:\/\/platform-outputs\.agnes-ai\.space\//.test(views) ? "YES" : "NO");
  } else if (!d || !d.error) {
    console.log("最终未失败也未跳转，percent=" + (d && d.percent) + " error=" + (d && d.error));
  }

  await mini.disconnect();
  console.log("DONE, screenshots in", OUT);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
