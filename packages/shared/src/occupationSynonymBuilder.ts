/**
 * Comprehensive Synonym Builder for Occupations
 * 
 * Automatically generates exhaustive synonym lists for better fuzzy matching
 */

import type { Occupation } from '@shared/occupations';

/**
 * Build comprehensive synonyms for an occupation
 * Includes: displayName, existing synonyms, and reverse-mapped terms
 */
export function buildComprehensiveSynonyms(occupation: Occupation): string[] {
  const synonyms = [...occupation.synonyms];
  
  // Always include displayName
  if (!synonyms.includes(occupation.displayName)) {
    synonyms.push(occupation.displayName);
  }
  
  // Add common variations
  const variations = generateCommonVariations(occupation.displayName);
  for (const variation of variations) {
    if (!synonyms.includes(variation)) {
      synonyms.push(variation);
    }
  }
  
  // Deduplicate and return
  return [...new Set(synonyms)];
}

/**
 * Generate common variations of occupation name
 */
function generateCommonVariations(displayName: string): string[] {
  const variations: string[] = [];
  
  // Add variants with/without "师"/"员"
  if (displayName.endsWith('师')) {
    const base = displayName.slice(0, -1);
    variations.push(base);
  }
  if (displayName.endsWith('员')) {
    const base = displayName.slice(0, -1);
    variations.push(base);
  }
  
  // Add variants with/without "工程师"
  if (displayName.includes('工程师')) {
    variations.push(displayName.replace('工程师', ''));
    variations.push(displayName.replace('工程师', '开发'));
  }
  
  // Add variants with/without "经理"
  if (displayName.includes('经理')) {
    variations.push(displayName.replace('经理', ''));
  }
  
  return variations;
}

/**
 * Get top missing Chinese terms for known occupations
 * Based on common user inputs that should map to existing occupations
 */
export const MISSING_CHINESE_TERMS: Record<string, string[]> = {
  // Illustrator - 插画师 (Issue: https://github.com/JoyJoin-Tech-Limited/JoyJoin_app_v0.1/issues/XXX)
  // This was identified during industry classification testing where "插画师" was incorrectly 
  // mapped to sports instead of creative/design
  'illustrator': ['插画师'],
  
  // Dancer - 舞蹈演员
  'dancer': ['舞蹈演员', '舞者'],
  
  // Actor - 演员
  'actor': ['演员'],
  
  // Pilot - 飞行员
  'pilot': ['飞行员'],
  
  // Investment Banker - 投资银行相关
  'investment_banker': ['投资银行', '投行'],
  
  // Frontend Engineer
  'frontend_engineer': ['前端', '前端开发'],
  
  // Backend Engineer
  'backend_engineer': ['后端', '后端开发'],
  
  // Product Manager
  'product_manager': ['产品', '产品经理'],
  
  // Data Analyst
  'data_analyst': ['数据分析', '分析师'],
  
  // Accountant
  'accountant': ['会计', '会计师'],
  
  // Banker
  'banker': ['银行', '银行职员'],
  
  // Teacher
  'teacher': ['老师', '教师'],
  
  // Doctor
  'doctor': ['医生', '大夫'],
  
  // Nurse
  'nurse': ['护士'],
  
  // Lawyer
  'lawyer': ['律师'],
  
  // Designer
  'graphic_designer': ['设计', '设计师'],
  
  // Photographer
  'photographer': ['摄影', '摄影师'],
  
  // Marketing
  'marketing_manager': ['市场', '营销'],
  
  // Sales
  'sales_manager': ['销售'],
  
  // Software Engineer
  'software_engineer': ['程序员', '开发', '工程师'],
  
  // AI Engineer
  'ai_engineer': ['AI', '人工智能'],
  
  // Content Creator
  'content_creator': ['博主', '自媒体'],
  
  // HR
  'hr_manager': ['人事', 'HR'],
  
  // Chef
  'chef': ['厨师'],
  
  // Fitness Trainer
  'fitness_trainer': ['健身教练', '教练'],
  
  // Barista
  'barista': ['咖啡师'],
  
  // Driver
  'driver': ['司机', '驾驶员'],
  
  // Courier
  'courier': ['快递员', '外卖员'],
  
  // Real Estate Agent
  'real_estate_agent': ['房产中介', '中介'],
  
  // Financial Analyst
  'finance_analyst': ['金融分析', '分析师'],
  
  // Consultant
  'management_consultant': ['咨询', '顾问'],
  
  // Entrepreneur
  'founder': ['创业', '老板'],
  
  // Student
  'student': ['学生'],
  
  // Retired
  'retired': ['退休'],
  
  // Unemployed
  'unemployed': ['待业', '求职'],
  
  // Freelancer
  'freelancer': ['自由职业', '自由职业者'],
  
  // Artist
  'artist': ['艺术家'],
  
  // Musician
  'musician': ['音乐人', '歌手'],
  
  // Writer
  'writer': ['作家', '写手'],
  
  // Journalist
  'journalist': ['记者'],
  
  // Therapist
  'therapist': ['心理咨询', '咨询师'],
  
  // Architect
  'architect': ['建筑师'],
  
  // Engineer (general)
  'engineer': ['工程师'],
};

/**
 * Apply missing Chinese terms to occupations
 */
export function applyMissingTerms(occupations: Occupation[]): Occupation[] {
  return occupations.map(occ => {
    const missingTerms = MISSING_CHINESE_TERMS[occ.id];
    if (missingTerms) {
      const currentSynonyms = new Set(occ.synonyms);
      const newSynonyms = missingTerms.filter(term => !currentSynonyms.has(term));
      
      if (newSynonyms.length > 0) {
        return {
          ...occ,
          synonyms: [...occ.synonyms, ...newSynonyms],
        };
      }
    }
    return occ;
  });
}
