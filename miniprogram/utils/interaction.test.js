const test = require("node:test");
const assert = require("node:assert");

const calls = [];
global.__wx = {
  showToast: (o) => calls.push(["toast", o.title]),
  navigateTo: (o) => calls.push(["navigateTo", o.url]),
  switchTab: (o) => calls.push(["switchTab", o.url])
};

const ui = require("./interaction");

test("toast 调用 wx.showToast", () => {
  ui.toast("已保存");
  assert.deepStrictEqual(calls[calls.length - 1], ["toast", "已保存"]);
});

test("navigate 对 Tab 页走 switchTab，对其他页走 navigateTo", () => {
  ui.navigate("/pages/profile/index");
  ui.navigate("/pages/basic-info/index");
  assert.deepStrictEqual(calls[calls.length - 2], ["switchTab", "/pages/profile/index"]);
  assert.deepStrictEqual(calls[calls.length - 1], ["navigateTo", "/pages/basic-info/index"]);
});
