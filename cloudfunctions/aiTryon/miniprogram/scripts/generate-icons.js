/* 生成 iconfont：svgtofont 生成 SVG 字体，fonteditor-core 转 ttf（修复 svgtofont 的 cmap 错乱）。
   注意：svgtofont 依赖在 Node 26 下不兼容，需用 Node 18 运行：
   npm run icons   （等价 npx -y node@18 scripts/generate-icons.js）
 */
const path = require("path");
const fs = require("fs");
const svgtofont = require("svgtofont");
const { svg2ttfobject, TTFWriter } = require("fonteditor-core");

const src = path.join(__dirname, "../assets/icons-src");
const out = path.join(__dirname, "../assets/icons");
const START_UNICODE = 0xe001;

(async () => {
  await svgtofont({
    src,
    dist: out,
    fontName: "iconfont",
    css: true,
    startUnicode: START_UNICODE,
    svgicons2svgfont: { fontHeight: 1000, normalize: true }
  });

  // 用 fonteditor-core 从 SVG 字体重新生成 ttf（修复 svgtofont 的 cmap 错乱）
  const svgFont = fs.readFileSync(path.join(out, "iconfont.svg"), "utf8");
  const ttfObj = svg2ttfobject(svgFont, {});
  const ttfBuf = Buffer.from(new TTFWriter().write(ttfObj));
  fs.writeFileSync(path.join(out, "iconfont.ttf"), ttfBuf);

  const fontBase64 = ttfBuf.toString("base64");
  const files = fs.readdirSync(src).filter((f) => f.endsWith(".svg")).sort();
  const glyphCss = files
    .map((f, i) => {
      const name = f.replace(/\.svg$/, "");
      const code = (START_UNICODE + i).toString(16);
      return `.${name}:before { content: "\\${code}"; }`;
    })
    .join("\n");

  const iconBlock = `/* ============ iconfont（由 scripts/generate-icons.js 生成，base64 内嵌） ============ */
@font-face {
  font-family: "iconfont";
  src: url('data:font/truetype;charset=utf-8;base64,${fontBase64}') format('truetype');
}

.iconfont {
  font-family: "iconfont" !important;
  font-size: 44rpx;
  color: inherit;
  line-height: 1;
}

${glyphCss}
`;

  fs.writeFileSync(path.join(out, "iconfont.wxss"), iconBlock, "utf8");

  const appWxssPath = path.join(__dirname, "../app.wxss");
  let appWxss = fs.readFileSync(appWxssPath, "utf8");
  if (appWxss.includes("=== iconfont")) {
    appWxss = appWxss.replace(
      /\/\* ============ iconfont[\s\S]*?(?=\/\* ============ 全局设计 token)/,
      iconBlock + "\n"
    );
  } else {
    appWxss = iconBlock + "\n" + appWxss;
  }
  fs.writeFileSync(appWxssPath, appWxss);

  // 清理多余产物，仅保留 ttf / woff / wxss
  for (const f of fs.readdirSync(out)) {
    if (!/^iconfont\.(ttf|woff|wxss)$/.test(f)) {
      try { fs.unlinkSync(path.join(out, f)); } catch (e) { /* 忽略占用 */ }
    }
  }
  console.log(`iconfont generated: ${files.length} glyphs; app.wxss synced`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
