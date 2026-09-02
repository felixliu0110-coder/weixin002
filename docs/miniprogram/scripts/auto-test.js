/* 自动化诊断：连接开发者工具，跳转 09 页，读取路径/数据并截图 */
const automator = require("miniprogram-automator");
const fs = require("fs");
const path = require("path");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const miniProgram = await automator.connect({
    wsEndpoint: "ws://127.0.0.1:9420"
  });
  console.log("CONNECTED");

  await miniProgram.reLaunch("/pages/login/index");
  await sleep(1000);
  const login = await miniProgram.currentPage();
  console.log("LOGIN PATH:", login && login.path);
  console.log("LOGIN DATA:", JSON.stringify(await login.data()));

  await miniProgram.navigateTo("/pages/privacy-auth/index");
  await sleep(1200);
  const auth = await miniProgram.currentPage();
  console.log("AUTH PATH:", auth && auth.path);
  if (auth) {
    console.log("AUTH DATA:", JSON.stringify(await auth.data()));
    const nodes = await auth.$$("view");
    console.log("AUTH VIEW NODES:", nodes ? nodes.length : "n/a");
    const shot = await miniProgram.screenshot();
    if (shot && typeof shot === "string") {
      const b64 = shot.includes(",") ? shot.split(",")[1] : shot;
      fs.writeFileSync(path.join(__dirname, "../assets/.diag-auth.png"), Buffer.from(b64, "base64"));
      console.log("SCREENSHOT SAVED");
    }
  }

  await miniProgram.close();
  console.log("DONE");
}

main().catch((err) => {
  console.error("AUTO TEST FAILED:", err.message);
  process.exit(1);
});
