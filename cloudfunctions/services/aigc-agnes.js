/* Agnes AIGC 适配器（Sapiens AI）：生图同步 + 视频异步任务
   生图：POST /v1/images/generations（agnes-image-2.1-flash）
   视频：POST /v1/videos 创建任务 → GET /agnesapi?video_id= 轮询（agnes-video-v2.0）
   Key 从云函数环境变量 AGNES_API_KEY 读取；未配置时由 aigc.js 回退 mock */
const https = require("https");

const BASE = "https://apihub.agnes-ai.com";

function getKey() {
  return process.env.AGNES_API_KEY || "";
}

function requestJson(method, path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const req = https.request({
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        Authorization: "Bearer " + getKey(),
        "Content-Type": "application/json"
      },
      timeout: timeoutMs || 90000
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { /* 非 JSON 响应 */ }
        if (res.statusCode >= 400) {
          const err = new Error("Agnes API " + res.statusCode + ": " + String(data).slice(0, 300));
          err.code = "AGNES_API_" + res.statusCode;
          err.statusCode = res.statusCode;
          reject(err);
        } else {
          resolve(json || {});
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Agnes API timeout")));
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

module.exports = {
  name: "agnes",
  isConfigured() {
    return !!getKey();
  },
  /* 生图（同步，等待返回 URL）。refImages 为可公网访问的 HTTPS 图片 URL 数组（图生图/参考图）。 */
  async generateImages({ prompt, refImages, count, size }) {
    if (!getKey()) {
      const err = new Error("AIGC_NOT_CONFIGURED: 未配置 AGNES_API_KEY 环境变量");
      err.code = "AIGC_NOT_CONFIGURED";
      throw err;
    }
    const body = {
      model: "agnes-image-2.1-flash",
      prompt,
      size: size || "1024x1024",
      extra_body: { response_format: "url" }
    };
    if (refImages && refImages.length > 0) {
      body.extra_body.image = refImages;
    }
    const res = await requestJson("POST", "/v1/images/generations", body, 90000);
    const urls = (res.data || []).map((d) => d && d.url).filter(Boolean);
    if (urls.length === 0) {
      throw new Error("Agnes 生图无返回 URL");
    }
    return { urls, provider: "agnes" };
  },
  /* 创建图生视频任务（异步，不等待完成）。返回任务 ID，后续用 getVideoStatus 轮询。 */
  async generateVideo({ imageUrl, prompt, durationSec }) {
    if (!getKey()) {
      const err = new Error("AIGC_NOT_CONFIGURED: 未配置 AGNES_API_KEY 环境变量");
      err.code = "AIGC_NOT_CONFIGURED";
      throw err;
    }
    const frames = durationSec && durationSec <= 4 ? 81 : 121; // 约 3s / 5s
    const body = {
      model: "agnes-video-v2.0",
      prompt,
      width: 1152,
      height: 768,
      num_frames: frames,
      frame_rate: 24
    };
    if (imageUrl) body.image = imageUrl;
    const res = await requestJson("POST", "/v1/videos", body, 60000);
    const videoId = res.video_id || res.task_id || res.id;
    if (!videoId) {
      throw new Error("Agnes 视频任务创建失败，无 task_id/video_id");
    }
    return { videoTaskId: videoId, status: res.status || "queued", provider: "agnes" };
  },
  /* 轮询视频任务状态。 */
  async getVideoStatus(taskId) {
    const res = await requestJson("GET", "/agnesapi?video_id=" + encodeURIComponent(taskId), undefined, 60000);
    return {
      status: res.status,
      progress: res.progress,
      videoUrl: (res.metadata && res.metadata.url) || "",
      error: res.error || ""
    };
  }
};
