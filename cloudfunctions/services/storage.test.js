const test = require("node:test");
const assert = require("node:assert");
const { saveRemoteImage, isPrivateIp, parseUrl, MAX_BYTES, MAX_REDIRECTS } = require("./storage");

test("saveRemoteImage 对 cloud:// 直接返回不重复下载", async () => {
  const id = "cloud://env.x/ai/1.png";
  const r = await saveRemoteImage(id, "tryon");
  assert.strictEqual(r, id);
});

test("saveRemoteImage 对空/缺失 URL 返回原值", async () => {
  assert.strictEqual(await saveRemoteImage("", "tryon"), "");
  assert.strictEqual(await saveRemoteImage(undefined, "tryon"), undefined);
});

test("isPrivateIp: 私网/回环/链路本地/保留地址全部识别", () => {
  for (const ip of ["127.0.0.1", "127.8.8.8", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.10.10", "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "2001:db8::1"]) {
    assert.strictEqual(isPrivateIp(ip), true, ip + " 应为私网");
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "114.114.114.114", "2606:4700:4700::1111"]) {
    assert.strictEqual(isPrivateIp(ip), false, ip + " 应为公网");
  }
});

test("parseUrl: 拒绝非 http(s)/localhost/私网字面 IP", () => {
  assert.throws(() => parseUrl("ftp://example.com/a.png"), (e) => e.appCode === "INVALID_ARGUMENT");
  assert.throws(() => parseUrl("file:///etc/passwd"), (e) => e.appCode === "INVALID_ARGUMENT");
  assert.throws(() => parseUrl("http://localhost:8080/a.png"), (e) => e.appCode === "INVALID_ARGUMENT");
  assert.throws(() => parseUrl("http://127.0.0.1/a.png"), (e) => e.appCode === "INVALID_ARGUMENT");
  assert.throws(() => parseUrl("http://192.168.1.2/a.png"), (e) => e.appCode === "INVALID_ARGUMENT");
  assert.throws(() => parseUrl("http://[::1]/a.png"), (e) => e.appCode === "INVALID_ARGUMENT");
  assert.strictEqual(parseUrl("https://example.com/a.png").hostname, "example.com");
});

test("MAX_BYTES 为 10MB", () => {
  assert.strictEqual(MAX_BYTES, 10 * 1024 * 1024);
});

test("MAX_REDIRECTS 限 3 次", () => {
  assert.strictEqual(MAX_REDIRECTS, 3);
});
