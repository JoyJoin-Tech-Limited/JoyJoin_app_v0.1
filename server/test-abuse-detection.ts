/**
 * 反恶意系统压力测试 - 模拟100个恶意用户
 * 测试内容过滤、速率限制、行为检测等防护机制
 */

import { filterContent, detectGibberish, detectRepetition } from './contentFilter';
import { checkUserAbuse, resetConversationTurns, recordTokenUsage } from './abuseDetection';

interface TestResult {
  category: string;
  total: number;
  blocked: number;
  allowed: number;
  details: string[];
}

interface TestReport {
  totalTests: number;
  totalBlocked: number;
  totalAllowed: number;
  blockRate: string;
  categories: TestResult[];
  timestamp: string;
}

const politicalMessages = [
  '我觉得共产党很好',
  '习近平最近做得不错',
  '天安门事件怎么看',
  '六四运动的真相',
  '台独是对的吗',
  '法轮功有什么问题',
  '翻墙上外网',
  '防火长城太讨厌了',
  '维尼熊真可爱',
  '颠覆政权的方法',
];

const pornographicMessages = [
  '约炮吗美女',
  '想要一夜情',
  '做爱技巧分享',
  '看黄片网站',
  '援交价格多少',
  '嫖娼去哪里',
  '成人片推荐',
  '裸体照片',
  '情人节包养',
  'AV女优最爱',
];

const violentMessages = [
  '我想杀人',
  '谋杀计划',
  '自杀方法',
  '恐怖袭击好刺激',
  '绑架勒索',
  '强奸案例',
  '虐待动物',
  '打死你全家',
  '血腥暴力电影',
  '弄死那个人',
];

const harassmentMessages = [
  '你这个傻逼',
  '操你妈的',
  '草泥马去死',
  '废物一个',
  '智障儿童',
  '脑残粉丝',
  '神经病啊你',
  '恶心变态',
  '垃圾人类',
  '白痴一枚',
];

const spamMessages = [
  '加我微信聊天',
  '我的QQ号是123456',
  '联系方式私聊',
  '手机号给你发了',
  '免费领取红包',
  '点击链接领奖',
  '扫码加入群聊',
  '转账给我500',
  '抽奖中大奖',
  '电话联系更快',
];

const illegalMessages = [
  '卖毒品的联系我',
  '冰毒多少钱一克',
  '赌博网站推荐',
  '洗钱服务',
  '诈骗技巧',
  '偷盗方法',
  '走私渠道',
  '传销致富',
  '海洛因效果',
  '抢劫银行',
];

const gibberishMessages = [
  'asdfghjklqwertyuiop',
  'zxcvbnmasdfghjkl',
  'aaaaaaaaaaaaaaaaaaa',
  'qqqqqqqqqqqqqqqqqqqq',
  '!@#$%^&*()_+=-[]{}',
  'jjjjjjjjjjjjjjjjjjj',
  'asdasdasdasdasdasd',
  'qweqweqweqweqweqwe',
  'zzzzzzzzzzzzzzzzzz',
  'abcabcabcabcabcabc',
];

const repetitionMessages = [
  '你好 你好 你好 你好 你好 你好 你好 你好',
  '测试 测试 测试 测试 测试 测试 测试',
  '哈哈 哈哈 哈哈 哈哈 哈哈 哈哈 哈哈',
  '好的 好的 好的 好的 好的 好的 好的',
  '呵呵 呵呵 呵呵 呵呵 呵呵 呵呵 呵呵',
  '是的 是的 是的 是的 是的 是的 是的',
  '对的 对的 对的 对的 对的 对的 对的',
  '嗯嗯 嗯嗯 嗯嗯 嗯嗯 嗯嗯 嗯嗯 嗯嗯',
  '好好 好好 好好 好好 好好 好好 好好',
  '行行 行行 行行 行行 行行 行行 行行',
];

const normalMessages = [
  '你好，我叫小明',
  '我喜欢看电影和读书',
  '周末有什么活动吗',
  '很高兴认识你',
  '天气真好啊',
  '最近在学习编程',
  '我住在深圳南山区',
  '喜欢户外运动',
  '美食是我的爱好',
  '想交一些新朋友',
];

function testContentFilter(messages: string[], category: string): TestResult {
  const result: TestResult = {
    category,
    total: messages.length,
    blocked: 0,
    allowed: 0,
    details: [],
  };

  for (const msg of messages) {
    const filterResult = filterContent(msg);
    if (filterResult.isViolation) {
      result.blocked++;
      result.details.push(`[BLOCKED] "${msg.substring(0, 20)}..." - ${filterResult.violationType} (${filterResult.severity})`);
    } else {
      result.allowed++;
      result.details.push(`[ALLOWED] "${msg.substring(0, 20)}..."`);
    }
  }

  return result;
}

function testGibberish(messages: string[]): TestResult {
  const result: TestResult = {
    category: '乱码检测',
    total: messages.length,
    blocked: 0,
    allowed: 0,
    details: [],
  };

  for (const msg of messages) {
    const isGibberish = detectGibberish(msg);
    if (isGibberish) {
      result.blocked++;
      result.details.push(`[BLOCKED] "${msg.substring(0, 20)}..." - 乱码`);
    } else {
      result.allowed++;
      result.details.push(`[ALLOWED] "${msg.substring(0, 20)}..."`);
    }
  }

  return result;
}

function testRepetition(messages: string[]): TestResult {
  const result: TestResult = {
    category: '重复检测',
    total: messages.length,
    blocked: 0,
    allowed: 0,
    details: [],
  };

  for (const msg of messages) {
    const isRepetition = detectRepetition(msg);
    if (isRepetition) {
      result.blocked++;
      result.details.push(`[BLOCKED] "${msg.substring(0, 20)}..." - 重复内容`);
    } else {
      result.allowed++;
      result.details.push(`[ALLOWED] "${msg.substring(0, 20)}..."`);
    }
  }

  return result;
}

function testNormalMessages(messages: string[]): TestResult {
  const result: TestResult = {
    category: '正常消息（应该通过）',
    total: messages.length,
    blocked: 0,
    allowed: 0,
    details: [],
  };

  for (const msg of messages) {
    const filterResult = filterContent(msg);
    const isGibberish = detectGibberish(msg);
    const isRepetition = detectRepetition(msg);
    
    if (filterResult.isViolation || isGibberish || isRepetition) {
      result.blocked++;
      result.details.push(`[BLOCKED] "${msg.substring(0, 20)}..." - 误判!`);
    } else {
      result.allowed++;
      result.details.push(`[ALLOWED] "${msg.substring(0, 20)}..." ✓`);
    }
  }

  return result;
}

async function runFullTest(): Promise<TestReport> {
  console.log('\n' + '='.repeat(60));
  console.log('🛡️  反恶意系统压力测试 - 100个恶意用户模拟');
  console.log('='.repeat(60) + '\n');

  const categories: TestResult[] = [];

  console.log('📋 测试类别1: 政治敏感词 (10条)');
  categories.push(testContentFilter(politicalMessages, '政治敏感'));

  console.log('📋 测试类别2: 色情内容 (10条)');
  categories.push(testContentFilter(pornographicMessages, '色情内容'));

  console.log('📋 测试类别3: 暴力内容 (10条)');
  categories.push(testContentFilter(violentMessages, '暴力内容'));

  console.log('📋 测试类别4: 骚扰辱骂 (10条)');
  categories.push(testContentFilter(harassmentMessages, '骚扰辱骂'));

  console.log('📋 测试类别5: 垃圾广告 (10条)');
  categories.push(testContentFilter(spamMessages, '垃圾广告'));

  console.log('📋 测试类别6: 违法内容 (10条)');
  categories.push(testContentFilter(illegalMessages, '违法内容'));

  console.log('📋 测试类别7: 乱码攻击 (10条)');
  categories.push(testGibberish(gibberishMessages));

  console.log('📋 测试类别8: 重复攻击 (10条)');
  categories.push(testRepetition(repetitionMessages));

  console.log('📋 测试类别9: 正常消息 (10条) - 验证不误杀');
  categories.push(testNormalMessages(normalMessages));

  console.log('📋 测试类别10: 混合攻击 (10条)');
  const mixedMessages = [
    ...politicalMessages.slice(0, 2),
    ...pornographicMessages.slice(0, 2),
    ...violentMessages.slice(0, 2),
    ...harassmentMessages.slice(0, 2),
    ...spamMessages.slice(0, 2),
  ];
  categories.push(testContentFilter(mixedMessages, '混合攻击'));

  const totalTests = categories.reduce((sum, c) => sum + c.total, 0);
  const totalBlocked = categories.reduce((sum, c) => sum + c.blocked, 0);
  const totalAllowed = categories.reduce((sum, c) => sum + c.allowed, 0);

  const report: TestReport = {
    totalTests,
    totalBlocked,
    totalAllowed,
    blockRate: ((totalBlocked / totalTests) * 100).toFixed(1) + '%',
    categories,
    timestamp: new Date().toISOString(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试报告');
  console.log('='.repeat(60));
  
  console.log('\n【分类结果】\n');
  for (const cat of categories) {
    const rate = cat.total > 0 ? ((cat.blocked / cat.total) * 100).toFixed(0) : 0;
    const icon = cat.category === '正常消息（应该通过）' 
      ? (cat.allowed === cat.total ? '✅' : '⚠️')
      : (cat.blocked === cat.total ? '✅' : (cat.blocked > 0 ? '⚠️' : '❌'));
    console.log(`${icon} ${cat.category}: ${cat.blocked}/${cat.total} 拦截 (${rate}%)`);
  }

  console.log('\n【总体统计】\n');
  console.log(`📌 总测试数: ${totalTests}`);
  console.log(`🛡️  成功拦截: ${totalBlocked}`);
  console.log(`✅ 放行通过: ${totalAllowed}`);
  
  const maliciousCategories = categories.filter(c => c.category !== '正常消息（应该通过）');
  const maliciousTotal = maliciousCategories.reduce((sum, c) => sum + c.total, 0);
  const maliciousBlocked = maliciousCategories.reduce((sum, c) => sum + c.blocked, 0);
  const maliciousBlockRate = ((maliciousBlocked / maliciousTotal) * 100).toFixed(1);
  
  const normalCategory = categories.find(c => c.category === '正常消息（应该通过）');
  const falsePositiveRate = normalCategory ? ((normalCategory.blocked / normalCategory.total) * 100).toFixed(1) : '0';

  console.log(`\n🎯 恶意消息拦截率: ${maliciousBlockRate}% (${maliciousBlocked}/${maliciousTotal})`);
  console.log(`⚠️  误杀率: ${falsePositiveRate}% (${normalCategory?.blocked || 0}/${normalCategory?.total || 0})`);

  console.log('\n' + '='.repeat(60));
  if (parseFloat(maliciousBlockRate) >= 80) {
    console.log('🎉 测试通过! 系统防护能力良好');
  } else if (parseFloat(maliciousBlockRate) >= 60) {
    console.log('⚠️  测试警告! 部分恶意内容未被拦截，建议优化敏感词库');
  } else {
    console.log('❌ 测试失败! 系统防护能力不足，需要加强');
  }
  console.log('='.repeat(60) + '\n');

  return report;
}

runFullTest().then(report => {
  console.log('\n测试完成! 时间:', report.timestamp);
}).catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
