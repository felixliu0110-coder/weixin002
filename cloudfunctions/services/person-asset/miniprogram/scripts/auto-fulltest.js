/* 自动化全流程测试：遍历全部页面，检测渲染节点数并截图 */
const automator = require("miniprogram-automator");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, "../assets/.diag");

const routes = [
  "pages/login/index",
  "pages/basic-info/index",
  "pages/body-params/index",
  "pages/photo-upload/index",
  "pages/privacy-auth/index",
  "pages/generate-progress/index",
  "pages/avatar-3d/index",
  "pages/tryon-select/index",
  "pages/image-preview/index",
  "pages/tryon-progress/index",
  "pages/tryon-result/index",
  "pages/compare-view/index",
  "pages/history/index",
  "pages/profile/index",
  "pages/privacy-manage/index",
  "pages/feedback-about/index",
  "pages/home/index"
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
  console.log("CONNECTED");
  const report = [];

  for (const route of routes) {
    try {
      await miniProgram.reLaunch("/" + route);
      await sleep(900);
      const page = await miniProgram.currentPage();
      const nodes = await page.$$("view");
      const texts = await page.$$("text");
      const shot = await miniProgram.screenshot();
      const b64 = shot.includes(",") ? shot.split(",")[1] : shot;
      fs.writeFileSync(path.join(outDir, route.replace(/\//g, "_") + ".png"), Buffer.from(b64, "base64"));
      const ok = nodes && nodes.length > 0;
      report.push(`${ok ? "OK " : "FAIL"} ${route} views=${nodes ? nodes.length : 0} texts=${texts ? texts.length : 0}`);
      console.log(report[report.length - 1]);
    } catch (e) {
      report.push(`ERR  ${route} ${e.message}`);
      console.log(report[report.length - 1]);
    }
  }

  fs.writeFileSync(path.join(outDir, "report.txt"), report.join("\n"));
  await miniProgram.close();
  console.log("REPORT SAVED");
}

main().catch((err) => {
  console.error("FULLTEST FAILED:", err.message);
  process.exit(1);
});
