/**
 * 状态管理器 - 管理用户属性状态
 * 处理属性更新、冲突检测、置信度管理
 */

import type { 
  UserAttributeMap, 
  AttributeState, 
  InferredAttribute, 
  ConflictInfo,
  InferenceResult,
  ExtractedValue
} from './types';

export class StateManager {
  /**
   * 更新状态：合并新的显式信息
   * 支持 string | number | boolean | string[] 类型
   */
  updateExplicit(
    currentState: UserAttributeMap,
    extracted: Record<string, ExtractedValue>
  ): UserAttributeMap {
    const newState = { ...currentState };
    
    for (const [field, value] of Object.entries(extracted)) {
      // 跳过 null/undefined
      if (value === null || value === undefined) continue;
      
      // 按类型分支处理
      let finalValue: ExtractedValue;
      
      if (typeof value === 'string') {
        // 字符串：trim 后检查是否为空
        const trimmed = value.trim();
        if (!trimmed) continue;
        finalValue = trimmed;
      } else if (typeof value === 'number') {
        // 数字：直接使用（如 birthYear: 1996）
        finalValue = value;
      } else if (typeof value === 'boolean') {
        // 布尔值：直接使用
        finalValue = value;
      } else if (Array.isArray(value)) {
        // 数组：过滤空值并 trim 字符串元素
        const filtered = value
          .map(v => typeof v === 'string' ? v.trim() : v)
          .filter(v => v && (typeof v !== 'string' || v.length > 0));
        if (filtered.length === 0) continue;
        finalValue = filtered;
      } else {
        // 未知类型跳过
        continue;
      }
      
      newState[field] = {
        value: finalValue,
        source: 'explicit',
        confidence: 1.0,  // 显式信息置信度为1
        evidence: '用户直接提供',
        timestamp: new Date()
      };
    }
    
    return newState;
  }
  
  /**
   * 更新状态：合并推断的属性
   */
  updateInferred(
    currentState: UserAttributeMap,
    inferred: InferredAttribute[]
  ): { newState: UserAttributeMap; conflicts: ConflictInfo[] } {
    const newState = { ...currentState };
    const conflicts: ConflictInfo[] = [];
    
    for (const inf of inferred) {
      const existing = currentState[inf.field];
      
      if (existing) {
        // 已有值，检查是否冲突
        if (existing.value !== inf.value) {
          // 值不同，检测冲突
          const conflict = this.resolveConflict(existing, inf);
          conflicts.push(conflict);
          
          if (conflict.resolution === 'use_new') {
            // 使用新值
            newState[inf.field] = {
              value: inf.value,
              source: 'inferred',
              confidence: inf.confidence,
              evidence: inf.evidence,
              timestamp: new Date()
            };
          }
          // keep_existing 或 needs_clarification 不更新
        }
        // 值相同，可能提升置信度
        else if (inf.confidence > existing.confidence) {
          newState[inf.field] = {
            ...existing,
            confidence: Math.min(1, existing.confidence + 0.1),
            timestamp: new Date()
          };
        }
      } else {
        // 新属性，直接添加
        newState[inf.field] = {
          value: inf.value,
          source: 'inferred',
          confidence: inf.confidence,
          evidence: inf.evidence,
          timestamp: new Date()
        };
      }
    }
    
    return { newState, conflicts };
  }
  
  /**
   * 冲突解决策略
   */
  private resolveConflict(
    existing: AttributeState,
    newInference: InferredAttribute
  ): ConflictInfo {
    // 策略1：显式信息优先于推断
    if (existing.source === 'explicit' && newInference.confidence < 0.95) {
      return {
        field: newInference.field,
        existingValue: String(existing.value),
        newValue: newInference.value,
        resolution: 'keep_existing',
        reason: '已有用户直接提供的信息，保持不变'
      };
    }
    
    // 策略2：高置信度新信息可以覆盖低置信度旧信息
    if (newInference.confidence > existing.confidence + 0.2) {
      return {
        field: newInference.field,
        existingValue: String(existing.value),
        newValue: newInference.value,
        resolution: 'use_new',
        reason: '新推断置信度显著更高'
      };
    }
    
    // 策略3：时间较新的信息可能更准确
    const existingAge = Date.now() - existing.timestamp.getTime();
    if (existingAge > 5 * 60 * 1000 && newInference.confidence >= 0.7) {
      // 旧信息超过5分钟，新信息置信度足够高
      return {
        field: newInference.field,
        existingValue: String(existing.value),
        newValue: newInference.value,
        resolution: 'use_new',
        reason: '新信息更近期，可能反映变化'
      };
    }
    
    // 默认：需要澄清
    return {
      field: newInference.field,
      existingValue: String(existing.value),
      newValue: newInference.value,
      resolution: 'needs_clarification',
      reason: '信息冲突，需要向用户确认'
    };
  }
  
  /**
   * 生成上下文摘要（注入到小悦提示词）
   */
  generateContextDigest(state: UserAttributeMap): string {
    const lines: string[] = ['## 已收集的用户信息'];
    
    const highConfidence: string[] = [];
    const mediumConfidence: string[] = [];
    
    for (const [field, attr] of Object.entries(state)) {
      const fieldName = this.getFieldDisplayName(field);
      const sourceLabel = attr.source === 'explicit' ? '用户说的' : '推断的';
      
      if (attr.confidence >= 0.85) {
        highConfidence.push(`- ${fieldName}: ${attr.value} (${sourceLabel})`);
      } else if (attr.confidence >= 0.6) {
        mediumConfidence.push(`- ${fieldName}: 可能是"${attr.value}" (待确认)`);
      }
    }
    
    if (highConfidence.length > 0) {
      lines.push('### 已确认信息（不要重复问）');
      lines.push(...highConfidence);
    }
    
    if (mediumConfidence.length > 0) {
      lines.push('### 待确认信息（可以简单确认）');
      lines.push(...mediumConfidence);
    }
    
    if (highConfidence.length === 0 && mediumConfidence.length === 0) {
      lines.push('暂无已收集信息');
    }
    
    return lines.join('\n');
  }
  
  /**
   * 生成跳过问题列表
   */
  generateSkipList(state: UserAttributeMap, threshold: number = 0.85): string[] {
    return Object.entries(state)
      .filter(([_, attr]) => attr.confidence >= threshold)
      .map(([field, _]) => field);
  }
  
  /**
   * 生成确认问题列表
   */
  generateConfirmList(
    state: UserAttributeMap, 
    minThreshold: number = 0.6,
    maxThreshold: number = 0.85
  ): Array<{ field: string; template: string; value: string }> {
    return Object.entries(state)
      .filter(([_, attr]) => attr.confidence >= minThreshold && attr.confidence < maxThreshold)
      .map(([field, attr]) => ({
        field,
        template: this.generateConfirmTemplate(field, String(attr.value)),
        value: String(attr.value)
      }));
  }
  
  /**
   * 字段显示名称
   */
  private getFieldDisplayName(field: string): string {
    const names: Record<string, string> = {
      lifeStage: '人生阶段',
      industry: '行业',
      city: '城市',
      occupation: '职业',
      age: '年龄',
      gender: '性别',
      isReturnee: '海归经历',
      languages: '语言',
      relationshipStatus: '感情状态',
      hasChildren: '有无孩子',
      education: '学历',
      company: '公司',
      school: '学校'
    };
    return names[field] || field;
  }
  
  /**
   * 生成确认式提问模板
   */
  private generateConfirmTemplate(field: string, value: string): string {
    const templates: Record<string, (v: string) => string> = {
      lifeStage: (v) => `你目前应该是"${v}"阶段对吧？`,
      industry: (v) => `你是在${v}行业？`,
      city: (v) => `你在${v}工作/生活是吗？`,
      isReturnee: () => `你有海外留学经历？`,
      gender: (v) => v === '男' ? '你是男生？' : '你是女生？',
      relationshipStatus: (v) => `感情状态是${v}？`,
      hasChildren: (v) => v === 'true' ? '你有小孩？' : '还没有小孩？',
      languages: (v) => `你会说${v}？`
    };
    
    const generator = templates[field];
    return generator ? generator(value) : `你的${this.getFieldDisplayName(field)}是"${value}"？`;
  }
  
  /**
   * 合并推断结果到最终输出
   */
  reconcile(
    matcherResult: {
      inferences: InferredAttribute[];
      skipQuestions: string[];
      confirmQuestions: Array<{ field: string; template: string; inferredValue: string }>;
    },
    llmResult: {
      extracted: Record<string, ExtractedValue>;
      inferred: InferredAttribute[];
      conflicts: ConflictInfo[];
      skipQuestions: string[];
      confirmQuestions: Array<{ field: string; template: string; inferredValue: string }>;
    } | null,
    currentState: UserAttributeMap
  ): InferenceResult & { newState: UserAttributeMap } {
    // 合并显式提取
    const extracted = llmResult?.extracted || {};
    
    // 合并推断（去重，优先LLM结果）
    const allInferences = [...matcherResult.inferences];
    if (llmResult) {
      for (const inf of llmResult.inferred) {
        if (!allInferences.some(i => i.field === inf.field)) {
          allInferences.push(inf);
        }
      }
    }
    
    // 更新状态
    let newState = this.updateExplicit(currentState, extracted);
    const { newState: inferredState, conflicts: stateConflicts } = this.updateInferred(newState, allInferences);
    newState = inferredState;
    
    // 合并冲突
    const allConflicts = [...stateConflicts];
    if (llmResult) {
      for (const c of llmResult.conflicts) {
        if (!allConflicts.some(ec => ec.field === c.field)) {
          allConflicts.push(c);
        }
      }
    }
    
    // 合并跳过列表（去重）
    const skipSet = new Set([
      ...matcherResult.skipQuestions,
      ...(llmResult?.skipQuestions || []),
      ...this.generateSkipList(newState)
    ]);
    
    // 合并确认问题（去重，排除已跳过的）
    const confirmMap = new Map<string, { field: string; template: string; inferredValue: string }>();
    for (const q of matcherResult.confirmQuestions) {
      if (!skipSet.has(q.field)) {
        confirmMap.set(q.field, q);
      }
    }
    if (llmResult) {
      for (const q of llmResult.confirmQuestions) {
        if (!skipSet.has(q.field) && !confirmMap.has(q.field)) {
          confirmMap.set(q.field, q);
        }
      }
    }
    
    return {
      extracted,
      inferred: allInferences,
      conflicts: allConflicts,
      skipQuestions: Array.from(skipSet),
      confirmQuestions: Array.from(confirmMap.values()),
      newState
    };
  }
}

// 单例导出
export const stateManager = new StateManager();
