/**
 * Seed库 - 精确匹配映射表
 * 响应时间目标: <10ms
 * 
 * This now uses auto-generated seed map from occupations with manual overrides
 */

import { GENERATED_SEED_MAP, generateMergedSeedMap } from './generateSeedMap';

export interface SeedMatch {
  category: string;
  segment: string;
  niche?: string;
  confidence: number;
}

// Manual overrides for special cases or legacy compatibility
const MANUAL_OVERRIDES = new Map<string, SeedMatch>([
  ['互联网运营', { category: 'tech', segment: 'product', confidence: 1.0 }],
  ['内容运营', { category: 'tech', segment: 'product', confidence: 1.0 }],
  ['用户运营', { category: 'tech', segment: 'product', confidence: 1.0 }],
  ['跨境选品', { category: 'consumer_retail', segment: 'retail', confidence: 1.0 }],
  ['跨境物流', { category: 'consumer_retail', segment: 'retail', confidence: 1.0 }],
  ['跨境电商运营', { category: 'consumer_retail', segment: 'retail', confidence: 1.0 }],
  ['FA财务顾问', { category: 'finance', segment: 'pe_vc', confidence: 1.0 }],
  ['融资顾问', { category: 'finance', segment: 'pe_vc', confidence: 1.0 }],
  ['家族办公室', { category: 'finance', segment: 'pe_vc', confidence: 1.0 }],
  ['餐厅经理', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['烘焙师', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['调酒师', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['咖啡师', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['茶艺师', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['品酒师', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['画家', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['雕塑家', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['书法家', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['陶艺师', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['作曲家', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['指挥家', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['戏剧导演', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['行为艺术家', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['策展人', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['艺术评论家', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['诗人', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['电影导演', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['编剧', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['幼师', { category: 'education', segment: 'k12', confidence: 1.0 }],
  ['大学教授', { category: 'education', segment: 'k12', confidence: 1.0 }],
  ['教授', { category: 'education', segment: 'k12', confidence: 1.0 }],
  ['讲师', { category: 'education', segment: 'k12', confidence: 1.0 }],
  ['公务员', { category: 'government_public', segment: 'civil_service', confidence: 1.0 }],
  ['事业单位员工', { category: 'government_public', segment: 'civil_service', confidence: 1.0 }],
  ['体制内', { category: 'government_public', segment: 'civil_service', confidence: 1.0 }],
  ['法官', { category: 'government_public', segment: 'civil_service', confidence: 1.0 }],
  ['检察官', { category: 'government_public', segment: 'civil_service', confidence: 1.0 }],
  ['军人', { category: 'government_public', segment: 'civil_service', confidence: 1.0 }],
  ['会计', { category: 'professional_services', segment: 'consulting', confidence: 1.0 }],
  ['会计员', { category: 'professional_services', segment: 'consulting', confidence: 1.0 }],
  ['出纳', { category: 'finance', segment: 'commercial_banking', confidence: 1.0 }],
  ['注册会计师', { category: 'professional_services', segment: 'consulting', confidence: 1.0 }],
  ['厨师', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['律师', { category: 'professional_services', segment: 'legal', confidence: 1.0 }],
  ['记者', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['编辑', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['摄影师', { category: 'media_creative', segment: 'marketing', confidence: 1.0 }],
  ['人力资源', { category: 'professional_services', segment: 'consulting', confidence: 1.0 }],
  ['文员', { category: 'professional_services', segment: 'consulting', confidence: 1.0 }],
  ['司机', { category: 'logistics', segment: 'express_delivery', confidence: 1.0 }],
  ['货车司机', { category: 'logistics', segment: 'express_delivery', confidence: 1.0 }],
  ['工人', { category: 'manufacturing', segment: 'consumer_electronics', confidence: 1.0 }],
  ['工厂工人', { category: 'manufacturing', segment: 'consumer_electronics', confidence: 1.0 }],
  ['保安', { category: 'life_services', segment: 'hospitality', confidence: 1.0 }],
  ['清洁工', { category: 'life_services', segment: 'hospitality', confidence: 1.0 }],
  ['服务员', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['收银员', { category: 'consumer_retail', segment: 'retail', confidence: 1.0 }],
  ['快递员', { category: 'logistics', segment: 'express_delivery', confidence: 1.0 }],
  ['外卖员', { category: 'logistics', segment: 'express_delivery', confidence: 1.0 }],
  ['外卖小哥', { category: 'logistics', segment: 'express_delivery', confidence: 1.0 }],
  ['电工', { category: 'construction', segment: 'construction', confidence: 1.0 }],
  ['水电工', { category: 'construction', segment: 'construction', confidence: 1.0 }],
  ['修理工', { category: 'construction', segment: 'construction', confidence: 1.0 }],
  ['装修工', { category: 'construction', segment: 'construction', confidence: 1.0 }],
  ['Angel Investor', { category: 'finance', segment: 'pe_vc', confidence: 1.0 }],
  ['Bartender', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['Sommelier', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['product manager', { category: 'tech', segment: 'product', confidence: 1.0 }],
  ['designer', { category: 'tech', segment: 'product', confidence: 1.0 }],
  ['会记', { category: 'professional_services', segment: 'consulting', confidence: 1.0 }],
  ['投资顾问', { category: 'finance', segment: 'pe_vc', confidence: 1.0 }],
  ['电⼦商務運营', { category: 'consumer_retail', segment: 'ecommerce', confidence: 1.0 }],
  ['电子商务运营', { category: 'consumer_retail', segment: 'ecommerce', confidence: 1.0 }],
  ['E-commerce manager', { category: 'consumer_retail', segment: 'ecommerce', confidence: 1.0 }],
  ['自己开店', { category: 'consumer_retail', segment: 'retail', confidence: 1.0 }],
  ['自己开了家咖啡店', { category: 'consumer_retail', segment: 'food_service', confidence: 1.0 }],
  ['我在剧场演出', { category: 'culture_sports', segment: 'performing_arts', confidence: 1.0 }],
  ['后段开发', { category: 'tech', segment: 'software_dev', confidence: 1.0 }],
]);

// Use merged seed map (auto-generated + manual overrides)
export const INDUSTRY_SEED_MAP = generateMergedSeedMap(MANUAL_OVERRIDES);

export function matchSeed(input: string): SeedMatch | null {
  const normalized = input.trim();
  return INDUSTRY_SEED_MAP.get(normalized) || null;
}
