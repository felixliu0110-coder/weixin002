/* 用 Chrome 无头渲染 SVG 生成彩色 PNG 图标（sharp 渲染 SVG 相对路径会镜像，必须用浏览器渲染） */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const srcDir = path.join(__dirname, "../assets/icons-src");
const outDir = path.join(__dirname, "../assets/icons/png");
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
fs.mkdirSync(outDir, { recursive: true });

const COLORS = {
  gray: "#8F8378",
  active: "#7A5A4E",
  deep: "#C98F80",
  white: "#FFFFFF",
  dark: "#1F1D1B",
  green: "#2F7D5C"
};

const NEED = {
  "icon-home": ["gray", "active"],
  "icon-hanger": ["gray", "active", "white"],
  "icon-heart": ["gray", "active"],
  "icon-user": ["gray", "active"],
  "icon-chevron-right": ["gray"],
  "icon-star": ["deep", "white"],
  "icon-avatar": ["deep", "gray", "white"],
  "icon-check": ["white", "green"],
  "icon-plus": ["gray"],
  "icon-minus": ["gray"],
  "icon-camera": ["white", "deep"],
  "icon-shield-check": ["gray"],
  "icon-export": ["gray", "dark"],
  "icon-clock": ["deep"],
  "icon-shield": ["gray"],
  "icon-ok": ["active"],
  "icon-photo": ["deep"],
  "icon-back": ["dark"],
  "icon-feedback": ["gray"],
  "icon-upload": ["white", "gray"],
  "icon-settings": ["dark"],
  "icon-ruler": ["active"],
  "icon-rotate": ["active"],
  "icon-search": ["gray"],
  "icon-save": ["gray"],
  "icon-trash": ["white"]
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 96, height: 96 });

  let count = 0;
  for (const [name, variants] of Object.entries(NEED)) {
    const src = path.join(srcDir, name + ".svg");
    if (!fs.existsSync(src)) {
      console.log("MISSING SRC:", name);
      continue;
    }
    const base = fs.readFileSync(src, "utf8");
    for (const v of variants) {
      const colored = base.replace(/stroke="#000"/g, `stroke="${COLORS[v]}"`);
      const url = "data:image/svg+xml;base64," + Buffer.from(colored).toString("base64");
      await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
      const out = path.join(outDir, `${name}-${v}.png`);
      await page.screenshot({ path: out, omitBackground: true });
      count++;
    }
  }
  await browser.close();
  console.log("PNG ICONS:", count);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
