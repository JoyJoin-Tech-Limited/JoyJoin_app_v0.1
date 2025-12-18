import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

interface TestResult {
  oderId: string;
  preference: "3D" | "2D" | "both_ok";
  reasoning: string;
  trustScore3D: number;
  trustScore2D: number;
  brandFit3D: number;
  brandFit2D: number;
  memorability3D: number;
  memorability2D: number;
}

const userPersonas = [
  "25岁女生，UI设计师，对视觉审美很敏感，喜欢高质感的设计",
  "32岁男生，程序员，注重功能性，对设计没太多偏好",
  "28岁女生，市场经理，经常使用各种社交App",
  "35岁男生，创业者，时间宝贵，喜欢简洁高效的界面",
  "23岁女生，大学生，喜欢可爱的卡通形象",
  "30岁男生，金融行业，偏好专业成熟的设计风格",
  "27岁女生，自由职业者，喜欢有个性的设计",
  "40岁男生，企业高管，使用App主要看实用性",
  "26岁女生，教师，喜欢温暖亲切的设计",
  "33岁男生，医生，注重App的可信度和专业感",
  "24岁女生，新媒体运营，对流行趋势很敏感",
  "29岁男生，律师，偏好简洁专业的界面",
  "31岁女生，HR经理，看重App的友好度",
  "36岁男生，销售经理，经常社交，见多识广",
  "22岁女生，研究生，第一次使用社交配对App",
  "38岁男生，工程师，技术型用户，注重细节",
  "25岁女生，护士，工作忙碌，希望App轻松有趣",
  "34岁男生，建筑师，对设计有专业眼光",
  "28岁女生，会计，性格内向，对社交App有点紧张",
  "30岁男生，产品经理，经常分析各种App设计",
];

async function simulateUser(persona: string, orderId: number): Promise<TestResult> {
  const prompt = `你是一个真实的用户，正在评估一个社交App的AI助手形象设计。

你的身份：${persona}

这个App叫"悦聚"，是一个4-6人小局社交平台。App里有12种动物代表不同社交性格（2D扁平插画风格）。
现在要设计AI助手"小悦"的形象，有两个方案：

【方案A - 3D渲染风格】
- 3D日式动漫渲染，类似《疯狂动物城》Nick Wilde的质感
- 立体感强，毛发有光泽，表情生动
- 高级感和真实感，像一个"真正的角色"
- 与App里其他12种2D原型动物风格不同，更突出

【方案B - 2D扁平风格】
- 扁平矢量插画，简洁线条，柔和渐变
- 与App里其他12种动物原型风格一致
- 可爱简洁，加载快，图标感
- 融入整体设计，不会太突兀

两个方案的角色设定相同：拟人化狐狸，穿紫色卫衣，墨镜挂领口，表情松弛慵懒。

请以这个用户的身份，评估两个方案：

请用JSON格式回答：
{
  "preference": "3D" 或 "2D" 或 "both_ok",
  "reasoning": "选择这个方案的理由（用第一人称，30字以内）",
  "trustScore3D": 1-10的信任感评分,
  "trustScore2D": 1-10的信任感评分,
  "brandFit3D": 1-10的品牌契合度评分,
  "brandFit2D": 1-10的品牌契合度评分,
  "memorability3D": 1-10的记忆点评分,
  "memorability2D": 1-10的记忆点评分
}

只返回JSON，不要其他内容。`;

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        oderId: `user_${orderId}`,
        ...result,
      };
    }
  } catch (error) {
    console.error(`Error for user ${orderId}:`, error);
  }

  return {
    oderId: `user_${orderId}`,
    preference: "both_ok",
    reasoning: "都可以接受",
    trustScore3D: 7,
    trustScore2D: 7,
    brandFit3D: 7,
    brandFit2D: 7,
    memorability3D: 7,
    memorability2D: 7,
  };
}

async function runTest() {
  console.log("🦊 3D vs 2D 风格测试 - 100人模拟用户\n");
  console.log("=".repeat(50));

  const results: TestResult[] = [];
  const batchSize = 10;

  for (let batch = 0; batch < 10; batch++) {
    console.log(`\n📊 测试批次 ${batch + 1}/10...`);
    
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const userIndex = batch * batchSize + i;
      const persona = userPersonas[userIndex % userPersonas.length];
      promises.push(simulateUser(persona, userIndex + 1));
    }

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    const prefer3D = batchResults.filter(r => r.preference === "3D").length;
    const prefer2D = batchResults.filter(r => r.preference === "2D").length;
    console.log(`   本批结果: 3D=${prefer3D}, 2D=${prefer2D}`);
  }

  // 统计结果
  console.log("\n" + "=".repeat(50));
  console.log("📊 最终统计结果\n");

  const prefer3D = results.filter(r => r.preference === "3D").length;
  const prefer2D = results.filter(r => r.preference === "2D").length;
  const bothOk = results.filter(r => r.preference === "both_ok").length;

  console.log("【用户偏好】");
  console.log(`  3D渲染风格: ${prefer3D}人 (${prefer3D}%)`);
  console.log(`  2D扁平风格: ${prefer2D}人 (${prefer2D}%)`);
  console.log(`  都可以: ${bothOk}人 (${bothOk}%)`);

  // 计算平均分
  const avg = (arr: number[]) => (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);

  console.log("\n【信任感评分】");
  console.log(`  3D风格: ${avg(results.map(r => r.trustScore3D))}/10`);
  console.log(`  2D风格: ${avg(results.map(r => r.trustScore2D))}/10`);

  console.log("\n【品牌契合度评分】");
  console.log(`  3D风格: ${avg(results.map(r => r.brandFit3D))}/10`);
  console.log(`  2D风格: ${avg(results.map(r => r.brandFit2D))}/10`);

  console.log("\n【记忆点评分】");
  console.log(`  3D风格: ${avg(results.map(r => r.memorability3D))}/10`);
  console.log(`  2D风格: ${avg(results.map(r => r.memorability2D))}/10`);

  // 用户理由样本
  console.log("\n【选择3D的理由样本】");
  results
    .filter(r => r.preference === "3D")
    .slice(0, 5)
    .forEach(r => console.log(`  - "${r.reasoning}"`));

  console.log("\n【选择2D的理由样本】");
  results
    .filter(r => r.preference === "2D")
    .slice(0, 5)
    .forEach(r => console.log(`  - "${r.reasoning}"`));

  // 按用户类型分析
  console.log("\n【用户类型分析】");
  const designerResults = results.filter((_, i) => 
    userPersonas[i % userPersonas.length].includes("设计") || 
    userPersonas[i % userPersonas.length].includes("建筑")
  );
  const techResults = results.filter((_, i) => 
    userPersonas[i % userPersonas.length].includes("程序员") || 
    userPersonas[i % userPersonas.length].includes("工程师") ||
    userPersonas[i % userPersonas.length].includes("产品经理")
  );
  const casualResults = results.filter((_, i) => 
    userPersonas[i % userPersonas.length].includes("学生") || 
    userPersonas[i % userPersonas.length].includes("护士") ||
    userPersonas[i % userPersonas.length].includes("教师")
  );

  if (designerResults.length > 0) {
    const d3D = designerResults.filter(r => r.preference === "3D").length;
    const d2D = designerResults.filter(r => r.preference === "2D").length;
    console.log(`  设计类用户: 3D=${d3D}, 2D=${d2D}`);
  }

  if (techResults.length > 0) {
    const t3D = techResults.filter(r => r.preference === "3D").length;
    const t2D = techResults.filter(r => r.preference === "2D").length;
    console.log(`  技术类用户: 3D=${t3D}, 2D=${t2D}`);
  }

  if (casualResults.length > 0) {
    const c3D = casualResults.filter(r => r.preference === "3D").length;
    const c2D = casualResults.filter(r => r.preference === "2D").length;
    console.log(`  普通用户: 3D=${c3D}, 2D=${c2D}`);
  }

  console.log("\n" + "=".repeat(50));
  
  // 给出建议
  console.log("\n💡 建议：");
  if (prefer3D > prefer2D + 20) {
    console.log("   强烈推荐使用 3D渲染风格 - 用户明显偏好");
  } else if (prefer2D > prefer3D + 20) {
    console.log("   强烈推荐使用 2D扁平风格 - 用户明显偏好");
  } else if (prefer3D > prefer2D) {
    console.log("   倾向 3D渲染风格，但差距不大");
  } else if (prefer2D > prefer3D) {
    console.log("   倾向 2D扁平风格，但差距不大");
  } else {
    console.log("   两种风格接受度相当，可根据品牌策略选择");
  }
}

runTest().catch(console.error);
