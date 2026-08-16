/* 云存储工具：下载公网图片并保存到云存储，返回 cloud:// fileID */
const https = require("https");

function downloadToBuffer(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs || 90000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error("download http " + res.statusCode + " for " + url));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("timeout", () => req.destroy(new Error("download timeout")));
    req.on("error", reject);
  });
}

/* 把公网图片 URL 保存到云存储（dir 如 "avatar_views" / "garment_views" / "tryon"），返回 fileID */
async function saveRemoteImage(url, dir) {
  if (!url || url.indexOf("cloud://") === 0) return url; // 已是云存储文件，直接返回
  const cloud = require("wx-server-sdk"); // 延迟加载，便于本地单测
  const buf = await downloadToBuffer(url);
  const ext = /\.(png|jpe?g|webp)$/i.test(url) ? url.match(/\.(png|jpe?g|webp)$/i)[1] : "png";
  const cloudPath = dir + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
  const up = await cloud.uploadFile({ cloudPath, fileContent: buf });
  return up.fileID;
}

module.exports = { downloadToBuffer, saveRemoteImage };
