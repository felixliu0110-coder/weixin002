/* 部署云函数前运行：把 cloudfunctions/services 的共享模块复制到各云函数目录根（单层，避免 CLI 子目录打包 bug） */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "cloudfunctions");
const src = path.join(root, "services");
const SHARED_FILES = [
  "aigc.js",
  "aigc-agnes.js",
  "aigc-mock.js",
  "avatarViews.js",
  "garmentViews.js",
  "storage.js",
  "tryonCache.js",
  "tryonImage.js",
  "tryonVideo.js"
];
// 已废弃的共享模块：从各云函数目录清理，避免随部署带上旧实现
const STALE_FILES = ["aigc-jimeng.js"];

const targets = fs.readdirSync(root).filter((name) => {
  return fs.statSync(path.join(root, name)).isDirectory() && name !== "services";
});

for (const name of targets) {
  const dir = path.join(root, name);
  for (const file of SHARED_FILES) {
    const from = path.join(src, file);
    const to = path.join(dir, file);
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, to);
      console.log("synced ->", path.relative(path.resolve(__dirname, ".."), to));
    }
  }
  for (const file of STALE_FILES) {
    const to = path.join(dir, file);
    if (fs.existsSync(to)) {
      fs.unlinkSync(to);
      console.log("removed stale ->", path.relative(path.resolve(__dirname, ".."), to));
    }
  }
}
console.log("done: " + targets.length + " 个云函数已同步共享模块");
