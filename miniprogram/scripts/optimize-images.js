/* 将 assets/img 下的图片压缩为 JPEG（真机兼容，控制主包 < 2MB）。
   用法：node scripts/optimize-images.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const imgDir = path.join(__dirname, "../assets/img");
const files = fs.readdirSync(imgDir).filter((f) => /\.(png|webp)$/.test(f));
const MAX_EDGE = 900;

(async () => {
  let srcTotal = 0;
  let dstTotal = 0;
  for (const f of files) {
    const src = path.join(imgDir, f);
    const dst = path.join(imgDir, f.replace(/\.(png|webp)$/, ".jpg"));
    const before = fs.statSync(src).size;
    const img = sharp(src);
    const meta = await img.metadata();
    const longest = Math.max(meta.width, meta.height);
    const resize = longest > MAX_EDGE ? { width: meta.width > meta.height ? MAX_EDGE : undefined, height: meta.height > meta.width ? MAX_EDGE : undefined } : undefined;
    let pipeline = img;
    if (resize) pipeline = pipeline.resize(resize);
    await pipeline.jpeg({ quality: 80 }).toFile(dst);
    const after = fs.statSync(dst).size;
    srcTotal += before;
    dstTotal += after;
    console.log(`${f}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (${((1 - after / before) * 100).toFixed(0)}%)`);
    try { fs.unlinkSync(src); } catch (e) { console.log(`  (skip delete: ${path.basename(src)} locked)`); }
  }
  console.log(`TOTAL: ${(srcTotal / 1024).toFixed(0)}KB -> ${(dstTotal / 1024).toFixed(0)}KB`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
