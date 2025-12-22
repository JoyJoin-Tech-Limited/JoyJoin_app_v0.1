/**
 * 智能推断引擎增强 - 极简用户优化
 * 
 * 改进目标：
 * 1. 减少追问次数 - 通过智能推断跳过冗余问题
 * 2. 边界输入处理 - 优雅处理emoji、特殊字符、无效输入
 * 3. 对话个性化 - 小悦根据用户风格动态调整语气
 * 4. 性格测试价值说明 - 测试前解释匹配质量重要性
 * 5. 心理教育内容 - 原型是启发性工具，鼓励自我探索
 */

import { detectCantoneseUsage, isCantoneseSpeaker } from './cantoneseVocabulary';

// ============ 边界输入处理 ============

export interface InputValidation {
  isValid: boolean;
  cleanedInput: string;
  inputType: 'text' | 'emoji_only' | 'special_chars' | 'too_short' | 'too_long' | 'gibberish' | 'empty';
  suggestion?: string;
}

/**
 * 验证和清理用户输入
 */
export function validateAndCleanInput(input: string): InputValidation {
  const trimmed = input.trim();
  
  // 空输入
  if (!trimmed) {
    return {
      isValid: false,
      cleanedInput: '',
      inputType: 'empty',
      suggestion: '嗯？你好像没说话呢～再说一次？'
    };
  }
  
  // 纯emoji检测
  const emojiPattern = /^[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\u2300-\u23FF\s]+$/;
  if (emojiPattern.test(trimmed)) {
    return {
      isValid: true, // emoji也是有效表达
      cleanedInput: trimmed,
      inputType: 'emoji_only',
      suggestion: '哈哈，看到你的表情了！能用文字多说两句吗～'
    };
  }
  
  // 太短
  if (trimmed.length < 2) {
    return {
      isValid: false,
      cleanedInput: trimmed,
      inputType: 'too_short',
      suggestion: '嗯嗯，再多说几个字让我更了解你～'
    };
  }
  
  // 太长（可能是粘贴的内容）
  if (trimmed.length > 500) {
    return {
      isValid: true,
      cleanedInput: trimmed.slice(0, 500),
      inputType: 'too_long',
      suggestion: '哇，你说了好多！我先消化一下～'
    };
  }
  
  // 特殊字符/乱码检测
  const gibberishPattern = /^[^a-zA-Z\u4e00-\u9fa5\u0400-\u04FF]{5,}$/;
  if (gibberishPattern.test(trimmed.replace(/\s/g, ''))) {
    return {
      isValid: false,
      cleanedInput: trimmed,
      inputType: 'gibberish',
      suggestion: '额...我看不太懂耶，能用中文或英文说吗？'
    };
  }
  
  // 清理多余空格和特殊字符
  const cleaned = trimmed
    .replace(/\s+/g, ' ')  // 多个空格变一个
    .replace(/[<>{}[\]\\]/g, ''); // 移除可能的XSS字符
  
  return {
    isValid: true,
    cleanedInput: cleaned,
    inputType: 'text',
  };
}

// ============ 智能推断规则 ============

export interface InferenceRule {
  pattern: RegExp;
  inferences: Array<{
    field: string;
    value: string | boolean;
    confidence: number;
  }>;
  skipQuestions?: string[];
}

/**
 * 增强的推断规则库
 * 用于减少追问次数
 */
export const SMART_INFERENCE_RULES: InferenceRule[] = [
  // ===== 职业/行业推断 =====
  // 注意：所有pattern不使用global flag以避免lastIndex问题
  {
    pattern: /(?:在|做|是).{0,5}(?:程序员|码农|开发|工程师|前端|后端|全栈)/i,
    inferences: [
      { field: 'industry', value: '互联网/科技', confidence: 0.9 },
      { field: 'occupation', value: '程序员/开发', confidence: 0.85 },
    ],
    skipQuestions: ['industry', 'occupation'],
  },
  {
    pattern: /(?:在|做|是).{0,5}(?:设计师|UI|UX|美工|视觉)/i,
    inferences: [
      { field: 'occupation', value: '设计师', confidence: 0.9 },
    ],
    skipQuestions: ['occupation'],
  },
  {
    pattern: /(?:在|做|是).{0,5}(?:产品经理|PM|产品)/i,
    inferences: [
      { field: 'occupation', value: '产品经理', confidence: 0.9 },
      { field: 'industry', value: '互联网/科技', confidence: 0.7 },
    ],
    skipQuestions: ['occupation'],
  },
  {
    pattern: /(?:在|做|是).{0,5}(?:老师|教师|讲师|教授)/i,
    inferences: [
      { field: 'industry', value: '教育', confidence: 0.9 },
      { field: 'occupation', value: '教师', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'occupation'],
  },
  {
    pattern: /(?:在|做|是).{0,5}(?:医生|护士|医护|医疗)/i,
    inferences: [
      { field: 'industry', value: '医疗健康', confidence: 0.9 },
    ],
    skipQuestions: ['industry'],
  },
  {
    pattern: /(?:在|做|是).{0,5}(?:金融|投资|银行|基金|证券)/i,
    inferences: [
      { field: 'industry', value: '金融', confidence: 0.9 },
    ],
    skipQuestions: ['industry'],
  },
  
  // ===== 金融细分领域推断 (Phase2新增) =====
  {
    pattern: /(?:一级|PE|VC|私募股权|风投|创投|股权投资|早期投资)/i,
    inferences: [
      { field: 'industry', value: '金融', confidence: 0.95 },
      { field: 'industrySegment', value: '一级市场', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:并购|M&A|收购|兼并|重组)/i,
    inferences: [
      { field: 'industry', value: '金融', confidence: 0.95 },
      { field: 'industrySegment', value: '并购', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:投行|IBD|保荐|承销|IPO)/i,
    inferences: [
      { field: 'industry', value: '金融', confidence: 0.95 },
      { field: 'industrySegment', value: '投行', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:二级|公募|股票|交易员|研究员|基金经理)/i,
    inferences: [
      { field: 'industry', value: '金融', confidence: 0.9 },
      { field: 'industrySegment', value: '二级市场', confidence: 0.85 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:量化|quant|策略|高频|alpha|因子)/i,
    inferences: [
      { field: 'industry', value: '金融', confidence: 0.9 },
      { field: 'industrySegment', value: '量化', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:四大|审计|普华|德勤|安永|毕马威|KPMG)/i,
    inferences: [
      { field: 'industry', value: '咨询', confidence: 0.9 },
      { field: 'industrySegment', value: '财务咨询', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:MBB|麦肯锡|BCG|贝恩|咨询顾问|战略咨询)/i,
    inferences: [
      { field: 'industry', value: '咨询', confidence: 0.95 },
      { field: 'industrySegment', value: '战略咨询', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  
  // ===== 科技细分领域推断 =====
  {
    pattern: /(?:AI|人工智能|机器学习|深度学习|大模型|LLM|算法)/i,
    inferences: [
      { field: 'industry', value: '科技/互联网', confidence: 0.9 },
      { field: 'industrySegment', value: 'AI/算法', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:数据分析|BI|数仓|ETL|数据工程)/i,
    inferences: [
      { field: 'industry', value: '科技/互联网', confidence: 0.85 },
      { field: 'industrySegment', value: '数据', confidence: 0.9 },
    ],
    skipQuestions: ['industrySegment'],
  },
  
  // ===== 法律行业细分 =====
  {
    pattern: /(?:律师|律所|红圈所|金杜|中伦|方达)/i,
    inferences: [
      { field: 'industry', value: '法律', confidence: 0.95 },
      { field: 'industrySegment', value: '律所', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  {
    pattern: /(?:法务|in-house|合规|法总)/i,
    inferences: [
      { field: 'industry', value: '法律', confidence: 0.9 },
      { field: 'industrySegment', value: '企业法务', confidence: 0.9 },
    ],
    skipQuestions: ['industry', 'industrySegment'],
  },
  
  // ===== 人生阶段推断 =====
  {
    pattern: /(?:大一|大二|大三|大四|研一|研二|研三|博一|博二|在读|读书|念书)/,
    inferences: [
      { field: 'lifeStage', value: '学生党', confidence: 0.95 },
    ],
    skipQuestions: ['lifeStage'],
  },
  {
    pattern: /(?:刚毕业|应届|找工作|求职|校招)/,
    inferences: [
      { field: 'lifeStage', value: '职场新人', confidence: 0.9 },
    ],
    skipQuestions: ['lifeStage'],
  },
  {
    pattern: /(?:创业|开公司|自己做|当老板|合伙人)/,
    inferences: [
      { field: 'lifeStage', value: '创业中', confidence: 0.95 },
    ],
    skipQuestions: ['lifeStage'],
  },
  {
    pattern: /(?:自由职业|freelance|接私活|不上班)/i,
    inferences: [
      { field: 'lifeStage', value: '自由职业', confidence: 0.9 },
    ],
    skipQuestions: ['lifeStage'],
  },
  {
    pattern: /(?:工作.{0,5}年了|入职.{0,5}年|做了.{0,5}年)/,
    inferences: [
      { field: 'lifeStage', value: '职场老手', confidence: 0.85 },
    ],
    skipQuestions: ['lifeStage'],
  },
  
  // ===== 城市推断 =====
  {
    pattern: /(?:在|住|来自|坐标).{0,3}(?:深圳|南山|福田|罗湖|宝安|龙华|前海)/,
    inferences: [
      { field: 'city', value: '深圳', confidence: 0.95 },
    ],
    skipQuestions: ['city'],
  },
  {
    pattern: /(?:在|住|来自|坐标).{0,3}(?:香港|港岛|九龙|新界|中环|旺角|铜锣湾)/,
    inferences: [
      { field: 'city', value: '香港', confidence: 0.95 },
    ],
    skipQuestions: ['city'],
  },
  {
    pattern: /(?:在|住|来自|坐标).{0,3}(?:广州|天河|越秀|海珠|番禺)/,
    inferences: [
      { field: 'city', value: '广州', confidence: 0.95 },
    ],
    skipQuestions: ['city'],
  },
  {
    pattern: /(?:在|住|来自|坐标).{0,3}(?:北京|朝阳|海淀|西城|东城)/,
    inferences: [
      { field: 'city', value: '北京', confidence: 0.95 },
    ],
    skipQuestions: ['city'],
  },
  {
    pattern: /(?:在|住|来自|坐标).{0,3}(?:上海|浦东|静安|徐汇|黄浦)/,
    inferences: [
      { field: 'city', value: '上海', confidence: 0.95 },
    ],
    skipQuestions: ['city'],
  },
  
  // ===== 关系状态推断 =====
  {
    pattern: /(?:单身|没对象|一个人|母胎solo|空窗)/,
    inferences: [
      { field: 'relationshipStatus', value: '单身', confidence: 0.9 },
    ],
    skipQuestions: ['relationshipStatus'],
  },
  {
    pattern: /(?:男朋友|女朋友|对象|另一半|在一起|恋爱)/,
    inferences: [
      { field: 'relationshipStatus', value: '恋爱中', confidence: 0.9 },
    ],
    skipQuestions: ['relationshipStatus'],
  },
  {
    pattern: /(?:老公|老婆|结婚|已婚|爱人)/,
    inferences: [
      { field: 'relationshipStatus', value: '已婚', confidence: 0.95 },
    ],
    skipQuestions: ['relationshipStatus'],
  },
  
  // ===== 性别推断 =====
  {
    pattern: /(?:女朋友|老婆|她|女生.{0,3}好麻烦)/,
    inferences: [
      { field: 'gender', value: '男', confidence: 0.85 },
    ],
  },
  {
    pattern: /(?:男朋友|老公|他|男生.{0,3}不懂)/,
    inferences: [
      { field: 'gender', value: '女', confidence: 0.85 },
    ],
  },
  
  // ===== 海归/语言推断 =====
  {
    pattern: /(?:留学|海归|从国外|在美国|在英国|在澳洲|回国)/,
    inferences: [
      { field: 'isReturnee', value: true, confidence: 0.9 },
      { field: 'languages', value: '英语', confidence: 0.8 },
    ],
    skipQuestions: ['isReturnee'],
  },
];

/**
 * 应用智能推断规则
 */
export function applySmartInference(
  text: string,
  existingSkipQuestions: string[] = []
): {
  inferences: Array<{ field: string; value: string | boolean; confidence: number }>;
  skipQuestions: string[];
} {
  const allInferences: Array<{ field: string; value: string | boolean; confidence: number }> = [];
  const allSkipQuestions = new Set(existingSkipQuestions);
  
  for (const rule of SMART_INFERENCE_RULES) {
    if (rule.pattern.test(text)) {
      allInferences.push(...rule.inferences);
      if (rule.skipQuestions) {
        rule.skipQuestions.forEach(q => allSkipQuestions.add(q));
      }
    }
  }
  
  return {
    inferences: allInferences,
    skipQuestions: Array.from(allSkipQuestions),
  };
}

// ============ 对话个性化 ============

export type ConversationStyle = 'formal' | 'casual' | 'playful' | 'empathetic' | 'efficient';

export interface StyleProfile {
  style: ConversationStyle;
  useEmoji: boolean;
  useDialect: boolean;
  verbosity: 'concise' | 'moderate' | 'elaborate';
}

/**
 * 根据用户风格生成小悦的语气调整建议
 */
export function detectUserStyle(
  messages: Array<{ role: string; content: string }>
): StyleProfile {
  const userMessages = messages.filter(m => m.role === 'user');
  const allContent = userMessages.map(m => m.content).join(' ');
  
  // 检测粤语使用
  const { density: cantoneseDensity } = detectCantoneseUsage(allContent);
  const useDialect = cantoneseDensity > 0.1;
  
  // 检测emoji使用
  const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]/g;
  const emojiCount = (allContent.match(emojiPattern) || []).length;
  const useEmoji = emojiCount > 2;
  
  // 检测回复长度偏好
  const avgLength = userMessages.length > 0 
    ? allContent.length / userMessages.length 
    : 20;
  const verbosity: StyleProfile['verbosity'] = 
    avgLength > 50 ? 'elaborate' : avgLength > 20 ? 'moderate' : 'concise';
  
  // 检测正式度
  const formalPatterns = /您|请问|麻烦|贵|敬请/g;
  const casualPatterns = /哈哈|嘿|哇|lol|hhh|2333/gi;
  const formalCount = (allContent.match(formalPatterns) || []).length;
  const casualCount = (allContent.match(casualPatterns) || []).length;
  
  let style: ConversationStyle;
  if (formalCount > casualCount * 2) {
    style = 'formal';
  } else if (casualCount > 3 || emojiCount > 5) {
    style = 'playful';
  } else if (verbosity === 'concise') {
    style = 'efficient';
  } else {
    style = 'casual';
  }
  
  return { style, useEmoji, useDialect, verbosity };
}

/**
 * 生成小悦的语气调整提示
 */
export function generateStylePrompt(profile: StyleProfile): string {
  const prompts: string[] = [];
  
  switch (profile.style) {
    case 'formal':
      prompts.push('使用礼貌正式的语气，避免过于随意的表达');
      break;
    case 'playful':
      prompts.push('使用活泼可爱的语气，可以适当卖萌');
      break;
    case 'efficient':
      prompts.push('保持简洁高效，不要绕弯子');
      break;
    case 'empathetic':
      prompts.push('展现共情和理解，多用感受性词汇');
      break;
    default:
      prompts.push('保持自然友好的对话风格');
  }
  
  if (profile.useEmoji) {
    prompts.push('可以适当使用emoji增加亲切感');
  } else {
    prompts.push('减少emoji使用，保持文字为主');
  }
  
  if (profile.useDialect) {
    prompts.push('可以适当使用粤语表达，增加亲切感（如「係咪」「冇问题」）');
  }
  
  if (profile.verbosity === 'concise') {
    prompts.push('保持回复简短，不超过2句话');
  } else if (profile.verbosity === 'elaborate') {
    prompts.push('可以详细解释，用户喜欢充分的信息');
  }
  
  return prompts.join('；');
}

// ============ 性格测试价值说明 ============

export const PERSONALITY_TEST_VALUE_MESSAGES = [
  {
    timing: 'before_test',
    message: '接下来是一个小小的性格探索游戏～只需要2-3分钟，帮我更了解你的社交风格，这样才能为你匹配到真正合拍的新朋友哦！',
    emoji: '🎮',
  },
  {
    timing: 'during_test',
    message: '每个问题都没有对错，选择最接近你真实反应的就好～这些答案会帮助算法找到和你气场相合的小伙伴。',
    emoji: '✨',
  },
  {
    timing: 'after_test',
    message: '测试完成！你的社交风格已经被记录下来，这会让我们的匹配更加精准，帮你找到真正聊得来的人～',
    emoji: '🎯',
  },
];

/**
 * 获取测试价值说明文案
 */
export function getTestValueMessage(timing: 'before_test' | 'during_test' | 'after_test'): string {
  const msg = PERSONALITY_TEST_VALUE_MESSAGES.find(m => m.timing === timing);
  return msg ? `${msg.emoji} ${msg.message}` : '';
}

// ============ 心理教育内容 ============

export const PSYCHOLOGICAL_EDUCATION = {
  archetype_explanation: {
    title: '关于你的社交原型',
    content: `
这个原型是帮助你了解自己社交风格的一个有趣工具，而不是给你贴标签。

每个人都是独特的，你可能在不同场合展现不同的社交面向：
- 和好朋友在一起时可能更外向
- 在陌生环境可能更内敛
- 工作中可能更理性
- 生活中可能更感性

原型描述的是你目前最自然的社交倾向，但这不是固定不变的。随着经历和成长，你的社交风格也会不断丰富和变化。

把这个结果当作自我探索的起点，而不是终点。继续发现更多关于自己的有趣之处吧！
    `.trim(),
    short_version: '这个原型是帮助你了解自己的工具，不是标签～你可以在不同场合展现不同面向，这正是你独特的地方！',
  },
  
  growth_mindset: {
    title: '人格是可以成长的',
    content: '心理学研究表明，人格特质不是一成不变的。通过新的经历、学习和有意识的练习，每个人都可以发展自己想要的社交技能。',
  },
  
  diversity_appreciation: {
    title: '不同风格的价值',
    content: '内向和外向、谨慎和冒险、感性和理性——这些不同的风格都有各自的优势。好的团队和友谊群体往往需要多样化的性格组合。',
  },
};

/**
 * 生成结果页的心理教育内容
 */
export function generatePsychEducationContent(archetype: string): {
  mainMessage: string;
  encouragement: string;
  growthTip: string;
} {
  return {
    mainMessage: PSYCHOLOGICAL_EDUCATION.archetype_explanation.short_version,
    encouragement: `作为${archetype}型，你有自己独特的社交魅力。继续做自己，同时也欢迎探索新的可能性！`,
    growthTip: PSYCHOLOGICAL_EDUCATION.growth_mindset.content,
  };
}

// ============ 导出 ============

export default {
  validateAndCleanInput,
  applySmartInference,
  detectUserStyle,
  generateStylePrompt,
  getTestValueMessage,
  generatePsychEducationContent,
  SMART_INFERENCE_RULES,
  PSYCHOLOGICAL_EDUCATION,
};
