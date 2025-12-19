/**
 * LLM推理器 - 使用Chain-of-Thought进行复杂推断
 * 当快速匹配层无法处理时调用
 */

import OpenAI from 'openai';
import type { InferredAttribute, UserAttributeMap, ConflictInfo } from './types';

// 使用DeepSeek API
const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY || ''
});

// ============ CoT推理提示词 ============

const COT_INFERENCE_PROMPT = `你是用户画像推断专家。基于用户的对话内容，进行三阶段思考，推断用户的隐含属性。

## 当前已知用户信息
{{currentState}}

## 用户最新回答
"{{userMessage}}"

## 对话历史摘要
{{conversationSummary}}

## 第一阶段：信息提取 (Extract)
从用户最新回答中提取明确信息：
- 用户直接说了什么？
- 提到了哪些实体（公司、城市、学校、年龄等）？
- 有没有否定或转折的表达？

## 第二阶段：推理 (Infer)
基于提取的信息，推断隐含属性。常见推断模式：
- "创业/开公司/自己做" → 人生阶段=创业中
- "在读/学生/念书" → 人生阶段=学生党
- "刚毕业/应届" → 人生阶段=职场新人
- "腾讯/阿里/字节" → 行业=互联网/科技
- "留学/海归/从国外回来" → 海归=是，可能会英语
- "老婆/女朋友" → 性别=男
- "老公/男朋友" → 性别=女
- "孩子/儿子/女儿" → 有孩子=是

对每个推断给出：
1. 推断的字段和值
2. 置信度(0-1)：基于证据的直接程度
3. 推断依据：为什么这样推断

## 第三阶段：验证 (Validate)
检查推断是否与已知信息冲突：
- 新推断与之前收集的信息是否矛盾？
- 如果矛盾，应该相信哪个？（通常相信更新的信息）

## 输出要求
必须输出以下JSON格式，不要输出其他内容：
{
  "thinking": "你的思考过程（可选）",
  "extracted": {
    "field1": "value1"
  },
  "inferred": [
    {
      "field": "lifeStage",
      "value": "创业中",
      "confidence": 0.92,
      "evidence": "用户说自己开公司",
      "reasoning": "开公司是创业的直接表达"
    }
  ],
  "conflicts": [
    {
      "field": "city",
      "existingValue": "北京",
      "newValue": "深圳",
      "resolution": "needs_clarification",
      "reason": "之前说在北京，现在提到深圳公司"
    }
  ],
  "skipQuestions": ["lifeStage"],
  "confirmQuestions": [
    {
      "field": "city",
      "template": "你是在深圳工作吗？",
      "inferredValue": "深圳"
    }
  ]
}

## 字段说明
可推断的字段包括：
- lifeStage: 人生阶段（学生党/职场新人/职场老手/创业中/自由职业/退休享乐）
- industry: 行业
- city: 城市
- occupation: 职业
- age: 年龄
- gender: 性别
- isReturnee: 是否海归 (true/false)
- languages: 语言（如：英语、粤语）
- relationshipStatus: 感情状态（单身/恋爱中/已婚/离异）
- hasChildren: 是否有孩子 (true/false)
- education: 学历

## 置信度标准
- 0.9+: 直接明确表达（"我在创业"）
- 0.7-0.9: 强烈暗示（"我开了个小公司"）
- 0.5-0.7: 间接暗示（"在腾讯工作" → 可能在深圳）
- <0.5: 弱推测，不建议使用`;

// ============ LLM推理器类 ============

export interface LLMReasonerResult {
  success: boolean;
  extracted: Record<string, string>;
  inferred: InferredAttribute[];
  conflicts: ConflictInfo[];
  skipQuestions: string[];
  confirmQuestions: Array<{ field: string; template: string; inferredValue: string }>;
  thinking?: string;
  error?: string;
  latencyMs: number;
}

export class LLMReasoner {
  private enabled: boolean;
  private maxLatencyMs: number;
  
  constructor(options?: { enabled?: boolean; maxLatencyMs?: number }) {
    this.enabled = options?.enabled ?? true;
    this.maxLatencyMs = options?.maxLatencyMs ?? 3000;
  }
  
  /**
   * 使用LLM进行推断
   */
  async infer(
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    currentState: UserAttributeMap
  ): Promise<LLMReasonerResult> {
    const startTime = Date.now();
    
    if (!this.enabled || !process.env.DEEPSEEK_API_KEY) {
      return {
        success: false,
        extracted: {},
        inferred: [],
        conflicts: [],
        skipQuestions: [],
        confirmQuestions: [],
        error: 'LLM推理器未启用或缺少API密钥',
        latencyMs: Date.now() - startTime
      };
    }
    
    try {
      // 构建提示词
      const prompt = this.buildPrompt(userMessage, conversationHistory, currentState);
      
      // 调用LLM
      const response = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt }
        ],
        temperature: 0.3,  // 低温度，更确定性的输出
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM返回空内容');
      }
      
      // 解析JSON
      const result = this.parseResponse(content);
      
      return {
        ...result,
        success: true,
        latencyMs: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('LLM推理错误:', error);
      return {
        success: false,
        extracted: {},
        inferred: [],
        conflicts: [],
        skipQuestions: [],
        confirmQuestions: [],
        error: error instanceof Error ? error.message : '未知错误',
        latencyMs: Date.now() - startTime
      };
    }
  }
  
  /**
   * 构建提示词
   */
  private buildPrompt(
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }>,
    currentState: UserAttributeMap
  ): string {
    // 格式化当前状态
    const stateStr = Object.entries(currentState)
      .map(([field, state]) => `- ${field}: ${state.value} (${state.source}, 置信度${state.confidence})`)
      .join('\n') || '暂无';
    
    // 格式化对话历史（最近5轮）
    const recentHistory = conversationHistory.slice(-10);
    const historyStr = recentHistory
      .map(msg => `${msg.role === 'user' ? '用户' : '小悦'}: ${msg.content.slice(0, 100)}`)
      .join('\n') || '暂无';
    
    return COT_INFERENCE_PROMPT
      .replace('{{currentState}}', stateStr)
      .replace('{{userMessage}}', userMessage)
      .replace('{{conversationSummary}}', historyStr);
  }
  
  /**
   * 解析LLM响应
   */
  private parseResponse(content: string): Omit<LLMReasonerResult, 'success' | 'latencyMs' | 'error'> {
    try {
      const data = JSON.parse(content);
      
      return {
        thinking: data.thinking,
        extracted: data.extracted || {},
        inferred: (data.inferred || []).map((inf: any) => ({
          field: inf.field,
          value: inf.value,
          confidence: Math.min(1, Math.max(0, inf.confidence || 0.5)),
          evidence: inf.evidence || '',
          reasoning: inf.reasoning || ''
        })),
        conflicts: (data.conflicts || []).map((c: any) => ({
          field: c.field,
          existingValue: c.existingValue,
          newValue: c.newValue,
          resolution: c.resolution || 'needs_clarification',
          reason: c.reason || ''
        })),
        skipQuestions: data.skipQuestions || [],
        confirmQuestions: data.confirmQuestions || []
      };
    } catch (e) {
      console.error('解析LLM响应失败:', e, content);
      return {
        extracted: {},
        inferred: [],
        conflicts: [],
        skipQuestions: [],
        confirmQuestions: []
      };
    }
  }
}

// 单例导出
export const llmReasoner = new LLMReasoner();
