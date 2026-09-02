/* 将 wxml 中的 iconfont text 图标替换为 PNG image（按场景颜色/尺寸） */
const fs = require("fs");
const path = require("path");

// 文件 -> { 图标名: { color, size } }
const MAP = {
  "pages/login/index.wxml": { check: { color: "white", size: 26 } },
  "pages/basic-info/index.wxml": {},
  "pages/body-params/index.wxml": { plus: { color: "gray", size: 28 }, minus: { color: "gray", size: 28 } },
  "pages/photo-upload/index.wxml": {},
  "pages/privacy-auth/index.wxml": {},
  "pages/generate-progress/index.wxml": { clock: { color: "deep", size: 34 }, star: { color: "deep", size: 34 } },
  "pages/avatar-3d/index.wxml": { rotate: { color: "active", size: 48 }, ruler: { color: "active", size: 48 }, ok: { color: "active", size: 48 }, avatar: { color: "gray", size: 68 }, "chevron-right": { color: "gray", size: 26 } },
  "pages/tryon-select/index.wxml": { hanger: { color: "gray", size: 40 } },
  "pages/image-preview/index.wxml": {},
  "pages/tryon-progress/index.wxml": { clock: { color: "deep", size: 34 }, star: { color: "deep", size: 34 } },
  "pages/tryon-result/index.wxml": { star: { color: "white", size: 24 }, export: { color: "dark", size: 32 }, upload: { color: "white", size: 32 } },
  "pages/compare-view/index.wxml": {},
  "pages/history/index.wxml": { heart: { color: "gray", size: 40 } },
  "pages/profile/index.wxml": { avatar: { color: "deep", size: 38 }, photo: { color: "deep", size: 38 }, star: { color: "deep", size: 28 }, "shield-check": { color: "gray", size: 38 }, feedback: { color: "gray", size: 38 }, "chevron-right": { color: "gray", size: 28 }, settings: { color: "dark", size: 42 } },
  "pages/privacy-manage/index.wxml": { "shield-check": { color: "gray", size: 38 }, export: { color: "gray", size: 38 }, camera: { color: "deep", size: 38 }, avatar: { color: "deep", size: 38 }, shield: { color: "gray", size: 38 }, "chevron-right": { color: "gray", size: 28 } },
  "pages/feedback-about/index.wxml": { check: { color: "green", size: 28 } },
  "pages/home/index.wxml": { search: { color: "gray", size: 32 }, star: { color: "deep", size: 30 }, hanger: { color: "white", size: 44 }, "chevron-right": { color: "gray", size: 26 } },
  "components/nav-bar/index.wxml": { back: { color: "dark", size: 42 } },
  "components/upload-card/index.wxml": {}
};

let total = 0;
for (const [file, icons] of Object.entries(MAP)) {
  const p = path.join(__dirname, "..", file);
  if (!fs.existsSync(p)) {
    console.log("MISSING FILE:", file);
    continue;
  }
  let content = fs.readFileSync(p, "utf8");
  let changed = false;
  for (const [icon, { color, size }] of Object.entries(icons)) {
    const re = new RegExp(`<text class="iconfont icon-${icon}"></text>`, "g");
    const img = `<image class="ic-img" style="width:${size}rpx;height:${size}rpx" src="/assets/icons/png/icon-${icon}-${color}.png" />`;
    const next = content.replace(re, img);
    if (next !== content) {
      content = next;
      changed = true;
      total++;
    }
  }
  if (changed) fs.writeFileSync(p, content, "utf8");
}
console.log("REPLACED:", total);
