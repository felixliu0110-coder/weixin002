/* 服装四视图提示词：源自 .agnes/jimeng-2026-08-16-8289-通用服装四视图提示词模板.md */
function buildGarmentViewsPrompt(garmentName) {
  return `纯白色背景，自然日常光线，生成【${garmentName}】的服装四视图，四张视图以2x2均等排布在同一画布：
1. 左上角：服装正面平拍
2. 右上角：服装45度斜侧角度
3. 左下角：服装局部细节特写
4. 右下角：服装背面平拍
四张视图中的服装与参考原图保持一致的版型、颜色和细节，呈现自然真实的效果。`;
}

module.exports = { buildGarmentViewsPrompt };
