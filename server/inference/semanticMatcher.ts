/**
 * 语义匹配器 - 快速推断层
 * 处理高频确定性场景，无需调用LLM
 */

import type { InferenceResult, InferredAttribute, UserAttributeMap } from './types';
import { 
  QUICK_INFERENCE_RULES, 
  findCanonicalForm, 
  containsNegation, 
  getTemporalContext,
  getAllSynonymGroups
} from './synonyms';
import { chainInference, extractEntities } from './knowledgeGraph';

/**
 * 语义匹配器类
 * 提供快速的基于规则的推断
 */
export class SemanticMatcher {
  
  /**
   * 快速匹配用户消息，返回可推断的属性
   */
  match(
    userMessage: string, 
    currentState: UserAttributeMap
  ): {
    matched: boolean;
    inferences: InferredAttribute[];
    skipQuestions: string[];
    confirmQuestions: Array<{ field: string; template: string; inferredValue: string }>;
    confidence: number;
  } {
    const inferences: InferredAttribute[] = [];
    const skipQuestions: string[] = [];
    const confirmQuestions: Array<{ field: string; template: string; inferredValue: string }> = [];
    
    // 检查否定和时态
    const isNegated = containsNegation(userMessage);
    const temporalContext = getTemporalContext(userMessage);
    
    // 1. 基于规则的快速推断
    for (const rule of QUICK_INFERENCE_RULES) {
      if (this.ruleMatches(userMessage, rule, isNegated, temporalContext)) {
        for (const inference of rule.infers) {
          // 检查是否已经有这个属性
          if (currentState[inference.field]) {
            continue;  // 跳过已知属性
          }
          
          if (inference.value) {
            inferences.push({
              field: inference.field,
              value: inference.value,
              confidence: inference.confidence,
              evidence: userMessage,
              reasoning: `匹配规则: ${rule.name}`
            });
          }
        }
      }
    }
    
    // 2. 知识图谱链式推断
    const chainInferences = chainInference(userMessage);
    for (const inf of chainInferences) {
      // 避免重复
      if (!inferences.some(i => i.field === inf.field) && !currentState[inf.field]) {
        inferences.push(inf);
      }
    }
    
    // 3. 同义词匹配
    const synonymResult = findCanonicalForm(userMessage);
    if (synonymResult.found && synonymResult.field && synonymResult.value) {
      if (!inferences.some(i => i.field === synonymResult.field) && !currentState[synonymResult.field]) {
        inferences.push({
          field: synonymResult.field,
          value: synonymResult.value,
          confidence: synonymResult.confidence,
          evidence: userMessage,
          reasoning: `同义词匹配: "${synonymResult.canonical}"`
        });
      }
    }
    
    // 4. 根据置信度决定跳过还是确认
    for (const inf of inferences) {
      if (inf.confidence >= 0.85) {
        // 高置信度：直接跳过这个问题
        skipQuestions.push(inf.field);
      } else if (inf.confidence >= 0.6) {
        // 中等置信度：用确认式提问
        confirmQuestions.push({
          field: inf.field,
          template: this.generateConfirmTemplate(inf.field, inf.value),
          inferredValue: inf.value
        });
      }
      // 低置信度：不做任何处理，让正常流程提问
    }
    
    const matched = inferences.length > 0;
    const avgConfidence = matched 
      ? inferences.reduce((sum, i) => sum + i.confidence, 0) / inferences.length 
      : 0;
    
    return {
      matched,
      inferences,
      skipQuestions,
      confirmQuestions,
      confidence: avgConfidence
    };
  }
  
  /**
   * 检查规则是否匹配
   */
  private ruleMatches(
    text: string, 
    rule: typeof QUICK_INFERENCE_RULES[0],
    isNegated: boolean,
    temporalContext: 'past' | 'present' | 'future' | null
  ): boolean {
    // 检查排除模式
    if (rule.excludePatterns) {
      for (const pattern of rule.excludePatterns) {
        if (text.includes(pattern)) {
          return false;
        }
      }
    }
    
    // 如果是过去时态，不匹配（除非规则设置了ignoreTemporal标志）
    // ignoreTemporal用于处理转折句式，如"海归"、"以前...后来自己干"等
    if (temporalContext === 'past' && !rule.ignoreTemporal) {
      return false;
    }
    
    // 检查触发条件
    if (rule.trigger.type === 'keyword' && rule.trigger.keywords) {
      const textLower = text.toLowerCase();
      return rule.trigger.keywords.some(kw => textLower.includes(kw.toLowerCase()));
    }
    
    if (rule.trigger.type === 'pattern' && rule.trigger.pattern) {
      const regex = typeof rule.trigger.pattern === 'string' 
        ? new RegExp(rule.trigger.pattern, 'i')
        : rule.trigger.pattern;
      return regex.test(text);
    }
    
    return false;
  }
  
  /**
   * 生成确认式提问模板
   */
  private generateConfirmTemplate(field: string, value: string): string {
    const templates: Record<string, (v: string) => string> = {
      lifeStage: (v) => `你刚才提到的情况，是不是可以说你目前是"${v}"阶段？`,
      industry: (v) => `听起来你是在${v}行业工作？`,
      city: (v) => `你是在${v}工作/生活吗？`,
      isReturnee: () => `听起来你有海外经历，是海归吗？`,
      gender: (v) => v === '男' ? '你是男生对吧？' : '你是女生对吧？',
      relationshipStatus: (v) => `你目前是${v}的状态？`,
      hasChildren: () => `你有小孩是吗？`,
      languages: (v) => `你会说${v}？`
    };
    
    const generator = templates[field];
    if (generator) {
      return generator(value);
    }
    
    return `确认一下，你的${field}是"${value}"对吗？`;
  }
  
  /**
   * 提取显式信息（用户直接说明的）
   */
  extractExplicit(userMessage: string): Record<string, string> {
    const explicit: Record<string, string> = {};
    
    // 提取实体
    const entities = extractEntities(userMessage);
    
    if (entities.companies.length > 0) {
      explicit.company = entities.companies[0];
    }
    if (entities.schools.length > 0) {
      explicit.school = entities.schools[0];
    }
    if (entities.cities.length > 0) {
      explicit.city = entities.cities[0];
    }
    if (entities.industries.length > 0) {
      explicit.industry = entities.industries[0];
    }
    
    // 提取年龄（如果用户说"我25岁"或"95年的"）
    const ageMatch = userMessage.match(/我?(\d{2})岁/);
    if (ageMatch) {
      explicit.age = ageMatch[1];
    }
    
    const birthYearMatch = userMessage.match(/(\d{2})年的/);
    if (birthYearMatch) {
      const year = parseInt(birthYearMatch[1]);
      const fullYear = year > 50 ? 1900 + year : 2000 + year;
      const age = new Date().getFullYear() - fullYear;
      explicit.age = age.toString();
    }
    
    return explicit;
  }
}

// 单例导出
export const semanticMatcher = new SemanticMatcher();
