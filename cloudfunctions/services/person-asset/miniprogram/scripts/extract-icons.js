/* 从 openDesign 原型提取唯一 SVG 图标，转成带描边的 iconfont 源文件。
   用法：node scripts/extract-icons.js
   输出：miniprogram/assets/icons-src/icon-<name>.svg
 */
const fs = require("fs");
const path = require("path");

const protoRoot = path.join(__dirname, "../../weixin002");
const outDir = path.join(__dirname, "../assets/icons-src");

// 提取顺序：screens/*.html（按文件名排序）后接 index.html
const screenFiles = fs
  .readdirSync(path.join(protoRoot, "screens"))
  .filter((f) => f.endsWith(".html"))
  .sort()
  .map((f) => path.join(protoRoot, "screens", f));
screenFiles.push(path.join(protoRoot, "index.html"));

// 唯一 SVG 的 path 内容 -> 图标类名（按出现顺序映射，与提取结果一致）
const names = [
  "icon-check",        // 1  勾选
  "icon-home",         // 2  首页/发现
  "icon-hanger",       // 3  试衣
  "icon-heart",        // 4  收藏
  "icon-user",         // 5  我的
  "icon-back",         // 6  左箭头/返回
  "icon-minus",        // 7  减号
  "icon-plus",         // 8  加号
  "icon-camera",       // 9  相机
  "icon-avatar",       // 10 人像/数字人
  "icon-rotate",       // 11 旋转
  "icon-ruler",        // 12 尺子/身材标注
  "icon-ok",           // 13 圈勾确认
  "icon-chevron-right",// 14 右箭头
  "icon-star",         // 15 星/额度
  "icon-export",       // 16 导出
  "icon-upload",       // 17 上传
  "icon-settings",     // 18 设置
  "icon-photo",        // 19 图片/预览
  "icon-shield-check", // 20 盾牌勾
  "icon-feedback",     // 21 反馈气泡
  "icon-clock",        // 22 时钟
  "icon-save",         // 23 保存/下载
  "icon-shield",       // 24 盾牌/隐私
  "icon-search"        // 25 搜索
];

const seen = new Map();
const order = [];

for (const file of screenFiles) {
  const html = fs.readFileSync(file, "utf8");
  const re = /<svg[^>]*>([\s\S]*?)<\/svg>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const inner = m[1].trim();
    if (!seen.has(inner)) {
      seen.set(inner, file);
      order.push(inner);
    }
  }
}

if (order.length !== names.length) {
  console.error(
    `图标数量不匹配：提取 ${order.length} 个，映射名 ${names.length} 个。请同步 names 数组。`
  );
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
order.forEach((inner, i) => {
  // 原型图标为线性描边（stroke=currentColor, fill=none），为 iconfont 补足描边属性
  const styled = inner.replace(
    /<(path|circle|rect|polyline|line)([^>]*?)(\/?)>/g,
    (tag, el, attrs, selfClose) => {
      const add =
        (attrs.includes("fill") ? "" : ' fill="none"') +
        (attrs.includes("stroke") ? "" : ' stroke="#000" stroke-width="1.8"') +
        ' stroke-linecap="round" stroke-linejoin="round"';
      return `<${el}${attrs}${add}${selfClose}>`;
    }
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${styled}</svg>`;
  fs.writeFileSync(path.join(outDir, `${names[i]}.svg`), svg, "utf8");
});

console.log(`wrote ${order.length} icons to ${outDir}`);
