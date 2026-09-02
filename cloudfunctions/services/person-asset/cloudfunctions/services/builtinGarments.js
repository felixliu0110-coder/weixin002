/* 内置模板衣物白名单（服务端可信数据源）：
   客户端提交的 garmentName/garmentImage 不作为生成依据；内置模板无云存储原图，
   生成四视图/试穿图时不携带参考图（纯提示词）。 */
const BUILTIN_GARMENTS = {
  "g-tee": { name: "白色基础T恤", category: "上衣" },
  "g-shirt": { name: "蓝色条纹衬衫", category: "上衣" },
  "g-hoodie": { name: "米白连帽卫衣", category: "上衣" },
  "g-jeans": { name: "蓝色直筒牛仔裤", category: "裤子" },
  "g-pants": { name: "浅灰休闲裤", category: "裤子" },
  "g-skirt": { name: "粉色半身裙", category: "其他" }
};

function isBuiltinGarment(id) {
  return Object.prototype.hasOwnProperty.call(BUILTIN_GARMENTS, id);
}

function getBuiltinGarment(id) {
  return BUILTIN_GARMENTS[id] || null;
}

module.exports = { BUILTIN_GARMENTS, isBuiltinGarment, getBuiltinGarment };
