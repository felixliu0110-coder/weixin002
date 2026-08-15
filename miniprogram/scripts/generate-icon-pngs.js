/* 从 icons-src SVG 生成彩色 PNG 图标（替换 iconfont 字体方案，真机兼容） */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const srcDir = path.join(__dirname, "../assets/icons-src");
const outDir = path.join(__dirname, "../assets/icons/png");
fs.mkdirSync(outDir, { recursive: true });

// 需要生成的颜色版本
const COLORS = {
  gray: "#8F8378",    // 次级/未选中
  active: "#7A5A4E",  // Tab 选中 / circle-btn
  deep: "#C98F80",    // 强调粉（ri-ic、quota）
  white: "#FFFFFF",   // 按钮/徽标白
  dark: "#1F1D1B",    // 主文字/返回
  green: "#2F7D5C"    // 成功态
};

// 每个图标需要的颜色版本（未列出的用 gray）
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
  "icon-upload": ["white"],
  "icon-settings": ["dark"],
  "icon-ruler": ["active"],
  "icon-rotate": ["active"],
  "icon-search": ["gray"]
};

(async () => {
  let count = 0;
  for (const [name, variants] of Object.entries(NEED)) {
    const src = path.join(srcDir, name + ".svg");
    if (!fs.existsSync(src)) {
      console.log("MISSING SRC:", name);
      continue;
    }
    let svg = fs.readFileSync(src, "utf8");
    for (const v of variants) {
      const colored = svg.replace(/stroke="#000"/g, `stroke="${COLORS[v]}"`);
      const out = path.join(outDir, `${name}-${v}.png`);
      await sharp(Buffer.from(colored)).resize(96, 96).png().toFile(out);
      count++;
    }
  }
  console.log("PNG ICONS:", count);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
