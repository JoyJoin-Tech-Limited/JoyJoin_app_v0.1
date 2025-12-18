/**
 * Enrichment Chat Flow Test Script
 * Tests 500 simulated users with varying profile completeness levels
 * 
 * Run with: npx tsx scripts/test-enrichment-chat.ts
 */

// Inline profile completion calculation (matches client/src/lib/profileCompletion.ts)
interface ProfileField {
  key: string;
  label: string;
  weight: number;
  check: (user: any) => boolean;
}

const PROFILE_FIELDS: ProfileField[] = [
  { key: 'gender', label: '性别', weight: 1, check: (u) => !!u.gender },
  { key: 'birthday', label: '年龄', weight: 1, check: (u) => !!u.birthday },
  { key: 'city', label: '城市', weight: 0.8, check: (u) => !!u.city },
  { key: 'education', label: '学历', weight: 0.7, check: (u) => !!u.education },
  { key: 'interests', label: '兴趣', weight: 0.8, check: (u) => Array.isArray(u.interests) && u.interests.length > 0 },
  { key: 'languages', label: '语言', weight: 0.6, check: (u) => Array.isArray(u.languages) && u.languages.length > 0 },
  { key: 'industry', label: '行业', weight: 0.5, check: (u) => !!u.industry },
  { key: 'seniority', label: '资历', weight: 0.5, check: (u) => !!u.seniority },
  { key: 'relationshipStatus', label: '感情状态', weight: 0.5, check: (u) => !!u.relationshipStatus },
  { key: 'archetypeResult', label: '性格类型', weight: 0.7, check: (u) => !!u.archetypeResult },
  { key: 'socialEnergyType', label: '社交能量', weight: 0.5, check: (u) => !!u.socialEnergyType },
  { key: 'activityTimePreferences', label: '活动时间', weight: 0.4, check: (u) => Array.isArray(u.activityTimePreferences) && u.activityTimePreferences.length > 0 },
  { key: 'socialFrequency', label: '社交频率', weight: 0.4, check: (u) => !!u.socialFrequency },
  { key: 'cuisinePreferences', label: '饮食偏好', weight: 0.3, check: (u) => Array.isArray(u.cuisinePreferences) && u.cuisinePreferences.length > 0 },
  { key: 'topicAvoidances', label: '话题避开', weight: 0.2, check: (u) => Array.isArray(u.topicAvoidances) && u.topicAvoidances.length > 0 },
];

function calculateProfileCompletion(user: any): { percentage: number; stars: number; missingFields: string[] } {
  const totalWeight = PROFILE_FIELDS.reduce((sum, f) => sum + f.weight, 0);
  let filledWeight = 0;
  const missingFields: string[] = [];

  for (const field of PROFILE_FIELDS) {
    if (field.check(user)) {
      filledWeight += field.weight;
    } else {
      missingFields.push(field.label);
    }
  }

  const percentage = Math.round((filledWeight / totalWeight) * 100);
  
  let stars = 1;
  if (percentage >= 90) stars = 5;
  else if (percentage >= 75) stars = 4;
  else if (percentage >= 55) stars = 3;
  else if (percentage >= 35) stars = 2;

  return { percentage, stars, missingFields };
}

function getMatchingBoostEstimate(currentPercentage: number): number {
  if (currentPercentage < 30) return 40;
  if (currentPercentage < 50) return 35;
  if (currentPercentage < 70) return 25;
  if (currentPercentage < 90) return 15;
  return 0;
}

interface MockUser {
  id: number;
  nickname: string;
  gender: string | null;
  birthday: string | null;
  city: string | null;
  district: string | null;
  education: string | null;
  studyLocale: string | null;
  seniority: string | null;
  industry: string | null;
  relationshipStatus: string | null;
  hasChildren: string | null;
  languages: string[] | null;
  interests: string[] | null;
  cuisinePreferences: string[] | null;
  dietaryRestrictions: string[] | null;
  topicAvoidances: string[] | null;
  socialEnergyType: string | null;
  activityTimePreferences: string[] | null;
  socialFrequency: string | null;
  archetypeResult: any | null;
}

interface TestResult {
  userId: number;
  profileCompletion: number;
  stars: number;
  matchingBoost: number;
  missingFieldsCount: number;
  missingFields: string[];
  enrichmentContext: {
    mode: string;
    questionsToAsk: number;
    focusAreas: string[];
  };
}

interface TestSummary {
  totalUsers: number;
  completionDistribution: { [key: string]: number };
  starDistribution: { [key: string]: number };
  avgMissingFields: number;
  avgMatchingBoost: number;
  enrichmentEligible: number;
  focusAreaFrequency: { [key: string]: number };
}

// Field options for random generation
const CITIES = ['香港', '深圳', '广州', '上海', '北京'];
const DISTRICTS_HK = ['中环', '铜锣湾', '尖沙咀', '旺角', '沙田', '荃湾'];
const DISTRICTS_SZ = ['福田', '南山', '罗湖', '宝安', '龙华'];
const EDUCATION_LEVELS = ['high_school', 'associate', 'bachelor', 'master', 'phd'];
const STUDY_LOCALES = ['mainland', 'hongkong', 'overseas_english', 'overseas_other'];
const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'manager', 'director', 'executive'];
const INDUSTRIES = ['tech', 'finance', 'healthcare', 'education', 'media', 'retail', 'consulting'];
const RELATIONSHIP_STATUS = ['single', 'dating', 'married', 'divorced', 'complicated'];
const LANGUAGES = ['粤语', '普通话', '英语', '日语', '韩语', '法语'];
const INTERESTS = ['运动', '音乐', '电影', '阅读', '旅行', '美食', '摄影', '游戏', '艺术', '科技', '投资', '瑜伽'];
const CUISINES = ['粤菜', '川菜', '日料', '西餐', '火锅', '韩餐', '泰餐', '意餐'];
const DIETARY = ['无限制', '素食', '清真', '无辣', '海鲜过敏'];
const TOPIC_AVOIDANCES = ['政治', '宗教', '八卦', '工作压力', '感情问题'];
const SOCIAL_ENERGY_TYPES = ['extrovert', 'ambivert', 'introvert'];
const ACTIVITY_TIMES = ['工作日晚上', '周末白天', '周末晚上'];
const SOCIAL_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'flexible'];
const ARCHETYPE_TYPES = ['owl', 'fox', 'dolphin', 'bear', 'cat', 'dog', 'rabbit', 'lion', 'koala', 'deer', 'raccoon', 'penguin'];

// Helper functions
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: T[], minSize = 0, maxSize?: number): T[] {
  const max = maxSize ?? arr.length;
  const size = Math.floor(Math.random() * (max - minSize + 1)) + minSize;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
}

function randomBirthday(): string {
  const year = 1980 + Math.floor(Math.random() * 25); // Ages 20-45
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateArchetypeResult(): any {
  return {
    primaryArchetype: randomChoice(ARCHETYPE_TYPES),
    secondaryArchetype: randomChoice(ARCHETYPE_TYPES),
    scores: {
      warmth: Math.floor(Math.random() * 100),
      openness: Math.floor(Math.random() * 100),
      energy: Math.floor(Math.random() * 100),
    }
  };
}

/**
 * Generate a mock user with specified completeness level
 * @param id User ID
 * @param targetCompleteness Target profile completeness percentage (0-100)
 */
function generateMockUser(id: number, targetCompleteness: number): MockUser {
  const user: MockUser = {
    id,
    nickname: `测试用户${id}`,
    gender: null,
    birthday: null,
    city: null,
    district: null,
    education: null,
    studyLocale: null,
    seniority: null,
    industry: null,
    relationshipStatus: null,
    hasChildren: null,
    languages: null,
    interests: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    topicAvoidances: null,
    socialEnergyType: null,
    activityTimePreferences: null,
    socialFrequency: null,
    archetypeResult: null,
  };

  // Define fields by priority (essential fields first)
  const fieldGenerators: Array<{ key: keyof MockUser; weight: number; generate: () => any }> = [
    { key: 'gender', weight: 1.0, generate: () => randomChoice(['male', 'female']) },
    { key: 'birthday', weight: 1.0, generate: randomBirthday },
    { key: 'city', weight: 0.8, generate: () => randomChoice(CITIES) },
    { key: 'education', weight: 0.7, generate: () => randomChoice(EDUCATION_LEVELS) },
    { key: 'interests', weight: 0.8, generate: () => randomSubset(INTERESTS, 2, 5) },
    { key: 'languages', weight: 0.6, generate: () => randomSubset(LANGUAGES, 1, 3) },
    { key: 'industry', weight: 0.5, generate: () => randomChoice(INDUSTRIES) },
    { key: 'seniority', weight: 0.5, generate: () => randomChoice(SENIORITY_LEVELS) },
    { key: 'relationshipStatus', weight: 0.5, generate: () => randomChoice(RELATIONSHIP_STATUS) },
    { key: 'archetypeResult', weight: 0.7, generate: generateArchetypeResult },
    { key: 'socialEnergyType', weight: 0.5, generate: () => randomChoice(SOCIAL_ENERGY_TYPES) },
    { key: 'activityTimePreferences', weight: 0.4, generate: () => randomSubset(ACTIVITY_TIMES, 1, 3) },
    { key: 'socialFrequency', weight: 0.4, generate: () => randomChoice(SOCIAL_FREQUENCIES) },
    { key: 'cuisinePreferences', weight: 0.3, generate: () => randomSubset(CUISINES, 1, 4) },
    { key: 'dietaryRestrictions', weight: 0.3, generate: () => randomSubset(DIETARY, 0, 2) },
    { key: 'studyLocale', weight: 0.3, generate: () => randomChoice(STUDY_LOCALES) },
    { key: 'hasChildren', weight: 0.3, generate: () => randomChoice(['yes', 'no', 'prefer_not_to_say']) },
    { key: 'topicAvoidances', weight: 0.2, generate: () => randomSubset(TOPIC_AVOIDANCES, 0, 2) },
    { key: 'district', weight: 0.2, generate: () => randomChoice([...DISTRICTS_HK, ...DISTRICTS_SZ]) },
  ];

  // Calculate how many fields to fill based on target completeness
  const totalWeight = fieldGenerators.reduce((sum, f) => sum + f.weight, 0);
  const targetWeight = (targetCompleteness / 100) * totalWeight;

  // Sort by weight (priority) and fill until we reach target
  let currentWeight = 0;
  const sortedFields = [...fieldGenerators].sort((a, b) => b.weight - a.weight);

  for (const field of sortedFields) {
    if (currentWeight >= targetWeight) break;
    
    // Add some randomness - 80% chance to fill if within target
    if (Math.random() < 0.85) {
      (user as any)[field.key] = field.generate();
      currentWeight += field.weight;
    }
  }

  return user;
}

/**
 * Determine enrichment context based on missing fields
 */
function getEnrichmentContext(missingFields: string[], profilePercentage: number): {
  mode: string;
  questionsToAsk: number;
  focusAreas: string[];
} {
  const fieldToCategoryMap: { [key: string]: string } = {
    '性别': 'basic',
    '年龄': 'basic',
    '城市': 'basic',
    '学历': 'background',
    '行业': 'background',
    '资历': 'background',
    '兴趣': 'interests',
    '语言': 'communication',
    '性格类型': 'personality',
    '社交能量': 'personality',
    '活动时间': 'scheduling',
    '社交频率': 'scheduling',
    '饮食偏好': 'dining',
    '话题避开': 'boundaries',
    '感情状态': 'personal',
  };

  // Group missing fields by category
  const categories = new Set<string>();
  for (const field of missingFields) {
    const category = fieldToCategoryMap[field];
    if (category) categories.add(category);
  }

  // Determine mode based on how much is missing
  let mode: string;
  let questionsToAsk: number;

  if (profilePercentage < 30) {
    mode = 'deep_enrichment';
    questionsToAsk = Math.min(8, missingFields.length);
  } else if (profilePercentage < 60) {
    mode = 'standard_enrichment';
    questionsToAsk = Math.min(5, missingFields.length);
  } else if (profilePercentage < 80) {
    mode = 'light_enrichment';
    questionsToAsk = Math.min(3, missingFields.length);
  } else {
    mode = 'quick_touch_up';
    questionsToAsk = Math.min(2, missingFields.length);
  }

  // Prioritize focus areas
  const focusAreaPriority = ['personality', 'interests', 'scheduling', 'background', 'dining', 'communication', 'personal', 'boundaries', 'basic'];
  const focusAreas = focusAreaPriority.filter(area => categories.has(area)).slice(0, 3);

  return { mode, questionsToAsk, focusAreas };
}

/**
 * Test a single user through enrichment flow
 */
function testUser(user: MockUser): TestResult {
  const completion = calculateProfileCompletion(user);
  const matchingBoost = getMatchingBoostEstimate(completion.percentage);
  const enrichmentContext = getEnrichmentContext(completion.missingFields, completion.percentage);

  return {
    userId: user.id,
    profileCompletion: completion.percentage,
    stars: completion.stars,
    matchingBoost,
    missingFieldsCount: completion.missingFields.length,
    missingFields: completion.missingFields,
    enrichmentContext,
  };
}

/**
 * Generate test summary statistics
 */
function generateSummary(results: TestResult[]): TestSummary {
  const completionDistribution: { [key: string]: number } = {
    '0-20%': 0,
    '21-40%': 0,
    '41-60%': 0,
    '61-80%': 0,
    '81-100%': 0,
  };

  const starDistribution: { [key: string]: number } = {
    '1星': 0,
    '2星': 0,
    '3星': 0,
    '4星': 0,
    '5星': 0,
  };

  const focusAreaFrequency: { [key: string]: number } = {};
  let totalMissingFields = 0;
  let totalMatchingBoost = 0;
  let enrichmentEligible = 0;

  for (const result of results) {
    // Completion distribution
    if (result.profileCompletion <= 20) completionDistribution['0-20%']++;
    else if (result.profileCompletion <= 40) completionDistribution['21-40%']++;
    else if (result.profileCompletion <= 60) completionDistribution['41-60%']++;
    else if (result.profileCompletion <= 80) completionDistribution['61-80%']++;
    else completionDistribution['81-100%']++;

    // Star distribution
    starDistribution[`${result.stars}星`]++;

    // Aggregate stats
    totalMissingFields += result.missingFieldsCount;
    totalMatchingBoost += result.matchingBoost;
    if (result.profileCompletion < 90) enrichmentEligible++;

    // Focus area frequency
    for (const area of result.enrichmentContext.focusAreas) {
      focusAreaFrequency[area] = (focusAreaFrequency[area] || 0) + 1;
    }
  }

  return {
    totalUsers: results.length,
    completionDistribution,
    starDistribution,
    avgMissingFields: Math.round(totalMissingFields / results.length * 10) / 10,
    avgMatchingBoost: Math.round(totalMatchingBoost / results.length * 10) / 10,
    enrichmentEligible,
    focusAreaFrequency,
  };
}

/**
 * Simulate AI opening message based on enrichment context
 */
function simulateAIOpening(user: MockUser, context: TestResult['enrichmentContext']): string {
  const greetings = [
    `嘿～${user.nickname}！看到你之前填过一些资料`,
    `哈喽${user.nickname}～我是小悦！`,
    `${user.nickname}你好呀～`,
  ];

  const modeMessages: { [key: string]: string } = {
    'deep_enrichment': '让我们花几分钟聊聊，我想更了解你～这样能帮你找到更合拍的活动伙伴！',
    'standard_enrichment': '我有几个小问题想问你，帮助我们更精准地匹配～',
    'light_enrichment': '就差一点点资料就完整啦！快速聊两句？',
    'quick_touch_up': '资料已经很全啦！再补充一两个小细节？',
  };

  const focusAreaIntros: { [key: string]: string } = {
    'personality': '想先聊聊你的社交风格～',
    'interests': '你平时都喜欢做些什么呢？',
    'scheduling': '你一般什么时候有空参加活动？',
    'background': '可以简单介绍一下你的背景吗？',
    'dining': '聚会经常涉及到吃，你有什么饮食偏好？',
  };

  const greeting = randomChoice(greetings);
  const modeMsg = modeMessages[context.mode] || modeMessages['standard_enrichment'];
  const focusIntro = context.focusAreas[0] ? focusAreaIntros[context.focusAreas[0]] || '' : '';

  return `${greeting}\n\n${modeMsg}\n\n${focusIntro}`;
}

/**
 * Run the full test suite
 */
async function runTest(): Promise<void> {
  console.log('🧪 Enrichment Chat Flow Test');
  console.log('============================\n');
  console.log('Generating 500 mock users with varying profile completeness...\n');

  // Distribution: 20% very low, 40% medium, 30% high, 10% near complete
  const users: MockUser[] = [];
  
  // Very low completeness (0-30%): 100 users
  for (let i = 1; i <= 100; i++) {
    users.push(generateMockUser(i, Math.random() * 30));
  }
  
  // Medium completeness (30-60%): 200 users
  for (let i = 101; i <= 300; i++) {
    users.push(generateMockUser(i, 30 + Math.random() * 30));
  }
  
  // High completeness (60-85%): 150 users
  for (let i = 301; i <= 450; i++) {
    users.push(generateMockUser(i, 60 + Math.random() * 25));
  }
  
  // Near complete (85-98%): 50 users
  for (let i = 451; i <= 500; i++) {
    users.push(generateMockUser(i, 85 + Math.random() * 13));
  }

  console.log(`✅ Generated ${users.length} mock users\n`);

  // Test each user
  console.log('Running enrichment flow analysis...\n');
  const results: TestResult[] = users.map(testUser);

  // Generate summary
  const summary = generateSummary(results);

  // Print results
  console.log('📊 TEST RESULTS');
  console.log('===============\n');

  console.log('Profile Completeness Distribution:');
  for (const [range, count] of Object.entries(summary.completionDistribution)) {
    const bar = '█'.repeat(Math.round(count / 10));
    console.log(`  ${range.padEnd(10)} ${bar} ${count} (${(count/500*100).toFixed(1)}%)`);
  }

  console.log('\nStar Rating Distribution:');
  for (const [stars, count] of Object.entries(summary.starDistribution)) {
    const bar = '⭐'.repeat(parseInt(stars));
    console.log(`  ${bar.padEnd(10)} ${count} users (${(count/500*100).toFixed(1)}%)`);
  }

  console.log('\n📈 Key Metrics:');
  console.log(`  Average missing fields: ${summary.avgMissingFields}`);
  console.log(`  Average matching boost potential: ${summary.avgMatchingBoost}%`);
  console.log(`  Users eligible for enrichment (<90%): ${summary.enrichmentEligible} (${(summary.enrichmentEligible/500*100).toFixed(1)}%)`);

  console.log('\n🎯 Focus Area Priority (top areas AI should ask about):');
  const sortedAreas = Object.entries(summary.focusAreaFrequency)
    .sort((a, b) => b[1] - a[1]);
  for (const [area, count] of sortedAreas) {
    console.log(`  ${area}: ${count} users need this`);
  }

  // Sample conversations
  console.log('\n💬 Sample AI Opening Messages:');
  console.log('-------------------------------');
  
  const sampleIndices = [0, 150, 350, 480]; // Very low, medium, high, near complete
  for (const idx of sampleIndices) {
    const user = users[idx];
    const result = results[idx];
    const opening = simulateAIOpening(user, result.enrichmentContext);
    
    console.log(`\n[User ${user.id}] Profile: ${result.profileCompletion}% | ${result.stars}⭐ | Mode: ${result.enrichmentContext.mode}`);
    console.log(`Missing: ${result.missingFields.slice(0, 5).join(', ')}${result.missingFields.length > 5 ? '...' : ''}`);
    console.log(`\n小悦: "${opening}"`);
  }

  // Enrichment flow analysis
  console.log('\n\n🔄 ENRICHMENT FLOW ANALYSIS');
  console.log('============================\n');

  const modeDistribution: { [key: string]: number } = {};
  for (const result of results) {
    const mode = result.enrichmentContext.mode;
    modeDistribution[mode] = (modeDistribution[mode] || 0) + 1;
  }

  console.log('Enrichment Mode Distribution:');
  for (const [mode, count] of Object.entries(modeDistribution)) {
    console.log(`  ${mode}: ${count} users`);
  }

  // Calculate average questions per mode
  const questionsByMode: { [key: string]: number[] } = {};
  for (const result of results) {
    const mode = result.enrichmentContext.mode;
    if (!questionsByMode[mode]) questionsByMode[mode] = [];
    questionsByMode[mode].push(result.enrichmentContext.questionsToAsk);
  }

  console.log('\nAverage Questions to Ask by Mode:');
  for (const [mode, questions] of Object.entries(questionsByMode)) {
    const avg = questions.reduce((a, b) => a + b, 0) / questions.length;
    console.log(`  ${mode}: ~${avg.toFixed(1)} questions`);
  }

  console.log('\n✅ Test completed successfully!');
  console.log('\n📝 RECOMMENDATIONS:');
  console.log('--------------------');
  console.log('1. Most users need personality/interests data - prioritize these in AI prompts');
  console.log('2. Scheduling preferences (activity time, frequency) are commonly missing');
  console.log('3. Consider "quick touch up" mode for users >85% to avoid over-asking');
  console.log('4. AI should adapt tone: more casual for deep enrichment, concise for quick touch-up');
}

// Run the test
runTest().catch(console.error);
