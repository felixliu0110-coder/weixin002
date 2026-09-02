const test = require("node:test");
const assert = require("node:assert");
const { nextPollInterval, POLL_INTERVALS, POLL_MAX_MS } = require("./poll");

test("nextPollInterval 按序列递增并封顶", () => {
  assert.strictEqual(nextPollInterval(0), 2000);
  assert.strictEqual(nextPollInterval(1), 3000);
  assert.strictEqual(nextPollInterval(2), 5000);
  assert.strictEqual(nextPollInterval(3), 8000);
  assert.strictEqual(nextPollInterval(4), 12000);
  assert.strictEqual(nextPollInterval(99), 12000);
});

test("常量符合设计", () => {
  assert.deepStrictEqual(POLL_INTERVALS, [2000, 3000, 5000, 8000, 12000]);
  assert.strictEqual(POLL_MAX_MS, 12 * 60 * 1000);
});
