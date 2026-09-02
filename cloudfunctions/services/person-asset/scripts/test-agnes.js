/* 临时验证 Agnes API Key 是否有效（与云函数 aigc-agnes.js 同一套 https 请求逻辑）
   用法（PowerShell）：
     $env:AGNES_TEST_KEY='你的真实key'
     node scripts/test-agnes.js
   不会打印 Key 本身，只打印结果。 */
const https = require("https");

const key = process.env.AGNES_TEST_KEY || "";
if (!key) {
  console.error("请先设置环境变量 AGNES_TEST_KEY=你的key，再运行：\n$env:AGNES_TEST_KEY='你的key'\nnode scripts/test-agnes.js");
  process.exit(1);
}

const body = {
  model: "agnes-image-2.1-flash",
  prompt: "一只白色的小猫，写实风格",
  size: "1024x1024",
  extra_body: { response_format: "url" }
};

const req = https.request({
  hostname: "apihub.agnes-ai.com",
  path: "/v1/images/generations",
  method: "POST",
  headers: {
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  },
  timeout: 90000
}, (res) => {
  let data = "";
  res.on("data", (c) => { data += c; });
  res.on("end", () => {
    console.log("HTTP 状态码:", res.statusCode);
    try {
      const json = JSON.parse(data);
      if (Array.isArray(json.data) && json.data.length > 0) {
        console.log("✅ Key 有效，生图成功：");
        json.data.forEach((d) => console.log("  -", d.url));
      } else if (json.error) {
        console.log("❌ 返回错误：", json.error.message || JSON.stringify(json.error));
        if (/invalid|无效/.test(JSON.stringify(json.error))) {
          console.log("→ Key 无效，请到 Agnes 平台确认 Key 状态/重新生成，注意复制时不要带空格。");
        }
      } else {
        console.log("返回内容：", data.slice(0, 500));
      }
    } catch (e) {
      console.log("非 JSON 响应：", data.slice(0, 500));
    }
  });
});
req.on("timeout", () => {
  console.error("请求超时（90s）");
  req.destroy();
});
req.on("error", (e) => {
  console.error("请求失败：", e.message);
});
req.write(JSON.stringify(body));
req.end();
