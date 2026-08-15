/* 将 HTML 原型截图与小程序截图并排拼接，生成对比图 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const htmlDir = path.join(__dirname, "../../docs/qa/html-prototype");
const mpDir = path.join(__dirname, "../../docs/qa/miniprogram");
const outDir = path.join(__dirname, "../../docs/qa/compare");
fs.mkdirSync(outDir, { recursive: true });

const names = fs.readdirSync(htmlDir).filter((f) => f.endsWith(".png")).sort();

(async () => {
  for (const f of names) {
    const html = path.join(htmlDir, f);
    const mp = path.join(mpDir, f);
    if (!fs.existsSync(mp)) {
      console.log("SKIP (no mp shot):", f);
      continue;
    }
    const htmlImg = sharp(html);
    const mpImg = sharp(mp);
    const [htmlMeta, mpMeta] = await Promise.all([htmlImg.metadata(), mpImg.metadata()]);
    const h = Math.min(htmlMeta.height, mpMeta.height);
    const left = await htmlImg.resize({ height: h }).toBuffer();
    const right = await mpImg.resize({ height: h }).toBuffer();
    const out = path.join(outDir, f);
    await sharp({
      create: {
        width: h * 2,
        height: h,
        channels: 3,
        background: { r: 20, g: 20, b: 20 }
      }
    })
      .composite([
        { input: left, left: 0, top: 0 },
        { input: right, left: h, top: 0 }
      ])
      .jpeg({ quality: 85 })
      .toFile(out);
    console.log("OK", f);
  }
  console.log("DONE");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
