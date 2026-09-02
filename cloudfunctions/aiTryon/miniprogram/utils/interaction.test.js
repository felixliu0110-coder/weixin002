const test = require("node:test");
const assert = require("node:assert");

const calls = [];
global.__wx = {
  showToast: (o) => calls.push(["toast", o.title]),
  navigateTo: (o) => calls.push(["navigateTo", o.url]),
  switchTab: (o) => calls.push(["switchTab", o.url])
};

const ui = require("./interaction");

test.beforeEach(() => {
  calls.length = 0;
  ui.__resetNavLock();
});

test("toast 调用 wx.showToast", () => {
  ui.toast("已保存");
  assert.deepStrictEqual(calls, [["toast", "已保存"]]);
});

test("navigate 对 Tab 页走 switchTab，对其他页走 navigateTo", () => {
  ui.navigate("/pages/profile/index");
  assert.deepStrictEqual(calls, [["switchTab", "/pages/profile/index"]]);
  ui.__resetNavLock();
  ui.navigate("/pages/basic-info/index");
  assert.deepStrictEqual(calls[calls.length - 1], ["navigateTo", "/pages/basic-info/index"]);
});

test("navigate 600ms 内防重复跳转", () => {
  ui.navigate("/pages/home/index");
  ui.navigate("/pages/profile/index");
  assert.strictEqual(calls.length, 1);
  assert.deepStrictEqual(calls[0], ["switchTab", "/pages/home/index"]);
});
