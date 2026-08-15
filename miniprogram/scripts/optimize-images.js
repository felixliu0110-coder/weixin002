/* 将 assets/img 下的 PNG 压缩为 WebP（控制主包 < 2MB）。
   用法：node scripts/optimize-images.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const imgDir = path.join(__dirname, "../assets/img");
const files = fs.readdirSync(imgDir).filter((f) => f.endsWith(".png"));

(async () => {
  let srcTotal = 0;
  let dstTotal = 0;
  for (const f of files) {
    const src = path.join(imgDir, f);
    const dst = path.join(imgDir, f.replace(/\.png$/, ".webp"));
    const before = fs.statSync(src).size;
    const info = await sharp(src).webp({ quality: 82 }).toFile(dst);
    const after = fs.statSync(dst).size;
    srcTotal += before;
    dstTotal += after;
    console.log(`${f}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB (${((1 - after / before) * 100).toFixed(0)}%)`);
    fs.unlinkSync(src);
  }
  console.log(`TOTAL: ${(srcTotal / 1024).toFixed(0)}KB -> ${(dstTotal / 1024).toFixed(0)}KB`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
