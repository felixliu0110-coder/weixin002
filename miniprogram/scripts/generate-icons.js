/* 生成 iconfont 字体与 CSS。
   注意：svgtofont 依赖在 Node 26 下不兼容，需用 Node 18 运行：
   npm run icons   （等价 npx -y node@18 scripts/generate-icons.js）
 */
const path = require("path");
const svgtofont = require("svgtofont");
const fs = require("fs");

const src = path.join(__dirname, "../assets/icons-src");
const out = path.join(__dirname, "../assets/icons");

(async () => {
  await svgtofont({
    src,
    dist: out,
    fontName: "iconfont",
    css: true,
    startUnicode: 0xe001,
    svgicons2svgfont: { fontHeight: 1000, normalize: true }
  });
  // 归一化 css：类名 .iconfont-icon-* -> .icon-*，@font-face 只保留 ttf
  const cssPath = path.join(out, "iconfont.css");
  let css = fs.readFileSync(cssPath, "utf8");
  css = css.replace(/\.iconfont-icon-/g, ".icon-");
  css = css.replace(
    /@font-face \{[\s\S]*?\}/,
    `@font-face {
  font-family: "iconfont";
  src: url('./iconfont.ttf') format('truetype');
}`
  );
  fs.writeFileSync(cssPath, css);

  // 清理小程序用不到的多余产物，仅保留 ttf / woff / css
  for (const f of fs.readdirSync(out)) {
    if (!/^iconfont\.(ttf|woff|css)$/.test(f)) {
      fs.unlinkSync(path.join(out, f));
    }
  }
  console.log("iconfont generated at", out);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
