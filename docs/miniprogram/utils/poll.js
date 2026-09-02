/* 生成轮询退避：间隔递增，封顶 12s；总上限 12 分钟 */
const POLL_INTERVALS = [2000, 3000, 5000, 8000, 12000];
const POLL_MAX_MS = 12 * 60 * 1000;

function nextPollInterval(count) {
  const i = Math.min(Math.max(count, 0), POLL_INTERVALS.length - 1);
  return POLL_INTERVALS[i];
}

module.exports = { nextPollInterval, POLL_INTERVALS, POLL_MAX_MS };
