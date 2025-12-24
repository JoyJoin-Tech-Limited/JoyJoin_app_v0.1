/**
 * 小悦智能评估系统 - 专家评分模块
 * 模拟10位AI专家对小悦进行多维度评分
 */

import OpenAI from 'openai';
import { TEST_SCENARIOS, getRandomScenarios as getScenarios } from './scenarios';
import type { EvaluationMetrics, SimulatedScenario } from './types';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

// ============ 10位AI专家人设 ============

export interface ExpertPersona {
  id: string;
  name: string;
  title: string;
  background: string;
  expertise: string[];
  evaluationFocus: string;
  scoringStyle: string;
}

export const EXPERT_PERSONAS: ExpertPersona[] = [
  {
    id: 'nlp_expert',
    name: '李明远',
    title: 'NLP首席科学家',
    background: '前Google Brain研究员，专注自然语言理解15年',
    expertise: ['语义理解', '意图识别', '上下文建模', '多轮对话'],
    evaluationFocus: '评估语义推断的准确性和覆盖率',
    scoringStyle: '严谨学术派，注重技术指标'
  },
  {
    id: 'dialogue_expert',
    name: '王雅琪',
    title: '对话系统架构师',
    background: '微软小冰团队核心成员，主导多个商业对话系统',
    expertise: ['对话管理', '状态追踪', '多轮推理', '任务型对话'],
    evaluationFocus: '评估对话流程的连贯性和自然度',
    scoringStyle: '工程实践派，关注可落地性'
  },
  {
    id: 'ux_expert',
    name: '陈思雨',
    title: '用户体验研究总监',
    background: '阿里巴巴UED前负责人，专注AI产品用户体验',
    expertise: ['用户研究', '交互设计', '情感化设计', 'AI可用性'],
    evaluationFocus: '评估用户感受和对话体验',
    scoringStyle: '用户视角派，强调情感共鸣'
  },
  {
    id: 'ml_expert',
    name: '张浩然',
    title: '机器学习工程师',
    background: '字节跳动推荐算法专家，擅长特征工程和模型优化',
    expertise: ['特征工程', '模型评估', '性能优化', 'A/B测试'],
    evaluationFocus: '评估推断模型的效率和准确率',
    scoringStyle: '数据驱动派，重视量化指标'
  },
  {
    id: 'product_expert',
    name: '林晓婷',
    title: '社交产品产品经理',
    background: '陌陌产品总监，深耕社交领域8年',
    expertise: ['社交产品', '用户增长', '注册转化', '用户留存'],
    evaluationFocus: '评估对注册转化的实际贡献',
    scoringStyle: '商业价值派，关注ROI'
  },
  {
    id: 'psychology_expert',
    name: '赵心怡',
    title: '认知心理学教授',
    background: '北京大学心理学系教授，研究人机交互心理',
    expertise: ['认知负荷', '信任建立', '焦虑缓解', '心理安全'],
    evaluationFocus: '评估对用户心理的影响',
    scoringStyle: '学术研究派，注重心理指标'
  },
  {
    id: 'linguistics_expert',
    name: '周语辰',
    title: '计算语言学家',
    background: '清华大学计算语言学博士，专注中文NLP',
    expertise: ['中文处理', '方言识别', '语用学', '隐含语义'],
    evaluationFocus: '评估中文语境的理解能力',
    scoringStyle: '语言学派，重视语言现象'
  },
  {
    id: 'ethics_expert',
    name: '孙雨轩',
    title: 'AI伦理专家',
    background: '中科院AI伦理研究员，关注AI公平性和隐私保护',
    expertise: ['AI伦理', '隐私保护', '公平性', '透明度'],
    evaluationFocus: '评估系统的伦理合规性',
    scoringStyle: '伦理审视派，关注潜在风险'
  },
  {
    id: 'startup_expert',
    name: '刘创业',
    title: '连续创业者',
    background: '三次创业经历，最近一次是AI社交产品被收购',
    expertise: ['创业实战', '产品市场匹配', '用户痛点', '竞品分析'],
    evaluationFocus: '评估产品的市场竞争力',
    scoringStyle: '创业实战派，看重差异化价值'
  },
  {
    id: 'senior_engineer',
    name: '吴代码',
    title: '资深后端架构师',
    background: '腾讯T12级工程师，15年后端开发经验',
    expertise: ['系统架构', '性能优化', '可维护性', '扩展性'],
    evaluationFocus: '评估技术实现的质量',
    scoringStyle: '工程严谨派，重视代码质量'
  }
];

// ============ 评估维度 ============

export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
  criteria: string[];
}

export const EVALUATION_DIMENSIONS: EvaluationDimension[] = [
  {
    id: 'inference_accuracy',
    name: '推断准确性',
    description: '从用户对话中提取和推断信息的准确程度',
    weight: 0.20,
    maxScore: 10,
    criteria: [
      '正确识别用户提供的显式信息',
      '准确推断用户未明说的隐含信息',
      '避免错误推断和过度推断',
      '处理模糊表达和多义词'
    ]
  },
  {
    id: 'redundancy_reduction',
    name: '重复问题避免',
    description: '成功避免询问已知或可推断信息的能力',
    weight: 0.20,
    maxScore: 10,
    criteria: [
      '不重复询问用户已明确提供的信息',
      '不询问可从上下文推断的信息',
      '合理使用确认式提问而非开放式提问',
      '对话轮次的有效减少'
    ]
  },
  {
    id: 'conversation_coherence',
    name: '对话连贯性',
    description: '对话流程的自然度和逻辑性',
    weight: 0.15,
    maxScore: 10,
    criteria: [
      '话题转换自然流畅',
      '上下文记忆和引用',
      '对用户回复的恰当回应',
      '对话节奏控制'
    ]
  },
  {
    id: 'user_experience',
    name: '用户体验',
    description: '用户在对话过程中的整体感受',
    weight: 0.15,
    maxScore: 10,
    criteria: [
      '让用户感到被倾听和理解',
      '减少用户的认知负担',
      '降低注册过程的焦虑感',
      '个性化和人情味的体现'
    ]
  },
  {
    id: 'edge_case_handling',
    name: '边界情况处理',
    description: '处理特殊情况和异常输入的能力',
    weight: 0.10,
    maxScore: 10,
    criteria: [
      '处理模糊或矛盾的用户输入',
      '应对用户拒绝回答的情况',
      '处理方言和非标准表达',
      '错误恢复能力'
    ]
  },
  {
    id: 'response_quality',
    name: '响应质量',
    description: '系统响应的整体质量',
    weight: 0.10,
    maxScore: 10,
    criteria: [
      '响应内容的相关性',
      '语言表达的自然度',
      '信息密度的适当性',
      '个性化程度'
    ]
  },
  {
    id: 'technical_robustness',
    name: '技术健壮性',
    description: '系统的技术可靠性和效率',
    weight: 0.10,
    maxScore: 10,
    criteria: [
      '推断算法的执行效率',
      '系统的稳定性',
      '错误处理机制',
      '可扩展性设计'
    ]
  }
];

// ============ 专家评分结果 ============

export interface ExpertScore {
  expertId: string;
  expertName: string;
  expertTitle: string;
  dimensions: {
    dimensionId: string;
    dimensionName: string;
    score: number;
    maxScore: number;
    reasoning: string;
    suggestions: string[];
  }[];
  overallScore: number;
  overallComments: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface ExpertEvaluationReport {
  timestamp: Date;
  systemVersion: string;
  evaluationMethod: 'simulated_experts' | 'human_experts' | 'automated';
  expertScores: ExpertScore[];
  aggregatedScores: {
    dimensionId: string;
    dimensionName: string;
    averageScore: number;
    maxScore: number;
    standardDeviation: number;
    expertScores: { expertId: string; score: number }[];
  }[];
  overallScore: number;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  topStrengths: string[];
  topWeaknesses: string[];
  prioritizedRecommendations: string[];
}

// ============ 模拟专家评分函数 ============

async function simulateExpertEvaluation(
  expert: ExpertPersona,
  systemDescription: string,
  sampleScenarios: SimulatedScenario[],
  metrics: EvaluationMetrics
): Promise<ExpertScore> {
  const prompt = `你现在扮演一位AI专家，对一个智能对话注册系统进行专业评估。

## 你的专家身份
- 姓名：${expert.name}
- 职位：${expert.title}
- 背景：${expert.background}
- 专业领域：${expert.expertise.join('、')}
- 评估重点：${expert.evaluationFocus}
- 评分风格：${expert.scoringStyle}

## 待评估系统介绍
${systemDescription}

## 系统性能指标
- 推断准确率：${(metrics.inferenceAccuracy * 100).toFixed(1)}%
- 重复问题避免率：${((1 - metrics.duplicateQuestionRate) * 100).toFixed(1)}%
- 推断覆盖率：${(metrics.inferenceCoverage * 100).toFixed(1)}%
- 总测试场景：${metrics.totalScenarios}个
- 正确推断：${metrics.correctInferences}次
- 错误推断：${metrics.incorrectInferences}次

## 示例对话场景
${sampleScenarios.slice(0, 3).map((s, i) => `
场景${i + 1}：${s.profile.persona} - ${s.profile.linguisticStyle}
对话：
${s.dialogue.slice(0, 4).map(d => `${d.role === 'user' ? '用户' : 'AI'}：${d.content}`).join('\n')}
`).join('\n')}

## 评估维度
${EVALUATION_DIMENSIONS.map(d => `
### ${d.name}（满分${d.maxScore}分，权重${(d.weight * 100).toFixed(0)}%）
${d.description}
评分标准：
${d.criteria.map(c => `- ${c}`).join('\n')}
`).join('\n')}

## 请按以下JSON格式输出你的专业评估
\`\`\`json
{
  "dimensions": [
    {
      "dimensionId": "inference_accuracy",
      "score": 8,
      "reasoning": "你对该维度的专业分析...",
      "suggestions": ["具体改进建议1", "具体改进建议2"]
    }
    // ... 对每个维度都给出评分
  ],
  "overallComments": "你作为${expert.title}的整体评价...",
  "strengths": ["系统的优势1", "系统的优势2", "系统的优势3"],
  "weaknesses": ["系统的不足1", "系统的不足2"],
  "recommendations": ["优先级最高的改进建议1", "改进建议2", "改进建议3"]
}
\`\`\`

请根据你的专业背景和评分风格，给出严谨、专业的评估。评分要有区分度，不要全部给高分。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一位严谨的AI专家评审，擅长对AI系统进行专业评估。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/```json\s*([\s\S]*?)```/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      
      const dimensionScores = EVALUATION_DIMENSIONS.map(dim => {
        const expertDim = parsed.dimensions?.find((d: any) => d.dimensionId === dim.id);
        return {
          dimensionId: dim.id,
          dimensionName: dim.name,
          score: expertDim?.score || 7,
          maxScore: dim.maxScore,
          reasoning: expertDim?.reasoning || '评估中',
          suggestions: expertDim?.suggestions || []
        };
      });
      
      const overallScore = dimensionScores.reduce((sum, d) => {
        const dim = EVALUATION_DIMENSIONS.find(ed => ed.id === d.dimensionId);
        return sum + (d.score * (dim?.weight || 0.1));
      }, 0);
      
      return {
        expertId: expert.id,
        expertName: expert.name,
        expertTitle: expert.title,
        dimensions: dimensionScores,
        overallScore: parseFloat(overallScore.toFixed(2)),
        overallComments: parsed.overallComments || '',
        strengths: parsed.strengths || [],
        weaknesses: parsed.weaknesses || [],
        recommendations: parsed.recommendations || []
      };
    }
  } catch (error) {
    console.error(`Expert ${expert.id} evaluation failed:`, error);
  }
  
  return {
    expertId: expert.id,
    expertName: expert.name,
    expertTitle: expert.title,
    dimensions: EVALUATION_DIMENSIONS.map(d => ({
      dimensionId: d.id,
      dimensionName: d.name,
      score: 7,
      maxScore: d.maxScore,
      reasoning: '评估失败，使用默认分数',
      suggestions: []
    })),
    overallScore: 7.0,
    overallComments: '评估过程中出现错误',
    strengths: [],
    weaknesses: [],
    recommendations: []
  };
}

// ============ 运行完整专家评估 ============

export async function runExpertEvaluation(
  metrics: EvaluationMetrics,
  sampleScenarios: SimulatedScenario[] = TEST_SCENARIOS.slice(0, 10)
): Promise<ExpertEvaluationReport> {
  console.log('[ExpertEval] 开始10位AI专家评估...');
  
  const systemDescription = `
小悦智能推断引擎是一个为社交注册场景设计的对话辅助系统。核心功能包括：

1. **智能推断**：从用户对话中自动提取和推断用户属性（如职业、人生阶段、婚姻状况等）
2. **重复问题避免**：通过跟踪已知信息，避免重复询问用户已经提供或可推断的信息
3. **多层架构**：
   - 语义匹配层：基于规则和同义词的快速推断（200+同义词映射，15+推断规则）
   - 知识图谱层：60+公司、30+学校、40+城市的实体识别和链式推断
   - LLM推理层：DeepSeek驱动的复杂场景推断
4. **置信度管理**：≥85%置信度直接跳过问题，60-85%使用确认式提问，<60%正常提问
5. **会话状态管理**：跨轮次维护用户属性状态，确保推断上下文连续

目标是减少注册对话的轮次，提升用户体验，降低用户的注册焦虑。
  `;
  
  const expertScores: ExpertScore[] = [];
  
  for (const expert of EXPERT_PERSONAS) {
    console.log(`[ExpertEval] ${expert.name}(${expert.title}) 评估中...`);
    const score = await simulateExpertEvaluation(expert, systemDescription, sampleScenarios, metrics);
    expertScores.push(score);
  }
  
  const aggregatedScores = EVALUATION_DIMENSIONS.map(dim => {
    const scores = expertScores.map(es => {
      const dimScore = es.dimensions.find(d => d.dimensionId === dim.id);
      return { expertId: es.expertId, score: dimScore?.score || 0 };
    });
    
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s.score - avgScore, 2), 0) / scores.length;
    
    return {
      dimensionId: dim.id,
      dimensionName: dim.name,
      averageScore: parseFloat(avgScore.toFixed(2)),
      maxScore: dim.maxScore,
      standardDeviation: parseFloat(Math.sqrt(variance).toFixed(2)),
      expertScores: scores
    };
  });
  
  const overallScore = aggregatedScores.reduce((sum, as) => {
    const dim = EVALUATION_DIMENSIONS.find(d => d.id === as.dimensionId);
    return sum + (as.averageScore * (dim?.weight || 0.1));
  }, 0);
  
  const grade = overallScore >= 9.0 ? 'A+' :
                overallScore >= 8.5 ? 'A' :
                overallScore >= 8.0 ? 'B+' :
                overallScore >= 7.0 ? 'B' :
                overallScore >= 6.0 ? 'C' :
                overallScore >= 5.0 ? 'D' : 'F';
  
  const allStrengths = expertScores.flatMap(es => es.strengths);
  const allWeaknesses = expertScores.flatMap(es => es.weaknesses);
  const allRecommendations = expertScores.flatMap(es => es.recommendations);
  
  const countOccurrences = (arr: string[]) => {
    const counts: Record<string, number> = {};
    arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([item]) => item);
  };
  
  const report: ExpertEvaluationReport = {
    timestamp: new Date(),
    systemVersion: '1.0.0',
    evaluationMethod: 'simulated_experts',
    expertScores,
    aggregatedScores,
    overallScore: parseFloat(overallScore.toFixed(2)),
    grade,
    summary: `经过10位AI专家的综合评估，小悦智能推断引擎获得${overallScore.toFixed(2)}分（满分10分），评级为${grade}。`,
    topStrengths: countOccurrences(allStrengths).slice(0, 5),
    topWeaknesses: countOccurrences(allWeaknesses).slice(0, 5),
    prioritizedRecommendations: countOccurrences(allRecommendations).slice(0, 5)
  };
  
  console.log(`[ExpertEval] 评估完成！综合评分：${overallScore.toFixed(2)}，评级：${grade}`);
  
  return report;
}

// ============ 生成Markdown报告 ============

export function generateExpertReportMarkdown(report: ExpertEvaluationReport): string {
  const lines: string[] = [
    '# 小悦智能推断引擎 - 专家评估报告',
    '',
    `**评估时间**: ${report.timestamp.toISOString()}`,
    `**系统版本**: ${report.systemVersion}`,
    `**评估方法**: ${report.evaluationMethod === 'simulated_experts' ? '模拟AI专家评审' : '人工专家评审'}`,
    '',
    '---',
    '',
    '## 综合评分',
    '',
    `### 总分: ${report.overallScore.toFixed(2)} / 10.0`,
    `### 评级: ${report.grade}`,
    '',
    report.summary,
    '',
    '---',
    '',
    '## 各维度评分汇总',
    '',
    '| 维度 | 平均分 | 满分 | 标准差 |',
    '|------|--------|------|--------|',
  ];
  
  for (const as of report.aggregatedScores) {
    lines.push(`| ${as.dimensionName} | ${as.averageScore.toFixed(2)} | ${as.maxScore} | ${as.standardDeviation.toFixed(2)} |`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## 专家评审详情');
  lines.push('');
  
  for (const es of report.expertScores) {
    lines.push(`### ${es.expertName} - ${es.expertTitle}`);
    lines.push(`**个人综合评分**: ${es.overallScore.toFixed(2)}/10`);
    lines.push('');
    lines.push('**各维度评分**:');
    for (const dim of es.dimensions) {
      lines.push(`- ${dim.dimensionName}: ${dim.score}/${dim.maxScore}`);
    }
    lines.push('');
    lines.push(`**整体评价**: ${es.overallComments}`);
    lines.push('');
    if (es.strengths.length > 0) {
      lines.push('**指出的优势**:');
      es.strengths.forEach(s => lines.push(`- ${s}`));
      lines.push('');
    }
    if (es.weaknesses.length > 0) {
      lines.push('**指出的不足**:');
      es.weaknesses.forEach(w => lines.push(`- ${w}`));
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }
  
  lines.push('## 综合分析');
  lines.push('');
  lines.push('### 主要优势');
  report.topStrengths.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');
  lines.push('### 主要不足');
  report.topWeaknesses.forEach((w, i) => lines.push(`${i + 1}. ${w}`));
  lines.push('');
  lines.push('### 优先改进建议');
  report.prioritizedRecommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  
  return lines.join('\n');
}

// ============ 导出评估问卷模板 ============

export interface EvaluationQuestionnaire {
  version: string;
  title: string;
  introduction: string;
  sections: {
    id: string;
    title: string;
    description: string;
    questions: {
      id: string;
      type: 'rating' | 'text' | 'multiple_choice';
      question: string;
      required: boolean;
      options?: { value: number | string; label: string }[];
      maxScore?: number;
    }[];
  }[];
}

export function generateEvaluationQuestionnaire(): EvaluationQuestionnaire {
  return {
    version: '1.0',
    title: '小悦智能推断引擎 - 专家评估问卷',
    introduction: '感谢您参与小悦智能推断引擎的专家评估。本问卷旨在收集您对系统各方面能力的专业评价，预计需要15-20分钟完成。您的反馈将帮助我们持续改进系统。',
    sections: EVALUATION_DIMENSIONS.map(dim => ({
      id: dim.id,
      title: dim.name,
      description: dim.description,
      questions: [
        {
          id: `${dim.id}_score`,
          type: 'rating' as const,
          question: `请对"${dim.name}"维度进行评分`,
          required: true,
          maxScore: dim.maxScore,
          options: Array.from({ length: dim.maxScore + 1 }, (_, i) => ({
            value: i,
            label: `${i}分`
          }))
        },
        {
          id: `${dim.id}_reasoning`,
          type: 'text' as const,
          question: `请说明您给出该评分的理由`,
          required: true
        },
        {
          id: `${dim.id}_criteria`,
          type: 'multiple_choice' as const,
          question: `系统在以下哪些方面表现良好？（可多选）`,
          required: false,
          options: dim.criteria.map((c, i) => ({ value: i, label: c }))
        },
        {
          id: `${dim.id}_suggestions`,
          type: 'text' as const,
          question: `您对该维度有什么改进建议？`,
          required: false
        }
      ]
    })).concat([
      {
        id: 'overall',
        title: '整体评价',
        description: '请对系统进行整体评价',
        questions: [
          {
            id: 'overall_score',
            type: 'rating' as const,
            question: '请对系统整体表现进行评分',
            required: true,
            maxScore: 10,
            options: Array.from({ length: 11 }, (_, i) => ({ value: i, label: `${i}分` }))
          },
          {
            id: 'overall_comments',
            type: 'text' as const,
            question: '请提供您的整体评价意见',
            required: true
          },
          {
            id: 'strengths',
            type: 'text' as const,
            question: '您认为系统最大的优势是什么？（请列出3-5条）',
            required: true
          },
          {
            id: 'weaknesses',
            type: 'text' as const,
            question: '您认为系统最需要改进的地方是什么？（请列出3-5条）',
            required: true
          },
          {
            id: 'recommendations',
            type: 'text' as const,
            question: '您有什么具体的改进建议？',
            required: false
          }
        ]
      }
    ])
  };
}
