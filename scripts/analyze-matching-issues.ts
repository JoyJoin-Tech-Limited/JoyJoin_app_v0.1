/**
 * 让"资深心理学家"(DeepSeek AI)分析匹配问题并提出改进建议
 */

import OpenAI from 'openai';
import { archetypePrototypes } from '../packages/shared/src/personality/prototypes';
import { questionsV4 } from '../packages/shared/src/personality/questionsV4';
import { TraitKey } from '../packages/shared/src/personality/types';

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  timeout: 60000,
});

// 模拟结果数据
const simulationResults = {
  totalTests: 50,
  exactMatchRate: 60,
  similarMatchRate: 64,
  
  stableArchetypes: [
    { name: "rooster", hitRate: 100, avgConfidence: 75.8 },
    { name: "hamster_praise", hitRate: 100, avgConfidence: 68.7 },
    { name: "dolphin_calm", hitRate: 100, avgConfidence: 63.8 },
    { name: "koala", hitRate: 80, avgConfidence: 69.4 },
    { name: "elephant", hitRate: 100, avgConfidence: 74.0 },
    { name: "owl", hitRate: 100, avgConfidence: 71.6 },
  ],
  
  problematicArchetypes: [
    { 
      name: "corgi", 
      hitRate: 0, 
      misclassifiedAs: "hamster_praise",
      targetProfile: { A: 72, C: 48, E: 62, O: 67, X: 96, P: 92 },
      measuredBias: { A: +23, C: +12, E: +3, O: +33, X: +4, P: +8 }
    },
    { 
      name: "fox", 
      hitRate: 0, 
      misclassifiedAs: "corgi",
      targetProfile: { A: 53, C: 52, E: 58, O: 92, X: 82, P: 63 },
      measuredBias: { A: +32, C: +8, E: +17, O: +8, X: +18, P: +37 }
    },
    { 
      name: "spider", 
      hitRate: 20, 
      misclassifiedAs: "koala/dolphin_calm",
      targetProfile: { A: 82, C: 72, E: 63, O: 68, X: 58, P: 62 },
      measuredBias: { A: +18, C: +28, E: +32, O: +27, X: +12, P: +28 }
    },
    { 
      name: "octopus", 
      hitRate: 0, 
      misclassifiedAs: "owl",
      targetProfile: { A: 48, C: 43, E: 57, O: 97, X: 58, P: 67 },
      measuredBias: { A: +17, C: +32, E: +8, O: +3, X: -18, P: +13 }
    },
  ]
};

// 获取原型定义
function getArchetypeDetails() {
  const details: string[] = [];
  for (const [name, proto] of Object.entries(archetypePrototypes)) {
    details.push(`
**${name}** (${proto.icon})
- 特质: A=${proto.traitProfile.A} C=${proto.traitProfile.C} E=${proto.traitProfile.E} O=${proto.traitProfile.O} X=${proto.traitProfile.X} P=${proto.traitProfile.P}
- 能量等级: ${proto.energyLevel}
- 易混淆: ${proto.confusableWith.join(', ')}
- 关键区分维度: ${proto.uniqueSignalTraits.join(', ')}`);
  }
  return details.join('\n');
}

// 获取题库中针对问题维度的题目
function getRelevantQuestions() {
  const targetTraits = ['X', 'O', 'A'] as TraitKey[]; // 问题最集中的维度
  const relevantQs = questionsV4
    .filter(q => q.primaryTraits.some(t => targetTraits.includes(t as TraitKey)))
    .slice(0, 15);
  
  return relevantQs.map(q => {
    const options = q.options.map(o => {
      const scores = Object.entries(o.traitScores)
        .map(([t, v]) => `${t}:${v > 0 ? '+' : ''}${v}`)
        .join(' ');
      return `  - "${o.text}" → ${scores}`;
    }).join('\n');
    return `Q: ${q.text}\n维度: ${q.primaryTraits.join(',')}\n${options}`;
  }).join('\n\n');
}

async function runAnalysis() {
  console.log('🧠 正在请求资深心理学家分析...\n');

  const prompt = `你是一位拥有20年经验的心理测量学专家，专注于人格评估工具的信效度研究。

我们开发了一个基于AOCEXP六维度模型的自适应性格测评系统，用于匹配社交活动中的用户。系统有12个原型（类似MBTI的类型），通过8-16道自适应题目确定用户原型。

## 模拟测试结果

我们用10位模拟用户（每位代表一种目标原型，特质分数精确匹配该原型）进行了测试，每人测5次：

- **总精确匹配率**: ${simulationResults.exactMatchRate}%
- **总相似匹配率**: ${simulationResults.similarMatchRate}%

### 稳定识别的原型 ✅
${simulationResults.stableArchetypes.map(a => `- ${a.name}: ${a.hitRate}% 命中，置信度 ${a.avgConfidence}%`).join('\n')}

### 问题原型 ❌
${simulationResults.problematicArchetypes.map(a => `
**${a.name}** (${a.hitRate}% 命中)
- 被误判为: ${a.misclassifiedAs}
- 目标特质: A=${a.targetProfile.A} C=${a.targetProfile.C} E=${a.targetProfile.E} O=${a.targetProfile.O} X=${a.targetProfile.X} P=${a.targetProfile.P}
- 测量偏差: A:${a.measuredBias.A > 0 ? '+' : ''}${a.measuredBias.A}, C:${a.measuredBias.C > 0 ? '+' : ''}${a.measuredBias.C}, E:${a.measuredBias.E > 0 ? '+' : ''}${a.measuredBias.E}, O:${a.measuredBias.O > 0 ? '+' : ''}${a.measuredBias.O}, X:${a.measuredBias.X > 0 ? '+' : ''}${a.measuredBias.X}, P:${a.measuredBias.P > 0 ? '+' : ''}${a.measuredBias.P}
`).join('')}

## 12原型定义
${getArchetypeDetails()}

## 部分题库示例（问题相关维度）
${getRelevantQuestions()}

---

请从心理测量学专业角度分析：

1. **根本原因诊断**：为什么这4个原型匹配失败？从维度区分度、题目设计、原型定义边界等角度分析。

2. **测量偏差解读**：所有问题原型的A(亲和力)和O(开放性)测量值都偏高，这说明什么？是社会期望效应还是题目设计问题？

3. **具体改进建议**：
   - 原型定义调整（哪些原型的特质分数需要修改？）
   - 题目设计建议（需要增加什么类型的题目？给出2-3个具体题目示例）
   - 算法权重调整（是否需要改变某些维度的权重？）

4. **预期效果**：如果按你的建议修改，预计精确匹配率能提升到多少？

请用专业但易懂的语言回答，每个部分控制在150字以内。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2500,
    });

    const analysis = response.choices[0]?.message?.content || '无法获取分析';
    
    console.log('═'.repeat(80));
    console.log('          📋 资深心理学家分析报告');
    console.log('═'.repeat(80));
    console.log('');
    console.log(analysis);
    console.log('');
    console.log('═'.repeat(80));
    
    return analysis;
  } catch (error) {
    console.error('API调用失败:', error);
    return null;
  }
}

runAnalysis().catch(console.error);
