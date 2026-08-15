/* 静态联调校验：页面注册、跳转目标、图片资源、图标类名、JSON/JS 语法。
   用法：node scripts/verify.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const errors = [];

function walk(dir, exts, out) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!f.startsWith(".") && f !== "node_modules") walk(full, exts, out);
    } else if (exts.includes(path.extname(f))) {
      out.push(full);
    }
  }
}

// 1. app.json 页面注册 + 四件套
const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
if (app.pages.length !== 17) {
  errors.push(`app.json pages 数量 ${app.pages.length}，应为 17`);
}
for (const p of app.pages) {
  for (const ext of ["wxml", "js", "wxss", "json"]) {
    if (!fs.existsSync(path.join(root, p + "." + ext))) {
      errors.push(`页面文件缺失: ${p}.${ext}`);
    }
  }
}
const tabPaths = new Set(app.tabBar.list.map((t) => t.pagePath));
for (const t of app.tabBar.list) {
  if (!app.pages.includes(t.pagePath)) errors.push(`tabBar 页面未注册: ${t.pagePath}`);
}

// 2. 页面/组件 JSON 全部可解析，组件 js 语法检查
const jsFiles = [];
walk(root, [".js"], jsFiles);
for (const f of jsFiles) {
  if (f.includes("scripts")) continue;
  try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); } catch (e) { errors.push(`JS 语法错误: ${path.relative(root, f)}`); }
}
const jsonFiles = [];
walk(root, [".json"], jsonFiles);
for (const f of jsonFiles) {
  try { JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { errors.push(`JSON 解析失败: ${path.relative(root, f)}`); }
}

// 3. 跳转目标 /pages/xxx 存在
const wxmlFiles = [];
walk(root, [".wxml"], wxmlFiles);
const allText = wxmlFiles.concat(jsFiles.filter((f) => !f.includes("scripts") && !f.endsWith(".test.js")))
  .map((f) => fs.readFileSync(f, "utf8")).join("\n");
const navTargets = new Set();
for (const m of allText.matchAll(/["']\/pages\/[a-z0-9-]+\/index["']/g)) {
  navTargets.add(m[0].replace(/["']/g, "").replace(/^\//, ""));
}
for (const t of navTargets) {
  if (!app.pages.includes(t)) errors.push(`跳转目标未注册: ${t}`);
  for (const ext of ["wxml", "js", "wxss", "json"]) {
    if (!fs.existsSync(path.join(root, t + "." + ext))) errors.push(`跳转目标文件缺失: ${t}.${ext}`);
  }
}

// 4. 图片资源引用存在
for (const m of allText.matchAll(/\/assets\/img\/[a-z0-9-]+\.png/g)) {
  const p = path.join(root, m[0].replace(/^\//, ""));
  if (!fs.existsSync(p)) errors.push(`图片资源缺失: ${m[0]}`);
}

// 5. 图标类名存在于 app.wxss
const appWxss = fs.readFileSync(path.join(root, "app.wxss"), "utf8");
for (const m of allText.matchAll(/\bicon-[a-z0-9-]+/g)) {
  const cls = m[0];
  if (cls === "iconfont") continue;
  if (!appWxss.includes("." + cls + ":before")) errors.push(`图标类未定义: ${cls}`);
}

if (errors.length) {
  console.error("VERIFY FAILED (" + errors.length + "):\n" + errors.join("\n"));
  process.exit(1);
}
console.log("VERIFY OK: 17 pages, " + navTargets.size + " nav targets, " + tabPaths.size + " tabs, all assets & icons resolved");
