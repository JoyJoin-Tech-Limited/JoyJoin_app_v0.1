/**
 * 粤语词库扩展 - 港深本地表达
 * 从100+扩展到200+常用词汇
 * 
 * 分类：
 * 1. 语气助词 (30+)
 * 2. 常用动词 (50+)
 * 3. 形容词 (30+)
 * 4. 日常短语 (40+)
 * 5. 地名/专有词 (30+)
 * 6. 网络/潮语 (20+)
 */

// ============ 语气助词 (Sentence-final particles) ============
export const PARTICLES = [
  // 基础语气词
  '嘅', '喺', '咗', '啦', '嘛', '咩', '呀', '噉', '喎', '咧', '㗎', '喇', '嚟', '唔',
  // 情感强调
  '囉', '嘞', '嗱', '嘥', '嗌', '嗡', '嘈', '嘮', '哋', '嚭', '嚿',
  // 疑问/反问
  '咪', '噃', '嘢', '嘥', '咋', '架', '哦', '嘎',
  // 感叹
  '吖', '喲', '哇', '唉', '哎', '嘩',
];

// ============ 常用动词 ============
export const VERBS = [
  // 基础动词
  '系', '唔系', '冇', '睇', '嚟', '返', '食', '饮', '瞓', '行', '讲', '听', '做', '买', '卖',
  '揾', '攞', '畀', '带', '放', '坐', '企', '跑', '跳', '游', '飞', '开', '关', '落', '入', '出',
  // 扩展动词
  '諗', '估', '等', '问', '答', '叫', '话', '写', '睇', '见', '闻', '拎', '抬', '摆', '收',
  '发', '寄', '打', '踢', '拍', '撞', '推', '拉', '揸', '踩', '摸', '攬', '锡', '嬲', '憎',
  // 复合动词
  '唔该', '多谢', '劳烦', '帮手', '搞掂', '搞定', '冇嘢', '得闲', '得唔得',
];

// ============ 形容词 ============
export const ADJECTIVES = [
  // 正面形容
  '靓', '叻', '勁', '正', '型', '索', '醒', '赞', '好嘢', '劲爆', '犀利', '厉害', '掂', '优质',
  // 负面形容
  '衰', '憎', '烦', '蠢', '笨', '差', '废', '闷', '攰', '辛苦', '惨', '核突', '乸型',
  // 中性形容
  '高', '矮', '肥', '瘦', '大', '细', '长', '短', '快', '慢', '热', '冻', '咸', '淡',
  // 程度词
  '好', '超', '极', '最', '幾', '太', '非常', '真系', '确实',
];

// ============ 日常短语 ============
export const PHRASES = [
  // 问候
  '早晨', '晚安', '你好', '再见', '拜拜', 'bye bye', '食饭未', '饮茶未', '最近点',
  // 常用回应
  '冇问题', '冇事', '冇嘢', '唔紧要', '唔使', '唔好意思', '对唔住', '多谢晒',
  // 表达态度
  '咪住', '等等', '慢慢嚟', '冇所谓', '随便', '都得', 'OK啦', '算啦', '唔好烦',
  // 疑问短语
  '点解', '做咩', '係咪', '真架', '点算', '点搞', '几时', '边度', '边个', '咩嘢',
  // 工作相关
  '返工', '收工', 'OT', '放假', '出粮', '炒鱿', '辞职', '加薪', '开会', '放lunch',
  // 生活相关
  '發夢', '沖涼', '瞓觉', '起身', '食嘢', '买嘢', '行街', '睇戏', '唱K', '打机',
  // 感叹短语
  '好犀利', '太劲喇', '好正啊', '冇得顶', '顶唔顺', '受唔住', '好鬼烦',
];

// ============ 香港地名/专有词 ============
export const HK_TERMS = [
  // 港铁站/区域（已清理编码问题）
  '铜锣湾', '旺角', '尖沙咀', '中环', '金钟', '太古', '沙田', '九龙塘', '观塘',
  '荃湾', '屯门', '元朗', '天水围', '将军澳', '马鞍山', '西营盘', '北角', '上环',
  '红磡', '黄大仙', '柴湾', '杏花邨', '彩虹', '调景岭', '坑口', '宝琳', '康城',
  '油塘', '蓝田', '牛头角', '深水埗', '大围', '火炭', '大埔', '粉岭', '上水',
  // 交通
  '巴士', '地铁', 'MTR', '的士', '小巴', '叮叮', '天星小轮', '渡轮', '港铁',
  // 购物/美食
  '茶餐厅', '大排档', '冰室', '菠萝包', '蛋挞', '奶茶', '柠檬茶', '冻柠', '热柠',
  '丝袜奶茶', '鸳鸯', '菠萝油', '公仔面', '出前一丁', '车仔面', '鱼蛋', '烧卖',
  // 本地词汇
  '屋企', '公司', '学校', '医院', '街市', '超市', '银行', '邮局', '油站',
  // 大学
  '港大', '中大', '科大', '理大', '城大', '浸大', '岭大', '教大', '树仁',
];

// ============ 深圳/广东地名 ============
export const SZ_TERMS = [
  // 区域
  '南山', '福田', '罗湖', '宝安', '龙华', '龙岗', '盐田', '光明', '坪山', '大鹏',
  // 地标
  '前海', '东门', '华强北', '车公庙', '深大', '科技园', '软件园', '蛇口', '后海',
  '世界之窗', '欢乐谷', '东部华侨城', '大梅沙', '小梅沙',
  // 商圈
  '万象城', 'COCO Park', '海岸城', '壹方城', '益田假日', '京基100',
];

// ============ 网络潮语 ============
export const SLANG = [
  // 港式网络用语
  '係咁先', '冇计', '做咩春', '咩料', '咩事', '识做', '识条铁', '好L嘢',
  '串爆', '废青', '废老', '巨婴', '收皮', 'pk', '咸湿', '痴线', '黐线', '傻仔',
  // 流行表达
  '好hea', '好chur', '好chill', 'YYDS', '绝绝子', '破防', '芭比Q', '内卷', '躺平',
  // 饮食词汇
  '饮啖茶', '食个包', '加餸', '走青', '少糖', '走糖', '加底', '飞边', '走冰',
];

// ============ 合并所有词汇生成正则 ============
export function buildCantonesePattern(): RegExp {
  const allTerms = [
    ...PARTICLES,
    ...VERBS,
    ...ADJECTIVES,
    ...PHRASES,
    ...HK_TERMS,
    ...SZ_TERMS,
    ...SLANG,
  ];
  
  // 去重并按长度降序排列（优先匹配长词）
  const uniqueTerms = Array.from(new Set(allTerms))
    .filter(t => t.length > 0)
    .sort((a, b) => b.length - a.length);
  
  // 转义特殊字符
  const escaped = uniqueTerms.map(t => 
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

// 预编译正则（性能优化）
export const CANTONESE_PATTERN = buildCantonesePattern();

// 词汇统计
export const VOCABULARY_STATS = {
  particles: PARTICLES.length,
  verbs: VERBS.length,
  adjectives: ADJECTIVES.length,
  phrases: PHRASES.length,
  hkTerms: HK_TERMS.length,
  szTerms: SZ_TERMS.length,
  slang: SLANG.length,
  get total() {
    return this.particles + this.verbs + this.adjectives + 
           this.phrases + this.hkTerms + this.szTerms + this.slang;
  }
};

/**
 * 检测文本中的粤语使用情况
 */
export function detectCantoneseUsage(text: string): {
  count: number;
  matches: string[];
  density: number; // 粤语词密度 (0-1)
} {
  const matches = text.match(CANTONESE_PATTERN) || [];
  const uniqueMatches = Array.from(new Set(matches));
  
  // 计算密度：粤语词数 / 总字数
  const density = text.length > 0 ? matches.length / text.length : 0;
  
  return {
    count: matches.length,
    matches: uniqueMatches,
    density: Math.min(1, density * 10), // 归一化到0-1
  };
}

/**
 * 判断用户是否倾向使用粤语
 */
export function isCantoneseSpeaker(
  conversationHistory: string[],
  threshold: number = 0.15
): boolean {
  const allText = conversationHistory.join(' ');
  const { density } = detectCantoneseUsage(allText);
  return density >= threshold;
}

// 导出词汇总数用于验证
console.log(`📚 粤语词库已加载: ${VOCABULARY_STATS.total} 词汇`);
console.log(`   语气助词: ${VOCABULARY_STATS.particles}`);
console.log(`   常用动词: ${VOCABULARY_STATS.verbs}`);
console.log(`   形容词: ${VOCABULARY_STATS.adjectives}`);
console.log(`   日常短语: ${VOCABULARY_STATS.phrases}`);
console.log(`   香港地名: ${VOCABULARY_STATS.hkTerms}`);
console.log(`   深圳地名: ${VOCABULARY_STATS.szTerms}`);
console.log(`   网络潮语: ${VOCABULARY_STATS.slang}`);
