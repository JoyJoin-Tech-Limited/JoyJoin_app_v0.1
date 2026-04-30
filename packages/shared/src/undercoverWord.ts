/**
 * Undercover Word (谁是卧底) — fallback word pairs
 *
 * Each pair: civilianWord (most players get this) + undercoverWord (one player gets this).
 * Words should be similar enough to cause confusion but distinct enough to be detectable.
 */

export interface UndercoverWordPair {
  civilianWord: string;
  undercoverWord: string;
  category: string;
}

export const FALLBACK_UNDERCOVER_PAIRS: UndercoverWordPair[] = [
  { civilianWord: '奶茶', undercoverWord: '咖啡', category: '饮品' },
  { civilianWord: '火锅', undercoverWord: '烧烤', category: '美食' },
  { civilianWord: '地铁', undercoverWord: '公交', category: '交通' },
  { civilianWord: '微信', undercoverWord: 'QQ', category: '社交' },
  { civilianWord: '猫', undercoverWord: '狗', category: '宠物' },
  { civilianWord: '饺子', undercoverWord: '汤圆', category: '食物' },
  { civilianWord: '夏天', undercoverWord: '秋天', category: '季节' },
  { civilianWord: '电影', undercoverWord: '电视剧', category: '娱乐' },
  { civilianWord: '篮球', undercoverWord: '足球', category: '运动' },
  { civilianWord: '可乐', undercoverWord: '雪碧', category: '饮料' },
  { civilianWord: '面包', undercoverWord: '馒头', category: '主食' },
  { civilianWord: '地铁', undercoverWord: '高铁', category: '交通' },
  { civilianWord: '耳机', undercoverWord: '音箱', category: '数码' },
  { civilianWord: '泡面', undercoverWord: '螺蛳粉', category: '速食' },
  { civilianWord: '瑜伽', undercoverWord: '普拉提', category: '健身' },
  { civilianWord: '煎饼果子', undercoverWord: '鸡蛋灌饼', category: '早餐' },
  { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
  { civilianWord: '快递', undercoverWord: '外卖', category: '服务' },
  { civilianWord: '咖啡', undercoverWord: '茶', category: '饮品' },
  { civilianWord: '地铁', undercoverWord: '打车', category: '出行' },
];

export function getFallbackUndercoverPair(): UndercoverWordPair {
  const idx = Math.floor(Math.random() * FALLBACK_UNDERCOVER_PAIRS.length);
  return FALLBACK_UNDERCOVER_PAIRS[idx];
}
