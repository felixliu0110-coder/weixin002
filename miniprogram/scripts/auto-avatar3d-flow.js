/* 自动化冒烟测试：驱动微信开发者工具跑通 登录 → 创建向导 → 生成数字人 → 3D 查看。
   前置：开发者工具已开启项目自动化（cli.bat auto --project D:\weixin002 --auto-port 15066）。 */
const automator = require("miniprogram-automator");
const fs = require("fs");
const path = require("path");

const OUT = process.env.AUTOTEST_OUT || path.join(process.env.TEMP || "C:/Users/刘小伟/AppData/Local/Temp", "autotest-avatar3d");
const WS = process.env.AUTOTEST_WS || "ws://127.0.0.1:15066";

async function waitFor(mini, predicate, timeoutMs, label) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      if (await predicate()) return true;
    } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("timeout waiting for " + label + (lastErr ? " (" + lastErr.message + ")" : ""));
}

async function currentPath(mini) {
  return (await mini.currentPage()).path;
}

async function pause(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function tapByText(page, text) {
  const nodes = await page.$$("button, btn");
  for (const n of nodes) {
    try {
      const t = (await n.text()) || "";
      if (t.trim() === text) { await n.tap(); return true; }
    } catch (e) { /* 忽略节点访问失败 */ }
  }
  return false;
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

  await mini.reLaunch("/pages/login/index");
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/login/index"), 10000, "login");
  await mini.screenshot({ path: path.join(OUT, "1-login.png") });
  await pause(900);

  let page = await mini.currentPage();
  if (!(await tapByText(page, "微信授权登录"))) await page.$(".login-cta").tap();
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/basic-info/index"), 10000, "basic-info");
  await mini.screenshot({ path: path.join(OUT, "2-basic-info.png") });
  await pause(900);

  page = await mini.currentPage();
  if (!(await tapByText(page, "下一步"))) await page.$(".footer-main").tap();
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/body-params/index"), 10000, "body-params");
  await mini.screenshot({ path: path.join(OUT, "3-body-params.png") });
  await pause(900);

  // 关键回归点：之前点击下一步无反应
  page = await mini.currentPage();
  if (!(await tapByText(page, "下一步"))) {
    const btns = await page.$$(".footer-half");
    await btns[btns.length - 1].tap();
  }
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/photo-upload/index"), 10000, "photo-upload");
  await mini.screenshot({ path: path.join(OUT, "4-photo-upload.png") });
  await pause(900);

  // 关键回归点：之前点击生成按钮无反应（文案已从「生成数字人」改为「开始生成」）
  page = await mini.currentPage();
  if (!(await tapByText(page, "开始生成"))) await page.$(".footer-main").tap();
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/privacy-auth/index"), 10000, "privacy-auth");
  await mini.screenshot({ path: path.join(OUT, "5-privacy-auth.png") });
  await pause(900);

  page = await mini.currentPage();
  if (!(await tapByText(page, "同意并继续"))) {
    const btns = await page.$$(".auth-btn");
    await btns[btns.length - 1].tap();
  }
  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/generate-progress/index"), 10000, "generate-progress");
  await mini.screenshot({ path: path.join(OUT, "6-generate-progress.png") });
  await pause(1500);
  page = await mini.currentPage();
  const genData = await page.data();
  console.log("generate-progress data: percent=" + genData.percent + " error=" + genData.error);

  await waitFor(mini, () => currentPath(mini).then((p) => p === "pages/avatar-3d/index"), 20000, "avatar-3d");
  await pause(1500);
  await mini.screenshot({ path: path.join(OUT, "7-avatar-3d.png") });
  page = await mini.currentPage();
  const avatarData = await page.data();
  console.log("avatar-3d data: renderFailed=" + avatarData.renderFailed + " measureOn=" + avatarData.measureOn + " rotating=" + avatarData.rotating);

  await mini.disconnect();
  console.log("DONE, screenshots in", OUT);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
