/**
 * 多方言检测词库 (Multi-Dialect Vocabulary)
 * 
 * 覆盖港深市场常见方言：
 * - 粤语 (Cantonese) - 已有368词库，从cantoneseVocabulary.ts导入
 * - 湖南话 (Hunanese/Xiang)
 * - 潮汕话 (Teochew/Chaoshan)  
 * - 客家话 (Hakka)
 * - 四川话 (Sichuanese)
 * - 东北话 (Northeastern)
 * - 闽南话 (Hokkien/Minnan)
 * - 上海话 (Shanghainese/Wu)
 * 
 * 用于 Level 3 隐藏推断的方言画像生成
 */

import { detectCantoneseUsage, isCantoneseSpeaker, CANTONESE_PATTERN } from './cantoneseVocabulary';
import type { DialectProfile } from './informationTiers';

export type { DialectProfile } from './informationTiers';

// ============ 湖南话词库 ============

export const HUNAN_PARTICLES = [
  '咯', '嘞', '哒', '唦', '啵', '噻', '嘛', '哈', '呗', '咧',
  '撒', '嗲', '哦', '呀', '喃', '叻', '咩', '嘎',
];

export const HUNAN_VERBS = [
  '恰饭', '恰菜', '困觉', '搞么子', '莫搞', '冇得', '有冇', 
  '晓得', '搞不清白', '搞忙', '搞活', '耍', '耍子', '港',
  '港一港', '讲', '讲究', '整', '整一下', '搞一搞',
  '看哈', '瞄', '瞄一哈', '等哈', '歇哈', '坐哈',
];

export const HUNAN_ADJECTIVES = [
  '蛮好', '蛮大', '蛮小', '霸蛮', '韵味', '堵心', '作声',
  '扎实', '狠', '很', '蛮', '几', '几多', '几好',
  '灵泛', '灵光', '清白', '精灵', '活泛', '死板',
];

export const HUNAN_PHRASES = [
  '搞么子', '你搞么子', '冇搞头', '搞定', '你港咯',
  '就咯样', '咯样子', '你讲咩', '冇得事', '冇事咯',
  '恰好呗', '困觉去', '莫急', '莫慌', '莫搞那多',
  '烦死了', '急死了', '堵心死了', '气死我了',
  '你几时', '你在哪', '你港得好', '蛮好的',
];

export const HUNAN_TERMS = [
  // 地名
  '长沙', '株洲', '湘潭', '衡阳', '邵阳', '岳阳', '常德',
  '张家界', '益阳', '郴州', '永州', '怀化', '娄底', '湘西',
  // 美食
  '臭豆腐', '剁椒鱼头', '小龙虾', '口味虾', '糖油粑粑',
  '米粉', '嗦粉', '辣椒炒肉', '毛氏红烧肉',
  // 大学
  '湖大', '中南', '湖师大', '湘大',
];

// ============ 潮汕话词库 ============

export const TEOCHEW_PARTICLES = [
  '唔', '无', '呢', '咧', '噢', '喔', '嘅', '个',
  '么', '末', '勿', '伓', '伊', '阮', '恁',
];

export const TEOCHEW_VERBS = [
  '食糜', '食饭', '食茶', '饮茶', '行路', '企起来',
  '睇', '睇一下', '听讲', '无变', '唔知', '知影',
  '呾', '呾话', '讲话', '做事', '做工', '出门',
];

export const TEOCHEW_PHRASES = [
  '胶己人', '胶己', '家己人', '无变', '无问题',
  '好食', '真好食', '真正好', '甲好', '甲水',
  '你呾咧', '你港咧', '唔知影', '知影无',
  '加油', '你真厉害', '你好勤力',
];

export const TEOCHEW_TERMS = [
  // 地名
  '汕头', '潮州', '揭阳', '潮阳', '澄海', '普宁', '饶平',
  '南澳', '惠来', '潮南', '濠江',
  // 美食
  '牛肉丸', '肠粉', '粿条', '蚝烙', '卤鹅', '鱼饭',
  '功夫茶', '工夫茶', '凤凰单丛', '单枞',
];

// ============ 客家话词库 ============

export const HAKKA_PARTICLES = [
  '呀', '喔', '啊', '咧', '唷', '咯', '嘛', '噢',
  '系', '唔系', '冇', '有冇',
];

export const HAKKA_VERBS = [
  '食朝', '食饭', '食茶', '饮茶', '行路', '转屋',
  '睇', '睇下', '听讲', '知得', '唔知',
  '讲', '讲话', '做事', '做工', '出门',
  '涯', '涯系', '你系', '佢系',
];

export const HAKKA_PHRASES = [
  '涯系客家人', '涯系梅州人', '你好', '食饭未',
  '唔使', '唔紧要', '多谢你', '辛苦你',
  '转屋卡', '归家', '行路转', '行慢点',
];

export const HAKKA_TERMS = [
  // 地名
  '梅州', '河源', '惠州', '韶关', '龙岩', '赣州',
  '梅县', '兴宁', '大埔', '五华', '蕉岭',
  // 美食
  '酿豆腐', '盐焗鸡', '梅菜扣肉', '客家娘酒', '擂茶',
];

// ============ 四川话词库 ============

export const SICHUAN_PARTICLES = [
  '嘛', '哦', '噻', '唦', '咯', '嘞', '撒', '喃',
  '些', '个', '子', '头',
];

export const SICHUAN_VERBS = [
  '整', '整起', '弄', '搞', '耍', '耍朋友',
  '吃', '吃嘎嘎', '喝', '摆龙门阵', '冲壳子',
  '看', '瞄', '逛', '逛街', '去', '走',
];

export const SICHUAN_ADJECTIVES = [
  '巴适', '安逸', '巴适得板', '舒服', '恼火', '凶',
  '要得', '对头', '莫得', '没得', '有撇子', '凶残',
  '瓜', '瓜皮', '瓜兮兮', '憨', '憨皮', '默默儿',
];

export const SICHUAN_PHRASES = [
  '巴适得很', '要得', '莫得问题', '不存在', '不摆了',
  '哦豁', '啷个', '咋个', '咋整', '搞快点',
  '龟儿子', '瓜娃子', '锤子', '铲铲',
  '走起', '安排', '耍起', '整起',
];

export const SICHUAN_TERMS = [
  // 地名
  '成都', '重庆', '绵阳', '德阳', '宜宾', '泸州', '乐山',
  '南充', '自贡', '达州', '遂宁', '春熙路', '太古里',
  // 美食
  '火锅', '串串', '冒菜', '钵钵鸡', '担担面', '抄手',
  '兔头', '兔丁', '麻辣烫', '龙抄手', '钟水饺',
];

// ============ 东北话词库 ============

export const NORTHEASTERN_PARTICLES = [
  '啊', '呀', '咧', '呗', '嘛', '呢', '噢', '哈',
  '的', '地', '得', '了',
];

export const NORTHEASTERN_VERBS = [
  '整', '整点', '嘎哈', '干啥', '咋整', '咋地',
  '唠', '唠嗑', '磨叽', '得瑟', '显摆', '嘚瑟',
  '撂', '撂挑子', '扒拉', '稀罕', '膈应',
];

export const NORTHEASTERN_ADJECTIVES = [
  '贼拉', '贼好', '贼棒', '老', '老好了', '老牛了',
  '嘎嘎', '杠杠的', '埋汰', '磕碜', '虎', '彪',
  '傻', '傻了吧唧', '秃噜', '咋咋呼呼',
];

export const NORTHEASTERN_PHRASES = [
  '嘎哈呢', '干啥呢', '咋整啊', '咋地了', '没毛病',
  '你瞅啥', '瞅你咋地', '唠唠', '唠会儿',
  '老铁', '铁子', '稳了', '安排',
  '得劲', '不得劲', '膈应人', '整挺好',
];

export const NORTHEASTERN_TERMS = [
  // 地名
  '哈尔滨', '长春', '沈阳', '大连', '鞍山', '抚顺',
  '吉林', '齐齐哈尔', '牡丹江', '佳木斯',
  // 美食
  '锅包肉', '杀猪菜', '酸菜', '大拉皮', '地三鲜',
  '烧烤', '小烧烤', '铁锅炖', '东北大拌菜',
];

// ============ 闽南话词库 ============

export const HOKKIEN_PARTICLES = [
  '啦', '咧', '喔', '呢', '噢', '哦', '嘅', '个',
  '呒', '勿', '伓', '阮', '恁', '伊',
];

export const HOKKIEN_VERBS = [
  '呷饭', '呷茶', '饮茶', '行路', '企', '坐',
  '睇', '看', '听', '讲', '说', '做', '工作',
  '歹势', '拍谢', '多谢', '感谢',
];

export const HOKKIEN_PHRASES = [
  '呷饱未', '食饱未', '歹势', '多谢', '免客气',
  '水喔', '真水', '足水', '真正好', '真好',
  '冲冲滚', '打拼', '拼经济',
];

export const HOKKIEN_TERMS = [
  // 地名
  '厦门', '泉州', '漳州', '福州', '莆田', '龙岩',
  '石狮', '晋江', '安溪', '同安', '翔安',
  // 美食
  '沙茶面', '海蛎煎', '土笋冻', '面线糊', '扁食',
  '卤面', '烧肉粽', '姜母鸭', '佛跳墙',
];

// ============ 上海话词库 ============

export const SHANGHAINESE_PARTICLES = [
  '啦', '呀', '咧', '噢', '嘅', '个', '阿拉',
  '侬', '伊', '伊拉', '覅', '勿',
];

export const SHANGHAINESE_VERBS = [
  '吃饭', '吃茶', '喝茶', '走路', '立起来', '坐',
  '看', '听', '讲', '说', '做', '工作',
  '覅', '覅来三', '覅搞', '勿要',
];

export const SHANGHAINESE_ADJECTIVES = [
  '老灵光', '老嗲', '老好', '蛮好', '结棍', '瞎搞',
  '噶', '噶灵', '邪气', '交关', '老卵',
];

export const SHANGHAINESE_PHRASES = [
  '侬好', '阿拉上海人', '侬吃过伐', '侬晓得伐',
  '覅来三', '勿要紧', '没事体', '没问题',
  '老灵额', '老嗲额', '瞎搞搞', '交关好',
  '谢谢侬', '拜拜', '再会',
];

export const SHANGHAINESE_TERMS = [
  // 地名
  '外滩', '南京路', '淮海路', '静安', '徐汇', '浦东',
  '陆家嘴', '虹桥', '闵行', '松江', '嘉定',
  // 美食
  '生煎', '小笼包', '本帮菜', '红烧肉', '糖醋排骨',
  '蟹壳黄', '排骨年糕', '鲜肉月饼',
];

// ============ 方言检测函数 ============

function buildDialectPattern(terms: string[][]): RegExp {
  const allTerms = terms.flat();
  const uniqueTerms = Array.from(new Set(allTerms))
    .filter(t => t.length > 0)
    .sort((a, b) => b.length - a.length);
  const escaped = uniqueTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'gi');
}

const HUNAN_PATTERN = buildDialectPattern([
  HUNAN_PARTICLES, HUNAN_VERBS, HUNAN_ADJECTIVES, HUNAN_PHRASES, HUNAN_TERMS
]);

const TEOCHEW_PATTERN = buildDialectPattern([
  TEOCHEW_PARTICLES, TEOCHEW_VERBS, TEOCHEW_PHRASES, TEOCHEW_TERMS
]);

const HAKKA_PATTERN = buildDialectPattern([
  HAKKA_PARTICLES, HAKKA_VERBS, HAKKA_PHRASES, HAKKA_TERMS
]);

const SICHUAN_PATTERN = buildDialectPattern([
  SICHUAN_PARTICLES, SICHUAN_VERBS, SICHUAN_ADJECTIVES, SICHUAN_PHRASES, SICHUAN_TERMS
]);

const NORTHEASTERN_PATTERN = buildDialectPattern([
  NORTHEASTERN_PARTICLES, NORTHEASTERN_VERBS, NORTHEASTERN_ADJECTIVES, NORTHEASTERN_PHRASES, NORTHEASTERN_TERMS
]);

const HOKKIEN_PATTERN = buildDialectPattern([
  HOKKIEN_PARTICLES, HOKKIEN_VERBS, HOKKIEN_PHRASES, HOKKIEN_TERMS
]);

const SHANGHAINESE_PATTERN = buildDialectPattern([
  SHANGHAINESE_PARTICLES, SHANGHAINESE_VERBS, SHANGHAINESE_ADJECTIVES, SHANGHAINESE_PHRASES, SHANGHAINESE_TERMS
]);

interface DialectDetectionResult {
  count: number;
  matches: string[];
  density: number;
}

function detectDialectUsage(text: string, pattern: RegExp): DialectDetectionResult {
  const matches = text.match(pattern) || [];
  const uniqueMatches = Array.from(new Set(matches.map(m => m.toLowerCase())));
  const density = text.length > 0 ? matches.length / text.length : 0;
  
  return {
    count: matches.length,
    matches: uniqueMatches,
    density: Math.min(1, density * 10),
  };
}

export function analyzeDialects(text: string): DialectProfile {
  const cantonese = detectCantoneseUsage(text);
  const hunan = detectDialectUsage(text, HUNAN_PATTERN);
  const teochew = detectDialectUsage(text, TEOCHEW_PATTERN);
  const hakka = detectDialectUsage(text, HAKKA_PATTERN);
  const sichuan = detectDialectUsage(text, SICHUAN_PATTERN);
  const northeastern = detectDialectUsage(text, NORTHEASTERN_PATTERN);
  const hokkien = detectDialectUsage(text, HOKKIEN_PATTERN);
  const shanghainese = detectDialectUsage(text, SHANGHAINESE_PATTERN);
  
  const densities = {
    cantonese: cantonese.density,
    mandarin: 0,
    hunan: hunan.density,
    teochew: teochew.density,
    hakka: hakka.density,
    sichuanese: sichuan.density,
    northeastern: northeastern.density,
    hokkien: hokkien.density,
    shanghainese: shanghainese.density,
  };
  
  const maxDensity = Math.max(...Object.values(densities));
  let primaryDialect: string | null = null;
  
  if (maxDensity > 0.05) {
    const entries = Object.entries(densities);
    const maxEntry = entries.reduce((a, b) => a[1] > b[1] ? a : b);
    primaryDialect = maxEntry[0];
  }
  
  const totalSignals = cantonese.count + hunan.count + teochew.count + hakka.count + 
                       sichuan.count + northeastern.count + hokkien.count + shanghainese.count;
  const confidence = Math.min(1, totalSignals / 20);
  
  return {
    ...densities,
    primaryDialect,
    confidence,
  };
}

export function analyzeDialectsFromMessages(messages: Array<{ role: string; content: string }>): DialectProfile {
  const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
  const combinedText = userMessages.join(' ');
  return analyzeDialects(combinedText);
}

export function getDialectDisplayName(dialectKey: string): string {
  const names: Record<string, string> = {
    cantonese: '粤语',
    mandarin: '普通话',
    hunan: '湖南话',
    teochew: '潮汕话',
    hakka: '客家话',
    sichuanese: '四川话',
    northeastern: '东北话',
    hokkien: '闽南话',
    shanghainese: '上海话',
  };
  return names[dialectKey] || dialectKey;
}

export function calculateDialectSimilarity(profile1: DialectProfile, profile2: DialectProfile): number {
  if (profile1.primaryDialect && profile1.primaryDialect === profile2.primaryDialect) {
    return 90 + Math.min(10, (profile1.confidence + profile2.confidence) * 5);
  }
  
  const dialectKeys = ['cantonese', 'hunan', 'teochew', 'hakka', 'sichuanese', 'northeastern', 'hokkien', 'shanghainese'] as const;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (const key of dialectKeys) {
    const v1 = profile1[key];
    const v2 = profile2[key];
    dotProduct += v1 * v2;
    norm1 += v1 * v1;
    norm2 += v2 * v2;
  }
  
  if (norm1 === 0 || norm2 === 0) return 50;
  
  const cosineSimilarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return Math.round(50 + cosineSimilarity * 50);
}
