/* 安全下载工具（SSRF 防护）：
   - 仅允许 http/https 公网地址；
   - 拒绝 localhost/本机/回环/链路本地/保留/私网（RFC1918/ULA/CGNAT/组播），DNS 解析后的 IP 同样检查；
   - 重定向最多 3 次且每次重新校验；
   - 连接/读取超时；响应字节数上限（10MB），超限立即中断；
   - Content-Type 白名单（图片类）；
   - 错误信息不泄露内部网络细节（统一 PROVIDER_ERROR/INVALID_ARGUMENT）。 */
const http = require("http");
const https = require("https");
const dns = require("dns");
const net = require("net");
const { appError } = require("./errors");

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase().split("%")[0];
    if (norm === "::" || norm === "::1") return true;
    if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return true; // fe80::/10 link-local
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // fc00::/7 ULA
    if (norm.startsWith("2001:db8")) return true; // 文档保留
    return false;
  }
  const parts = ip.split(".").map((s) => parseInt(s, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local 169.254/16
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 172.16/12
  if (a === 192 && b === 168) return true; // RFC1918 192.168/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 基准测试保留
  if (a >= 224) return true; // 组播/保留
  return false;
}

function parseUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    throw appError("INVALID_ARGUMENT", "URL 不合法");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw appError("INVALID_ARGUMENT", "仅支持 http/https");
  }
  const rawHost = u.hostname.toLowerCase();
  const host = rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw appError("INVALID_ARGUMENT", "不允许本机/内网地址");
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw appError("INVALID_ARGUMENT", "不允许本机/内网地址");
  }
  return u;
}

function resolvePublic(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) return reject(appError("PROVIDER_ERROR", "下载失败"));
      const list = (addresses || []);
      const order = list.filter((a) => net.isIPv4(a.address)).concat(list.filter((a) => net.isIPv6(a.address)));
      for (const a of order) {
        if (!isPrivateIp(a.address)) {
          return resolve({ address: a.address, family: net.isIPv4(a.address) ? 4 : 6 });
        }
      }
      reject(appError("INVALID_ARGUMENT", "不允许内网地址"));
    });
  });
}

function requestOnce(url, redirectsLeft) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = parseUrl(url);
    } catch (e) {
      return reject(e);
    }
    resolvePublic(u.hostname).then((ip) => {
      const mod = u.protocol === "https:" ? https : http;
      const req = mod.request({
        hostname: ip.address,
        family: ip.family,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: "GET",
        headers: { "User-Agent": "weixin002-storage", Accept: "image/*" },
        timeout: DEFAULT_TIMEOUT_MS,
        // 强制使用已验证 IP，避免 DNS 重绑定
        lookup: (host, opts, cb) => cb(null, ip.address, ip.family)
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(appError("INVALID_ARGUMENT", "重定向过多"));
          let next;
          try {
            next = new URL(res.headers.location, u).toString();
          } catch (e) {
            return reject(appError("INVALID_ARGUMENT", "重定向地址不合法"));
          }
          return resolve(requestOnce(next, redirectsLeft - 1));
        }
        const ctype = (res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
        if (res.statusCode !== 200) {
          res.resume();
          return reject(appError("PROVIDER_ERROR", "下载失败"));
        }
        if (!ALLOWED_CONTENT_TYPES.includes(ctype)) {
          res.resume();
          return reject(appError("INVALID_ARGUMENT", "文件类型不支持"));
        }
        const chunks = [];
        let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > MAX_BYTES) {
            req.destroy();
            reject(appError("PAYLOAD_TOO_LARGE", "文件过大"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: ctype }));
        res.on("error", () => reject(appError("PROVIDER_ERROR", "下载失败")));
      });
      req.on("timeout", () => {
        req.destroy();
        reject(appError("PROVIDER_ERROR", "下载超时"));
      });
      req.on("error", (e) => {
        if (e && e.appCode) return reject(e);
        reject(appError("PROVIDER_ERROR", "下载失败"));
      });
      req.end();
    }).catch(reject);
  });
}

/* 安全下载公网图片到内存 Buffer（已做 SSRF/大小/类型校验） */
async function downloadToBuffer(url) {
  const r = await requestOnce(url, MAX_REDIRECTS);
  return r.buffer;
}

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif"
};

/* 把公网图片 URL 安全下载并保存到云存储（dir 如 "avatar_views" / "garment_views" / "tryon"），返回 fileID */
async function saveRemoteImage(url, dir) {
  if (!url || url.indexOf("cloud://") === 0) return url; // 已是云存储文件，直接返回
  const cloud = require("wx-server-sdk"); // 延迟加载，便于本地单测
  const r = await requestOnce(url, MAX_REDIRECTS);
  const ext = EXT_BY_TYPE[r.contentType] || "png";
  const cloudPath = dir + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const up = await cloud.uploadFile({ cloudPath, fileContent: r.buffer });
  return up.fileID;
}

module.exports = { downloadToBuffer, saveRemoteImage, isPrivateIp, parseUrl, MAX_BYTES, MAX_REDIRECTS };
