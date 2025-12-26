/**
 * Gossip Engine V3 验证测试
 * 测试语义去重和同义词替换的效果
 */

import {
  generateDynamicInferenceV2,
  resetCadence,
  testGenerateInsightsV2,
  levenshteinDistance,
  normalizedSimilarity,
} from './gossipEngineV2';
import type { CollectedInfo } from './gossipEngineV2';

// 模拟用户数据生成器
function generateRandomUserInfo(): CollectedInfo {
  const genders = ['male', 'female'] as const;
  const cities = ['深圳', '香港', '广州'] as const;
  const hometowns = ['四川', '东北', '广东', '湖南', '河南', '江苏', '浙江', '北京', '上海'] as const;
  const industries = ['互联网', '金融', '设计', '教育', '医疗', '法律', '媒体'] as const;
  const interestPool = ['美食', '旅行', '运动', '音乐', '游戏', '摄影', '读书', '户外', '宠物', '电影'];
  
  const birthYear = (new Date().getFullYear() - 22 - Math.floor(Math.random() * 15)).toString();
  const randomInterests = interestPool
    .sort(() => Math.random() - 0.5)
    .slice(0, 2 + Math.floor(Math.random() * 3));
  
  return {
    displayName: `用户${Math.floor(Math.random() * 1000)}`,
    gender: genders[Math.floor(Math.random() * genders.length)],
    birthYear: birthYear,
    currentCity: cities[Math.floor(Math.random() * cities.length)],
    hometown: hometowns[Math.floor(Math.random() * hometowns.length)],
    industry: industries[Math.floor(Math.random() * industries.length)],
    interestsTop: randomInterests,
  };
}

// 计算重复率
function calculateRepetitionRate(texts: string[]): { rate: number; uniqueCount: number; totalCount: number } {
  const seen = new Set<string>();
  let duplicates = 0;
  
  for (const text of texts) {
    if (seen.has(text)) {
      duplicates++;
    } else {
      seen.add(text);
    }
  }
  
  return {
    rate: texts.length > 0 ? (duplicates / texts.length) * 100 : 0,
    uniqueCount: seen.size,
    totalCount: texts.length,
  };
}

// 计算语义重复率（使用 Levenshtein 相似度）
function calculateSemanticRepetitionRate(texts: string[], threshold: number = 0.6): { 
  rate: number; 
  semanticDuplicates: number;
  exactDuplicates: number;
} {
  let semanticDuplicates = 0;
  let exactDuplicates = 0;
  
  for (let i = 0; i < texts.length; i++) {
    for (let j = 0; j < i; j++) {
      const similarity = normalizedSimilarity(texts[i], texts[j]);
      if (similarity === 1) {
        exactDuplicates++;
        break;
      } else if (similarity >= threshold) {
        semanticDuplicates++;
        break;
      }
    }
  }
  
  return {
    rate: texts.length > 0 ? ((exactDuplicates + semanticDuplicates) / texts.length) * 100 : 0,
    semanticDuplicates,
    exactDuplicates,
  };
}

// 运行测试
export function runV3Test(iterations: number = 100): void {
  console.log(`\n========== Gossip Engine V3 测试 ==========`);
  console.log(`测试轮数: ${iterations}`);
  
  const allTexts: string[] = [];
  const allTriggers: string[] = [];
  let successCount = 0;
  let cooldownCount = 0;
  let noMatchCount = 0;
  
  // 每个用户的重复率统计
  const perUserRepetitionRates: number[] = [];
  const perUserExactRates: number[] = [];
  
  // 模拟多个用户的多轮对话
  const numUsers = 20;
  const turnsPerUser = Math.ceil(iterations / numUsers);
  
  for (let u = 0; u < numUsers; u++) {
    resetCadence();
    const userInfo = generateRandomUserInfo();
    const userTexts: string[] = [];
    
    for (let t = 0; t < turnsPerUser; t++) {
      const result = generateDynamicInferenceV2(userInfo, t);
      
      if (result.type === 'success' && result.insight) {
        successCount++;
        allTexts.push(result.insight.text);
        allTriggers.push(result.insight.trigger);
        userTexts.push(result.insight.text);
      } else if (result.type === 'cooldown') {
        cooldownCount++;
      } else {
        noMatchCount++;
      }
    }
    
    // 计算该用户的重复率
    if (userTexts.length > 1) {
      const userExact = calculateRepetitionRate(userTexts);
      const userSemantic = calculateSemanticRepetitionRate(userTexts, 0.6);
      perUserExactRates.push(userExact.rate);
      perUserRepetitionRates.push(userSemantic.rate);
    }
  }
  
  // 计算全局指标
  const exactRepetition = calculateRepetitionRate(allTexts);
  const semanticRepetition = calculateSemanticRepetitionRate(allTexts, 0.6);
  const triggerRepetition = calculateRepetitionRate(allTriggers);
  
  // 计算平均每用户重复率
  const avgPerUserExact = perUserExactRates.length > 0 
    ? perUserExactRates.reduce((a, b) => a + b, 0) / perUserExactRates.length 
    : 0;
  const avgPerUserSemantic = perUserRepetitionRates.length > 0 
    ? perUserRepetitionRates.reduce((a, b) => a + b, 0) / perUserRepetitionRates.length 
    : 0;
  
  console.log(`\n---------- 结果统计 ----------`);
  console.log(`用户数: ${numUsers}`);
  console.log(`成功生成洞察: ${successCount}`);
  console.log(`冷却期跳过: ${cooldownCount}`);
  console.log(`无匹配规则: ${noMatchCount}`);
  
  console.log(`\n---------- 全局重复率 (跨用户) ----------`);
  console.log(`精确文本重复率: ${exactRepetition.rate.toFixed(2)}%`);
  console.log(`语义重复率 (阈值0.6): ${semanticRepetition.rate.toFixed(2)}%`);
  console.log(`Trigger 重复率: ${triggerRepetition.rate.toFixed(2)}%`);
  
  console.log(`\n---------- 每用户重复率 (核心指标) ----------`);
  console.log(`平均精确重复率: ${avgPerUserExact.toFixed(2)}%`);
  console.log(`平均语义重复率: ${avgPerUserSemantic.toFixed(2)}%`);
  
  console.log(`\n---------- 多样性分析 ----------`);
  console.log(`独立文本数: ${exactRepetition.uniqueCount}`);
  console.log(`总生成数: ${exactRepetition.totalCount}`);
  console.log(`独立 Trigger 数: ${triggerRepetition.uniqueCount}`);
  
  // 目标检查 - 使用每用户重复率
  const targetRate = 20;
  const passed = avgPerUserSemantic <= targetRate;
  console.log(`\n---------- 目标检查 ----------`);
  console.log(`目标 (每用户语义重复率): ≤${targetRate}%`);
  console.log(`实际: ${avgPerUserSemantic.toFixed(2)}%`);
  console.log(`结果: ${passed ? '✅ 通过' : '❌ 未达标'}`);
  
  console.log(`\n========================================\n`);
}

// 测试 Levenshtein 距离函数
export function testLevenshteinDistance(): void {
  console.log(`\n========== Levenshtein 距离测试 ==========`);
  
  const testCases = [
    ['吃货属性已暴露', '吃货属性已暴露', 'exact match'],
    ['吃货属性已暴露', '美食达人已暴露', 'similar'],
    ['你好世界', '世界你好', 'reordered'],
    ['科技圈的人', '互联网人', 'different'],
  ];
  
  for (const [a, b, desc] of testCases) {
    const distance = levenshteinDistance(a, b);
    const similarity = normalizedSimilarity(a, b);
    console.log(`"${a}" vs "${b}" (${desc})`);
    console.log(`  距离: ${distance}, 相似度: ${similarity.toFixed(3)}`);
  }
  
  console.log(`\n========================================\n`);
}

// 导出测试函数供外部调用
export { generateRandomUserInfo, calculateRepetitionRate, calculateSemanticRepetitionRate };
