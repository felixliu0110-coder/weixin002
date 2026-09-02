/* 检查 iconfont.ttf 字符映射与 iconfont.css 类名码点是否一致 */
const opentype = require("opentype.js");
const fs = require("fs");
const path = require("path");

const font = opentype.parse(fs.readFileSync(path.join(__dirname, "../assets/icons/iconfont.ttf")).buffer);
const css = fs.readFileSync(path.join(__dirname, "../assets/icons/iconfont.wxss"), "utf8");

const names = [
  "icon-rotate", "icon-ruler", "icon-ok", "icon-home", "icon-hanger",
  "icon-heart", "icon-user", "icon-check", "icon-star", "icon-export",
  "icon-upload", "icon-camera", "icon-avatar", "icon-clock", "icon-photo",
  "icon-save", "icon-search", "icon-settings", "icon-shield", "icon-shield-check",
  "icon-feedback", "icon-back", "icon-minus", "icon-plus", "icon-chevron-right"
];

let bad = 0;
for (const n of names) {
  const re = new RegExp(`\\.${n}:before \\{ content: "\\\\${"([0-9a-f]+)"}"; \\}`);
  const m = css.match(re);
  const code = m ? parseInt(m[1], 16) : null;
  let glyphName = "?";
  let has = false;
  if (code != null) {
    const idx = font.charToGlyphIndex(String.fromCharCode(code));
    if (idx != null && idx > 0) {
      const g = font.glyphs.get(idx);
      glyphName = (g.name || String(idx)) + "#" + idx;
      has = g.path.commands.length > 0 || (g.advanceWidth > 0);
    }
  }
  if (!has) bad++;
  console.log(`${n} css=U+${code ? code.toString(16) : "?"} glyph=${glyphName} has=${has}`);
}
console.log("BAD:", bad);
