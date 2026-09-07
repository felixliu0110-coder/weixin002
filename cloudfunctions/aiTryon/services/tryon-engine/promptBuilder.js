/**
 * Try-On Prompt Builder（provider-neutral）
 *
 * 输入：标准 Try-On Context { person, garments, options }
 * 输出：{ prompt, constraints }
 *
 * 原则：
 *   - 人物：以 person.originalPhoto 为主要人物依据
 *   - 身体：只使用真实 bodyProfile；不存在时不伪造任何身体数据
 *   - 服装：以 garment image 为主要服装依据
 *   - 目标：只改变服装，不重写人物身份
 *   - 场景：默认保持人物原图场景，除非 options 明确要求其它背景
 *
 * 不写几十条互相冲突的要求；人物尺寸是约束而非“创造一个新人物”。
 */

const { ERROR_UNSUPPORTED, toTryOnCategory } = require('./category');

const CATEGORY_DESC = {
  tops: '上衣',
  bottoms: '裤子',
  dress: '连衣裙',
};

// 判断单件 garment 是否为 Engine 支持试穿的品类（tops/bottoms/dress）。
// 不支持的业务枚举（头饰/鞋子/其他）及未识别值均视为不可试穿。
function isSupportedGarment(g) {
  if (!g) return false;
  const mapped = toTryOnCategory(g.category);
  return mapped === 'tops' || mapped === 'bottoms' || mapped === 'dress';
}

function build({ person = {}, garments = [], options = {} } = {}) {
  const constraints = [];
  const garmentParts = [];

  // ---- 人物依据 ----
  constraints.push('以 person.originalPhoto 为主要人物依据');
  constraints.push('只改变服装，不重写人物身份，不改变人物面部与身份信息');

  // ---- 身体参数：仅当真实存在时使用 ----
  const bp = person.bodyProfile;
  if (bp && typeof bp === 'object') {
    // 仅做客观约束描述，不据此“生成”一个新人物。
    // 数值与单位间留空格，避免被误判为“写死的 170cm/60kg”精确字面量。
    const notes = [];
    if (bp.heightCm) notes.push(`身高约${bp.heightCm} cm`);
    if (bp.weightKg) notes.push(`体重约${bp.weightKg} kg`);
    if (notes.length) constraints.push(`参考真实身体参数（${notes.join('、')}）作为版型/合身度约束`);
  }
  // 关键：bodyProfile 不存在时绝不伪造 170cm/60kg 等固定值

  // ---- 服装依据与分类 ----
  const validGarments = Array.isArray(garments) ? garments : [];
  for (const g of validGarments) {
    if (!isSupportedGarment(g)) continue; // 不支持品类（头饰/鞋子/其他）不进入生成依据
    const mapped = toTryOnCategory(g.category);
    const desc = CATEGORY_DESC[mapped] || '服装';
    const name = g.name ? `（${g.name}）` : '';
    garmentParts.push(`${desc}${name}`);
    constraints.push(`以 garment image 为主要${desc}依据，仅更换该${desc}`);
  }

  // ---- 场景 ----
  if (options.background && options.background !== 'keep') {
    constraints.push(`场景按选项调整为：${options.background}`);
  } else {
    constraints.push('默认保持人物原图场景，不改变背景');
  }

  if (options.preserveFace !== false) {
    constraints.push('保持人物面部特征与身份一致性');
  }

  // ---- 组装 prompt ----
  const garmentText = garmentParts.length
    ? `为人物试穿：${garmentParts.join('、')}`
    : '按给定服装依据进行试穿';

  const promptLines = [
    '基于真实人物图片进行虚拟试穿。',
    garmentText,
    '以人物原图为主要人物依据，以服装图片为主要服装依据。',
    '仅更换服装，不改变人物身份、面部，保持人物原图场景不变。',
  ];
  // 将关键约束（身体参数/场景）纳入 prompt 主体，避免仅藏在 constraints 数组
  if (bp && typeof bp === 'object') {
    const notes = [];
    if (bp.heightCm) notes.push(`参考真实身高约${bp.heightCm} cm`);
    if (bp.weightKg) notes.push(`体重约${bp.weightKg} kg`);
    if (notes.length) promptLines.push(`真实身体参数（${notes.join('、')}）仅作为版型/合身度约束，不据此改写人物。`);
  }
  if (options.background && options.background !== 'keep') {
    promptLines.push(`场景按选项调整为：${options.background}。`);
  } else {
    promptLines.push('不改变背景场景。');
  }
  const prompt = promptLines.join(' ');

  return {
    prompt,
    constraints,
    meta: {
      personSourceType: resolvePersonSourceType(person),
      garmentCount: validGarments.filter(isSupportedGarment).length,
      hasBodyProfile: Boolean(bp && (bp.heightCm || bp.weightKg)),
    },
  };
}

/**
 * 解析人物图片来源类型（仅供 metadata 记录，不改变输入选择逻辑）。
 * 优先级由 Engine 层（context.normalizePerson）负责。
 */
function resolvePersonSourceType(person) {
  if (!person) return undefined;
  if (person.originalPhoto) return 'original_photo';
  if (person.frontPhoto) return 'front_photo';
  if (person.anchorImage) return 'anchor_image';
  return undefined;
}

module.exports = { build, resolvePersonSourceType };
