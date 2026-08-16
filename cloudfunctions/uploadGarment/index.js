const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event) => {
  const { fileID } = event;
  if (!fileID) return { ok: false, error: "fileID 必填" };
  try {
    // 下载云存储图片 → 微信内容安全检测（C-04）
    const dl = await cloud.downloadFile({ fileID });
    const res = await cloud.openapi.security.imgSecCheck({
      media: { contentType: "image/png", value: dl.fileContent }
    });
    const pass = !res || res.errCode === 0;
    console.log("uploadGarment check", "fileID=" + fileID, "pass=" + pass);
    return { ok: true, pass, label: (res && res.result && res.result.label) || 0 };
  } catch (e) {
    // 87014 = 内容违规（微信标准错误码）
    if (e && e.errCode === 87014) {
      return { ok: true, pass: false, label: 100, reason: "图片内容违规，请更换后重试" };
    }
    console.log("uploadGarment check fail", "error=" + ((e && (e.errMsg || e.message)) || e));
    return { ok: false, error: (e && (e.errMsg || e.message)) || String(e) };
  }
};
