/**
 * 职位模糊匹配与行业-职位联合推理
 * 
 * 支持口语化表达识别：
 * - "做XX的" → 标准职位
 * - "XX一枚" → 标准职位
 * - "搞XX的" → 标准职位
 */

export interface OccupationMatch {
  occupation: string;
  category: string;
  confidence: number;
  evidence: string;
}

export interface CompanyProfile {
  name: string;
  aliases: string[];
  industry: string;
  commonRoles: string[];
}

// 标准职位映射
// IMPORTANT: Pattern order matters! More specific patterns should come first.
// Finance/Investment patterns MUST be before generic tech patterns to prevent misclassification.
const OCCUPATION_PATTERNS: Array<{
  patterns: RegExp[];
  occupation: string;
  category: string;
  priority?: number; // Higher priority = checked first in scoring system
}> = [
  // ===== HIGH PRIORITY: Finance/Investment (MUST come first) =====
  // This prevents "投资" from being misclassified as tech roles
  {
    patterns: [
      /投资/i,
      /投行/i,
      /基金/i,
      /pe(?![a-z])/i,
      /vc(?![a-z])/i,
      /券商/i,
      /证券/i,
      /金融/i,
      /量化/i,
      /私募/i,
      /风投/i,
      /资管/i,
      /做投资的/i,
      /搞金融的/i,
      /做金融的/i,
      /金融一枚/i,
      /分析师/i,
      /交易员/i,
      /banker/i,
    ],
    occupation: '金融从业者',
    category: '金融',
    priority: 100
  },
  // 咨询
  {
    patterns: [
      /咨询/i,
      /做咨询的/i,
      /咨询一枚/i,
      /consultant/i,
      /四大/i,
      /mbb/i,
      /麦肯锡/i,
      /bcg/i,
      /贝恩/i,
      /德勤/i,
      /普华/i,
      /安永/i,
      /毕马威/i,
    ],
    occupation: '咨询顾问',
    category: '咨询',
    priority: 90
  },
  // 法律
  {
    patterns: [
      /律师/i,
      /做律师的/i,
      /律师一枚/i,
      /法务/i,
      /做法律的/i,
      /搞法律的/i,
      /律所/i,
      /legal/i,
    ],
    occupation: '律师/法务',
    category: '法律',
    priority: 90
  },
  // 医疗
  {
    patterns: [
      /医生/i,
      /做医生的/i,
      /医生一枚/i,
      /护士/i,
      /医疗/i,
      /做医疗的/i,
      /医药/i,
      /doctor/i,
    ],
    occupation: '医疗从业者',
    category: '医疗',
    priority: 90
  },
  // 产品
  {
    patterns: [
      /产品经理/i,
      /做产品的/i,
      /产品一枚/i,
      /pm(?![a-z])/i,
      /搞产品的/i,
      /产品狗/i,
      /画原型的/i,
      /写prd的/i,
    ],
    occupation: '产品经理',
    category: '产品',
    priority: 80
  },
  // 设计
  {
    patterns: [
      /设计师/i,
      /做设计的/i,
      /设计一枚/i,
      /ui(?:\/ux)?/i,
      /ux/i,
      /美工/i,
      /视觉设计/i,
      /交互设计/i,
      /搞设计的/i,
      /画图的/i,
      /做ui的/i,
    ],
    occupation: '设计师',
    category: '设计',
    priority: 80
  },
  // 运营
  {
    patterns: [
      /运营/i,
      /做运营的/i,
      /运营一枚/i,
      /搞运营的/i,
      /内容运营/i,
      /用户运营/i,
      /活动运营/i,
      /社群运营/i,
      /新媒体运营/i,
    ],
    occupation: '运营',
    category: '运营',
    priority: 70
  },
  // 市场/营销
  {
    patterns: [
      /市场/i,
      /做市场的/i,
      /市场一枚/i,
      /营销/i,
      /marketing/i,
      /品牌/i,
      /公关/i,
      /pr(?![a-z])/i,
      /广告/i,
    ],
    occupation: '市场营销',
    category: '市场',
    priority: 70
  },
  // 销售
  {
    patterns: [
      /销售/i,
      /做销售的/i,
      /销售一枚/i,
      /bd(?![a-z])/i,
      /商务拓展/i,
      /商务/i,
      /客户经理/i,
      /卖东西的/i,
    ],
    occupation: '销售',
    category: '销售',
    priority: 70
  },
  // 技术/开发 - MOVED AFTER FINANCE to prevent misclassification
  {
    patterns: [
      /程序员/i,
      /做开发的/i,
      /开发一枚/i,
      /码农/i,
      /写代码的/i,
      /敲代码的/i,
      /搞技术的/i,
      /工程师/i,
      /前端/i,
      /后端/i,
      /全栈/i,
      /软件开发/i,
      /研发/i,
      /coder/i,
      /developer/i,
      /swe/i,
      /tech(?:nical)?/i,
    ],
    occupation: '软件工程师',
    category: '技术',
    priority: 60
  },
  // 教育
  {
    patterns: [
      /老师/i,
      /做老师的/i,
      /老师一枚/i,
      /教师/i,
      /教育/i,
      /做教育的/i,
      /培训/i,
      /讲师/i,
    ],
    occupation: '教育工作者',
    category: '教育',
    priority: 80
  },
  // HR
  {
    patterns: [
      /hr(?![a-z])/i,
      /做hr的/i,
      /hr一枚/i,
      /人力资源/i,
      /招聘/i,
      /人事/i,
      /hrbp/i,
    ],
    occupation: 'HR',
    category: '人力资源',
    priority: 70
  },
  // 财务
  {
    patterns: [
      /财务/i,
      /做财务的/i,
      /财务一枚/i,
      /会计/i,
      /审计/i,
      /cfo/i,
      /出纳/i,
    ],
    occupation: '财务',
    category: '财务',
    priority: 70
  },
  // 行政
  {
    patterns: [
      /行政/i,
      /做行政的/i,
      /行政一枚/i,
      /前台/i,
      /助理/i,
      /秘书/i,
    ],
    occupation: '行政',
    category: '行政',
    priority: 60
  },
  // 创业者/老板
  {
    patterns: [
      /创业/i,
      /自己创业/i,
      /老板/i,
      /ceo/i,
      /创始人/i,
      /founder/i,
      /自己做/i,
      /自己开/i,
    ],
    occupation: '创业者',
    category: '创业',
    priority: 80
  },
  // 自由职业
  {
    patterns: [
      /自由职业/i,
      /freelancer/i,
      /自媒体/i,
      /博主/i,
      /up主/i,
      /kol/i,
      /网红/i,
      /直播/i,
    ],
    occupation: '自由职业者',
    category: '自由职业',
    priority: 70
  },
];

// 知名公司及其常见职位
const COMPANY_PROFILES: CompanyProfile[] = [
  // 互联网大厂
  {
    name: '腾讯',
    aliases: ['tencent', '鹅厂', '小马哥的公司'],
    industry: '互联网',
    commonRoles: ['产品经理', '软件工程师', '运营', '设计师', '游戏策划']
  },
  {
    name: '阿里巴巴',
    aliases: ['阿里', '阿里巴巴', 'alibaba', '蚂蚁', '蚂蚁金服', '支付宝', '淘宝', '天猫', '菜鸟', '盒马'],
    industry: '互联网/电商',
    commonRoles: ['产品经理', '软件工程师', '运营', '算法工程师']
  },
  {
    name: '字节跳动',
    aliases: ['字节', 'bytedance', '抖音', '今日头条', 'tiktok', '飞书'],
    industry: '互联网',
    commonRoles: ['产品经理', '软件工程师', '运营', '算法工程师', '内容审核']
  },
  {
    name: '美团',
    aliases: ['meituan', '美团点评'],
    industry: '互联网/本地生活',
    commonRoles: ['产品经理', '软件工程师', '运营', '销售', '骑手']
  },
  {
    name: '京东',
    aliases: ['jd', '东哥的公司'],
    industry: '互联网/电商',
    commonRoles: ['产品经理', '软件工程师', '运营', '供应链']
  },
  {
    name: '百度',
    aliases: ['baidu'],
    industry: '互联网',
    commonRoles: ['软件工程师', '算法工程师', '产品经理']
  },
  {
    name: '华为',
    aliases: ['huawei', '菊厂'],
    industry: '通信/科技',
    commonRoles: ['软件工程师', '硬件工程师', '产品经理', '销售']
  },
  {
    name: '小红书',
    aliases: ['red', '小红薯'],
    industry: '互联网/社交',
    commonRoles: ['产品经理', '运营', '软件工程师', '设计师']
  },
  {
    name: '拼多多',
    aliases: ['pdd', '拼夕夕'],
    industry: '互联网/电商',
    commonRoles: ['软件工程师', '产品经理', '运营']
  },
  {
    name: '网易',
    aliases: ['netease', '猪厂'],
    industry: '互联网/游戏',
    commonRoles: ['游戏策划', '软件工程师', '产品经理', '设计师']
  },
  {
    name: '大疆',
    aliases: ['dji'],
    industry: '科技/硬件',
    commonRoles: ['软件工程师', '硬件工程师', '产品经理']
  },
  {
    name: 'SHEIN',
    aliases: ['希音'],
    industry: '电商/快时尚',
    commonRoles: ['运营', '供应链', '产品经理', '软件工程师']
  },
  // 咨询公司
  {
    name: '麦肯锡',
    aliases: ['mckinsey', 'mck'],
    industry: '咨询',
    commonRoles: ['咨询顾问']
  },
  {
    name: 'BCG',
    aliases: ['波士顿咨询', 'boston consulting'],
    industry: '咨询',
    commonRoles: ['咨询顾问']
  },
  {
    name: '贝恩',
    aliases: ['bain'],
    industry: '咨询',
    commonRoles: ['咨询顾问']
  },
  // 四大会计师事务所
  {
    name: '德勤',
    aliases: ['deloitte', 'dtt'],
    industry: '会计/咨询',
    commonRoles: ['审计', '咨询顾问', '税务']
  },
  {
    name: '普华永道',
    aliases: ['pwc', '普华'],
    industry: '会计/咨询',
    commonRoles: ['审计', '咨询顾问', '税务']
  },
  {
    name: '安永',
    aliases: ['ey', 'ernst & young'],
    industry: '会计/咨询',
    commonRoles: ['审计', '咨询顾问', '税务']
  },
  {
    name: '毕马威',
    aliases: ['kpmg'],
    industry: '会计/咨询',
    commonRoles: ['审计', '咨询顾问', '税务']
  },
  // 金融机构
  {
    name: '高盛',
    aliases: ['goldman', 'goldman sachs', 'gs'],
    industry: '金融/投行',
    commonRoles: ['投行分析师', '交易员']
  },
  {
    name: '摩根士丹利',
    aliases: ['morgan stanley', 'ms'],
    industry: '金融/投行',
    commonRoles: ['投行分析师', '交易员']
  },
  {
    name: '中金',
    aliases: ['cicc', '中金公司'],
    industry: '金融/投行',
    commonRoles: ['投行分析师', '研究员']
  },
];

/**
 * Calculate match specificity score
 * Higher scores indicate more specific/confident matches
 */
function calculateMatchScore(
  matchedText: string, 
  fullText: string, 
  pattern: typeof OCCUPATION_PATTERNS[0]
): number {
  let score = 0;
  
  // Base priority from pattern configuration
  score += (pattern.priority || 50);
  
  // Exact match gets highest bonus
  if (matchedText.trim() === fullText.trim()) {
    score += 100;
  }
  
  // Longer matches are more specific
  score += matchedText.length * 10;
  
  // Match length relative to input text (higher = more specific)
  const coverage = matchedText.length / fullText.length;
  score += coverage * 50;
  
  // Specific high-priority keywords get bonus
  const highPriorityKeywords = [
    '投资', '投行', 'PE', 'VC', '基金', '证券', '券商',
    '产品经理', '设计师', '咨询', '律师', '医生'
  ];
  const lowerMatched = matchedText.toLowerCase();
  const hasHighPriorityKeyword = highPriorityKeywords.some(kw => 
    matchedText.includes(kw) || lowerMatched === kw.toLowerCase()
  );
  if (hasHighPriorityKeyword) {
    score += 50;
  }
  
  return score;
}

/**
 * 从文本中匹配职位 (with specificity scoring)
 */
export function matchOccupation(text: string): OccupationMatch | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();
  const matches: Array<OccupationMatch & { score: number }> = [];
  
  // Collect all matching patterns with scores
  for (const pattern of OCCUPATION_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = trimmedText.match(regex);
      if (match) {
        // Calculate specificity score
        const score = calculateMatchScore(match[0], trimmedText, pattern);
        matches.push({
          occupation: pattern.occupation,
          category: pattern.category,
          confidence: 0.85,
          evidence: match[0],
          score
        });
        
        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          console.log('[OccupationMatcher] Pattern matched:', {
            input: trimmedText,
            matched: match[0],
            occupation: pattern.occupation,
            category: pattern.category,
            score,
            priority: pattern.priority || 50
          });
        }
      }
    }
  }
  
  // Return highest scoring match
  if (matches.length === 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[OccupationMatcher] No match found for:', trimmedText);
    }
    return null;
  }
  
  // Sort by score (highest first) and return best match
  matches.sort((a, b) => b.score - a.score);
  const bestMatch = matches[0];
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[OccupationMatcher] Best match selected:', {
      input: trimmedText,
      result: bestMatch.occupation,
      category: bestMatch.category,
      evidence: bestMatch.evidence,
      score: bestMatch.score,
      totalMatches: matches.length
    });
  }
  
  // Return without the score property
  const { score, ...result } = bestMatch;
  return result;
}

/**
 * 识别公司并推断可能职位
 */
export function recognizeCompany(text: string): CompanyProfile | null {
  const lowerText = text.toLowerCase();
  
  for (const company of COMPANY_PROFILES) {
    const allNames = [company.name.toLowerCase(), ...company.aliases.map(a => a.toLowerCase())];
    
    for (const name of allNames) {
      if (lowerText.includes(name)) {
        return company;
      }
    }
  }
  
  return null;
}

/**
 * 行业-职位联合推理
 * 根据已知公司推断可能的职位列表
 */
export function inferPossibleRoles(companyName: string): string[] {
  const company = COMPANY_PROFILES.find(c => 
    c.name === companyName || 
    c.aliases.some(a => a.toLowerCase() === companyName.toLowerCase())
  );
  
  return company?.commonRoles || [];
}

/**
 * 综合职位识别
 */
export function extractOccupationInfo(text: string): {
  occupation: OccupationMatch | null;
  company: CompanyProfile | null;
  possibleRoles: string[];
} {
  const occupation = matchOccupation(text);
  const company = recognizeCompany(text);
  const possibleRoles = company ? company.commonRoles : [];
  
  return {
    occupation,
    company,
    possibleRoles
  };
}
