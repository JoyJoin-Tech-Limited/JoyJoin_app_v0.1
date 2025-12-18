import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

const VERSION_A = `深度模式——意味着我能把你摸得更透，匹配更准。
大概6-7分钟，聊聊你是什么type的人，包括你的社交能量画像。值得投资。
先说个称呼？`;

const VERSION_B = `深度模式——意味着我能把你摸得更透，匹配更准。
大概6-7分钟，聊聊你是什么type的人，包括你的社交能量画像。不亏。
先说个称呼？`;

const VERSION_C = `深度模式——意味着我能把你摸得更透，匹配更准。
大概6-7分钟，聊聊你是什么type的人。
先说个称呼？`;

const USER_PERSONAS = [
  { age: "00后", gender: "女", occupation: "大学生" },
  { age: "00后", gender: "男", occupation: "程序员" },
  { age: "95后", gender: "女", occupation: "设计师" },
  { age: "95后", gender: "男", occupation: "金融" },
  { age: "90后", gender: "女", occupation: "教师" },
  { age: "90后", gender: "男", occupation: "创业者" },
  { age: "85后", gender: "女", occupation: "HR" },
  { age: "85后", gender: "男", occupation: "销售" },
  { age: "95后", gender: "女", occupation: "自由职业" },
  { age: "90后", gender: "男", occupation: "医生" },
  { age: "00后", gender: "女", occupation: "新媒体运营" },
  { age: "95后", gender: "男", occupation: "律师" },
  { age: "90后", gender: "女", occupation: "产品经理" },
  { age: "85后", gender: "男", occupation: "工程师" },
  { age: "00后", gender: "男", occupation: "电商" },
  { age: "95后", gender: "女", occupation: "护士" },
  { age: "90后", gender: "男", occupation: "摄影师" },
  { age: "85后", gender: "女", occupation: "会计" },
  { age: "00后", gender: "女", occupation: "模特" },
  { age: "95后", gender: "男", occupation: "厨师" },
];

interface TestResult {
  persona: string;
  choice: "A" | "B" | "C";
  reason: string;
}

async function testUser(persona: { age: string; gender: string; occupation: string }, index: number): Promise<TestResult> {
  const personaStr = `${persona.age}${persona.gender}生，职业：${persona.occupation}`;
  
  const prompt = `你是一个${personaStr}，正在注册一个社交活动平台。你看到了AI助手"小悦"的开场白。

请从以下三个版本中选择你最喜欢的一个，并简短说明原因（20字以内）：

【版本A】
${VERSION_A}

【版本B】
${VERSION_B}

【版本C】
${VERSION_C}

请用以下格式回答：
选择：[A/B/C]
原因：[你的理由]`;

  try {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content || "";
    
    const choiceMatch = content.match(/选择[：:]\s*([ABC])/i);
    const reasonMatch = content.match(/原因[：:]\s*(.+)/);
    
    const choice = (choiceMatch?.[1]?.toUpperCase() as "A" | "B" | "C") || "C";
    const reason = reasonMatch?.[1]?.trim().slice(0, 50) || "未提供原因";

    return { persona: personaStr, choice, reason };
  } catch (error) {
    console.error(`Error for user ${index}:`, error);
    return { persona: personaStr, choice: "C", reason: "API错误" };
  }
}

async function runTest() {
  console.log("🦊 开始模拟用户测试 - Nick Wilde风格偏好\n");
  console.log("测试的三个版本：");
  console.log("A: 「值得投资」（原版）");
  console.log("B: 「不亏」（街头风）");
  console.log("C: 直接删掉（简洁版）\n");
  console.log("=".repeat(60) + "\n");

  const results: TestResult[] = [];
  const counts = { A: 0, B: 0, C: 0 };
  const reasonsByChoice: { A: string[]; B: string[]; C: string[] } = { A: [], B: [], C: [] };

  const batchSize = 10;
  const totalUsers = 100;
  
  for (let batch = 0; batch < totalUsers / batchSize; batch++) {
    const startIdx = batch * batchSize;
    console.log(`处理批次 ${batch + 1}/${totalUsers / batchSize}... (用户 ${startIdx + 1}-${startIdx + batchSize})`);
    
    const batchPromises = [];
    for (let i = 0; i < batchSize; i++) {
      const userIndex = startIdx + i;
      const persona = USER_PERSONAS[userIndex % USER_PERSONAS.length];
      batchPromises.push(testUser(persona, userIndex));
    }
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const result of batchResults) {
      results.push(result);
      counts[result.choice]++;
      reasonsByChoice[result.choice].push(result.reason);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 测试结果统计\n");
  
  const total = results.length;
  console.log(`版本A「值得投资」: ${counts.A}票 (${(counts.A / total * 100).toFixed(1)}%)`);
  console.log(`版本B「不亏」: ${counts.B}票 (${(counts.B / total * 100).toFixed(1)}%)`);
  console.log(`版本C 简洁版: ${counts.C}票 (${(counts.C / total * 100).toFixed(1)}%)`);
  
  console.log("\n🏆 获胜版本:", counts.A >= counts.B && counts.A >= counts.C ? "A" : counts.B >= counts.C ? "B" : "C");
  
  console.log("\n📝 典型评价：\n");
  
  console.log("版本A「值得投资」:");
  reasonsByChoice.A.slice(0, 5).forEach(r => console.log(`  - ${r}`));
  
  console.log("\n版本B「不亏」:");
  reasonsByChoice.B.slice(0, 5).forEach(r => console.log(`  - ${r}`));
  
  console.log("\n版本C 简洁版:");
  reasonsByChoice.C.slice(0, 5).forEach(r => console.log(`  - ${r}`));

  const genderBreakdown = { 
    male: { A: 0, B: 0, C: 0, total: 0 }, 
    female: { A: 0, B: 0, C: 0, total: 0 } 
  };
  
  results.forEach((r) => {
    const isMale = r.persona.includes("男");
    const key = isMale ? "male" : "female";
    genderBreakdown[key][r.choice]++;
    genderBreakdown[key].total++;
  });

  console.log("\n👥 性别偏好分析：");
  console.log(`男生: A=${genderBreakdown.male.A} B=${genderBreakdown.male.B} C=${genderBreakdown.male.C}`);
  console.log(`女生: A=${genderBreakdown.female.A} B=${genderBreakdown.female.B} C=${genderBreakdown.female.C}`);
}

runTest().catch(console.error);
