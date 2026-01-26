/**
 * JoyJoin 三层行业分类体系 (Three-Tier Industry Taxonomy)
 * 覆盖率目标：从35% → 94%+
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
          { id: "llm_research", label: "大模型研发", synonyms: ["LLM", "大语言模型", "GPT"], keywords: ["大模型", "LLM", "GPT"] },
          { id: "medical_ai", label: "医疗AI", synonyms: ["AI医疗", "医学影像"], keywords: ["医疗", "AI", "影像"] },
          { id: "cv", label: "计算机视觉", synonyms: ["CV", "图像识别"], keywords: ["视觉", "CV", "图像"] },
          { id: "nlp", label: "自然语言处理", synonyms: ["NLP", "文本分析"], keywords: ["NLP", "语言", "文本"] },
        ]
      },
      {
        id: "software_dev",
        label: "软件开发",
        niches: [
          { id: "frontend", label: "前端工程师", synonyms: ["前端开发", "web开发"], keywords: ["前端", "React", "Vue"] },
          { id: "backend", label: "后端工程师", synonyms: ["后端开发", "服务端"], keywords: ["后端", "Java", "Python"] },
          { id: "fullstack", label: "全栈工程师", synonyms: ["全栈开发"], keywords: ["全栈", "开发"] },
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
          { id: "ui_designer", label: "UI设计师", synonyms: ["界面设计"], keywords: ["UI", "视觉", "界面"] },
          { id: "ux_designer", label: "UX设计师", synonyms: ["用户体验"], keywords: ["UX", "交互", "体验"] },
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
          { id: "new_energy", label: "新能源汽车", synonyms: ["电动车", "EV"], keywords: ["新能源", "电动", "汽车"] },
          { id: "auto_parts", label: "汽车零部件", synonyms: ["零配件"], keywords: ["零部件", "配件"] },
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
    ]
  },
  {
    id: "real_estate",
    label: "房地产/建筑",
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
      {
        id: "construction",
        label: "建筑工程",
        niches: [
          { id: "construction_worker", label: "建筑工人", synonyms: ["工地", "施工员"], keywords: ["工人", "工地", "施工"] },
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
        label: "市场营销",
        niches: [
          { id: "marketer", label: "营销", synonyms: ["市场", "推广"], keywords: ["营销", "市场", "推广"] },
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
