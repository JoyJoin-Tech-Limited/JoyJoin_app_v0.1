/**
 * 行业本体知识库
 * 
 * 用于智能信息提取的专业分类体系
 * 包含：行业大类 → 细分领域 → 常见职位 → 同义词映射
 */

// ============ 行业本体结构 ============

export interface IndustrySegment {
  name: string;
  aliases: string[];           // 同义词/别名
  commonPositions: string[];   // 常见职位
  keywords: string[];          // 触发关键词
}

export interface IndustryCategory {
  name: string;
  aliases: string[];
  segments: IndustrySegment[];
  keywords: string[];
}

// ============ 行业本体库 ============

export const INDUSTRY_ONTOLOGY: IndustryCategory[] = [
  // ===== 金融 =====
  {
    name: '金融',
    aliases: ['金融业', '金融行业', '财经', 'finance'],
    keywords: ['金融', '投资', '银行', '基金', '证券', '保险', '财务'],
    segments: [
      {
        name: '一级市场',
        aliases: ['PE', 'VC', '私募股权', '风险投资', '创投', 'primary market'],
        commonPositions: ['投资经理', '投资总监', '合伙人', '投后管理', '募资'],
        keywords: ['PE', 'VC', '私募', '风投', '创投', '股权投资', '早期投资', 'GP', 'LP']
      },
      {
        name: '并购',
        aliases: ['M&A', '兼并收购', '投行并购'],
        commonPositions: ['并购经理', '并购总监', 'MD', '执行董事'],
        keywords: ['并购', 'M&A', '收购', '兼并', '重组', '尽调', 'DD']
      },
      {
        name: '投行',
        aliases: ['投资银行', 'IBD', 'investment banking'],
        commonPositions: ['分析师', 'Associate', 'VP', 'MD', '保荐代表人'],
        keywords: ['投行', 'IBD', 'IPO', '承销', '保荐', '发债', 'ECM', 'DCM']
      },
      {
        name: '二级市场',
        aliases: ['公募', '股票', '证券交易', 'secondary market'],
        commonPositions: ['研究员', '基金经理', '交易员', '分析师'],
        keywords: ['股票', '二级', '公募', '研究', '交易', '量化', 'A股', '港股', '美股']
      },
      {
        name: '量化',
        aliases: ['量化交易', 'quant', '量化投资'],
        commonPositions: ['量化研究员', '策略研究员', 'Quant Developer'],
        keywords: ['量化', 'quant', '策略', '高频', 'alpha', '因子']
      },
      {
        name: '银行',
        aliases: ['商业银行', '银行业'],
        commonPositions: ['客户经理', '风控', '信审', '对公', '零售'],
        keywords: ['银行', '信贷', '风控', '信审', '对公', '零售银行']
      },
      {
        name: '保险',
        aliases: ['保险业', '保险公司'],
        commonPositions: ['精算师', '核保', '理赔', '保险代理'],
        keywords: ['保险', '精算', '核保', '理赔', '再保险']
      },
      {
        name: '资管',
        aliases: ['资产管理', 'asset management'],
        commonPositions: ['基金经理', '投资经理', '产品经理'],
        keywords: ['资管', '资产管理', '财富管理', '理财', '信托']
      }
    ]
  },
  
  // ===== 科技/互联网 =====
  {
    name: '科技/互联网',
    aliases: ['科技', '互联网', 'IT', 'tech', '技术'],
    keywords: ['科技', '互联网', '技术', '软件', '开发', '程序', 'IT', 'tech'],
    segments: [
      {
        name: '研发/开发',
        aliases: ['开发', '工程', 'development', 'engineering'],
        commonPositions: ['程序员', '工程师', '开发', '架构师', 'CTO'],
        keywords: ['程序员', '码农', '开发', '工程师', '写代码', '后端', '前端', '全栈']
      },
      {
        name: '前端',
        aliases: ['前端开发', 'frontend', 'web开发'],
        commonPositions: ['前端工程师', 'Web开发', 'H5开发'],
        keywords: ['前端', 'H5', 'Web', 'React', 'Vue', 'JavaScript', 'CSS']
      },
      {
        name: '后端',
        aliases: ['后端开发', 'backend', '服务端'],
        commonPositions: ['后端工程师', '服务端开发', 'Java开发'],
        keywords: ['后端', '服务端', 'Java', 'Python', 'Go', 'Node', '数据库']
      },
      {
        name: 'AI/算法',
        aliases: ['人工智能', '机器学习', 'ML', 'AI'],
        commonPositions: ['算法工程师', 'AI工程师', '数据科学家', '机器学习工程师'],
        keywords: ['AI', '算法', '机器学习', '深度学习', 'NLP', 'CV', '大模型', 'LLM']
      },
      {
        name: '产品',
        aliases: ['产品管理', 'product'],
        commonPositions: ['产品经理', 'PM', '产品总监', 'CPO'],
        keywords: ['产品经理', 'PM', '产品', '需求', '用户体验', 'PRD']
      },
      {
        name: '设计',
        aliases: ['UI/UX', '视觉设计'],
        commonPositions: ['UI设计师', 'UX设计师', '视觉设计师', '交互设计师'],
        keywords: ['设计师', 'UI', 'UX', '视觉', '交互', '美工', 'Figma']
      },
      {
        name: '运营',
        aliases: ['互联网运营', 'operation'],
        commonPositions: ['运营经理', '内容运营', '用户运营', '增长'],
        keywords: ['运营', '增长', '拉新', '留存', '内容', '社群']
      },
      {
        name: '数据',
        aliases: ['数据分析', 'data'],
        commonPositions: ['数据分析师', '数据工程师', 'BI'],
        keywords: ['数据', '分析', 'BI', 'SQL', '数仓', 'ETL']
      }
    ]
  },
  
  // ===== 咨询 =====
  {
    name: '咨询',
    aliases: ['管理咨询', 'consulting', '咨询公司'],
    keywords: ['咨询', '顾问', 'MBB', '麦肯锡', '波士顿', '贝恩'],
    segments: [
      {
        name: '战略咨询',
        aliases: ['管理咨询', 'strategy consulting'],
        commonPositions: ['咨询顾问', '高级顾问', '项目经理', '合伙人'],
        keywords: ['战略', 'MBB', '麦肯锡', 'BCG', '贝恩', '咨询']
      },
      {
        name: '财务咨询',
        aliases: ['四大', 'Big4', '审计'],
        commonPositions: ['审计', '税务', '咨询顾问', '经理'],
        keywords: ['四大', '审计', '普华', '德勤', '安永', '毕马威', 'KPMG']
      },
      {
        name: 'IT咨询',
        aliases: ['技术咨询', 'IT consulting'],
        commonPositions: ['IT顾问', '解决方案架构师', '实施顾问'],
        keywords: ['埃森哲', 'IBM', 'IT咨询', '实施', 'SAP', 'Oracle']
      }
    ]
  },
  
  // ===== 法律 =====
  {
    name: '法律',
    aliases: ['律所', '法律行业', 'legal'],
    keywords: ['律师', '法律', '律所', '法务', '诉讼'],
    segments: [
      {
        name: '律所',
        aliases: ['律师事务所'],
        commonPositions: ['律师', '合伙人', '律师助理'],
        keywords: ['律师', '律所', '红圈所', '金杜', '中伦', '方达']
      },
      {
        name: '企业法务',
        aliases: ['in-house', '公司法务'],
        commonPositions: ['法务', '法务总监', '总法律顾问'],
        keywords: ['法务', 'in-house', '合规', '法总']
      }
    ]
  },
  
  // ===== 医疗/生物 =====
  {
    name: '医疗/生物',
    aliases: ['医疗', '生物', '医药', 'healthcare', 'biotech'],
    keywords: ['医疗', '医生', '医院', '生物', '医药', '制药'],
    segments: [
      {
        name: '临床医疗',
        aliases: ['医院', '医生'],
        commonPositions: ['医生', '主任医师', '住院医', '护士'],
        keywords: ['医生', '医院', '临床', '主任', '住院医', '规培']
      },
      {
        name: '医药研发',
        aliases: ['药企研发', 'pharma R&D'],
        commonPositions: ['研发科学家', '临床研究员', 'MSL'],
        keywords: ['研发', '新药', '临床试验', 'CRO', 'CMO']
      },
      {
        name: '生物科技',
        aliases: ['biotech', '生物技术'],
        commonPositions: ['研究员', '科学家', '实验员'],
        keywords: ['生物', 'biotech', '基因', '细胞', '免疫']
      }
    ]
  },
  
  // ===== 教育 =====
  {
    name: '教育',
    aliases: ['教育行业', 'education'],
    keywords: ['教育', '老师', '教师', '培训', '学校'],
    segments: [
      {
        name: '学校教育',
        aliases: ['公立教育', '学校'],
        commonPositions: ['教师', '老师', '班主任', '教授'],
        keywords: ['老师', '教师', '学校', '教授', '大学']
      },
      {
        name: '培训机构',
        aliases: ['教培', '培训'],
        commonPositions: ['培训师', '课程顾问', '教研'],
        keywords: ['培训', '教培', '机构', '课程']
      }
    ]
  },
  
  // ===== 地产 =====
  {
    name: '地产',
    aliases: ['房地产', 'real estate', '不动产'],
    keywords: ['地产', '房地产', '房产', '开发商'],
    segments: [
      {
        name: '开发商',
        aliases: ['房企', '地产开发'],
        commonPositions: ['投拓', '营销', '工程', '设计'],
        keywords: ['开发商', '房企', '地产公司', '投拓', '拿地']
      },
      {
        name: '商业地产',
        aliases: ['写字楼', '购物中心'],
        commonPositions: ['招商', '运营', '资管'],
        keywords: ['商业', '写字楼', '购物中心', '招商']
      }
    ]
  },
  
  // ===== 快消/零售 =====
  {
    name: '快消/零售',
    aliases: ['消费品', 'FMCG', 'retail', '零售'],
    keywords: ['快消', '零售', '消费品', '品牌', '电商'],
    segments: [
      {
        name: '品牌方',
        aliases: ['甲方', 'brand'],
        commonPositions: ['品牌经理', '市场经理', '销售'],
        keywords: ['品牌', '市场', '宝洁', '联合利华', '欧莱雅']
      },
      {
        name: '电商',
        aliases: ['线上零售', 'e-commerce'],
        commonPositions: ['电商运营', '店铺运营', '选品'],
        keywords: ['电商', '淘宝', '天猫', '京东', '抖音', '直播']
      }
    ]
  },
  
  // ===== 传媒/广告 =====
  {
    name: '传媒/广告',
    aliases: ['媒体', '广告', 'media', 'advertising'],
    keywords: ['传媒', '广告', '媒体', '公关', '营销'],
    segments: [
      {
        name: '广告公司',
        aliases: ['4A', '创意', 'agency'],
        commonPositions: ['AE', '创意', '策划', '文案'],
        keywords: ['广告', '4A', '创意', '奥美', 'WPP']
      },
      {
        name: '公关',
        aliases: ['PR', '公共关系'],
        commonPositions: ['公关经理', 'PR', '媒介'],
        keywords: ['公关', 'PR', '媒介', '传播']
      }
    ]
  },
  
  // ===== 制造业 =====
  {
    name: '制造业',
    aliases: ['工业', '制造', 'manufacturing'],
    keywords: ['制造', '工厂', '生产', '工业', '工程'],
    segments: [
      {
        name: '汽车',
        aliases: ['车企', 'automotive'],
        commonPositions: ['工程师', '研发', '生产'],
        keywords: ['汽车', '车企', '新能源车', '蔚来', '特斯拉', '比亚迪']
      },
      {
        name: '半导体/芯片',
        aliases: ['芯片', 'semiconductor', 'IC'],
        commonPositions: ['IC设计', '工艺工程师', 'FAE'],
        keywords: ['芯片', '半导体', 'IC', '晶圆', '封测']
      }
    ]
  }
];

// ============ 同义词快速查找表 ============

export interface SynonymMapping {
  canonical: string;        // 标准形式
  field: 'industry' | 'industrySegment' | 'occupation';
  value: string;            // 映射到的值
  confidence: number;       // 匹配置信度
}

// 构建同义词查找表
export function buildSynonymLookup(): Map<string, SynonymMapping> {
  const lookup = new Map<string, SynonymMapping>();
  
  for (const industry of INDUSTRY_ONTOLOGY) {
    // 行业别名
    for (const alias of [industry.name, ...industry.aliases]) {
      lookup.set(alias.toLowerCase(), {
        canonical: industry.name,
        field: 'industry',
        value: industry.name,
        confidence: 0.95
      });
    }
    
    // 行业关键词
    for (const keyword of industry.keywords) {
      if (!lookup.has(keyword.toLowerCase())) {
        lookup.set(keyword.toLowerCase(), {
          canonical: industry.name,
          field: 'industry',
          value: industry.name,
          confidence: 0.85
        });
      }
    }
    
    // 细分领域
    for (const segment of industry.segments) {
      for (const alias of [segment.name, ...segment.aliases]) {
        lookup.set(alias.toLowerCase(), {
          canonical: segment.name,
          field: 'industrySegment',
          value: segment.name,
          confidence: 0.95
        });
      }
      
      for (const keyword of segment.keywords) {
        if (!lookup.has(keyword.toLowerCase())) {
          lookup.set(keyword.toLowerCase(), {
            canonical: segment.name,
            field: 'industrySegment',
            value: segment.name,
            confidence: 0.85
          });
        }
      }
      
      // 职位
      for (const position of segment.commonPositions) {
        if (!lookup.has(position.toLowerCase())) {
          lookup.set(position.toLowerCase(), {
            canonical: position,
            field: 'occupation',
            value: position,
            confidence: 0.9
          });
        }
      }
    }
  }
  
  return lookup;
}

// 预构建查找表
export const SYNONYM_LOOKUP = buildSynonymLookup();

// ============ RAG检索函数 ============

export interface IndustryMatch {
  industry: string;
  industrySegment?: string;
  occupation?: string;
  confidence: number;
  matchedKeywords: string[];
}

/**
 * 从用户输入中匹配行业信息
 * 用于RAG增强prompt上下文
 */
export function matchIndustryFromText(text: string): IndustryMatch | null {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let bestMatch: IndustryMatch | null = null;
  
  // 遍历知识库寻找匹配
  for (const industry of INDUSTRY_ONTOLOGY) {
    // 检查行业关键词
    for (const keyword of industry.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    
    // 检查细分领域
    for (const segment of industry.segments) {
      for (const keyword of segment.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          matchedKeywords.push(keyword);
          
          // 找到细分领域匹配
          if (!bestMatch || matchedKeywords.length > bestMatch.matchedKeywords.length) {
            bestMatch = {
              industry: industry.name,
              industrySegment: segment.name,
              confidence: 0.85 + (matchedKeywords.length * 0.03),
              matchedKeywords: [...matchedKeywords]
            };
          }
        }
      }
      
      // 检查职位
      for (const position of segment.commonPositions) {
        if (lowerText.includes(position.toLowerCase())) {
          matchedKeywords.push(position);
          
          if (!bestMatch || matchedKeywords.length > bestMatch.matchedKeywords.length) {
            bestMatch = {
              industry: industry.name,
              industrySegment: segment.name,
              occupation: position,
              confidence: 0.9 + (matchedKeywords.length * 0.02),
              matchedKeywords: [...matchedKeywords]
            };
          }
        }
      }
    }
  }
  
  // 限制置信度上限
  if (bestMatch) {
    bestMatch.confidence = Math.min(bestMatch.confidence, 0.98);
  }
  
  return bestMatch;
}

/**
 * 生成RAG上下文注入prompt
 * 根据用户对话内容，返回相关的行业知识
 */
export function generateRAGContext(userMessages: string[]): string {
  const allText = userMessages.join(' ');
  const match = matchIndustryFromText(allText);
  
  if (!match) {
    return '';
  }
  
  // 找到对应的行业详情
  const industryInfo = INDUSTRY_ONTOLOGY.find(i => i.name === match.industry);
  const segmentInfo = industryInfo?.segments.find(s => s.name === match.industrySegment);
  
  let context = `\n[行业知识库参考]\n`;
  context += `检测到用户可能属于：${match.industry}`;
  if (match.industrySegment) {
    context += ` - ${match.industrySegment}`;
  }
  context += `\n`;
  
  if (segmentInfo) {
    context += `常见职位：${segmentInfo.commonPositions.join('、')}\n`;
    context += `相关术语：${segmentInfo.keywords.slice(0, 5).join('、')}\n`;
  }
  
  context += `请在collected_info中使用结构化字段：industry="${match.industry}"`;
  if (match.industrySegment) {
    context += `, industrySegment="${match.industrySegment}"`;
  }
  if (match.occupation) {
    context += `, occupation="${match.occupation}"`;
  }
  context += `\n`;
  
  return context;
}

/**
 * 获取行业知识库摘要（用于prompt注入）
 */
export function getIndustryOntologySummary(): string {
  const industries = INDUSTRY_ONTOLOGY.map(i => {
    const segments = i.segments.map(s => s.name).join('/');
    return `${i.name}(${segments})`;
  }).join('、');
  
  return `支持的行业分类：${industries}`;
}
