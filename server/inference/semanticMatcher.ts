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
  getAllSynonymGroups,
  isDirectlyNegated,
  isNegativeSentence
} from './synonyms';
import { chainInference, extractEntities } from './knowledgeGraph';

// ============ 矛盾字段定义 ============
const CONTRADICTORY_VALUES: Record<string, string[][]> = {
  gender: [['男'], ['女']],
  relationshipStatus: [['单身'], ['已婚', '恋爱中'], ['离异']],
  lifeStage: [['学生党'], ['退休享乐'], ['全职爸妈']],
  hasChildren: [['true'], ['false']],
};

/**
 * 去重和清理推断结果
 * 1. 去除完全重复的推断
 * 2. 同一字段保留置信度最高的
 * 3. 检测并解决矛盾值
 */
function deduplicateAndClean(inferences: InferredAttribute[]): InferredAttribute[] {
  const fieldBestInference: Record<string, InferredAttribute> = {};
  
  for (const inf of inferences) {
    const key = inf.field;
    const existing = fieldBestInference[key];
    
    if (!existing) {
      fieldBestInference[key] = inf;
    } else if (inf.confidence > existing.confidence) {
      // 保留置信度更高的
      fieldBestInference[key] = inf;
    } else if (inf.value !== existing.value && inf.confidence === existing.confidence) {
      // 同等置信度但不同值，检查矛盾
      const groups = CONTRADICTORY_VALUES[inf.field];
      if (groups) {
        // 如果是矛盾的值（来自不同组），保留第一个
        let existingGroup = -1;
        let infGroup = -1;
        for (let i = 0; i < groups.length; i++) {
          if (groups[i].includes(existing.value)) existingGroup = i;
          if (groups[i].includes(inf.value)) infGroup = i;
        }
        // 如果来自不同组，是矛盾，保留现有的
        // 如果来自同组或未定义，也保留现有的
      }
    }
    // 否则保留现有的（置信度更高或相等）
  }
  
  return Object.values(fieldBestInference);
}

/**
 * 检测推断结果中的矛盾
 */
function detectContradictions(inferences: InferredAttribute[]): {
  hasContradiction: boolean;
  conflicts: Array<{ field: string; values: string[] }>;
  cleanedInferences: InferredAttribute[];
} {
  // 先去重
  const cleanedInferences = deduplicateAndClean(inferences);
  
  // 检测是否有矛盾被解决
  const originalFieldValues: Record<string, Set<string>> = {};
  for (const inf of inferences) {
    if (!originalFieldValues[inf.field]) {
      originalFieldValues[inf.field] = new Set();
    }
    originalFieldValues[inf.field].add(inf.value);
  }
  
  const conflicts: Array<{ field: string; values: string[] }> = [];
  for (const [field, valuesSet] of Object.entries(originalFieldValues)) {
    const valuesArray = Array.from(valuesSet);
    if (valuesArray.length > 1) {
      const groups = CONTRADICTORY_VALUES[field];
      if (groups) {
        const groupIndices = new Set<number>();
        for (const val of valuesArray) {
          for (let i = 0; i < groups.length; i++) {
            if (groups[i].includes(val)) {
              groupIndices.add(i);
            }
          }
        }
        if (groupIndices.size > 1) {
          conflicts.push({ field, values: valuesArray });
        }
      }
    }
  }
  
  return {
    hasContradiction: conflicts.length > 0,
    conflicts,
    cleanedInferences
  };
}

/**
 * 语义匹配器类
 * 提供快速的基于规则的推断
 */
export class SemanticMatcher {
  
  /**
   * 检测是否为假设语气
   * "如果不是创业的话" → 实际是创业
   * "假如不在深圳" → 实际在深圳
   */
  private isHypotheticalNegation(message: string): boolean {
    const hypotheticalPrefixes = ['如果', '假如', '要是', '若是', '倘若', '假设'];
    const negationWords = ['不是', '不在', '没有', '不做', '没'];
    
    for (const prefix of hypotheticalPrefixes) {
      const prefixIdx = message.indexOf(prefix);
      if (prefixIdx !== -1) {
        // 检查假设词后面是否跟着否定词
        const afterPrefix = message.substring(prefixIdx + prefix.length, prefixIdx + prefix.length + 10);
        for (const neg of negationWords) {
          if (afterPrefix.includes(neg)) {
            return true;  // 假设+否定 = 实际肯定，应该推断
          }
        }
      }
    }
    return false;
  }
  
  /**
   * 检测是否为第三人称陈述（不应推断为用户属性）
   * "我朋友在创业" → 不推断
   * "他在深圳" → 不推断
   */
  private isThirdPersonStatement(message: string): boolean {
    const thirdPersonPatterns = [
      /我(朋友|同事|同学|老公|老婆|爸|妈|哥|姐|弟|妹|闺蜜|兄弟)/,
      /^他(在|是|做|住|有)/,
      /^她(在|是|做|住|有)/,
      /^他们(在|是|做|住|有)/,
      /^她们(在|是|做|住|有)/,
      /朋友(在|是|做|住|有)/,
      /同事(在|是|做|住|有)/,
    ];
    
    for (const pattern of thirdPersonPatterns) {
      if (pattern.test(message)) {
        return true;
      }
    }
    return false;
  }

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
    let inferences: InferredAttribute[] = [];
    const skipQuestions: string[] = [];
    const confirmQuestions: Array<{ field: string; template: string; inferredValue: string }> = [];
    
    // 早期退出：第三人称陈述不推断
    if (this.isThirdPersonStatement(userMessage)) {
      return {
        matched: false,
        inferences: [],
        skipQuestions: [],
        confirmQuestions: [],
        confidence: 0
      };
    }
    
    // 检查否定和时态
    const isNegated = containsNegation(userMessage);
    const temporalContext = getTemporalContext(userMessage);
    const sentenceNegation = isNegativeSentence(userMessage);
    const isHypotheticalNeg = this.isHypotheticalNegation(userMessage);
    
    // 1. 基于规则的快速推断
    for (const rule of QUICK_INFERENCE_RULES) {
      if (this.ruleMatches(userMessage, rule, isNegated, temporalContext)) {
        for (const inference of rule.infers) {
          // 检查是否已经有这个属性
          if (currentState[inference.field]) {
            continue;  // 跳过已知属性
          }
          
          if (inference.value) {
            // 检查关键词是否被直接否定
            const matchedKeyword = this.findMatchedKeyword(userMessage, rule);
            if (matchedKeyword && isDirectlyNegated(userMessage, matchedKeyword)) {
              continue;  // 跳过被否定的推断
            }
            
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
    
    // 2. 知识图谱链式推断（也需要检查否定）
    const chainInferences = chainInference(userMessage);
    for (const inf of chainInferences) {
      // 避免重复
      if (!inferences.some(i => i.field === inf.field) && !currentState[inf.field]) {
        // 检查是否被否定
        if (!this.isInferenceNegated(userMessage, inf)) {
          inferences.push(inf);
        }
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
    
    // 4. 去重与矛盾检测（始终执行）
    const contradictionResult = detectContradictions(inferences);
    inferences = contradictionResult.cleanedInferences;
    
    // 5. 根据置信度决定跳过还是确认
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
   * 找到匹配的关键词
   */
  private findMatchedKeyword(text: string, rule: typeof QUICK_INFERENCE_RULES[0]): string | null {
    if (rule.trigger.type === 'keyword' && rule.trigger.keywords) {
      for (const kw of rule.trigger.keywords) {
        if (text.includes(kw)) {
          return kw;
        }
      }
    } else if (rule.trigger.type === 'pattern' && rule.trigger.pattern) {
      const match = text.match(new RegExp(rule.trigger.pattern));
      if (match) {
        return match[0];
      }
    }
    return null;
  }
  
  /**
   * 检查推断是否被否定
   */
  private isInferenceNegated(text: string, inference: InferredAttribute): boolean {
    // 检查城市是否被否定
    if (inference.field === 'city') {
      return isDirectlyNegated(text, inference.value);
    }
    // 检查其他字段
    return false;
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
