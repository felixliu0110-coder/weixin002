/* 自主测试：启动项目，调用 aiTryon history 查询，验证记录读取与部署状态 */
const automator = require("miniprogram-automator");

async function main() {
  const mini = await automator.launch({
    cliPath: "D:/刘小伟/微信web开发者工具/cli.bat",
    projectPath: "D:/weixin002"
  });
  console.log("launched");
  mini.on("console", (msg) => {
    if (msg.type === "error" || msg.type === "warn") {
      console.log("[console " + msg.type + "]", msg.args ? msg.args.join(" ") : "");
    }
  });

  const r = await mini.evaluate(() => new Promise((resolve) => {
    wx.cloud.callFunction({
      name: "aiTryon",
      data: { action: "history" },
      success: (res) => resolve(res.result),
      fail: (e) => resolve({ ok: false, errMsg: (e && e.errMsg) || String(e) })
    });
  }));
  console.log("history result:", JSON.stringify(r, null, 2).slice(0, 1500));

  await mini.close();
  console.log("DONE");
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
