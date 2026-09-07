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
    // IPv4-mapped IPv6：::ffff:a.b.c.d 及规范化变体必须按对应 IPv4 地址判断，
    // 防止 DNS/解析结果通过 IPv6 形式绕过 RFC1918/回环/链路本地拦截。
    const mapped = norm.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    // IPv4-compatible / mapped 的常见完整写法：0:0:0:0:0:ffff:a.b.c.d
    const fullMapped = norm.match(/^0:0:0:0:0:ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (fullMapped) return isPrivateIp(fullMapped[1]);
    if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return true; // fe80::/10 link-local
    if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // fc00::/7 ULA
    if (norm.startsWith("ff")) return true; // multicast
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

/* 按文件真实内容（magic bytes）识别图片 contentType。
   不信任文件名/扩展名/前端声明的 MIME。
   当前产品声明支持：JPEG / PNG；项目已支持 WebP 上传时一并支持。
   无法识别返回 null。可单测。 */
function detectImageContentType(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  const b = buffer;
  // PNG: 89504E47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "image/png";
  // JPEG: FFD8FF
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return "image/jpeg";
  // WEBP: 52494646 ... 57454250  (RIFF....WEBP)
  if (b.length >= 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}



function readImageDimensions(buffer, contentType) {
  if (!Buffer.isBuffer(buffer) || !contentType) return null;
  try {
    if (contentType === "image/png" && buffer.length >= 24) {
      if (buffer.readUInt32BE(0) !== 0x89504E47) return null;
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (contentType === "image/webp" && buffer.length >= 30) {
      if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
      const chunk = buffer.toString("ascii", 12, 16);
      if (chunk === "VP8X" && buffer.length >= 30) {
        const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
        const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
        return { width, height };
      }
      if (chunk === "VP8L" && buffer.length >= 25) {
        // VP8L signature 0x2f, 14-bit width/height packed into 5 bytes.
        if (buffer[20] !== 0x2f) return null;
        const bits = buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24);
        const width = 1 + (bits & 0x3fff);
        const height = 1 + ((bits >>> 14) & 0x3fff);
        return { width, height };
      }
      return null;
    }
    if (contentType === "image/jpeg" && buffer.length >= 4) {
      if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
      let i = 2;
      while (i + 1 < buffer.length) {
        while (i < buffer.length && buffer[i] === 0xFF) i++;
        if (i >= buffer.length) break;
        const marker = buffer[i++];
        if (marker === 0xD8 || marker === 0xD9) continue;
        if (marker === 0xDA) break;
        if (i + 1 >= buffer.length) break;
        const len = buffer.readUInt16BE(i);
        if (len < 2 || i + len > buffer.length) return null;
        const sof = ((marker >= 0xC0 && marker <= 0xC3) ||
                     (marker >= 0xC5 && marker <= 0xC7) ||
                     (marker >= 0xC9 && marker <= 0xCB) ||
                     (marker >= 0xCD && marker <= 0xCF));
        if (sof && len >= 7) {
          return { width: buffer.readUInt16BE(i + 5), height: buffer.readUInt16BE(i + 3) };
        }
        i += len;
      }
    }
  } catch (_e) {
    return null;
  }
  return null;
}

const TRYON_MIN_BYTES = 5 * 1024;
const TRYON_MAX_BYTES = 5 * 1024 * 1024;

/* Provider 侧 AI 试衣输入约束：当前阿里云 aitryon / aitryon-plus 要求
   5KB~5MB；这里在真正扣额度、调用 Provider 前 fail-closed。
   只对当前 V1 已允许的 JPEG/PNG/WEBP 做内容校验。 */
async function validateTryonInputUrl(url) {
  if (!url || typeof url !== "string") {
    throw appError("INVALID_ARGUMENT", "试穿图片地址缺失");
  }
  const r = await requestOnce(url, MAX_REDIRECTS);
  if (r.buffer.length < TRYON_MIN_BYTES) {
    throw appError("INVALID_ARGUMENT", "试穿图片过小（至少 5KB）");
  }
  if (r.buffer.length > TRYON_MAX_BYTES) {
    throw appError("PAYLOAD_TOO_LARGE", "试穿图片过大（最多 5MB）");
  }
  const detected = detectImageContentType(r.buffer);
  // DashScope aitryon 当前 V1 合同：jpg/jpeg/png/bmp/heic；项目自身上传链目前仅稳定产出 jpg/png。
  // WebP 虽可被部分上游识别，但 Provider 明确不收，不能让 preflight 放行后再由 Provider 拒绝。
  if (!detected || !["image/jpeg", "image/png"].includes(detected)) {
    throw appError("INVALID_ARGUMENT", "试穿图片格式不支持");
  }
  const dimensions = readImageDimensions(r.buffer, detected);
  if (!dimensions || dimensions.width < 150 || dimensions.height < 150 || dimensions.width > 4096 || dimensions.height > 4096) {
    throw appError("INVALID_ARGUMENT", "试穿图片尺寸必须在 150~4096 px 之间");
  }
  return { contentType: detected, size: r.buffer.length, width: dimensions.width, height: dimensions.height };
}

module.exports = { downloadToBuffer, saveRemoteImage, isPrivateIp, parseUrl, MAX_BYTES, MAX_REDIRECTS, detectImageContentType, readImageDimensions, TRYON_MIN_BYTES, TRYON_MAX_BYTES, validateTryonInputUrl };
