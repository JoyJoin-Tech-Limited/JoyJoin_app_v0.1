/**
 * Seed库 - 精确匹配映射表
 * 响应时间目标: <10ms
 */

export interface SeedMatch {
  category: string;
  segment: string;
  niche?: string;
  confidence: number;
}

export const INDUSTRY_SEED_MAP = new Map<string, SeedMatch>([
  // 金融
  ["银行柜员", { category: "finance", segment: "commercial_banking", niche: "bank_teller", confidence: 1.0 }],
  ["柜员", { category: "finance", segment: "commercial_banking", niche: "bank_teller", confidence: 0.95 }],
  ["客户经理", { category: "finance", segment: "commercial_banking", niche: "relationship_manager", confidence: 0.90 }],
  ["理财经理", { category: "finance", segment: "commercial_banking", niche: "relationship_manager", confidence: 0.95 }],
  ["投行", { category: "finance", segment: "investment_banking", confidence: 0.85 }],
  ["PE", { category: "finance", segment: "pe_vc", niche: "private_equity", confidence: 0.90 }],
  ["VC", { category: "finance", segment: "pe_vc", niche: "venture_capital", confidence: 0.90 }],
  ["精算师", { category: "finance", segment: "insurance", niche: "actuary", confidence: 1.0 }],
  
  // 科技
  ["前端工程师", { category: "tech", segment: "software_dev", niche: "frontend", confidence: 1.0 }],
  ["前端开发", { category: "tech", segment: "software_dev", niche: "frontend", confidence: 1.0 }],
  ["后端工程师", { category: "tech", segment: "software_dev", niche: "backend", confidence: 1.0 }],
  ["后端开发", { category: "tech", segment: "software_dev", niche: "backend", confidence: 1.0 }],
  ["全栈工程师", { category: "tech", segment: "software_dev", niche: "fullstack", confidence: 1.0 }],
  ["产品经理", { category: "tech", segment: "product", niche: "product_manager", confidence: 0.95 }],
  ["PM", { category: "tech", segment: "product", niche: "product_manager", confidence: 0.85 }],
  ["UI设计师", { category: "tech", segment: "design", niche: "ui_designer", confidence: 1.0 }],
  ["UX设计师", { category: "tech", segment: "design", niche: "ux_designer", confidence: 1.0 }],
  ["医疗AI", { category: "tech", segment: "ai_ml", niche: "medical_ai", confidence: 1.0 }],
  ["大模型", { category: "tech", segment: "ai_ml", niche: "llm_research", confidence: 0.90 }],
  ["LLM", { category: "tech", segment: "ai_ml", niche: "llm_research", confidence: 0.95 }],
  
  // 制造
  ["生产线工人", { category: "manufacturing", segment: "consumer_electronics", niche: "assembly_worker", confidence: 0.90 }],
  ["流水线", { category: "manufacturing", segment: "consumer_electronics", niche: "assembly_worker", confidence: 0.85 }],
  ["操作工", { category: "manufacturing", segment: "consumer_electronics", niche: "assembly_worker", confidence: 0.80 }],
  
  // 消费/零售
  ["服务员", { category: "consumer_retail", segment: "food_service", niche: "waiter", confidence: 0.90 }],
  ["餐厅服务员", { category: "consumer_retail", segment: "food_service", niche: "waiter", confidence: 1.0 }],
  ["厨师", { category: "consumer_retail", segment: "food_service", niche: "chef", confidence: 0.95 }],
  
  // 房地产
  ["房产中介", { category: "real_estate", segment: "real_estate_sales", niche: "agent", confidence: 1.0 }],
  ["地产经纪", { category: "real_estate", segment: "real_estate_sales", niche: "agent", confidence: 1.0 }],
  ["建筑工人", { category: "real_estate", segment: "construction", niche: "construction_worker", confidence: 0.90 }],
  
  // 医疗
  ["医生", { category: "healthcare", segment: "medical_services", niche: "doctor", confidence: 0.95 }],
  ["护士", { category: "healthcare", segment: "medical_services", niche: "nurse", confidence: 1.0 }],
  ["药剂师", { category: "healthcare", segment: "medical_services", niche: "pharmacist", confidence: 1.0 }],
  
  // 教育
  ["老师", { category: "education", segment: "k12", niche: "teacher", confidence: 0.90 }],
  ["教师", { category: "education", segment: "k12", niche: "teacher", confidence: 0.95 }],
  
  // 专业服务
  ["律师", { category: "professional_services", segment: "legal", niche: "lawyer", confidence: 0.95 }],
  ["咨询顾问", { category: "professional_services", segment: "consulting", niche: "consultant", confidence: 0.90 }],
  
  // 物流
  ["快递员", { category: "logistics", segment: "express_delivery", niche: "courier", confidence: 1.0 }],
  ["送货员", { category: "logistics", segment: "express_delivery", niche: "courier", confidence: 0.95 }],
  ["配送员", { category: "logistics", segment: "express_delivery", niche: "courier", confidence: 0.95 }],
  
  // 政府
  ["公务员", { category: "government_public", segment: "civil_service", niche: "government", confidence: 0.95 }],
]);

export function matchSeed(input: string): SeedMatch | null {
  const normalized = input.trim();
  return INDUSTRY_SEED_MAP.get(normalized) || null;
}
