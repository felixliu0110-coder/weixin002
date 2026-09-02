/* 自动化单页测试：跳转到指定页面并截图、统计节点 */
const automator = require("miniprogram-automator");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const route = process.argv[2] || "pages/avatar-3d/index";

async function main() {
  const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
  console.log("CONNECTED");
  await miniProgram.reLaunch("/" + route);
  await sleep(1200);
  const page = await miniProgram.currentPage();
  console.log("PATH:", page && page.path);
  const views = await page.$$("view");
  const texts = await page.$$("text");
  const images = await page.$$("image");
  console.log("VIEWS:", views ? views.length : 0, "TEXTS:", texts ? texts.length : 0, "IMAGES:", images ? images.length : 0);
  const shot = await miniProgram.screenshot();
  const b64 = shot.includes(",") ? shot.split(",")[1] : shot;
  const out = path.join(__dirname, "../assets/.diag-" + route.replace(/\//g, "_") + ".png");
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("SHOT:", out);
  await miniProgram.close();
}

main().catch((err) => {
  console.error("PAGE TEST FAILED:", err.message);
  process.exit(1);
});
