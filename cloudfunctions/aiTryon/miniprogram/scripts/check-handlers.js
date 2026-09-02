/* 检查页面 WXML 事件绑定是否都在 JS 中定义 */
const fs = require("fs");
const path = require("path");

const pagesDir = path.join(__dirname, "../pages");
const issues = [];

for (const p of fs.readdirSync(pagesDir)) {
  const dir = path.join(pagesDir, p);
  const wxmlPath = path.join(dir, "index.wxml");
  const jsPath = path.join(dir, "index.js");
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) continue;

  const wxml = fs.readFileSync(wxmlPath, "utf8");
  const js = fs.readFileSync(jsPath, "utf8");

  const handlers = [...wxml.matchAll(/(?:bind|catch)[a-z]+="([A-Za-z_][A-Za-z0-9_]*)"/g)].map((m) => m[1]);
  const methods = new Set([...js.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm)].map((m) => m[1]));
  const missing = [...new Set(handlers)].filter((h) => !methods.has(h));
  if (missing.length) issues.push(`${p}: ${missing.join(", ")}`);
}

if (issues.length) {
  console.error("MISSING HANDLERS:\n" + issues.join("\n"));
  process.exit(1);
}
console.log("ALL HANDLERS OK");
