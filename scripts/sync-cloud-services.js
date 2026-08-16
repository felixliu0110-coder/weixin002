/* 部署云函数前运行：把 cloudfunctions/services 同步到各云函数目录，保证 require("./services/...") 可解析 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "cloudfunctions");
const src = path.join(root, "services");
const targets = fs.readdirSync(root).filter((name) => {
  return fs.statSync(path.join(root, name)).isDirectory() && name !== "services";
});

for (const name of targets) {
  const target = path.join(root, name, "services");
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(src, target, { recursive: true });
  console.log("synced ->", path.relative(path.resolve(__dirname, ".."), target));
}
console.log("done: " + targets.length + " 个云函数已同步 services");
