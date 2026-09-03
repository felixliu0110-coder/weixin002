/* 内置模板衣物白名单（服务端可信数据源）：
   客户端提交的 garmentName/garmentImage 不作为生成依据；内置模板无云存储原图，
   生成四视图/试穿图时不携带参考图（纯提示词）。
   V1 用户入口仅允许 上衣/裤子 分类；g-skirt 等未来能力保留但不在 V1 路径展示。
   displayImage 为小程序本地 UI 展示资源，非 Provider reference asset。 */
const V1_CATEGORIES = ["上衣", "裤子"];

const BUILTIN_GARMENTS = {
  "g-tee": { name: "白色基础T恤", category: "上衣", displayImage: "/assets/img/p06-tee.jpg" },
  "g-shirt": { name: "蓝色条纹衬衫", category: "上衣", displayImage: "/assets/img/p06-shirt.jpg" },
  "g-hoodie": { name: "米白连帽卫衣", category: "上衣", displayImage: "/assets/img/p06-hoodie.jpg" },
  "g-jeans": { name: "蓝色直筒牛仔裤", category: "裤子", displayImage: "/assets/img/p06-jeans.jpg" },
  "g-pants": { name: "浅灰休闲裤", category: "裤子", displayImage: "/assets/img/p06-pants.jpg" },
  "g-skirt": { name: "粉色半身裙", category: "其他", displayImage: "/assets/img/p06-skirt.jpg" }
};

function isBuiltinGarment(id) {
  return Object.prototype.hasOwnProperty.call(BUILTIN_GARMENTS, id);
}

function getBuiltinGarment(id) {
  return BUILTIN_GARMENTS[id] || null;
}

/* V1 过滤：仅返回属于 V1 分类（上衣/裤子）的内置模板 */
function getV1BuiltinList() {
  return Object.keys(BUILTIN_GARMENTS)
    .filter(function (id) { return V1_CATEGORIES.indexOf(BUILTIN_GARMENTS[id].category) >= 0; })
    .map(function (id) { return Object.assign({ id: id }, BUILTIN_GARMENTS[id]); });
}

module.exports = { BUILTIN_GARMENTS, isBuiltinGarment, getBuiltinGarment, getV1BuiltinList, V1_CATEGORIES };
