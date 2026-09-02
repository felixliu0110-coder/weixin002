/* 批量截取小程序全部页面（模拟器），输出到 docs/qa/miniprogram/ */
const automator = require("miniprogram-automator");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, "../../docs/qa/miniprogram");

const routes = [
  ["01-login", "pages/login/index"],
  ["02-basic-info", "pages/basic-info/index"],
  ["03-body-params", "pages/body-params/index"],
  ["04-photo-upload", "pages/photo-upload/index"],
  ["05-3d-viewer", "pages/avatar-3d/index"],
  ["06-tryon-select", "pages/tryon-select/index"],
  ["07-tryon-result", "pages/tryon-result/index"],
  ["08-profile", "pages/profile/index"],
  ["09-privacy-auth", "pages/privacy-auth/index"],
  ["10-generate-progress", "pages/generate-progress/index"],
  ["11-image-preview", "pages/image-preview/index"],
  ["12-tryon-progress", "pages/tryon-progress/index"],
  ["13-tryon-history", "pages/history/index"],
  ["14-compare-view", "pages/compare-view/index"],
  ["15-privacy-manage", "pages/privacy-manage/index"],
  ["16-feedback-about", "pages/feedback-about/index"],
  ["17-home", "pages/home/index"]
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" });
  console.log("CONNECTED");
  let ok = 0;
  for (const [name, route] of routes) {
    try {
      await miniProgram.reLaunch("/" + route);
      await sleep(700);
      const shot = await miniProgram.screenshot();
      const b64 = shot.includes(",") ? shot.split(",")[1] : shot;
      fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(b64, "base64"));
      ok++;
      console.log("OK", name);
    } catch (e) {
      console.log("ERR", name, e.message);
    }
  }
  await miniProgram.close();
  console.log("SHOTS:", ok + "/" + routes.length);
}

main().catch((err) => {
  console.error("SHOTS FAILED:", err.message);
  process.exit(1);
});
