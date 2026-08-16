/* 用 Chrome 无头渲染验证 build-model + renderer 绘制逻辑（标准 canvas 环境）。 */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const buildModel = require("../utils/avatar3d/build-model");

const rendererSrc = fs.readFileSync(path.join(__dirname, "../utils/avatar3d/renderer.js"), "utf8");
const OUT = process.env.AUTOTEST_OUT || "C:/Temp/autotest-canvas-render.png";

(async () => {
  const model = buildModel({ gender: "female", heightCm: 165, weightKg: 50, legLengthCm: 96 });
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setContent('<canvas id="c" width="750" height="700" style="width:375px;height:350px"></canvas>');
  await page.evaluate(({ rendererSrc, model }) => {
    const module = { exports: {} };
    const fn = new Function("module", "exports", "require", rendererSrc);
    fn(module, module.exports, () => { throw new Error("no require"); });
    const AvatarRenderer = module.exports;
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");
    const r = new AvatarRenderer();
    r.init(canvas, model, { width: 750, height: 700, ctx });
    r.render();
  }, { rendererSrc, model });
  await page.screenshot({ path: OUT });
  await browser.close();
  console.log("saved", OUT);
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
