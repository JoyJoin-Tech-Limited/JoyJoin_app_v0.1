/**
 * JoyJoin 三层行业分类体系 (Three-Tier Industry Taxonomy)
 * 21个行业大类，覆盖率目标：94%+
 */

export interface IndustryNiche {
  id: string;
  label: string;
  synonyms: string[];
  keywords: string[];
}

export interface IndustrySegment {
  id: string;
  label: string;
  niches: IndustryNiche[];
}

export interface IndustryCategory {
  id: string;
  label: string;
  icon: string;
  priority: number;
  segments: IndustrySegment[];
}

export const INDUSTRY_TAXONOMY: IndustryCategory[] = [
  {
    id: "finance",
    label: "金融服务",
    icon: "💰",
    priority: 1,
    segments: [
      {
        id: "commercial_banking",
        label: "商业银行",
        niches: [
          { id: "bank_teller", label: "银行柜员", synonyms: ["柜员", "银行职员", "银行前台"], keywords: ["柜台", "营业厅", "储蓄"] },
          { id: "relationship_manager", label: "客户经理", synonyms: ["理财经理", "客户顾问"], keywords: ["理财", "客户", "销售"] },
          { id: "credit_officer", label: "信贷员", synonyms: ["贷款专员", "信审"], keywords: ["贷款", "信贷", "审批"] },
          { id: "risk_management", label: "风险管理", synonyms: ["风控", "风险分析师"], keywords: ["风控", "风险", "合规"] },
        ]
      },
      {
        id: "investment_banking",
        label: "投资银行",
        niches: [
          { id: "ipo_ecm", label: "IPO/股权承销", synonyms: ["ECM", "股票承销", "保荐"], keywords: ["IPO", "上市", "承销"] },
          { id: "ma_advisory", label: "并购顾问", synonyms: ["M&A", "兼并收购"], keywords: ["并购", "M&A", "收购"] },
        ]
      },
      {
        id: "pe_vc",
        label: "PE/VC",
        niches: [
          { id: "private_equity", label: "私募股权", synonyms: ["PE", "股权投资", "一级市场"], keywords: ["PE", "股权", "私募", "LP", "GP"] },
          { id: "venture_capital", label: "风险投资", synonyms: ["VC", "创投"], keywords: ["VC", "风投", "创业"] },
        ]
      },
      {
        id: "insurance",
        label: "保险",
        niches: [
          { id: "actuary", label: "精算师", synonyms: ["精算", "保险精算"], keywords: ["精算", "数学", "保险"] },
          { id: "insurance_agent", label: "保险代理", synonyms: ["保险经纪"], keywords: ["保险", "代理", "销售"] },
        ]
      },
    ]
  },
  {
    id: "tech",
    label: "科技互联网",
    icon: "💻",
    priority: 2,
    segments: [
      {
        id: "ai_ml",
        label: "人工智能",
        niches: [
          { id: "llm_research", label: "大模型研发", synonyms: ["LLM", "大语言模型", "GPT"], keywords: ["大模型", "LLM", "GPT", "fine-tuning", "DeepSeek", "文心一言"] },
          { id: "medical_ai", label: "医疗AI", synonyms: ["AI医疗", "医学影像"], keywords: ["医疗", "AI", "影像"] },
          { id: "cv", label: "计算机视觉", synonyms: ["CV", "图像识别"], keywords: ["视觉", "CV", "图像"] },
          { id: "nlp", label: "自然语言处理", synonyms: ["NLP", "文本分析"], keywords: ["NLP", "语言", "文本"] },
          { id: "ml_engineer", label: "机器学习工程师", synonyms: ["ML工程师"], keywords: ["PyTorch", "TensorFlow", "scikit-learn", "ML"] },
        ]
      },
      {
        id: "software_dev",
        label: "软件开发",
        niches: [
          { id: "frontend", label: "前端工程师", synonyms: ["前端开发", "web开发"], keywords: ["前端", "React", "Vue", "前端工程师", "H5", "小程序", "TypeScript"] },
          { id: "backend", label: "后端工程师", synonyms: ["后端开发", "服务端"], keywords: ["后端", "Java", "Python", "程序员", "码农", "开发工程师", "软件工程师", "Go", "Node.js", "Spring"] },
          { id: "fullstack", label: "全栈工程师", synonyms: ["全栈开发", "full stack", "fullstack"], keywords: ["全栈", "全栈工程师"] },
        ]
      },
      {
        id: "product",
        label: "产品",
        niches: [
          { id: "product_manager", label: "产品经理", synonyms: ["PM", "产品"], keywords: ["产品", "需求", "功能"] },
        ]
      },
      {
        id: "design",
        label: "设计",
        niches: [
          { id: "ui_designer", label: "UI设计师", synonyms: ["界面设计"], keywords: ["UI", "视觉", "界面", "Figma", "PS", "视觉设计"] },
          { id: "ux_designer", label: "UX设计师", synonyms: ["用户体验"], keywords: ["UX", "交互", "体验", "交互设计", "用户研究", "可用性"] },
        ]
      },
      {
        id: "cybersecurity",
        label: "网络安全",
        niches: [
          { id: "sec_engineer", label: "安全工程师", synonyms: ["信息安全"], keywords: ["安全", "渗透", "攻防", "Security"] },
          { id: "sec_analyst", label: "安全分析师", synonyms: ["SOC", "安全运营"], keywords: ["监控", "响应", "应急"] },
        ]
      },
      {
        id: "data_analytics",
        label: "数据分析",
        niches: [
          { id: "data_analyst", label: "数据分析师", synonyms: ["数据分析"], keywords: ["分析", "BI", "SQL", "Tableau"] },
          { id: "data_engineer", label: "数据工程师", synonyms: ["数据开发"], keywords: ["ETL", "数仓", "Spark", "Flink"] },
          { id: "data_scientist", label: "数据科学家", synonyms: ["DS"], keywords: ["Python", "ML", "模型", "统计"] },
        ]
      },
      {
        id: "qa_testing",
        label: "测试/QA",
        niches: [
          { id: "qa_engineer", label: "测试工程师", synonyms: ["QA", "质量保证"], keywords: ["测试", "自动化", "Selenium"] },
        ]
      },
      {
        id: "devops_sre",
        label: "运维/SRE",
        niches: [
          { id: "devops_eng", label: "DevOps工程师", synonyms: ["运维开发"], keywords: ["DevOps", "CI/CD", "K8s", "Docker"] },
          { id: "sre", label: "SRE工程师", synonyms: ["站点可靠性"], keywords: ["SRE", "监控", "告警", "运维"] },
        ]
      },
    ]
  },
  {
    id: "telecom",
    label: "通信/电信",
    icon: "📡",
    priority: 18,
    segments: [
      {
        id: "telecom_equipment",
        label: "通信设备",
        niches: [
          { id: "network_engineer", label: "网络工程师", synonyms: ["通信工程师"], keywords: ["通信", "网络", "5G", "基站"] },
          { id: "telecom_hardware", label: "硬件工程师", synonyms: ["射频", "天线"], keywords: ["射频", "微波", "天线"] },
        ]
      },
      {
        id: "telecom_operator",
        label: "运营商",
        niches: [
          { id: "operator_staff", label: "运营商员工", synonyms: ["移动", "电信", "联通"], keywords: ["运营商", "移动", "联通", "电信"] },
        ]
      },
    ]
  },
  {
    id: "manufacturing",
    label: "制造业",
    icon: "🏭",
    priority: 3,
    segments: [
      {
        id: "consumer_electronics",
        label: "消费电子",
        niches: [
          { id: "assembly_worker", label: "生产线工人", synonyms: ["流水线", "操作工", "组装工"], keywords: ["生产线", "工人", "操作"] },
          { id: "smartphone", label: "手机制造", synonyms: ["手机厂"], keywords: ["手机", "制造"] },
        ]
      },
      {
        id: "automotive",
        label: "汽车制造",
        niches: [
          { id: "ev_manufacturing", label: "新能源汽车制造", synonyms: ["电动车", "EV"], keywords: ["新能源车", "电动", "汽车制造"] },
          { id: "auto_parts", label: "汽车零部件", synonyms: ["零配件"], keywords: ["零部件", "配件"] },
        ]
      },
      {
        id: "machinery",
        label: "机械制造",
        niches: [
          { id: "mech_engineer", label: "机械工程师", synonyms: ["机械设计"], keywords: ["机械", "制造", "CNC"] },
          { id: "electrical_eng", label: "电气工程师", synonyms: ["电气"], keywords: ["电气", "电路", "PLC"] },
        ]
      },
    ]
  },
  {
    id: "semiconductor",
    label: "半导体/芯片",
    icon: "💾",
    priority: 17,
    segments: [
      {
        id: "semiconductor",
        label: "半导体/芯片",
        niches: [
          { id: "chip_design", label: "芯片设计", synonyms: ["IC设计"], keywords: ["芯片", "IC", "EDA"] },
          { id: "fab_engineer", label: "制造工程师", synonyms: ["工艺"], keywords: ["晶圆", "光刻", "封装"] },
        ]
      },
    ]
  },
  {
    id: "consumer_retail",
    label: "消费品/零售",
    icon: "🛍️",
    priority: 4,
    segments: [
      {
        id: "food_service",
        label: "餐饮",
        niches: [
          { id: "chef", label: "厨师", synonyms: ["大厨", "厨子"], keywords: ["厨师", "烹饪", "做菜"] },
          { id: "waiter", label: "服务员", synonyms: ["餐厅服务", "侍应"], keywords: ["服务员", "侍应", "餐饮"] },
        ]
      },
      {
        id: "retail",
        label: "零售",
        niches: [
          { id: "sales", label: "销售", synonyms: ["店员", "导购"], keywords: ["销售", "店员", "导购"] },
        ]
      },
      {
        id: "ecommerce",
        label: "电商",
        niches: [
          { id: "ecom_operations", label: "电商运营", synonyms: ["电商"], keywords: ["电商", "运营", "天猫", "京东"] },
          { id: "ecom_marketing", label: "电商营销", synonyms: ["推广"], keywords: ["直通车", "推广", "投流"] },
          { id: "cross_border_ecom", label: "跨境电商", synonyms: ["跨境"], keywords: ["跨境", "亚马逊", "独立站"] },
        ]
      },
    ]
  },
  {
    id: "real_estate",
    label: "房地产",
    icon: "🏗️",
    priority: 5,
    segments: [
      {
        id: "real_estate_sales",
        label: "房产交易",
        niches: [
          { id: "agent", label: "房产中介", synonyms: ["地产经纪", "房产顾问"], keywords: ["中介", "经纪", "房产"] },
        ]
      },
    ]
  },
  {
    id: "construction",
    label: "建筑工程",
    icon: "🏗️",
    priority: 16,
    segments: [
      {
        id: "construction",
        label: "建筑工程",
        niches: [
          { id: "construction_worker", label: "建筑工人", synonyms: ["工地", "施工员", "construction"], keywords: ["工人", "工地", "施工", "construction"] },
        ]
      },
    ]
  },
  {
    id: "healthcare",
    label: "医疗健康",
    icon: "🏥",
    priority: 6,
    segments: [
      {
        id: "medical_services",
        label: "医疗服务",
        niches: [
          { id: "doctor", label: "医生", synonyms: ["医师", "大夫"], keywords: ["医生", "医师", "临床"] },
          { id: "nurse", label: "护士", synonyms: ["护理"], keywords: ["护士", "护理", "病房"] },
          { id: "pharmacist", label: "药剂师", synonyms: ["药师"], keywords: ["药剂", "药师", "配药"] },
        ]
      },
      {
        id: "mental_health",
        label: "心理健康",
        niches: [
          { id: "psychologist", label: "心理咨询师", synonyms: ["心理医生"], keywords: ["心理", "咨询", "治疗"] },
        ]
      },
      {
        id: "pharmaceutical",
        label: "制药",
        niches: [
          { id: "pharma_research", label: "药物研发", synonyms: ["新药"], keywords: ["制药", "药物", "临床"] },
        ]
      },
    ]
  },
  {
    id: "education",
    label: "教育培训",
    icon: "📚",
    priority: 7,
    segments: [
      {
        id: "k12",
        label: "K12教育",
        niches: [
          { id: "teacher", label: "教师", synonyms: ["老师", "教书"], keywords: ["教师", "老师", "教学"] },
        ]
      },
      {
        id: "higher_education",
        label: "高等教育",
        niches: [
          { id: "professor", label: "教授", synonyms: ["大学教师"], keywords: ["教授", "大学", "讲师", "学术"] },
          { id: "researcher", label: "研究员", synonyms: ["科研人员"], keywords: ["研究", "科研", "实验室"] },
          { id: "phd_student", label: "博士生", synonyms: ["博士", "PhD"], keywords: ["博士", "PhD", "博后"] },
        ]
      },
      {
        id: "vocational_training",
        label: "职业培训",
        niches: [
          { id: "trainer", label: "培训师", synonyms: ["讲师"], keywords: ["培训", "技能", "考证"] },
        ]
      },
    ]
  },
  {
    id: "research",
    label: "学术/科研",
    icon: "🔬",
    priority: 20,
    segments: [
      {
        id: "research_institute",
        label: "科研院所",
        niches: [
          { id: "researcher", label: "研究员", synonyms: ["科研", "实验室"], keywords: ["科研", "实验室", "研究院", "中科院"] },
          { id: "lab_technician", label: "实验员", synonyms: ["检测"], keywords: ["测试", "化验", "检测"] },
        ]
      },
      {
        id: "think_tank",
        label: "智库/咨询研究",
        niches: [
          { id: "analyst_research", label: "研究分析师", synonyms: ["智库"], keywords: ["智库", "研究", "分析"] },
        ]
      },
    ]
  },
  {
    id: "professional_services",
    label: "专业服务",
    icon: "💼",
    priority: 8,
    segments: [
      {
        id: "consulting",
        label: "咨询",
        niches: [
          { id: "consultant", label: "咨询顾问", synonyms: ["顾问"], keywords: ["咨询", "顾问"] },
        ]
      },
      {
        id: "legal",
        label: "法律",
        niches: [
          { id: "lawyer", label: "律师", synonyms: ["律师事务所"], keywords: ["律师", "法务"] },
        ]
      },
      {
        id: "accounting",
        label: "会计/审计",
        niches: [
          { id: "cpa", label: "注册会计师", synonyms: ["CPA", "审计师"], keywords: ["审计", "会计", "税务"] },
          { id: "bookkeeper", label: "会计员", synonyms: ["记账"], keywords: ["账务", "出纳"] },
        ]
      },
      {
        id: "human_resources",
        label: "人力资源",
        niches: [
          { id: "hrbp", label: "HRBP", synonyms: ["人事"], keywords: ["HR", "招聘", "薪酬", "员工"] },
          { id: "recruiter", label: "招聘专员", synonyms: ["猎头"], keywords: ["招聘", "面试", "人才"] },
        ]
      },
      {
        id: "admin",
        label: "行政/后勤",
        niches: [
          { id: "admin_staff", label: "行政专员", synonyms: ["行政", "办公室"], keywords: ["行政", "后勤", "前台"] },
        ]
      },
      {
        id: "translation",
        label: "翻译/本地化",
        niches: [
          { id: "translator", label: "翻译", synonyms: ["笔译", "口译"], keywords: ["翻译", "本地化"] },
        ]
      },
    ]
  },
  {
    id: "media_creative",
    label: "传媒/创意",
    icon: "🎨",
    priority: 9,
    segments: [
      {
        id: "marketing",
        label: "广告/公关/营销",
        niches: [
          { id: "marketing_specialist", label: "营销专员", synonyms: ["市场", "品牌营销"], keywords: ["营销", "市场", "推广", "品牌"] },
          { id: "advertising", label: "广告", synonyms: ["广告投放", "4A"], keywords: ["广告", "投放", "信息流"] },
          { id: "public_relations", label: "公关", synonyms: ["PR", "品牌公关", "政府关系"], keywords: ["公关", "PR", "GR", "媒体关系"] },
        ]
      },
      {
        id: "journalism",
        label: "新闻媒体",
        niches: [
          { id: "journalist", label: "记者", synonyms: ["新闻工作者"], keywords: ["记者", "新闻", "采访"] },
          { id: "editor", label: "编辑", synonyms: ["文字编辑"], keywords: ["编辑", "校对", "出版"] },
        ]
      },
      {
        id: "film_tv",
        label: "影视制作",
        niches: [
          { id: "director", label: "导演", synonyms: ["电影导演"], keywords: ["导演", "拍摄"] },
          { id: "screenwriter", label: "编剧", synonyms: ["剧本"], keywords: ["编剧", "剧本", "故事"] },
          { id: "producer", label: "制片人", synonyms: ["制片"], keywords: ["制片", "监制"] },
        ]
      },
      {
        id: "content_creation",
        label: "内容创作",
        niches: [
          { id: "content_creator", label: "内容创作者", synonyms: ["自媒体"], keywords: ["自媒体", "博主", "UP主", "KOL"] },
          { id: "streamer", label: "主播", synonyms: ["直播"], keywords: ["主播", "直播", "带货"] },
        ]
      },
    ]
  },
  {
    id: "gaming",
    label: "游戏/电竞",
    icon: "🎮",
    priority: 19,
    segments: [
      {
        id: "game_development",
        label: "游戏开发",
        niches: [
          { id: "game_engineer", label: "游戏开发工程师", synonyms: ["Unity", "Unreal", "Cocos"], keywords: ["游戏", "Unity", "Unreal", "Cocos", "引擎"] },
          { id: "game_designer", label: "游戏策划", synonyms: ["游戏策划"], keywords: ["游戏策划", "玩法", "系统策划", "数值策划"] },
          { id: "game_artist", label: "游戏美术", synonyms: ["原画", "模型"], keywords: ["游戏美术", "原画", "3D", "特效"] },
        ]
      },
      {
        id: "esports",
        label: "电竞",
        niches: [
          { id: "esports_player", label: "电竞选手", synonyms: ["职业选手"], keywords: ["电竞", "选手", "比赛"] },
          { id: "esports_operations", label: "电竞运营", synonyms: ["赛事"], keywords: ["赛事", "电竞运营", "解说"] },
        ]
      },
    ]
  },
  {
    id: "logistics",
    label: "物流/供应链",
    icon: "📦",
    priority: 10,
    segments: [
      {
        id: "express_delivery",
        label: "快递/配送",
        niches: [
          { id: "courier", label: "快递员", synonyms: ["送货员", "配送员"], keywords: ["快递", "送货", "配送"] },
        ]
      },
    ]
  },
  {
    id: "government_public",
    label: "政府/公共服务",
    icon: "🏛️",
    priority: 11,
    segments: [
      {
        id: "civil_service",
        label: "公务员",
        niches: [
          { id: "government", label: "公务员", synonyms: ["政府", "机关"], keywords: ["公务员", "政府", "机关"] },
        ]
      },
    ]
  },
  {
    id: "nonprofit",
    label: "非营利/公益",
    icon: "🤝",
    priority: 21,
    segments: [
      {
        id: "ngo",
        label: "公益组织",
        niches: [
          { id: "ngo_staff", label: "公益从业者", synonyms: ["NGO", "NPO", "公益"], keywords: ["公益", "NGO", "NPO", "慈善", "基金会"] },
        ]
      },
      {
        id: "social_enterprise",
        label: "社会企业",
        niches: [
          { id: "social_ent_staff", label: "社会企业员工", synonyms: ["社企"], keywords: ["社会企业", "社企"] },
        ]
      },
    ]
  },
  {
    id: "life_services",
    label: "生活服务",
    icon: "🛎️",
    priority: 12,
    segments: [
      {
        id: "hospitality",
        label: "酒店/旅游",
        niches: [
          { id: "hotel", label: "酒店服务", synonyms: ["酒店"], keywords: ["酒店", "服务"] },
        ]
      },
      {
        id: "aviation",
        label: "航空服务",
        niches: [
          { id: "pilot", label: "飞行员", synonyms: ["机长", "副驾驶", "民航飞行员"], keywords: ["飞行", "驾驶", "航空"] },
          { id: "flight_attendant", label: "空乘人员", synonyms: ["空姐", "空少", "乘务员", "cabin crew"], keywords: ["空乘", "客舱", "飞机"] },
          { id: "ground_staff", label: "地勤人员", synonyms: ["地勤", "机场服务", "值机"], keywords: ["地勤", "机场", "服务"] },
        ]
      },
    ]
  },
  {
    id: "energy_environment",
    label: "能源/环保",
    icon: "🔋",
    priority: 13,
    segments: [
      {
        id: "new_energy",
        label: "新能源",
        niches: [
          { id: "solar", label: "光伏/太阳能", synonyms: ["光伏"], keywords: ["光伏", "太阳能"] },
        ]
      },
    ]
  },
  {
    id: "agriculture_food",
    label: "农业/食品",
    icon: "🌾",
    priority: 14,
    segments: [
      {
        id: "farming",
        label: "种植/养殖",
        niches: [
          { id: "farmer", label: "农民", synonyms: ["种植"], keywords: ["种植", "农业"] },
        ]
      },
    ]
  },
  {
    id: "culture_sports",
    label: "文化/体育",
    icon: "⚽",
    priority: 15,
    segments: [
      {
        id: "sports",
        label: "体育",
        niches: [
          { id: "athlete", label: "运动员", synonyms: ["职业运动员"], keywords: ["运动员", "体育"] },
        ]
      },
      {
        id: "performing_arts",
        label: "表演艺术",
        niches: [
          { id: "dancer", label: "舞蹈演员", synonyms: ["舞者", "舞蹈员", "芭蕾舞演员", "现代舞", "街舞dancer"], keywords: ["舞蹈", "跳舞", "表演"] },
          { id: "actor", label: "演员", synonyms: ["表演者", "艺人", "配音演员", "话剧演员"], keywords: ["表演", "演戏", "演员"] },
          { id: "musician", label: "音乐家", synonyms: ["乐手", "歌手", "音乐制作人", "编曲师"], keywords: ["音乐", "演奏", "唱歌"] },
        ]
      },
    ]
  },
];

export function findCategoryById(categoryId: string): IndustryCategory | undefined {
  return INDUSTRY_TAXONOMY.find(c => c.id === categoryId);
}

export function findSegmentById(categoryId: string, segmentId: string): IndustrySegment | undefined {
  const category = findCategoryById(categoryId);
  return category?.segments.find(s => s.id === segmentId);
}

export function findNicheById(categoryId: string, segmentId: string, nicheId: string): IndustryNiche | undefined {
  const segment = findSegmentById(categoryId, segmentId);
  return segment?.niches.find(n => n.id === nicheId);
}

export function getFullIndustryPath(categoryId: string, segmentId?: string, nicheId?: string): string {
  const category = findCategoryById(categoryId);
  if (!category) return "";
  const parts = [category.label];
  if (segmentId) {
    const segment = findSegmentById(categoryId, segmentId);
    if (segment) parts.push(segment.label);
    if (nicheId) {
      const niche = findNicheById(categoryId, segmentId, nicheId);
      if (niche) parts.push(niche.label);
    }
  }
  return parts.join(" > ");
}

export function getTaxonomyStats() {
  const categoryCount = INDUSTRY_TAXONOMY.length;
  const segmentCount = INDUSTRY_TAXONOMY.reduce((sum, cat) => sum + cat.segments.length, 0);
  const nicheCount = INDUSTRY_TAXONOMY.reduce(
    (sum, cat) => sum + cat.segments.reduce((s, seg) => s + seg.niches.length, 0), 0
  );
  return { categories: categoryCount, segments: segmentCount, niches: nicheCount };
}

export function getIndustryPathLabels(
  categoryId?: string, 
  segmentId?: string, 
  nicheId?: string
): { category?: string; segment?: string; niche?: string } {
  if (!categoryId) return {};
  
  const category = findCategoryById(categoryId);
  const result: { category?: string; segment?: string; niche?: string } = {};
  
  if (category) {
    result.category = category.label;
    
    if (segmentId) {
      const segment = findSegmentById(categoryId, segmentId);
      if (segment) {
        result.segment = segment.label;
        
        if (nicheId) {
          const niche = findNicheById(categoryId, segmentId, nicheId);
          if (niche) {
            result.niche = niche.label;
          }
        }
      }
    }
  }
  
  return result;
}
