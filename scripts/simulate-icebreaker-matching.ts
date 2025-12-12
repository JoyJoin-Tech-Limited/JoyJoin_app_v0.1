/**
 * 模拟测试：精选破冰话题生成逻辑
 * 测试10,000个4-6人聚会组合的话题匹配效果
 */

// 复制当前的话题库和逻辑
const icebreakerQuestions = {
  lighthearted: [
    "今天什么事让你微笑了？",
    "本周最好的消息是什么？",
    "最近吃过最奇怪的一道菜是什么？",
    "如果可以从日常生活中去掉一件事，你会选什么？为什么？",
    "如果能立刻学会一项技能，你想学什么？",
    "周末最喜欢做的一件小事是什么？",
    "最近什么事让你觉得很治愈？",
    "你的「快乐按钮」是什么？做什么事能让你立刻开心起来？",
  ],
  passions: [
    "你对什么充满热情？为什么？",
    "有什么爱好或活动是你真正享受的？它吸引你的地方是什么？",
    "最近沉迷的一项运动或爱好是什么？",
    "有什么一直想尝试但还没开始的事情？",
    "如果有一整天自由时间，你会怎么度过？",
    "你会推荐别人尝试什么爱好或体验？",
    "什么事情会让你完全忘记时间？",
  ],
  travel: [
    "最难忘的一次旅行经历是什么？",
    "如果可以立刻去任何地方旅行，你会去哪里？",
    "旅行中遇到过什么意外的惊喜？",
    "你更喜欢计划好的行程，还是随性探索？",
    "有什么地方去了之后改变了你的想法？",
    "推荐一个你觉得被低估的旅行目的地",
    "下一个最想去的地方是哪里？为什么？",
  ],
  creativity: [
    "最近有什么艺术作品或表演让你印象深刻？",
    "你会用什么方式表达创意？（音乐、绘画、写作等）",
    "有没有特别喜欢的艺术家或创作者？",
    "如果可以掌握一门艺术，你会选什么？",
    "最近在读什么书或在看什么剧？",
    "有什么电影或音乐改变了你的看法？",
    "你觉得什么样的创作最能打动人心？",
  ],
  innovation: [
    "你觉得什么技术会改变我们的未来？",
    "有什么新科技产品让你觉得很酷？",
    "如果能发明一样东西解决生活中的问题，你会发明什么？",
    "你对AI有什么看法？它会如何影响我们的生活？",
    "最让你期待的未来趋势是什么？",
    "科技让生活更好了，还是更复杂了？",
  ],
  personal: [
    "今晚你对这次聚会有什么期待？",
    "猜猜看，大家都是做什么工作的？",
    "如果明年要实现一个重要目标，会是什么？为什么？",
    "有什么经历塑造了现在的你？",
    "如果要教一门课，你会教什么？",
    "你觉得自己在哪方面成长了很多？",
    "最近学到的最重要的一课是什么？",
    "如果可以给5年前的自己一个建议，会说什么？",
  ],
  values: [
    "有什么信念或价值观对你很重要？它如何影响你的选择？",
    "你觉得人类的发展方向是在进步还是倒退？为什么？",
    "什么样的事情会让你觉得很有意义？",
    "你觉得什么品质在人身上最可贵？",
    "有什么原则是你一直坚持的？",
    "你希望为这个世界留下什么？",
    "对你来说，成功意味着什么？",
  ],
  dining: [
    "最近发现的宝藏餐厅在哪里？",
    "有什么菜你觉得被严重低估了？",
    "如果只能吃一种美食过一年，你选什么？",
    "你做饭吗？有什么拿手菜？",
    "最怀念的家乡味道是什么？",
    "有什么食物是你小时候讨厌、长大后爱上的？",
  ],
  city_life: [
    "你觉得这座城市最吸引你的地方是什么？",
    "如果可以改变城市的一个问题，你会选什么？",
    "周末通常会去哪里逛？",
    "有什么本地的隐藏好去处推荐？",
    "你理想中的生活节奏是怎样的？",
    "城市生活最让你头疼的事是什么？",
  ],
};

// 兴趣到分类的映射
const interestToCategoryMap: Record<string, string[]> = {
  "旅行": ["travel"],
  "户外": ["travel"],
  "摄影": ["creativity", "travel"],
  "美食": ["dining"],
  "烹饪": ["dining"],
  "咖啡": ["dining", "city_life"],
  "电影": ["creativity"],
  "音乐": ["creativity"],
  "阅读": ["creativity", "personal"],
  "艺术": ["creativity"],
  "科技": ["innovation"],
  "创业": ["innovation", "personal"],
  "投资": ["innovation"],
  "健身": ["passions"],
  "瑜伽": ["passions", "personal"],
  "运动": ["passions"],
  "游戏": ["passions"],
  "桌游": ["passions"],
  "宠物": ["lighthearted"],
  "时尚": ["creativity"],
  "设计": ["creativity"],
};

// 所有可能的兴趣标签（包含映射内和映射外的）
const allPossibleInterests = [
  // 映射内的兴趣
  "旅行", "户外", "摄影", "美食", "烹饪", "咖啡", "电影", "音乐", 
  "阅读", "艺术", "科技", "创业", "投资", "健身", "瑜伽", "运动", 
  "游戏", "桌游", "宠物", "时尚", "设计",
  // 映射外的兴趣（测试覆盖率）
  "心理学", "哲学", "历史", "政治", "金融", "医学", "法律", "教育",
  "育儿", "园艺", "钓鱼", "露营", "滑雪", "潜水", "冲浪", "攀岩",
  "跑步", "骑行", "篮球", "足球", "网球", "高尔夫", "电竞", "动漫",
  "追剧", "综艺", "播客", "写作", "绘画", "手工", "烘焙", "调酒",
  "品酒", "茶道", "花艺", "占星", "塔罗", "冥想", "数字营销", "自媒体",
];

// 模拟话题生成逻辑（与routes.ts一致）
function generateCuratedTopics(attendees: { interests: string[] }[]) {
  const allInterests: string[] = [];
  
  for (const attendee of attendees) {
    allInterests.push(...attendee.interests);
  }

  // 计算共同兴趣
  const interestCounts: Record<string, number> = {};
  for (const interest of allInterests) {
    interestCounts[interest] = (interestCounts[interest] || 0) + 1;
  }
  const commonInterests = Object.entries(interestCounts)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([interest]) => interest)
    .slice(0, 5);

  // 确定优先分类
  const prioritizedCategories: string[] = [];
  for (const interest of commonInterests) {
    const categories = interestToCategoryMap[interest];
    if (categories) {
      prioritizedCategories.push(...categories);
    }
  }

  // 统计未映射的兴趣
  const unmappedInterests = allInterests.filter(i => !interestToCategoryMap[i]);

  // 构建分类顺序
  let categoryOrder: string[];
  if (prioritizedCategories.length > 0) {
    categoryOrder = ["lighthearted", ...new Set(prioritizedCategories), "passions", "personal", "travel", "creativity"];
  } else {
    categoryOrder = ["lighthearted", "dining", "passions", "travel", "creativity", "city_life", "innovation", "personal"];
  }

  type DifficultyLevel = "easy" | "medium" | "deep";
  const categoryDifficulty: Record<string, DifficultyLevel> = {
    lighthearted: "easy",
    dining: "easy",
    city_life: "easy",
    passions: "medium",
    travel: "medium",
    creativity: "medium",
    innovation: "medium",
    personal: "deep",
    values: "deep",
  };

  // 选择话题
  const curatedTopics: { question: string; category: string; difficulty: DifficultyLevel }[] = [];
  const usedQuestions = new Set<string>();
  const TARGET_TOPICS = 8;
  const uniqueCategories = [...new Set(categoryOrder)];
  const allCategories = Object.keys(icebreakerQuestions);

  // 第一轮：每类1条
  for (const category of uniqueCategories) {
    const questions = icebreakerQuestions[category as keyof typeof icebreakerQuestions];
    if (questions && questions.length > 0) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      for (const q of shuffled) {
        if (!usedQuestions.has(q)) {
          usedQuestions.add(q);
          curatedTopics.push({
            question: q,
            category,
            difficulty: categoryDifficulty[category] || "medium",
          });
          break;
        }
      }
    }
  }

  // 第二轮：补充到8条
  for (const category of allCategories) {
    if (curatedTopics.length >= TARGET_TOPICS) break;
    const questions = icebreakerQuestions[category as keyof typeof icebreakerQuestions];
    if (questions && questions.length > 0) {
      const shuffled = [...questions].sort(() => Math.random() - 0.5);
      for (const q of shuffled) {
        if (!usedQuestions.has(q) && curatedTopics.length < TARGET_TOPICS) {
          usedQuestions.add(q);
          curatedTopics.push({
            question: q,
            category,
            difficulty: categoryDifficulty[category] || "medium",
          });
        }
        if (curatedTopics.length >= TARGET_TOPICS) break;
      }
    }
  }

  return {
    commonInterests,
    prioritizedCategories: [...new Set(prioritizedCategories)],
    unmappedInterests: [...new Set(unmappedInterests)],
    curatedTopics,
    hasPersonalization: prioritizedCategories.length > 0,
  };
}

// 随机生成一个用户
function generateRandomUser() {
  const numInterests = 3 + Math.floor(Math.random() * 3); // 3-5个兴趣
  const shuffled = [...allPossibleInterests].sort(() => Math.random() - 0.5);
  return {
    interests: shuffled.slice(0, numInterests),
  };
}

// 运行模拟
function runSimulation(numSimulations: number = 10000) {
  console.log(`\n🎲 开始模拟 ${numSimulations.toLocaleString()} 个4-6人聚会...\n`);

  const stats = {
    total: numSimulations,
    hasCommonInterests: 0,
    hasPersonalization: 0,
    avgCommonInterests: 0,
    avgUnmappedInterests: 0,
    categoryCoverage: {} as Record<string, number>,
    questionUsage: {} as Record<string, number>,
    groupSizeDistribution: { 4: 0, 5: 0, 6: 0 },
    repeatTestResults: [] as number[],
  };

  let totalCommonInterests = 0;
  let totalUnmapped = 0;

  for (let i = 0; i < numSimulations; i++) {
    // 随机4-6人
    const groupSize = 4 + Math.floor(Math.random() * 3);
    stats.groupSizeDistribution[groupSize as 4 | 5 | 6]++;

    // 生成参与者
    const attendees = Array.from({ length: groupSize }, () => generateRandomUser());

    // 运行话题生成逻辑
    const result = generateCuratedTopics(attendees);

    // 统计
    if (result.commonInterests.length > 0) {
      stats.hasCommonInterests++;
    }
    if (result.hasPersonalization) {
      stats.hasPersonalization++;
    }
    totalCommonInterests += result.commonInterests.length;
    totalUnmapped += result.unmappedInterests.length;

    // 统计分类覆盖
    for (const topic of result.curatedTopics) {
      stats.categoryCoverage[topic.category] = (stats.categoryCoverage[topic.category] || 0) + 1;
      stats.questionUsage[topic.question] = (stats.questionUsage[topic.question] || 0) + 1;
    }

    // 每1000次测试一次重复率（同一群人连续3次）
    if (i % 1000 === 0) {
      const result1 = generateCuratedTopics(attendees);
      const result2 = generateCuratedTopics(attendees);
      const result3 = generateCuratedTopics(attendees);
      
      const questions1 = new Set(result1.curatedTopics.map(t => t.question));
      const questions2 = new Set(result2.curatedTopics.map(t => t.question));
      const questions3 = new Set(result3.curatedTopics.map(t => t.question));
      
      let overlap12 = 0, overlap23 = 0, overlap13 = 0;
      questions1.forEach(q => { if (questions2.has(q)) overlap12++; });
      questions2.forEach(q => { if (questions3.has(q)) overlap23++; });
      questions1.forEach(q => { if (questions3.has(q)) overlap13++; });
      
      const avgOverlap = (overlap12 + overlap23 + overlap13) / 3;
      stats.repeatTestResults.push(avgOverlap / 8 * 100); // 百分比
    }
  }

  stats.avgCommonInterests = totalCommonInterests / numSimulations;
  stats.avgUnmapped = totalUnmapped / numSimulations;

  // 输出报告
  console.log("═".repeat(60));
  console.log("📊 模拟测试报告");
  console.log("═".repeat(60));
  
  console.log("\n【基础统计】");
  console.log(`  总模拟次数: ${stats.total.toLocaleString()}`);
  console.log(`  聚会规模分布: 4人(${stats.groupSizeDistribution[4]}) / 5人(${stats.groupSizeDistribution[5]}) / 6人(${stats.groupSizeDistribution[6]})`);

  console.log("\n【共同兴趣命中】");
  const commonInterestRate = (stats.hasCommonInterests / stats.total * 100).toFixed(1);
  console.log(`  有共同兴趣的聚会: ${stats.hasCommonInterests.toLocaleString()} (${commonInterestRate}%)`);
  console.log(`  平均共同兴趣数: ${stats.avgCommonInterests.toFixed(2)}`);

  console.log("\n【个性化程度】");
  const personalizationRate = (stats.hasPersonalization / stats.total * 100).toFixed(1);
  console.log(`  触发个性化推荐: ${stats.hasPersonalization.toLocaleString()} (${personalizationRate}%)`);
  console.log(`  平均未映射兴趣: ${stats.avgUnmapped.toFixed(2)} (这些兴趣无法个性化)`);

  console.log("\n【话题分类覆盖】");
  const sortedCategories = Object.entries(stats.categoryCoverage)
    .sort((a, b) => b[1] - a[1]);
  for (const [category, count] of sortedCategories) {
    const bar = "█".repeat(Math.round(count / stats.total * 50));
    console.log(`  ${category.padEnd(12)} ${bar} ${(count / stats.total * 100).toFixed(1)}%`);
  }

  console.log("\n【话题使用分布】");
  const questionCounts = Object.values(stats.questionUsage);
  const maxUsage = Math.max(...questionCounts);
  const minUsage = Math.min(...questionCounts);
  const avgUsage = questionCounts.reduce((a, b) => a + b, 0) / questionCounts.length;
  console.log(`  话题总数: ${questionCounts.length}`);
  console.log(`  最高使用: ${maxUsage} 次`);
  console.log(`  最低使用: ${minUsage} 次`);
  console.log(`  平均使用: ${avgUsage.toFixed(1)} 次`);
  console.log(`  使用均匀度: ${(minUsage / maxUsage * 100).toFixed(1)}% (越高越均匀)`);

  // 找出最少使用的话题
  const leastUsed = Object.entries(stats.questionUsage)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5);
  console.log(`  最少使用的5个话题:`);
  for (const [q, count] of leastUsed) {
    console.log(`    - "${q.slice(0, 20)}..." (${count}次)`);
  }

  console.log("\n【重复率测试】(同一群人连续3次打开)");
  const avgRepeat = stats.repeatTestResults.reduce((a, b) => a + b, 0) / stats.repeatTestResults.length;
  console.log(`  平均重复率: ${avgRepeat.toFixed(1)}%`);
  console.log(`  ${avgRepeat < 30 ? "✅ 重复率可接受" : avgRepeat < 50 ? "⚠️ 重复率偏高" : "❌ 重复率过高"}`);

  console.log("\n═".repeat(60));
  console.log("📋 智能度评估");
  console.log("═".repeat(60));

  let score = 0;
  const maxScore = 100;

  // 评分：共同兴趣命中率 (30分)
  const commonScore = Math.min(30, Number(commonInterestRate) * 0.35);
  score += commonScore;
  console.log(`\n1. 共同兴趣识别: ${commonScore.toFixed(0)}/30`);
  console.log(`   ${Number(commonInterestRate) >= 70 ? "✅" : "⚠️"} ${commonInterestRate}% 的聚会能找到共同兴趣`);

  // 评分：个性化触发率 (25分)
  const personScore = Math.min(25, Number(personalizationRate) * 0.3);
  score += personScore;
  console.log(`\n2. 个性化推荐: ${personScore.toFixed(0)}/25`);
  console.log(`   ${Number(personalizationRate) >= 50 ? "✅" : "⚠️"} ${personalizationRate}% 的聚会触发个性化`);

  // 评分：话题均匀度 (20分)
  const uniformity = minUsage / maxUsage * 100;
  const uniformScore = uniformity * 0.2;
  score += uniformScore;
  console.log(`\n3. 话题覆盖均匀度: ${uniformScore.toFixed(0)}/20`);
  console.log(`   ${uniformity >= 30 ? "✅" : "⚠️"} 均匀度 ${uniformity.toFixed(1)}%`);

  // 评分：重复率 (25分)
  const repeatScore = Math.max(0, 25 - avgRepeat * 0.5);
  score += repeatScore;
  console.log(`\n4. 低重复率: ${repeatScore.toFixed(0)}/25`);
  console.log(`   ${avgRepeat <= 30 ? "✅" : "⚠️"} 重复率 ${avgRepeat.toFixed(1)}%`);

  console.log("\n" + "─".repeat(60));
  console.log(`🏆 智能度总分: ${score.toFixed(0)}/${maxScore}`);
  
  if (score >= 80) {
    console.log("   评级: ⭐⭐⭐⭐⭐ 非常智能");
  } else if (score >= 60) {
    console.log("   评级: ⭐⭐⭐⭐ 比较智能");
  } else if (score >= 40) {
    console.log("   评级: ⭐⭐⭐ 基本可用");
  } else {
    console.log("   评级: ⭐⭐ 需要优化");
  }

  console.log("\n【改进建议】");
  if (Number(personalizationRate) < 60) {
    console.log("  🔸 扩展兴趣映射表：当前只覆盖21种兴趣，建议扩展到50+");
  }
  if (avgRepeat > 30) {
    console.log("  🔸 增加话题库容量：当前约60条，建议扩展到100+");
  }
  if (uniformity < 40) {
    console.log("  🔸 优化选题算法：让冷门分类有更多曝光机会");
  }
  if (stats.avgUnmapped > 5) {
    console.log("  🔸 处理未映射兴趣：考虑用AI动态生成相关话题");
  }
}

// 运行
runSimulation(10000);
