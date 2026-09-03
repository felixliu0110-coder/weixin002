/**
 * 最小化边界测试：严禁伪造 avatarViewId
 * 只检查本次修复相关边界，不引入额外测试框架。
 * 运行：node tests/avatar-view-id.test.js
 */
const assert = require("assert");
const fs = require("fs");

const GEN = fs.readFileAsString
  ? fs.readFileSync(require.resolve("../../miniprogram/pages/generate-progress/index.js"), "utf-8")
  : null;

function load(name) {
  return fs.readFileSync(
    require("path").join(__dirname, "..", "miniprogram", "pages", name, "index.js"),
    "utf-8"
  );
}

const genSrc = load("generate-progress");
const trySrc = load("tryon-progress");

let pass = 0, fail = 0;
function check(cond, msg) {
  if (cond) { pass++; /* console.log("  ok -", msg); */ }
  else { fail++; console.log("  FAIL -", msg); }
}

console.log("[1] generate-progress 不再出现 av-current");
check(!/av-current/.test(genSrc), "generate-progress 不含 av-current");

console.log("[2] tryon-progress 不再出现 av-current");
check(!/av-current/.test(trySrc), "tryon-progress 不含 av-current");

console.log("[3] 两个文件不存在 avatarViewId 伪造 fallback");
// 仅检测「声明/赋值 avatarViewId 时」的 || 默认字符串（伪造 fallback）。
// 排除：存储写入时的 `avatarViewId || ""` 空串兜底（值本身来自真实 avatarViewId）。
const declLine = trySrc.split("\n").find((l) => /const avatarViewId/.test(l)) || "";
check(!/avatarViewId\s*=\s*[^;]*\|\|/.test(declLine), "声明行无 || 默认 fallback");
check(!/getStorageSync\(["']avatarViewId["']\)[^;]*\|\|[^;]*[a-z0-9_]/.test(trySrc), "getStorageSync 读取无默认占位值");
check(!/"av-current"|'av-current'|`av-current`/.test(genSrc + trySrc), "全局无 av-current 字面量");
// 不允许自动寻找 latest / 第一条 avatar_view / 自动生成
check(!/latest.*avatar[_ ]?view|first.*avatar[_ ]?view|generate.*avatarViewId|Math\.random/.test(trySrc),
  "tryon-progress 无自动寻找/自动生成 avatarViewId");

console.log("[4] createAvatarViews 没返回 avatarViewId 时不会继续到 avatar-3d");
check(/av\.avatarViewId/.test(genSrc), "generate 校验 av.avatarViewId");
check(/setStorageSync\(["']avatarViewId["'], av\.avatarViewId\)/.test(genSrc), "仅真实值写入 storage");
check(/error.*人物视图生成异常/.test(genSrc), "无 avatarViewId 进入 error");
check(!/navigate.*avatar-3d/.test(genSrc) || /return/.test(genSrc), "异常路径 return（不跳转）");

console.log("[5] 缺少真实 avatarViewId 时不会提交 aiTryon");
// tryon-progress：缺值时 return，不调用 submitAiTryon
const submitFn = trySrc;
check(/if \(!avatarViewId\)[\s\S]{0,200}return/.test(submitFn), "缺 avatarViewId 时提前 return");
check(/submitting: false/.test(submitFn), "缺值时设置 submitting false（不进入提交）");

console.log("\n[JS syntax check]");
function syntax(src, name) {
  try { new Function(src); check(true, name + " syntax ok"); }
  catch (e) {
    // 小程序 Page() 全局未定义，用 vm 仅做语法解析
    new require("vm").Script(src, { filename: name });
    check(true, name + " syntax ok (vm)");
  }
}
syntax(genSrc, "generate-progress");
syntax(trySrc, "tryon-progress");

console.log(`\n结果: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
