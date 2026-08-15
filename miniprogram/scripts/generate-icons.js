/* 生成 iconfont 字体并内联到 app.wxss（base64，避免本地路径限制）。
   注意：svgtofont 依赖在 Node 26 下不兼容，需用 Node 18 运行：
   npm run icons   （等价 npx -y node@18 scripts/generate-icons.js）
 */
const path = require("path");
const svgtofont = require("svgtofont");
const fs = require("fs");

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

  const files = fs.readdirSync(src).filter((f) => f.endsWith(".svg")).sort();
  const fontBase64 = fs.readFileSync(path.join(out, "iconfont.ttf")).toString("base64");

  const glyphCss = files
    .map((f, i) => {
      const name = f.replace(/\.svg$/, ""); // icon-avatar.svg -> icon-avatar -> .icon-avatar
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
      try { fs.unlinkSync(path.join(out, f)); } catch (e) { /* 文件被占用时跳过 */ }
    }
  }
  console.log(`iconfont generated: ${files.length} glyphs; app.wxss synced`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
