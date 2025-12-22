/**
 * 端到端流程测试脚本
 * 模拟100个用户走完整个注册流程，验证每个节点的衔接
 * 
 * 流程：新用户登录 → 注册页 → 性格测试 → 发现页
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TOTAL_USERS = 100;
const DEMO_CODE = '666666';

interface TestResult {
  userId: string;
  phone: string;
  steps: {
    login: { success: boolean; hasCompletedRegistration?: boolean; error?: string };
    registration: { success: boolean; error?: string };
    personalityTest: { success: boolean; archetype?: string; error?: string };
    finalCheck: { success: boolean; hasCompletedRegistration?: boolean; hasCompletedPersonalityTest?: boolean; error?: string };
  };
  flowComplete: boolean;
  duration: number;
}

interface TestSummary {
  total: number;
  successful: number;
  failed: number;
  successRate: string;
  avgDuration: string;
  stepBreakdown: {
    login: { success: number; fail: number };
    registration: { success: number; fail: number };
    personalityTest: { success: number; fail: number };
    finalCheck: { success: number; fail: number };
  };
  issues: string[];
}

class CookieJar {
  private cookies: Map<string, string> = new Map();
  
  setCookies(setCookieHeader: string | string[] | null) {
    if (!setCookieHeader) return;
    const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    for (const header of headers) {
      const parts = header.split(';')[0].split('=');
      if (parts.length >= 2) {
        this.cookies.set(parts[0], parts.slice(1).join('='));
      }
    }
  }
  
  getCookieString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function testUserFlow(userIndex: number): Promise<TestResult> {
  const startTime = Date.now();
  const phone = `138${String(10000000 + userIndex).padStart(8, '0')}`;
  const cookieJar = new CookieJar();
  
  const result: TestResult = {
    userId: '',
    phone,
    steps: {
      login: { success: false },
      registration: { success: false },
      personalityTest: { success: false },
      finalCheck: { success: false },
    },
    flowComplete: false,
    duration: 0,
  };
  
  try {
    // Step 1: Phone Login (new user)
    const loginRes = await fetch(`${BASE_URL}/api/auth/phone-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phone, code: DEMO_CODE }),
    });
    
    const setCookie = loginRes.headers.get('set-cookie');
    cookieJar.setCookies(setCookie);
    
    if (!loginRes.ok) {
      result.steps.login.error = `HTTP ${loginRes.status}`;
      return finishTest(result, startTime);
    }
    
    const loginData = await loginRes.json();
    result.userId = loginData.userId;
    result.steps.login.success = true;
    result.steps.login.hasCompletedRegistration = loginData.hasCompletedRegistration;
    
    // Verify: New user should have hasCompletedRegistration = false
    if (loginData.hasCompletedRegistration === true) {
      result.steps.login.error = 'Expected hasCompletedRegistration=false for new user';
    }
    
    // Step 2: Complete Registration (simulate AI chat registration completion)
    // Need to provide conversationHistory with at least 4 messages
    const gender = userIndex % 2 === 0 ? '男' : '女';
    const city = userIndex % 2 === 0 ? '香港' : '深圳';
    const nickname = `TestUser${userIndex}`;
    const birthYear = 1995 + (userIndex % 10);
    
    const conversationHistory = [
      { role: 'assistant', content: '嗨～我是小悦！很高兴认识你！你希望大家怎么称呼你呀？' },
      { role: 'user', content: `叫我${nickname}就好` },
      { role: 'assistant', content: `${nickname}，这名字很好听！你现在在哪个城市呢？` },
      { role: 'user', content: `我在${city}工作` },
      { role: 'assistant', content: '了解了！你是做什么工作的呀？' },
      { role: 'user', content: '互联网行业，做产品经理' },
      { role: 'assistant', content: '产品经理很有趣！平时有什么爱好吗？' },
      { role: 'user', content: `喜欢摄影、音乐和喝咖啡。对了我是${birthYear}年出生的${gender}生` },
    ];
    
    const registrationData = {
      conversationHistory,
      phoneNumber: phone,
      startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    };
    
    const regRes = await fetch(`${BASE_URL}/api/registration/chat/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieJar.getCookieString(),
      },
      body: JSON.stringify(registrationData),
    });
    
    if (!regRes.ok) {
      const errText = await regRes.text();
      result.steps.registration.error = `HTTP ${regRes.status}: ${errText.slice(0, 100)}`;
      return finishTest(result, startTime);
    }
    
    result.steps.registration.success = true;
    
    // Step 3: Submit Personality Test
    const testResponses = generatePersonalityTestResponses();
    
    const testRes = await fetch(`${BASE_URL}/api/personality-test/v2/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieJar.getCookieString(),
      },
      body: JSON.stringify({ responses: testResponses }),
    });
    
    if (!testRes.ok) {
      const errText = await testRes.text();
      result.steps.personalityTest.error = `HTTP ${testRes.status}: ${errText.slice(0, 100)}`;
      return finishTest(result, startTime);
    }
    
    const testData = await testRes.json();
    result.steps.personalityTest.success = true;
    result.steps.personalityTest.archetype = testData.primaryRole || testData.archetype;
    
    // Step 4: Final Check - Verify user status
    const userRes = await fetch(`${BASE_URL}/api/auth/user`, {
      headers: { 'Cookie': cookieJar.getCookieString() },
    });
    
    if (!userRes.ok) {
      result.steps.finalCheck.error = `HTTP ${userRes.status}`;
      return finishTest(result, startTime);
    }
    
    const userData = await userRes.json();
    result.steps.finalCheck.success = true;
    result.steps.finalCheck.hasCompletedRegistration = userData.hasCompletedRegistration;
    result.steps.finalCheck.hasCompletedPersonalityTest = userData.hasCompletedPersonalityTest;
    
    // Verify final state
    if (!userData.hasCompletedRegistration) {
      result.steps.finalCheck.error = 'hasCompletedRegistration should be true after registration';
    }
    if (!userData.hasCompletedPersonalityTest) {
      result.steps.finalCheck.error = 'hasCompletedPersonalityTest should be true after test';
    }
    
    // All steps passed
    const allStepsSuccess = 
      result.steps.login.success &&
      result.steps.registration.success &&
      result.steps.personalityTest.success &&
      result.steps.finalCheck.success;
    
    const registrationComplete = userData.hasCompletedRegistration === true;
    const personalityComplete = userData.hasCompletedPersonalityTest === true;
    
    result.flowComplete = allStepsSuccess && registrationComplete && personalityComplete;
    
    // Debug: Log if steps passed but flow not complete
    if (allStepsSuccess && !result.flowComplete) {
      console.log(`Debug ${phone}: hasCompletedRegistration=${userData.hasCompletedRegistration}, hasCompletedPersonalityTest=${userData.hasCompletedPersonalityTest}`);
    }
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (!result.steps.login.success) {
      result.steps.login.error = errMsg;
    } else if (!result.steps.registration.success) {
      result.steps.registration.error = errMsg;
    } else if (!result.steps.personalityTest.success) {
      result.steps.personalityTest.error = errMsg;
    } else {
      result.steps.finalCheck.error = errMsg;
    }
  }
  
  return finishTest(result, startTime);
}

function finishTest(result: TestResult, startTime: number): TestResult {
  result.duration = Date.now() - startTime;
  return result;
}

interface TraitScores {
  A?: number;
  O?: number;
  C?: number;
  E?: number;
  X?: number;
  P?: number;
}

interface AnswerV2 {
  type: "single" | "dual";
  value?: string;
  mostLike?: string;
  secondLike?: string;
  traitScores: TraitScores;
  secondTraitScores?: TraitScores;
}

function generatePersonalityTestResponses(): Record<number, AnswerV2> {
  const responses: Record<number, AnswerV2> = {};
  const traitOptions = ['A', 'O', 'C', 'E', 'X', 'P'] as const;
  
  for (let i = 1; i <= 12; i++) {
    const randomTraits: TraitScores = {};
    const numTraits = 2 + Math.floor(Math.random() * 3); // 2-4 traits per answer
    const selectedTraits = [...traitOptions].sort(() => Math.random() - 0.5).slice(0, numTraits);
    
    for (const trait of selectedTraits) {
      randomTraits[trait] = 5 + Math.floor(Math.random() * 10); // 5-14 points
    }
    
    responses[i] = {
      type: "single",
      value: `option_${Math.floor(Math.random() * 4)}`,
      traitScores: randomTraits,
    };
  }
  return responses;
}

function generateSummary(results: TestResult[]): TestSummary {
  const summary: TestSummary = {
    total: results.length,
    successful: results.filter(r => r.flowComplete).length,
    failed: results.filter(r => !r.flowComplete).length,
    successRate: '',
    avgDuration: '',
    stepBreakdown: {
      login: { success: 0, fail: 0 },
      registration: { success: 0, fail: 0 },
      personalityTest: { success: 0, fail: 0 },
      finalCheck: { success: 0, fail: 0 },
    },
    issues: [],
  };
  
  summary.successRate = `${((summary.successful / summary.total) * 100).toFixed(1)}%`;
  summary.avgDuration = `${(results.reduce((sum, r) => sum + r.duration, 0) / results.length).toFixed(0)}ms`;
  
  const issueSet = new Set<string>();
  
  for (const r of results) {
    if (r.steps.login.success) summary.stepBreakdown.login.success++;
    else {
      summary.stepBreakdown.login.fail++;
      if (r.steps.login.error) issueSet.add(`登录: ${r.steps.login.error}`);
    }
    
    if (r.steps.registration.success) summary.stepBreakdown.registration.success++;
    else {
      summary.stepBreakdown.registration.fail++;
      if (r.steps.registration.error) issueSet.add(`注册: ${r.steps.registration.error}`);
    }
    
    if (r.steps.personalityTest.success) summary.stepBreakdown.personalityTest.success++;
    else {
      summary.stepBreakdown.personalityTest.fail++;
      if (r.steps.personalityTest.error) issueSet.add(`性格测试: ${r.steps.personalityTest.error}`);
    }
    
    if (r.steps.finalCheck.success) summary.stepBreakdown.finalCheck.success++;
    else {
      summary.stepBreakdown.finalCheck.fail++;
      if (r.steps.finalCheck.error) issueSet.add(`最终检查: ${r.steps.finalCheck.error}`);
    }
  }
  
  summary.issues = Array.from(issueSet);
  
  return summary;
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('端到端流程测试 - 模拟100个用户注册流程');
  console.log('='.repeat(60));
  console.log(`\n测试流程: 新用户登录 → 注册页 → 性格测试 → 发现页\n`);
  console.log(`开始时间: ${new Date().toLocaleString()}`);
  console.log(`测试用户数: ${TOTAL_USERS}`);
  console.log(`服务器地址: ${BASE_URL}\n`);
  
  const results: TestResult[] = [];
  const batchSize = 10; // Run 10 users in parallel
  
  for (let i = 0; i < TOTAL_USERS; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, TOTAL_USERS); j++) {
      batch.push(testUserFlow(j));
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    const completed = Math.min(i + batchSize, TOTAL_USERS);
    const successCount = results.filter(r => r.flowComplete).length;
    process.stdout.write(`\r进度: ${completed}/${TOTAL_USERS} (成功: ${successCount})`);
  }
  
  console.log('\n');
  
  // Generate summary
  const summary = generateSummary(results);
  
  console.log('='.repeat(60));
  console.log('测试结果汇总');
  console.log('='.repeat(60));
  console.log(`\n总用户数: ${summary.total}`);
  console.log(`成功完成: ${summary.successful}`);
  console.log(`失败: ${summary.failed}`);
  console.log(`成功率: ${summary.successRate}`);
  console.log(`平均耗时: ${summary.avgDuration}`);
  
  console.log('\n--- 各步骤统计 ---');
  console.log(`登录:       成功 ${summary.stepBreakdown.login.success} / 失败 ${summary.stepBreakdown.login.fail}`);
  console.log(`注册:       成功 ${summary.stepBreakdown.registration.success} / 失败 ${summary.stepBreakdown.registration.fail}`);
  console.log(`性格测试:   成功 ${summary.stepBreakdown.personalityTest.success} / 失败 ${summary.stepBreakdown.personalityTest.fail}`);
  console.log(`最终检查:   成功 ${summary.stepBreakdown.finalCheck.success} / 失败 ${summary.stepBreakdown.finalCheck.fail}`);
  
  if (summary.issues.length > 0) {
    console.log('\n--- 发现的问题 ---');
    for (const issue of summary.issues) {
      console.log(`  - ${issue}`);
    }
  }
  
  // Output detailed failures
  const failures = results.filter(r => !r.flowComplete);
  if (failures.length > 0 && failures.length <= 10) {
    console.log('\n--- 失败详情 (前10个) ---');
    for (const f of failures.slice(0, 10)) {
      console.log(`\n用户 ${f.phone}:`);
      if (!f.steps.login.success) console.log(`  登录失败: ${f.steps.login.error}`);
      if (f.steps.login.success && !f.steps.registration.success) console.log(`  注册失败: ${f.steps.registration.error}`);
      if (f.steps.registration.success && !f.steps.personalityTest.success) console.log(`  性格测试失败: ${f.steps.personalityTest.error}`);
      if (f.steps.personalityTest.success && !f.steps.finalCheck.success) console.log(`  最终检查失败: ${f.steps.finalCheck.error}`);
    }
  }
  
  // Archetype distribution
  const archetypes = results
    .filter(r => r.steps.personalityTest.archetype)
    .map(r => r.steps.personalityTest.archetype!);
  
  if (archetypes.length > 0) {
    const distribution: Record<string, number> = {};
    for (const a of archetypes) {
      distribution[a] = (distribution[a] || 0) + 1;
    }
    
    console.log('\n--- 性格类型分布 ---');
    const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
    for (const [archetype, count] of sorted) {
      const pct = ((count / archetypes.length) * 100).toFixed(1);
      console.log(`  ${archetype}: ${count} (${pct}%)`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`测试完成: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
  
  // Return exit code based on success rate
  const successThreshold = 0.9; // 90%
  if (summary.successful / summary.total < successThreshold) {
    console.log(`\n⚠️  成功率低于 ${successThreshold * 100}%，请检查问题`);
    process.exit(1);
  } else {
    console.log(`\n✅ 测试通过！成功率达到 ${summary.successRate}`);
    process.exit(0);
  }
}

runTests().catch(console.error);
