/**
 * 评估器 - A/B测试推断引擎效果
 * 对比旧系统和新推断引擎的表现
 */

import type { 
  SimulatedScenario, 
  EvaluationMetrics,
  InferredAttribute,
  UserAttributeMap
} from './types';
import { inferenceEngine, type InferenceEngineResult } from './engine';
import { TEST_SCENARIOS } from './scenarios';

// ============ 评估结果类型 ============

interface ScenarioEvaluation {
  scenarioId: string;
  persona: string;
  linguisticStyle: string;
  
  // 推断结果
  correctInferences: InferredAttribute[];
  incorrectInferences: InferredAttribute[];
  missedInferences: InferredAttribute[];
  
  // 重复问题检测
  duplicateQuestionsAvoided: string[];  // 成功避免的重复问题
  duplicateQuestionsAsked: string[];    // 仍然会问的重复问题
  
  // 性能
  totalLatencyMs: number;
  llmCalled: boolean;
}

interface EvaluationReport {
  timestamp: Date;
  totalScenarios: number;
  metrics: EvaluationMetrics;
  scenarioResults: ScenarioEvaluation[];
  
  // 典型案例
  bestCases: ScenarioEvaluation[];
  worstCases: ScenarioEvaluation[];
  
  // 改进建议
  recommendations: string[];
}

// ============ 评估器类 ============

export class InferenceEvaluator {
  
  /**
   * 运行完整评估
   */
  async evaluate(scenarios: SimulatedScenario[] = TEST_SCENARIOS): Promise<EvaluationReport> {
    console.log(`[Evaluator] 开始评估 ${scenarios.length} 个场景...`);
    
    const scenarioResults: ScenarioEvaluation[] = [];
    
    for (const scenario of scenarios) {
      const result = await this.evaluateScenario(scenario);
      scenarioResults.push(result);
    }
    
    // 计算汇总指标
    const metrics = this.calculateMetrics(scenarioResults);
    
    // 找出最好和最差的案例
    const sortedByAccuracy = [...scenarioResults].sort((a, b) => {
      const aAccuracy = a.correctInferences.length / (a.correctInferences.length + a.incorrectInferences.length + a.missedInferences.length);
      const bAccuracy = b.correctInferences.length / (b.correctInferences.length + b.incorrectInferences.length + b.missedInferences.length);
      return bAccuracy - aAccuracy;
    });
    
    const bestCases = sortedByAccuracy.slice(0, 5);
    const worstCases = sortedByAccuracy.slice(-5).reverse();
    
    // 生成改进建议
    const recommendations = this.generateRecommendations(metrics, scenarioResults);
    
    const report: EvaluationReport = {
      timestamp: new Date(),
      totalScenarios: scenarios.length,
      metrics,
      scenarioResults,
      bestCases,
      worstCases,
      recommendations
    };
    
    console.log(`[Evaluator] 评估完成！准确率: ${(metrics.inferenceAccuracy * 100).toFixed(1)}%, 重复问题率: ${(metrics.duplicateQuestionRate * 100).toFixed(1)}%`);
    
    return report;
  }
  
  /**
   * 评估单个场景
   */
  private async evaluateScenario(scenario: SimulatedScenario): Promise<ScenarioEvaluation> {
    const correctInferences: InferredAttribute[] = [];
    const incorrectInferences: InferredAttribute[] = [];
    const missedInferences: InferredAttribute[] = [];
    const duplicateQuestionsAvoided: string[] = [];
    const duplicateQuestionsAsked: string[] = [];
    
    let currentState: UserAttributeMap = {};
    let totalLatencyMs = 0;
    let llmCalled = false;
    
    // 模拟对话流程
    const conversationHistory: Array<{ role: string; content: string }> = [];
    
    for (const turn of scenario.dialogue) {
      if (turn.role === 'user') {
        // 运行推断引擎
        const result = await inferenceEngine.process(
          turn.content,
          conversationHistory,
          currentState,
          scenario.id
        );
        
        // 更新状态
        currentState = result.newState;
        totalLatencyMs += result.debug.totalLatencyMs;
        if (result.debug.llmCalled) llmCalled = true;
        
        // 记录对话历史
        conversationHistory.push({ role: 'user', content: turn.content });
        
        // 检查这轮的推断结果
        if (turn.containsInferableInfo) {
          for (const expected of turn.containsInferableInfo) {
            // 查找是否有对应的推断
            const actualInference = result.inferred.find(i => i.field === expected.field);
            
            if (actualInference) {
              if (actualInference.value === expected.value) {
                correctInferences.push(actualInference);
              } else {
                incorrectInferences.push(actualInference);
              }
            }
          }
        }
      }
    }
    
    // 检查遗漏的推断
    for (const expected of scenario.expectedInferences) {
      const wasInferred = correctInferences.some(i => i.field === expected.field);
      const wasWrong = incorrectInferences.some(i => i.field === expected.field);
      
      if (!wasInferred && !wasWrong) {
        missedInferences.push(expected);
      }
    }
    
    // 检查重复问题
    for (const field of scenario.potentialDuplicateQuestions) {
      if (currentState[field] && currentState[field].confidence >= 0.85) {
        duplicateQuestionsAvoided.push(field);
      } else {
        duplicateQuestionsAsked.push(field);
      }
    }
    
    return {
      scenarioId: scenario.id,
      persona: scenario.profile.persona,
      linguisticStyle: scenario.profile.linguisticStyle,
      correctInferences,
      incorrectInferences,
      missedInferences,
      duplicateQuestionsAvoided,
      duplicateQuestionsAsked,
      totalLatencyMs,
      llmCalled
    };
  }
  
  /**
   * 计算汇总指标
   */
  private calculateMetrics(results: ScenarioEvaluation[]): EvaluationMetrics {
    let totalInferences = 0;
    let correctInferences = 0;
    let incorrectInferences = 0;
    let missedInferences = 0;
    let totalDuplicateAvoided = 0;
    let totalDuplicateAsked = 0;
    
    const byPersona: Record<string, { correct: number; total: number; duplicateAsked: number; duplicateTotal: number }> = {};
    const byStyle: Record<string, { correct: number; total: number; duplicateAsked: number; duplicateTotal: number }> = {};
    
    for (const result of results) {
      const correct = result.correctInferences.length;
      const incorrect = result.incorrectInferences.length;
      const missed = result.missedInferences.length;
      const avoided = result.duplicateQuestionsAvoided.length;
      const asked = result.duplicateQuestionsAsked.length;
      
      totalInferences += correct + incorrect + missed;
      correctInferences += correct;
      incorrectInferences += incorrect;
      missedInferences += missed;
      totalDuplicateAvoided += avoided;
      totalDuplicateAsked += asked;
      
      // 按人设分类
      if (!byPersona[result.persona]) {
        byPersona[result.persona] = { correct: 0, total: 0, duplicateAsked: 0, duplicateTotal: 0 };
      }
      byPersona[result.persona].correct += correct;
      byPersona[result.persona].total += correct + incorrect + missed;
      byPersona[result.persona].duplicateAsked += asked;
      byPersona[result.persona].duplicateTotal += asked + avoided;
      
      // 按语言风格分类
      if (!byStyle[result.linguisticStyle]) {
        byStyle[result.linguisticStyle] = { correct: 0, total: 0, duplicateAsked: 0, duplicateTotal: 0 };
      }
      byStyle[result.linguisticStyle].correct += correct;
      byStyle[result.linguisticStyle].total += correct + incorrect + missed;
      byStyle[result.linguisticStyle].duplicateAsked += asked;
      byStyle[result.linguisticStyle].duplicateTotal += asked + avoided;
    }
    
    const totalDuplicate = totalDuplicateAvoided + totalDuplicateAsked;
    
    return {
      duplicateQuestionRate: totalDuplicate > 0 ? totalDuplicateAsked / totalDuplicate : 0,
      inferenceAccuracy: totalInferences > 0 ? correctInferences / totalInferences : 0,
      inferenceCoverage: totalInferences > 0 ? correctInferences / (correctInferences + missedInferences) : 0,
      averageDialogueTurns: 0,  // TODO: 实现
      
      totalScenarios: results.length,
      totalInferences,
      correctInferences,
      incorrectInferences,
      missedInferences,
      duplicateQuestionsAsked: totalDuplicateAsked,
      
      byPersona: Object.fromEntries(
        Object.entries(byPersona).map(([k, v]) => [k, {
          accuracy: v.total > 0 ? v.correct / v.total : 0,
          duplicateRate: v.duplicateTotal > 0 ? v.duplicateAsked / v.duplicateTotal : 0
        }])
      ),
      
      byLinguisticStyle: Object.fromEntries(
        Object.entries(byStyle).map(([k, v]) => [k, {
          accuracy: v.total > 0 ? v.correct / v.total : 0,
          duplicateRate: v.duplicateTotal > 0 ? v.duplicateAsked / v.duplicateTotal : 0
        }])
      )
    };
  }
  
  /**
   * 生成改进建议
   */
  private generateRecommendations(metrics: EvaluationMetrics, results: ScenarioEvaluation[]): string[] {
    const recommendations: string[] = [];
    
    // 根据指标生成建议
    if (metrics.duplicateQuestionRate > 0.3) {
      recommendations.push('重复问题率较高，建议增加更多同义词映射或提升快速匹配层覆盖率');
    }
    
    if (metrics.inferenceAccuracy < 0.7) {
      recommendations.push('推断准确率有待提高，建议检查规则逻辑和LLM提示词');
    }
    
    if (metrics.inferenceCoverage < 0.6) {
      recommendations.push('推断覆盖率较低，可能需要增加更多推断规则');
    }
    
    // 检查按风格的表现
    for (const [style, data] of Object.entries(metrics.byLinguisticStyle)) {
      if (data.accuracy < 0.5) {
        recommendations.push(`"${style}"风格的准确率较低(${(data.accuracy * 100).toFixed(1)}%)，需要针对性优化`);
      }
    }
    
    // 检查按人设的表现
    for (const [persona, data] of Object.entries(metrics.byPersona)) {
      if (data.duplicateRate > 0.4) {
        recommendations.push(`"${persona}"用户的重复问题率较高(${(data.duplicateRate * 100).toFixed(1)}%)，建议增加相关推断规则`);
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('整体表现良好，可以考虑扩展更多边界场景测试');
    }
    
    return recommendations;
  }
  
  /**
   * 生成Markdown报告
   */
  generateMarkdownReport(report: EvaluationReport): string {
    const lines: string[] = [
      '# 推断引擎评估报告',
      '',
      `**评估时间**: ${report.timestamp.toISOString()}`,
      `**场景数量**: ${report.totalScenarios}`,
      '',
      '## 核心指标',
      '',
      '| 指标 | 数值 | 目标 | 状态 |',
      '|------|------|------|------|',
      `| 重复问题率 | ${(report.metrics.duplicateQuestionRate * 100).toFixed(1)}% | <30% | ${report.metrics.duplicateQuestionRate < 0.3 ? '✅' : '❌'} |`,
      `| 推断准确率 | ${(report.metrics.inferenceAccuracy * 100).toFixed(1)}% | >70% | ${report.metrics.inferenceAccuracy > 0.7 ? '✅' : '❌'} |`,
      `| 推断覆盖率 | ${(report.metrics.inferenceCoverage * 100).toFixed(1)}% | >60% | ${report.metrics.inferenceCoverage > 0.6 ? '✅' : '❌'} |`,
      '',
      '## 按用户类型分析',
      '',
      '| 用户类型 | 准确率 | 重复问题率 |',
      '|----------|--------|------------|',
    ];
    
    for (const [persona, data] of Object.entries(report.metrics.byPersona)) {
      lines.push(`| ${persona} | ${(data.accuracy * 100).toFixed(1)}% | ${(data.duplicateRate * 100).toFixed(1)}% |`);
    }
    
    lines.push('');
    lines.push('## 按语言风格分析');
    lines.push('');
    lines.push('| 语言风格 | 准确率 | 重复问题率 |');
    lines.push('|----------|--------|------------|');
    
    for (const [style, data] of Object.entries(report.metrics.byLinguisticStyle)) {
      lines.push(`| ${style} | ${(data.accuracy * 100).toFixed(1)}% | ${(data.duplicateRate * 100).toFixed(1)}% |`);
    }
    
    lines.push('');
    lines.push('## 统计详情');
    lines.push('');
    lines.push(`- 总推断次数: ${report.metrics.totalInferences}`);
    lines.push(`- 正确推断: ${report.metrics.correctInferences}`);
    lines.push(`- 错误推断: ${report.metrics.incorrectInferences}`);
    lines.push(`- 遗漏推断: ${report.metrics.missedInferences}`);
    lines.push(`- 重复问题数: ${report.metrics.duplicateQuestionsAsked}`);
    
    lines.push('');
    lines.push('## 改进建议');
    lines.push('');
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
    
    lines.push('');
    lines.push('## 最佳案例');
    lines.push('');
    for (const best of report.bestCases) {
      lines.push(`- **${best.scenarioId}** (${best.persona}, ${best.linguisticStyle}): 正确${best.correctInferences.length}, 错误${best.incorrectInferences.length}, 遗漏${best.missedInferences.length}`);
    }
    
    lines.push('');
    lines.push('## 最差案例');
    lines.push('');
    for (const worst of report.worstCases) {
      lines.push(`- **${worst.scenarioId}** (${worst.persona}, ${worst.linguisticStyle}): 正确${worst.correctInferences.length}, 错误${worst.incorrectInferences.length}, 遗漏${worst.missedInferences.length}`);
    }
    
    return lines.join('\n');
  }
}

// 单例导出
export const evaluator = new InferenceEvaluator();

/**
 * 快速运行评估并返回报告
 */
export async function runEvaluation(scenarioCount?: number): Promise<{
  metrics: EvaluationMetrics;
  markdownReport: string;
}> {
  const scenarios = scenarioCount 
    ? TEST_SCENARIOS.slice(0, scenarioCount)
    : TEST_SCENARIOS;
    
  const report = await evaluator.evaluate(scenarios);
  const markdownReport = evaluator.generateMarkdownReport(report);
  
  return {
    metrics: report.metrics,
    markdownReport
  };
}
