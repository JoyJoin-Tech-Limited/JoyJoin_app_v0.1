/**
 * 混合语义策略 (方案C)
 * 李明远专家建议：简单特征用正则，复杂语义调用DeepSeek
 * 仅对低置信度特征补充分析，控制成本
 */

import OpenAI from 'openai';
import type { InferredAttribute } from './types';

const CONFIDENCE_THRESHOLD = 0.6;
const MAX_LLM_CALLS_PER_USER = 3;

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

interface SemanticAnalysisResult {
  field: string;
  value: string;
  confidence: number;
  source: 'regex' | 'llm';
  reasoning?: string;
}

export async function analyzeComplexSemantics(
  text: string,
  lowConfidenceAttributes: InferredAttribute[]
): Promise<SemanticAnalysisResult[]> {
  if (lowConfidenceAttributes.length === 0) {
    return [];
  }

  const attributesToAnalyze = lowConfidenceAttributes
    .filter(attr => attr.confidence < CONFIDENCE_THRESHOLD)
    .slice(0, MAX_LLM_CALLS_PER_USER);

  if (attributesToAnalyze.length === 0) {
    return [];
  }

  const results: SemanticAnalysisResult[] = [];

  const batchPrompt = buildBatchPrompt(text, attributesToAnalyze);
  
  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SEMANTIC_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: batchPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    if (parsed.analyses && Array.isArray(parsed.analyses)) {
      for (const analysis of parsed.analyses) {
        if (analysis.field && analysis.value && analysis.confidence) {
          results.push({
            field: analysis.field,
            value: analysis.value,
            confidence: Math.min(0.95, analysis.confidence),
            source: 'llm',
            reasoning: analysis.reasoning,
          });
        }
      }
    }
  } catch (error) {
    console.error('[HybridSemantic] LLM analysis failed:', error);
  }

  return results;
}

function buildBatchPrompt(text: string, attributes: InferredAttribute[]): string {
  const fieldsToAnalyze = attributes.map(a => `- ${a.field}: 当前推断"${a.value}"，置信度${(a.confidence * 100).toFixed(0)}%`).join('\n');
  
  return `请分析以下用户对话文本，验证或纠正这些低置信度的属性推断：

用户对话摘要：
"${text.slice(0, 500)}"

需要分析的属性：
${fieldsToAnalyze}

请以JSON格式返回分析结果：
{
  "analyses": [
    {
      "field": "属性名",
      "value": "推断值",
      "confidence": 0.0-1.0,
      "reasoning": "简短推理依据"
    }
  ]
}`;
}

const SEMANTIC_ANALYSIS_SYSTEM_PROMPT = `你是一个精准的语义分析专家，专门分析用户对话中的隐含信息。

分析原则：
1. 只根据文本中的实际线索进行推断
2. 如果证据不足，降低置信度而不是强行推断
3. 注意中文语境下的隐喻、反讽、客套话
4. 区分事实陈述和假设/愿望表达
5. 考虑粤语/港式中文的特殊表达

输出要求：
- confidence 0.8+：有明确文字支持
- confidence 0.6-0.8：有强烈暗示但非直接陈述
- confidence 0.4-0.6：有一定线索但存在歧义
- confidence <0.4：证据不足，不建议采用`;

export function shouldUseLLM(attributes: InferredAttribute[]): boolean {
  const lowConfidence = attributes.filter(a => a.confidence < CONFIDENCE_THRESHOLD);
  return lowConfidence.length > 0;
}

export function mergeWithLLMResults(
  regexResults: InferredAttribute[],
  llmResults: SemanticAnalysisResult[]
): InferredAttribute[] {
  const merged = [...regexResults];
  
  for (const llmResult of llmResults) {
    const existingIndex = merged.findIndex(r => r.field === llmResult.field);
    
    if (existingIndex >= 0) {
      if (llmResult.confidence > merged[existingIndex].confidence) {
        merged[existingIndex] = {
          field: llmResult.field,
          value: llmResult.value,
          confidence: llmResult.confidence,
          evidence: `hybrid_llm: ${llmResult.reasoning || ''}`,
        };
      }
    } else {
      merged.push({
        field: llmResult.field,
        value: llmResult.value,
        confidence: llmResult.confidence,
        evidence: `hybrid_llm: ${llmResult.reasoning || ''}`,
      });
    }
  }
  
  return merged;
}

interface AnalysisStats {
  regexOnlyCount: number;
  llmEnhancedCount: number;
  avgConfidenceImprovement: number;
}

let analysisStats: AnalysisStats = {
  regexOnlyCount: 0,
  llmEnhancedCount: 0,
  avgConfidenceImprovement: 0,
};

export function recordAnalysis(usedLLM: boolean, confidenceImprovement: number = 0): void {
  if (usedLLM) {
    analysisStats.llmEnhancedCount++;
    const totalImprovement = analysisStats.avgConfidenceImprovement * (analysisStats.llmEnhancedCount - 1) + confidenceImprovement;
    analysisStats.avgConfidenceImprovement = totalImprovement / analysisStats.llmEnhancedCount;
  } else {
    analysisStats.regexOnlyCount++;
  }
}

export function getAnalysisStats(): AnalysisStats & { llmUsageRate: string } {
  const total = analysisStats.regexOnlyCount + analysisStats.llmEnhancedCount;
  return {
    ...analysisStats,
    llmUsageRate: total > 0 
      ? `${(analysisStats.llmEnhancedCount / total * 100).toFixed(1)}%`
      : '0%',
  };
}

export default {
  analyzeComplexSemantics,
  shouldUseLLM,
  mergeWithLLMResults,
  recordAnalysis,
  getAnalysisStats,
};
