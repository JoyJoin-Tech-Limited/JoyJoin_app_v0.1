/**
 * 匹配算法专家评估
 * 让10位资深专家从各自角度审视6维匹配算法的优化空间
 */

import OpenAI from 'openai';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

interface ExpertFeedback {
  expertName: string;
  expertTitle: string;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  priority: 'high' | 'medium' | 'low';
  detailedFeedback: string;
}

const MATCHING_ALGORITHM_DESCRIPTION = `
# 悦聚6维匹配算法 - 当前实现

## 算法概述
为4-6人小局社交活动进行智能匹配，使用6个维度综合评分：
- 性格维度 (25%): 基于12原型动物系统的性格互补性
- 兴趣维度 (25%): 共同兴趣 + 主要兴趣优先 + 话题回避冲突检测
- 意图维度 (15%): 活动目的一致性（交友/职场社交/兴趣交流等）
- 背景维度 (15%): 年龄相近度(±3/5/8年) + 同城老乡(+20分) + 资历相似度 + 子女状态 + 感情状态
- 文化维度 (10%): 共同语言 + 海外留学地区匹配 + 国际化视野
- 对话签名维度 (10%): 从AI对话中提取的特征向量

## 深度特征提取系统 (5大类心理画像)
1. 认知风格: 决策速度、风险偏好、思维方式(逻辑/直觉)、信息处理偏好
2. 沟通偏好: 幽默风格(机智/搞笑/冷幽默)、表达深度、Emoji使用频率、正式度
3. 社交人格: 社交主动性、领导倾向、倾听vs表达、群体偏好、能量来源(内向/外向)
4. 情感特质: 情绪稳定度(0-100)、共情能力(0-100)、开放程度(0-100)、积极性评分
5. 互动节奏: 回复速度、话题切换频率、对话深入度、问答比例

## 特色功能
- 归一化处理防止分数堆叠过高（超过30分的部分按50%计算）
- 置信度加权的深度特征相似度计算
- 精细匹配点说明：如"老乡！都来自深圳"、"都有学龄前孩子"、"都在北美留过学"
- 话题回避冲突检测（兴趣与回避话题冲突时最高扣25分）

## 数据利用率
从约60%提升到90%+，现在使用：年龄、子女状态、感情状态、海外地区、城市级老家、对话特征等

## 目标用户
香港/深圳地区的年轻职场人士（25-40岁为主），追求有质量的线下社交
`;

const EXPERTS = [
  {
    id: 'nlp_expert',
    name: '李明远',
    title: 'NLP首席科学家 (前Google Brain)',
    prompt: '从NLP和语义理解角度，评估深度特征提取系统的技术实现。关注：特征提取的准确性、语义推断的可靠性、中文语境处理的完备性。'
  },
  {
    id: 'dialogue_expert',
    name: '王雅琪',
    title: '对话系统架构师 (微软小冰团队)',
    prompt: '从对话系统角度，评估对话签名维度的设计。关注：多轮对话中的状态追踪、用户画像的动态更新、对话特征与匹配质量的关联度。'
  },
  {
    id: 'ux_expert',
    name: '陈思雨',
    title: '用户体验研究总监 (前阿里UED)',
    prompt: '从用户体验角度，评估匹配结果的呈现方式。关注：匹配点说明的可读性、用户对匹配理由的感知、是否建立了足够的信任感。'
  },
  {
    id: 'ml_expert',
    name: '张浩然',
    title: '机器学习工程师 (字节推荐算法)',
    prompt: '从特征工程和模型优化角度，评估6维算法的设计。关注：特征权重分配的合理性、归一化策略的有效性、潜在的特征交互和非线性关系。'
  },
  {
    id: 'product_expert',
    name: '林晓婷',
    title: '社交产品经理 (陌陌产品总监)',
    prompt: '从社交产品角度，评估匹配算法对用户活跃度和留存的影响。关注：首次匹配体验、匹配结果的"惊喜感"、用户复购动力。'
  },
  {
    id: 'psychology_expert',
    name: '赵心怡',
    title: '认知心理学教授 (北京大学)',
    prompt: '从心理学角度，评估深度特征分类体系的科学性。关注：认知风格/情感特质的划分是否符合心理学理论、是否存在标签化风险、对用户心理安全的影响。'
  },
  {
    id: 'linguistics_expert',
    name: '周语辰',
    title: '计算语言学家 (清华大学)',
    prompt: '从语言学角度，评估对话特征提取的语言覆盖度。关注：正则表达式的准确性、方言和网络用语的处理、积极/消极词汇的判断逻辑。'
  },
  {
    id: 'ethics_expert',
    name: '孙雨轩',
    title: 'AI伦理专家 (中科院)',
    prompt: '从AI伦理角度，评估算法的公平性和隐私保护。关注：是否存在隐性歧视（如年龄/地域）、用户数据使用的透明度、匹配结果的可解释性。'
  },
  {
    id: 'startup_expert',
    name: '刘创业',
    title: '连续创业者 (AI社交产品被收购)',
    prompt: '从创业实战角度，评估算法的市场竞争力。关注：与竞品（Soul、探探等）的差异化、算法的可扩展性、商业化潜力。'
  },
  {
    id: 'senior_engineer',
    name: '吴代码',
    title: '资深后端架构师 (腾讯T12)',
    prompt: '从工程实现角度，评估代码质量和系统架构。关注：性能瓶颈、可维护性、测试覆盖率、扩展性设计。'
  }
];

async function getExpertFeedback(expert: typeof EXPERTS[0]): Promise<ExpertFeedback> {
  const systemPrompt = `你是${expert.name}，${expert.title}。你是一位资深专家，需要对悦聚平台的匹配算法进行专业评估。

你的评估重点：${expert.prompt}

请以JSON格式返回评估结果，包含：
- overallScore: 总体评分(0-100)
- strengths: 当前实现的亮点(数组，3-5条)
- improvements: 需要优化的地方(数组，3-5条，按优先级排序)
- priority: 最重要的优化事项的紧急程度("high"/"medium"/"low")
- detailedFeedback: 详细专业意见(200-300字)`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: MATCHING_ALGORITHM_DESCRIPTION + '\n\n请给出你的专业评估。' }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);
    
    return {
      expertName: expert.name,
      expertTitle: expert.title,
      overallScore: parsed.overallScore || 0,
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      priority: parsed.priority || 'medium',
      detailedFeedback: parsed.detailedFeedback || ''
    };
  } catch (error) {
    console.error(`Error getting feedback from ${expert.name}:`, error);
    return {
      expertName: expert.name,
      expertTitle: expert.title,
      overallScore: 0,
      strengths: [],
      improvements: ['评估失败'],
      priority: 'medium',
      detailedFeedback: '评估过程中出现错误'
    };
  }
}

async function runExpertEvaluation() {
  console.log('🎯 悦聚6维匹配算法 - 10位专家评估\n');
  console.log('=' .repeat(60));
  
  console.log('\n⏳ 正在并行咨询10位专家...\n');
  
  const results = await Promise.all(
    EXPERTS.map(async (expert) => {
      const feedback = await getExpertFeedback(expert);
      console.log(`✅ ${expert.name}: ${feedback.overallScore}/100 (${feedback.priority})`);
      return feedback;
    })
  );
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 专家评估汇总\n');
  
  const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
  console.log(`📈 平均评分: ${avgScore.toFixed(1)}/100\n`);
  
  console.log('--- 各专家详细反馈 ---\n');
  
  for (const result of results) {
    console.log(`\n【${result.expertName}】${result.expertTitle}`);
    console.log(`评分: ${result.overallScore}/100 | 优先级: ${result.priority}`);
    console.log('\n✅ 亮点:');
    result.strengths.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
    console.log('\n🔧 优化建议:');
    result.improvements.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
    console.log(`\n💬 详细意见:\n   ${result.detailedFeedback}`);
    console.log('\n' + '-'.repeat(50));
  }
  
  console.log('\n📋 高优先级优化项汇总:\n');
  const highPriority = results.filter(r => r.priority === 'high');
  if (highPriority.length > 0) {
    highPriority.forEach(r => {
      console.log(`⚠️ ${r.expertName}: ${r.improvements[0]}`);
    });
  } else {
    console.log('✅ 无高优先级优化项');
  }
  
  console.log('\n🎯 中优先级优化项汇总:\n');
  const mediumPriority = results.filter(r => r.priority === 'medium');
  mediumPriority.forEach(r => {
    console.log(`📌 ${r.expertName}: ${r.improvements[0]}`);
  });
  
  return results;
}

runExpertEvaluation().catch(console.error);
