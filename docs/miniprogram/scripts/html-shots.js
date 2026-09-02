/* 用系统 Chrome 无头模式截取 HTML 原型全部页面（完整页） */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const screensDir = path.join(__dirname, "../../weixin002/screens");
const outDir = path.join(__dirname, "../../docs/qa/html-prototype");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  const files = fs.readdirSync(screensDir).filter((f) => f.endsWith(".html")).sort();
  let ok = 0;
  for (const f of files) {
    const url = "file:///" + path.join(screensDir, f).replace(/\\/g, "/");
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 300));
    const out = path.join(outDir, f.replace(/\.html$/, ".png"));
    await page.screenshot({ path: out, fullPage: true });
    ok++;
    console.log("OK", f);
  }
  await browser.close();
  console.log("HTML SHOTS:", ok + "/" + files.length);
})().catch((e) => {
  console.error("SHOTS FAILED:", e.message);
  process.exit(1);
});
