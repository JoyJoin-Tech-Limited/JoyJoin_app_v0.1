/**
 * JoyJoin 职业分类数据库
 * 
 * 设计原则：
 * 1. 覆盖港深地区25-35岁职场人群80%以上常见职业
 * 2. 每个职业配同义词，支持智能搜索匹配
 * 3. 热门职业标记，用于快捷选择
 * 4. 行业自动归类，减少用户选择步骤
 * 
 * 数据维护指南：
 * - 新增职业需审核后加入，保证数据质量
 * - 同义词应包含口语化表达、英文缩写、行业术语
 * - hot标记基于平台用户分布统计，定期更新
 */

// 行业分类
export interface Industry {
  id: string;
  label: string;
  icon: string;
  priority: number; // 展示排序权重
}

// 职业定义
export interface Occupation {
  id: string;
  displayName: string;
  industryId: string;
  synonyms: string[];      // 同义词，用于搜索匹配
  keywords: string[];      // 关键词，用于模糊匹配
  hot: boolean;            // 是否热门，用于快捷选择
}

// 工作身份/模式
export type WorkMode = "founder" | "self_employed" | "employed" | "student";

export interface WorkModeOption {
  value: WorkMode;
  label: string;
  description: string;
}

export const WORK_MODES: WorkModeOption[] = [
  { value: "founder", label: "创始人/合伙人", description: "创业中，自己当老板" },
  { value: "self_employed", label: "自由职业", description: "独立工作，灵活接活" },
  { value: "employed", label: "在职员工", description: "在公司/机构工作" },
  { value: "student", label: "学生", description: "在读或Gap中" },
];

// 15个行业分类
export const INDUSTRIES: Industry[] = [
  { id: "tech", label: "科技互联网", icon: "💻", priority: 1 },
  { id: "ai", label: "AI/大数据", icon: "🤖", priority: 2 },
  { id: "ecommerce", label: "跨境电商", icon: "🌏", priority: 3 },
  { id: "finance", label: "金融投资", icon: "📈", priority: 4 },
  { id: "consulting", label: "咨询服务", icon: "💼", priority: 5 },
  { id: "marketing", label: "市场营销", icon: "📣", priority: 6 },
  { id: "creative", label: "创意设计", icon: "🎨", priority: 7 },
  { id: "media", label: "传媒内容", icon: "📺", priority: 8 },
  { id: "medical", label: "医疗健康", icon: "🏥", priority: 9 },
  { id: "education", label: "教育培训", icon: "📚", priority: 10 },
  { id: "legal", label: "法律合规", icon: "⚖️", priority: 11 },
  { id: "realestate", label: "地产建筑", icon: "🏗️", priority: 12 },
  { id: "hospitality", label: "航空酒店旅游", icon: "✈️", priority: 13 },
  { id: "lifestyle", label: "生活方式", icon: "☕", priority: 14 },
  { id: "other", label: "其他行业", icon: "🔧", priority: 15 },
];

// 130+ 职业数据
export const OCCUPATIONS: Occupation[] = [
  // ========== 科技互联网 (tech) ==========
  { id: "software_engineer", displayName: "软件工程师", industryId: "tech", synonyms: ["程序员", "码农", "开发工程师", "研发工程师", "coder", "developer"], keywords: ["编程", "代码", "开发"], hot: true },
  { id: "frontend_engineer", displayName: "前端工程师", industryId: "tech", synonyms: ["前端开发", "web开发", "H5开发", "React开发"], keywords: ["网页", "界面"], hot: true },
  { id: "backend_engineer", displayName: "后端工程师", industryId: "tech", synonyms: ["后端开发", "服务端开发", "Java开发", "Python开发", "Go开发"], keywords: ["服务器", "接口"], hot: false },
  { id: "fullstack_engineer", displayName: "全栈工程师", industryId: "tech", synonyms: ["全栈开发", "Full Stack", "前后端开发"], keywords: ["全栈", "开发"], hot: true },
  { id: "mobile_engineer", displayName: "移动端工程师", industryId: "tech", synonyms: ["iOS开发", "Android开发", "App开发", "客户端开发", "Flutter开发"], keywords: ["手机", "App"], hot: false },
  { id: "blockchain_engineer", displayName: "区块链工程师", industryId: "tech", synonyms: ["Web3开发", "智能合约", "Solidity", "链上开发"], keywords: ["区块链", "Web3"], hot: true },
  { id: "web3_product", displayName: "Web3产品经理", industryId: "tech", synonyms: ["Crypto PM", "区块链产品", "DeFi产品", "NFT产品"], keywords: ["Web3", "Crypto"], hot: false },
  { id: "crypto_trader", displayName: "加密货币交易员", industryId: "tech", synonyms: ["币圈", "数字货币", "量化交易", "加密货币"], keywords: ["加密", "交易"], hot: false },
  { id: "product_manager", displayName: "产品经理", industryId: "tech", synonyms: ["PM", "产品", "产品狗", "产品负责人"], keywords: ["需求", "功能"], hot: true },
  { id: "ui_designer", displayName: "UI设计师", industryId: "tech", synonyms: ["界面设计师", "视觉设计师", "UI/UX"], keywords: ["界面", "视觉"], hot: true },
  { id: "ux_designer", displayName: "UX设计师", industryId: "tech", synonyms: ["用户体验设计师", "交互设计师", "体验设计"], keywords: ["交互", "体验"], hot: false },
  { id: "qa_engineer", displayName: "测试工程师", industryId: "tech", synonyms: ["QA", "质量工程师", "测试"], keywords: ["测试", "质量"], hot: false },
  { id: "devops_engineer", displayName: "运维工程师", industryId: "tech", synonyms: ["DevOps", "SRE", "系统运维", "云架构师"], keywords: ["服务器", "部署"], hot: false },
  { id: "security_engineer", displayName: "安全工程师", industryId: "tech", synonyms: ["网络安全", "信息安全", "渗透测试", "白帽子"], keywords: ["安全", "渗透"], hot: false },
  { id: "tech_lead", displayName: "技术负责人", industryId: "tech", synonyms: ["技术总监", "CTO", "架构师", "Tech Lead"], keywords: ["架构", "技术管理"], hot: false },
  
  // ========== AI/大数据 (ai) ==========
  { id: "data_analyst", displayName: "数据分析师", industryId: "ai", synonyms: ["数据分析", "BI分析师", "业务分析师"], keywords: ["数据", "分析", "报表"], hot: true },
  { id: "data_scientist", displayName: "数据科学家", industryId: "ai", synonyms: ["算法工程师", "机器学习工程师", "ML Engineer"], keywords: ["算法", "模型"], hot: true },
  { id: "ai_engineer", displayName: "AI工程师", industryId: "ai", synonyms: ["人工智能工程师", "深度学习工程师", "NLP工程师", "CV工程师"], keywords: ["AI", "深度学习"], hot: true },
  { id: "prompt_engineer", displayName: "提示词工程师", industryId: "ai", synonyms: ["Prompt Engineer", "AI训练师", "LLM工程师", "ChatGPT专家"], keywords: ["提示词", "Prompt"], hot: true },
  { id: "aigc_designer", displayName: "AIGC设计师", industryId: "ai", synonyms: ["AI绘画", "Midjourney", "Stable Diffusion", "AI设计师"], keywords: ["AIGC", "AI绘画"], hot: true },
  { id: "llm_engineer", displayName: "大模型工程师", industryId: "ai", synonyms: ["LLM Engineer", "大语言模型", "GPT工程师", "模型训练"], keywords: ["大模型", "LLM"], hot: true },
  { id: "data_engineer", displayName: "数据工程师", industryId: "ai", synonyms: ["大数据工程师", "ETL工程师", "数仓工程师"], keywords: ["数据仓库", "管道"], hot: false },
  { id: "ai_product_manager", displayName: "AI产品经理", industryId: "ai", synonyms: ["算法产品经理", "数据产品经理", "AIGC产品经理"], keywords: ["AI产品", "算法产品"], hot: false },
  { id: "ai_researcher", displayName: "AI研究员", industryId: "ai", synonyms: ["算法研究员", "科研工程师", "Research Scientist"], keywords: ["AI研究", "论文"], hot: false },
  
  // ========== 跨境电商 (ecommerce) ==========
  { id: "ecom_operator", displayName: "电商运营", industryId: "ecommerce", synonyms: ["跨境电商运营", "亚马逊运营", "Shopify运营", "站点运营", "店铺运营", "做电商", "淘宝运营", "天猫运营", "拼多多运营"], keywords: ["运营", "店铺", "销售", "电商"], hot: true },
  { id: "ecom_product", displayName: "电商选品", industryId: "ecommerce", synonyms: ["跨境选品", "选品专员", "产品开发", "品类经理", "选品经理", "选品师"], keywords: ["选品", "产品开发"], hot: true },
  { id: "ecom_independent", displayName: "独立站站长", industryId: "ecommerce", synonyms: ["DTC运营", "品牌站长", "独立站运营", "Shopify店主", "自建站"], keywords: ["独立站", "品牌站"], hot: true },
  { id: "ecom_ads", displayName: "广告投放", industryId: "ecommerce", synonyms: ["跨境广告投放", "Facebook投放", "Google Ads", "海外投放", "广告优化师", "投放优化", "信息流投放", "SEM"], keywords: ["广告", "投放", "ROI"], hot: true },
  { id: "ecom_logistics", displayName: "电商物流", industryId: "ecommerce", synonyms: ["跨境物流", "海外仓运营", "FBA运营", "物流专员", "供应链", "仓储管理"], keywords: ["物流", "仓储", "配送"], hot: false },
  { id: "ecom_customer", displayName: "电商客服", industryId: "ecommerce", synonyms: ["跨境客服", "海外客服", "英语客服", "售后专员", "客服主管"], keywords: ["客服", "售后"], hot: false },
  { id: "ecom_manager", displayName: "电商负责人", industryId: "ecommerce", synonyms: ["电商总监", "运营总监", "电商经理", "店长"], keywords: ["管理", "电商"], hot: false },
  
  // ========== 金融投资 (finance) ==========
  { id: "finance_analyst", displayName: "金融分析师", industryId: "finance", synonyms: ["投资分析师", "研究员", "行研"], keywords: ["分析", "研究"], hot: true },
  { id: "banker", displayName: "银行职员", industryId: "finance", synonyms: ["银行经理", "客户经理", "理财经理", "柜员"], keywords: ["银行", "理财"], hot: true },
  { id: "investment_banker", displayName: "投行分析师", industryId: "finance", synonyms: ["IBD", "投行", "并购分析师"], keywords: ["投行", "并购", "IPO"], hot: true },
  { id: "pe_vc", displayName: "PE/VC投资", industryId: "finance", synonyms: ["投资经理", "风投", "私募", "基金经理"], keywords: ["投资", "基金"], hot: true },
  { id: "securities", displayName: "证券从业", industryId: "finance", synonyms: ["券商", "股票分析师", "交易员", "经纪人"], keywords: ["证券", "股票"], hot: false },
  { id: "insurance", displayName: "保险从业", industryId: "finance", synonyms: ["保险经纪", "保险顾问", "精算师"], keywords: ["保险", "精算"], hot: false },
  { id: "fund_manager", displayName: "基金经理", industryId: "finance", synonyms: ["资产管理", "投资总监", "Portfolio Manager"], keywords: ["基金", "资产"], hot: false },
  { id: "accountant", displayName: "会计师", industryId: "finance", synonyms: ["会计", "审计师", "CPA", "财务"], keywords: ["会计", "审计", "财务"], hot: true },
  { id: "cfo", displayName: "财务负责人", industryId: "finance", synonyms: ["CFO", "财务总监", "财务经理"], keywords: ["财务", "管理"], hot: false },
  
  // ========== 咨询服务 (consulting) ==========
  { id: "management_consultant", displayName: "管理咨询顾问", industryId: "consulting", synonyms: ["战略咨询", "MBB", "咨询师", "顾问"], keywords: ["咨询", "战略"], hot: true },
  { id: "it_consultant", displayName: "IT咨询顾问", industryId: "consulting", synonyms: ["技术咨询", "数字化咨询", "系统实施"], keywords: ["IT", "系统"], hot: false },
  { id: "hr_consultant", displayName: "人力咨询顾问", industryId: "consulting", synonyms: ["猎头", "招聘顾问", "HR顾问", "人才顾问"], keywords: ["招聘", "人才"], hot: true },
  { id: "hr_manager", displayName: "HR经理", industryId: "consulting", synonyms: ["人力资源", "HRBP", "人事经理", "招聘经理"], keywords: ["HR", "人事"], hot: true },
  { id: "admin_manager", displayName: "行政经理", industryId: "consulting", synonyms: ["行政", "办公室主任", "综合管理"], keywords: ["行政", "办公"], hot: false },
  
  // ========== 市场营销 (marketing) ==========
  { id: "marketing_manager", displayName: "市场经理", industryId: "marketing", synonyms: ["市场营销", "Marketing", "品牌经理", "市场总监"], keywords: ["市场", "营销"], hot: true },
  { id: "brand_manager", displayName: "品牌经理", industryId: "marketing", synonyms: ["品牌营销", "Brand Manager", "品牌策划"], keywords: ["品牌", "策划"], hot: true },
  { id: "digital_marketing", displayName: "数字营销", industryId: "marketing", synonyms: ["互联网营销", "线上营销", "增长黑客", "Growth"], keywords: ["数字", "增长"], hot: true },
  { id: "social_media", displayName: "社媒运营", industryId: "marketing", synonyms: ["新媒体运营", "小红书运营", "抖音运营", "微信运营"], keywords: ["社交媒体", "内容"], hot: true },
  { id: "pr_manager", displayName: "公关经理", industryId: "marketing", synonyms: ["PR", "公共关系", "媒体关系"], keywords: ["公关", "媒体"], hot: false },
  { id: "sales_manager", displayName: "销售经理", industryId: "marketing", synonyms: ["销售", "BD", "商务拓展", "客户经理"], keywords: ["销售", "客户"], hot: true },
  { id: "event_planner", displayName: "活动策划", industryId: "marketing", synonyms: ["活动执行", "会展策划", "线下活动"], keywords: ["活动", "策划"], hot: false },
  
  // ========== 创意设计 (creative) ==========
  { id: "graphic_designer", displayName: "平面设计师", industryId: "creative", synonyms: ["视觉设计", "美工", "设计师", "品牌设计"], keywords: ["设计", "视觉"], hot: true },
  { id: "illustrator", displayName: "插画师", industryId: "creative", synonyms: ["插画", "原画师", "画师", "绘画", "概念设计师"], keywords: ["插画", "绘画"], hot: true },
  { id: "3d_artist", displayName: "3D设计师", industryId: "creative", synonyms: ["三维设计", "3D建模", "C4D设计师", "Blender"], keywords: ["3D", "建模"], hot: true },
  { id: "game_designer", displayName: "游戏设计师", industryId: "creative", synonyms: ["游戏策划", "关卡设计", "数值策划", "游戏开发"], keywords: ["游戏", "策划"], hot: true },
  { id: "game_artist", displayName: "游戏美术", industryId: "creative", synonyms: ["游戏原画", "游戏UI", "角色设计", "场景设计"], keywords: ["游戏", "美术"], hot: false },
  { id: "motion_designer", displayName: "动效设计师", industryId: "creative", synonyms: ["动画设计", "MG动画", "视频特效", "AE动画"], keywords: ["动画", "特效"], hot: false },
  { id: "vr_ar_designer", displayName: "VR/AR设计师", industryId: "creative", synonyms: ["虚拟现实", "增强现实", "XR设计", "元宇宙设计"], keywords: ["VR", "AR"], hot: false },
  { id: "photographer", displayName: "摄影师", industryId: "creative", synonyms: ["摄影", "商业摄影", "人像摄影", "婚礼摄影", "风光摄影"], keywords: ["摄影", "拍照"], hot: true },
  { id: "videographer", displayName: "摄像师", industryId: "creative", synonyms: ["视频拍摄", "导演", "影视制作", "纪录片"], keywords: ["视频", "拍摄"], hot: false },
  { id: "video_editor", displayName: "视频剪辑", industryId: "creative", synonyms: ["剪辑师", "后期制作", "视频编辑", "Premiere"], keywords: ["剪辑", "后期"], hot: true },
  { id: "interior_designer", displayName: "室内设计师", industryId: "creative", synonyms: ["空间设计", "软装设计", "家装设计", "商业空间"], keywords: ["室内", "装修"], hot: true },
  { id: "industrial_designer", displayName: "工业设计师", industryId: "creative", synonyms: ["产品设计", "外观设计", "结构设计", "ID设计"], keywords: ["工业", "产品"], hot: false },
  { id: "jewelry_designer", displayName: "珠宝设计师", industryId: "creative", synonyms: ["首饰设计", "配饰设计", "奢侈品设计"], keywords: ["珠宝", "首饰"], hot: false },
  { id: "fashion_designer", displayName: "服装设计师", industryId: "creative", synonyms: ["时装设计", "服饰设计", "时尚设计", "打版师"], keywords: ["服装", "时尚"], hot: false },
  { id: "model", displayName: "模特", industryId: "creative", synonyms: ["平面模特", "商业模特", "试衣模特", "淘宝模特", "T台模特"], keywords: ["模特", "拍摄"], hot: true },
  { id: "makeup_artist", displayName: "化妆师", industryId: "creative", synonyms: ["彩妆师", "美妆师", "新娘跟妆", "影视化妆"], keywords: ["化妆", "造型"], hot: false },
  { id: "dancer", displayName: "舞蹈演员", industryId: "creative", synonyms: ["舞者", "编舞", "舞蹈老师", "街舞", "芭蕾"], keywords: ["舞蹈", "表演"], hot: false },
  { id: "actor", displayName: "演员", industryId: "creative", synonyms: ["表演", "艺人", "配音演员", "话剧演员", "群演"], keywords: ["演员", "表演"], hot: false },
  { id: "host", displayName: "主持人", industryId: "creative", synonyms: ["司仪", "婚礼主持", "活动主持", "电台主持"], keywords: ["主持", "主播"], hot: false },
  { id: "musician", displayName: "音乐人", industryId: "creative", synonyms: ["歌手", "乐手", "音乐制作人", "编曲师", "词曲作者"], keywords: ["音乐", "唱歌"], hot: false },
  { id: "sound_engineer", displayName: "音效师", industryId: "creative", synonyms: ["录音师", "混音师", "音频工程师", "声音设计"], keywords: ["音效", "录音"], hot: false },
  
  // ========== 传媒内容 (media) ==========
  { id: "journalist", displayName: "记者编辑", industryId: "media", synonyms: ["记者", "编辑", "新闻", "采编", "媒体人"], keywords: ["新闻", "采访"], hot: false },
  { id: "content_creator", displayName: "自媒体博主", industryId: "media", synonyms: ["自媒体", "博主", "KOL", "网红", "UP主", "内容创作者", "视频博主", "图文博主", "公众号博主"], keywords: ["内容", "创作", "博主"], hot: true },
  { id: "copywriter", displayName: "文案策划", industryId: "media", synonyms: ["文案", "创意文案", "广告文案", "写手", "编剧"], keywords: ["文案", "写作"], hot: true },
  { id: "content_operator", displayName: "内容运营", industryId: "media", synonyms: ["编辑运营", "内容编辑", "社区运营", "账号运营"], keywords: ["内容", "运营"], hot: false },
  { id: "live_streamer", displayName: "直播主播", industryId: "media", synonyms: ["主播", "带货主播", "游戏主播", "直播", "电商主播", "娱乐主播"], keywords: ["直播", "带货"], hot: true },
  { id: "live_operator", displayName: "直播运营", industryId: "media", synonyms: ["直播策划", "直播间运营", "场控", "直播助理"], keywords: ["直播", "运营", "策划"], hot: true },
  { id: "podcast_host", displayName: "播客主理人", industryId: "media", synonyms: ["播客", "主播", "电台主持", "音频创作"], keywords: ["播客", "音频"], hot: false },
  
  // ========== 医疗健康 (medical) ==========
  { id: "doctor", displayName: "医生", industryId: "medical", synonyms: ["医师", "主治医师", "专科医生", "全科医生"], keywords: ["医生", "诊疗"], hot: true },
  { id: "nurse", displayName: "护士", industryId: "medical", synonyms: ["护理", "护理师", "ICU护士", "手术室护士"], keywords: ["护士", "护理"], hot: true },
  { id: "pharmacist", displayName: "药剂师", industryId: "medical", synonyms: ["药师", "临床药师", "药房"], keywords: ["药剂", "药房"], hot: false },
  { id: "therapist", displayName: "心理咨询师", industryId: "medical", synonyms: ["心理治疗师", "心理医生", "咨询师"], keywords: ["心理", "咨询"], hot: true },
  { id: "nutritionist", displayName: "营养师", industryId: "medical", synonyms: ["营养咨询", "健康管理师", "饮食顾问"], keywords: ["营养", "健康"], hot: false },
  { id: "dentist", displayName: "牙医", industryId: "medical", synonyms: ["口腔医生", "正畸医生", "种植医生"], keywords: ["牙科", "口腔"], hot: false },
  { id: "tcm_doctor", displayName: "中医师", industryId: "medical", synonyms: ["中医", "针灸师", "推拿师"], keywords: ["中医", "针灸"], hot: false },
  { id: "medical_device", displayName: "医疗器械", industryId: "medical", synonyms: ["器械销售", "医疗设备", "IVD"], keywords: ["器械", "设备"], hot: false },
  { id: "pharma", displayName: "医药代表", industryId: "medical", synonyms: ["药代", "医药销售", "临床推广"], keywords: ["医药", "销售"], hot: false },
  
  // ========== 教育培训 (education) ==========
  { id: "teacher", displayName: "教师", industryId: "education", synonyms: ["老师", "教员", "班主任", "学科老师", "中小学老师"], keywords: ["教学", "学校"], hot: true },
  { id: "trainer", displayName: "培训讲师", industryId: "education", synonyms: ["企业培训", "讲师", "内训师", "培训师", "职业讲师", "企业教练"], keywords: ["培训", "讲课", "授课"], hot: true },
  { id: "tutor", displayName: "课外辅导", industryId: "education", synonyms: ["家教", "补习老师", "一对一", "课后辅导"], keywords: ["辅导", "家教"], hot: false },
  { id: "education_consultant", displayName: "教育顾问", industryId: "education", synonyms: ["留学顾问", "升学顾问", "课程顾问", "留学中介"], keywords: ["咨询", "升学", "留学"], hot: true },
  { id: "professor", displayName: "大学教授", industryId: "education", synonyms: ["教授", "副教授", "讲师", "高校教师", "大学老师"], keywords: ["高校", "研究"], hot: false },
  { id: "researcher", displayName: "科研人员", industryId: "education", synonyms: ["研究员", "博士后", "科学家", "研究生导师"], keywords: ["科研", "研究"], hot: false },
  { id: "online_educator", displayName: "在线教育", industryId: "education", synonyms: ["网课老师", "知识付费", "线上讲师", "网红老师"], keywords: ["在线", "网课"], hot: true },
  
  // ========== 法律合规 (legal) ==========
  { id: "lawyer", displayName: "律师", industryId: "legal", synonyms: ["执业律师", "法律顾问", "诉讼律师", "非诉律师"], keywords: ["法律", "诉讼"], hot: true },
  { id: "paralegal", displayName: "律师助理", industryId: "legal", synonyms: ["法务助理", "律所助理"], keywords: ["法务", "助理"], hot: false },
  { id: "legal_counsel", displayName: "企业法务", industryId: "legal", synonyms: ["法务经理", "合规经理", "法律总监"], keywords: ["法务", "合规"], hot: false },
  { id: "compliance", displayName: "合规专员", industryId: "legal", synonyms: ["风控", "内控", "合规管理"], keywords: ["合规", "风控"], hot: false },
  { id: "ip_attorney", displayName: "知识产权", industryId: "legal", synonyms: ["专利代理", "商标代理", "IP律师"], keywords: ["专利", "商标"], hot: false },
  
  // ========== 地产建筑 (realestate) ==========
  { id: "architect", displayName: "建筑师", industryId: "realestate", synonyms: ["建筑设计", "方案设计师", "注册建筑师"], keywords: ["建筑", "设计"], hot: true },
  { id: "civil_engineer", displayName: "土木工程师", industryId: "realestate", synonyms: ["结构工程师", "施工工程师", "工程师"], keywords: ["工程", "施工"], hot: false },
  { id: "real_estate_agent", displayName: "房产经纪", industryId: "realestate", synonyms: ["地产中介", "置业顾问", "房产销售", "二手房"], keywords: ["房产", "中介"], hot: true },
  { id: "property_manager", displayName: "物业管理", industryId: "realestate", synonyms: ["物业经理", "社区经理", "物管"], keywords: ["物业", "社区"], hot: false },
  { id: "project_manager", displayName: "工程项目经理", industryId: "realestate", synonyms: ["项目经理", "工程经理", "施工管理"], keywords: ["项目", "工程"], hot: false },
  { id: "landscape_designer", displayName: "景观设计师", industryId: "realestate", synonyms: ["园林设计", "景观规划"], keywords: ["景观", "园林"], hot: false },
  
  // ========== 航空酒店旅游 (hospitality) ==========
  { id: "flight_attendant", displayName: "空乘人员", industryId: "hospitality", synonyms: ["空姐", "空少", "乘务员", "cabin crew"], keywords: ["飞机", "航空"], hot: true },
  { id: "pilot", displayName: "飞行员", industryId: "hospitality", synonyms: ["机长", "副驾驶", "民航飞行员"], keywords: ["飞行", "航空"], hot: false },
  { id: "ground_staff", displayName: "地勤人员", industryId: "hospitality", synonyms: ["地勤", "机场服务", "值机"], keywords: ["机场", "服务"], hot: false },
  { id: "hotel_manager", displayName: "酒店管理", industryId: "hospitality", synonyms: ["酒店经理", "前台经理", "客房经理"], keywords: ["酒店", "管理"], hot: true },
  { id: "tour_guide", displayName: "导游领队", industryId: "hospitality", synonyms: ["导游", "领队", "旅游顾问"], keywords: ["旅游", "导游"], hot: false },
  { id: "travel_planner", displayName: "旅行策划", industryId: "hospitality", synonyms: ["旅行定制", "行程规划", "旅游产品"], keywords: ["旅行", "策划"], hot: false },
  
  // ========== 生活方式 (lifestyle) ==========
  { id: "fitness_coach", displayName: "健身教练", industryId: "lifestyle", synonyms: ["私教", "健身私教", "普拉提教练", "CrossFit教练"], keywords: ["健身", "运动"], hot: true },
  { id: "yoga_instructor", displayName: "瑜伽老师", industryId: "lifestyle", synonyms: ["瑜伽教练", "瑜伽导师", "冥想导师"], keywords: ["瑜伽", "冥想"], hot: true },
  { id: "barista", displayName: "咖啡师", industryId: "lifestyle", synonyms: ["咖啡", "咖啡店员", "手冲咖啡", "咖啡调配师"], keywords: ["咖啡", "饮品"], hot: true },
  { id: "bartender", displayName: "调酒师", industryId: "lifestyle", synonyms: ["酒保", "鸡尾酒", "酒吧", "Mixologist"], keywords: ["调酒", "酒吧"], hot: true },
  { id: "tea_master", displayName: "茶艺师", industryId: "lifestyle", synonyms: ["茶艺", "茶道", "品茶师", "茶馆"], keywords: ["茶艺", "茶道"], hot: false },
  { id: "chef", displayName: "厨师", industryId: "lifestyle", synonyms: ["主厨", "西餐厨师", "中餐厨师", "日料师傅"], keywords: ["烹饪", "美食"], hot: true },
  { id: "pastry_chef", displayName: "甜点师", industryId: "lifestyle", synonyms: ["烘焙师", "蛋糕师", "西点师", "面包师"], keywords: ["甜点", "烘焙"], hot: true },
  { id: "sommelier", displayName: "侍酒师", industryId: "lifestyle", synonyms: ["品酒师", "葡萄酒顾问", "红酒鉴赏"], keywords: ["红酒", "葡萄酒"], hot: false },
  { id: "beautician", displayName: "美容师", industryId: "lifestyle", synonyms: ["美容顾问", "皮肤管理", "美容美体", "美容院"], keywords: ["美容", "护肤"], hot: true },
  { id: "hairstylist", displayName: "美发师", industryId: "lifestyle", synonyms: ["发型师", "理发师", "Tony老师", "造型师"], keywords: ["美发", "发型"], hot: true },
  { id: "nail_artist", displayName: "美甲师", industryId: "lifestyle", synonyms: ["美甲", "美睫师", "指甲彩绘"], keywords: ["美甲", "美睫"], hot: false },
  { id: "tattoo_artist", displayName: "纹身师", industryId: "lifestyle", synonyms: ["纹身", "刺青师", "Tattoo Artist"], keywords: ["纹身", "刺青"], hot: false },
  { id: "massage_therapist", displayName: "按摩师", industryId: "lifestyle", synonyms: ["推拿师", "SPA技师", "理疗师", "足疗师"], keywords: ["按摩", "推拿"], hot: false },
  { id: "pet_groomer", displayName: "宠物美容师", industryId: "lifestyle", synonyms: ["宠物店", "宠物护理", "宠物美容"], keywords: ["宠物", "美容"], hot: false },
  { id: "pet_trainer", displayName: "宠物训练师", industryId: "lifestyle", synonyms: ["宠物行为师", "训犬师", "宠物教练"], keywords: ["宠物", "训练"], hot: false },
  { id: "veterinarian", displayName: "宠物医生", industryId: "lifestyle", synonyms: ["兽医", "宠物诊所", "动物医生"], keywords: ["宠物", "兽医"], hot: false },
  { id: "florist", displayName: "花艺师", industryId: "lifestyle", synonyms: ["花店", "插花师", "花艺设计", "花店老板"], keywords: ["花艺", "花店"], hot: false },
  { id: "dj", displayName: "DJ", industryId: "lifestyle", synonyms: ["打碟", "夜店DJ", "电子音乐", "Club DJ"], keywords: ["DJ", "音乐"], hot: true },
  { id: "personal_shopper", displayName: "私人买手", industryId: "lifestyle", synonyms: ["代购", "买手", "时尚买手", "采购顾问"], keywords: ["买手", "代购"], hot: false },
  
  // ========== 其他行业 (other) ==========
  { id: "entrepreneur", displayName: "创业者", industryId: "other", synonyms: ["创业", "老板", "企业主", "自己做生意"], keywords: ["创业", "老板"], hot: true },
  { id: "freelancer", displayName: "自由职业者", industryId: "other", synonyms: ["自由职业", "独立工作者", "Freelance", "接私活"], keywords: ["自由", "独立"], hot: true },
  { id: "civil_servant", displayName: "公务员", industryId: "other", synonyms: ["政府", "事业单位", "国企员工", "体制内"], keywords: ["公务员", "政府"], hot: true },
  { id: "social_worker", displayName: "社工", industryId: "other", synonyms: ["社会工作者", "NGO", "公益", "志愿者"], keywords: ["社工", "公益"], hot: false },
  { id: "military", displayName: "军人", industryId: "other", synonyms: ["现役军人", "退伍军人", "部队"], keywords: ["军人", "部队"], hot: false },
  { id: "operations_manager", displayName: "运营经理", industryId: "other", synonyms: ["运营总监", "运营", "COO"], keywords: ["运营", "管理"], hot: true },
  { id: "supply_chain", displayName: "供应链管理", industryId: "other", synonyms: ["采购", "物流管理", "供应链经理"], keywords: ["供应链", "采购"], hot: false },
  { id: "manufacturing", displayName: "生产制造", industryId: "other", synonyms: ["工厂", "生产经理", "车间主任", "质量管理"], keywords: ["生产", "制造"], hot: false },
  { id: "translator", displayName: "翻译", industryId: "other", synonyms: ["口译", "笔译", "同声传译", "翻译员"], keywords: ["翻译", "语言"], hot: false },
  { id: "secretary", displayName: "秘书助理", industryId: "other", synonyms: ["行政助理", "总裁助理", "EA"], keywords: ["助理", "秘书"], hot: false },
  { id: "student_grad", displayName: "在校学生", industryId: "other", synonyms: ["大学生", "研究生", "博士生", "留学生"], keywords: ["学生", "在读"], hot: true },
  { id: "gap_year", displayName: "Gap中", industryId: "other", synonyms: ["待业", "求职中", "Career Break", "休息中"], keywords: ["Gap", "待业"], hot: false },
  { id: "homemaker", displayName: "全职家庭", industryId: "other", synonyms: ["全职妈妈", "全职爸爸", "家庭主妇", "家庭主夫"], keywords: ["家庭", "全职"], hot: false },
  { id: "retired", displayName: "退休人士", industryId: "other", synonyms: ["退休", "提前退休", "FIRE"], keywords: ["退休"], hot: false },
];

// ========== 拼音首字母映射 ==========
// 用于支持拼音首字母搜索（如 cxy → 程序员, hr → 人力资源）
export const PINYIN_MAP: Record<string, string[]> = {
  // 科技互联网
  "rjgcs": ["software_engineer"], // 软件工程师
  "cxy": ["software_engineer"], // 程序员
  "mn": ["software_engineer"], // 码农
  "qdgcs": ["frontend_engineer"], // 前端工程师
  "hdgcs": ["backend_engineer"], // 后端工程师
  "qzgcs": ["fullstack_engineer"], // 全栈工程师
  "yddgcs": ["mobile_engineer"], // 移动端工程师
  "qlgcs": ["blockchain_engineer"], // 区块链工程师
  "web3": ["blockchain_engineer", "web3_product"], // Web3
  "jmhb": ["crypto_trader"], // 加密货币
  "bq": ["crypto_trader"], // 币圈
  "cpjl": ["product_manager"], // 产品经理
  "pm": ["product_manager"], // PM
  "uisjs": ["ui_designer"], // UI设计师
  "uxsjs": ["ux_designer"], // UX设计师
  "csgcs": ["qa_engineer"], // 测试工程师
  "qa": ["qa_engineer"],
  "ywgcs": ["devops_engineer"], // 运维工程师
  "aqgcs": ["security_engineer"], // 安全工程师
  "wlaq": ["security_engineer"], // 网络安全
  "jsfzr": ["tech_lead"], // 技术负责人
  "cto": ["tech_lead"],
  
  // AI/大数据
  "sjfxs": ["data_analyst"], // 数据分析师
  "sjkxj": ["data_scientist"], // 数据科学家
  "sfgcs": ["data_scientist"], // 算法工程师
  "aigcs": ["ai_engineer"], // AI工程师
  "tscgcs": ["prompt_engineer"], // 提示词工程师
  "prompt": ["prompt_engineer"],
  "aigcsjs": ["aigc_designer"], // AIGC设计师
  "aigc": ["aigc_designer"],
  "midjourney": ["aigc_designer"],
  "dmxgcs": ["llm_engineer"], // 大模型工程师
  "llm": ["llm_engineer"],
  "gpt": ["llm_engineer"],
  "sjgcs": ["data_engineer"], // 数据工程师
  "aicpjl": ["ai_product_manager"], // AI产品经理
  "aiyjy": ["ai_researcher"], // AI研究员
  
  // 跨境电商
  "dsyy": ["ecom_operator"], // 电商运营
  "kjdsyy": ["ecom_operator"], // 跨境电商运营
  "zds": ["ecom_independent"], // 做电商
  "xp": ["ecom_product"], // 选品
  "dlz": ["ecom_independent"], // 独立站
  "ggtf": ["ecom_ads"], // 广告投放
  "dswl": ["ecom_logistics"], // 电商物流
  "dskf": ["ecom_customer"], // 电商客服
  "dsfzr": ["ecom_manager"], // 电商负责人
  
  // 金融投资
  "jrfxs": ["finance_analyst"], // 金融分析师
  "yhzy": ["banker"], // 银行职员
  "th": ["investment_banker"], // 投行
  "tzyy": ["pe_vc"], // 投资
  "pevc": ["pe_vc"],
  "vc": ["pe_vc"],
  "pe": ["pe_vc"],
  "zqcy": ["securities"], // 证券从业
  "bxcy": ["insurance"], // 保险从业
  "jjjl": ["fund_manager"], // 基金经理
  "kjs": ["accountant"], // 会计师
  "kj": ["accountant"], // 会计
  "cpa": ["accountant"],
  "cwfzr": ["cfo"], // 财务负责人
  "cfo": ["cfo"],
  
  // 咨询服务
  "glzxgw": ["management_consultant"], // 管理咨询顾问
  "zxs": ["management_consultant"], // 咨询师
  "mbb": ["management_consultant"],
  "itzxgw": ["it_consultant"], // IT咨询顾问
  "rlzxgw": ["hr_consultant"], // 人力咨询顾问
  "lt": ["hr_consultant"], // 猎头
  "hrjl": ["hr_manager"], // HR经理
  "hr": ["hr_manager"],
  "hrbp": ["hr_manager"],
  "rlzy": ["hr_manager"], // 人力资源
  "xzjl": ["admin_manager"], // 行政经理
  
  // 市场营销
  "scjl": ["marketing_manager"], // 市场经理
  "ppjl": ["brand_manager"], // 品牌经理
  "szyx": ["digital_marketing"], // 数字营销
  "smyy": ["social_media"], // 社媒运营
  "xmtyy": ["social_media"], // 新媒体运营
  "xhs": ["social_media"], // 小红书
  "dy": ["social_media"], // 抖音
  "ggjl": ["pr_manager"], // 公关经理
  "pr": ["pr_manager"],
  "xsjl": ["sales_manager"], // 销售经理
  "bd": ["sales_manager"],
  "hdch": ["event_planner"], // 活动策划
  
  // 创意设计
  "pmsjs": ["graphic_designer"], // 平面设计师
  "sjs": ["graphic_designer", "interior_designer", "fashion_designer", "3d_artist", "industrial_designer"], // 设计师
  "mg": ["graphic_designer"], // 美工
  "chs": ["illustrator"], // 插画师
  "yhs": ["illustrator"], // 原画师
  "3dsjs": ["3d_artist"], // 3D设计师
  "c4d": ["3d_artist"],
  "blender": ["3d_artist"],
  "yxsjs": ["game_designer"], // 游戏设计师
  "yxch": ["game_designer"], // 游戏策划
  "yxms": ["game_artist"], // 游戏美术
  "dxsjs": ["motion_designer"], // 动效设计师
  "vr": ["vr_ar_designer"], // VR
  "ar": ["vr_ar_designer"], // AR
  "xr": ["vr_ar_designer"], // XR
  "yyz": ["vr_ar_designer"], // 元宇宙
  "sys": ["photographer"], // 摄影师
  "sxs": ["videographer"], // 摄像师
  "spjj": ["video_editor"], // 视频剪辑
  "jjs": ["video_editor"], // 剪辑师
  "snsjs": ["interior_designer"], // 室内设计师
  "gysjs": ["industrial_designer"], // 工业设计师
  "zbsjs": ["jewelry_designer"], // 珠宝设计师
  "fzsjs": ["fashion_designer"], // 服装设计师
  "mt": ["model"], // 模特
  "hzs": ["makeup_artist"], // 化妆师
  "wdyy": ["dancer"], // 舞蹈演员
  "yy": ["actor", "musician"], // 演员/音乐人
  "zcr": ["host"], // 主持人
  "syi": ["host"], // 司仪
  "yyr": ["musician"], // 音乐人
  "yxs": ["sound_engineer"], // 音效师
  "lys": ["sound_engineer"], // 录音师
  
  // 传媒内容
  "jzbj": ["journalist"], // 记者编辑
  "jz": ["journalist"], // 记者
  "zmtbz": ["content_creator"], // 自媒体博主
  "bz": ["content_creator"], // 博主
  "kol": ["content_creator"],
  "upz": ["content_creator"], // UP主
  "wach": ["copywriter"], // 文案策划
  "wa": ["copywriter"], // 文案
  "nryy": ["content_operator"], // 内容运营
  "zbzb": ["live_streamer"], // 直播主播
  "zb": ["live_streamer", "live_operator"], // 直播
  "zbyy": ["live_operator"], // 直播运营
  "bkzlr": ["podcast_host"], // 播客主理人
  "bk": ["podcast_host"], // 播客
  
  // 医疗健康
  "ys": ["doctor"], // 医生
  "hs": ["nurse"], // 护士
  "yjs": ["pharmacist"], // 药剂师
  "xlzxs": ["therapist"], // 心理咨询师
  "yys": ["nutritionist"], // 营养师
  "yy_tooth": ["dentist"], // 牙医 (避免和演员冲突)
  "kqys": ["dentist"], // 口腔医生
  "zys": ["tcm_doctor"], // 中医师
  "zy": ["tcm_doctor"], // 中医
  "ylqx": ["medical_device"], // 医疗器械
  "yydb": ["pharma"], // 医药代表
  "yd": ["pharma"], // 药代
  
  // 教育培训
  "js": ["teacher"], // 教师
  "ls": ["teacher", "lawyer"], // 老师/律师
  "pxjs": ["trainer"], // 培训讲师
  "jy": ["teacher"], // 教员
  "kwfd": ["tutor"], // 课外辅导
  "jj": ["tutor"], // 家教
  "jygw": ["education_consultant"], // 教育顾问
  "lxgw": ["education_consultant"], // 留学顾问
  "dxjs": ["professor"], // 大学教授
  "kyry": ["researcher"], // 科研人员
  "yjy": ["researcher"], // 研究员
  "zxjy": ["online_educator"], // 在线教育
  "wkls": ["online_educator"], // 网课老师
  
  // 法律合规
  "lvs": ["lawyer"], // 律师
  "lszl": ["paralegal"], // 律师助理
  "qyfw": ["legal_counsel"], // 企业法务
  "hgzy": ["compliance"], // 合规专员
  "fk": ["compliance"], // 风控
  "zscq": ["ip_attorney"], // 知识产权
  "zldy": ["ip_attorney"], // 专利代理
  
  // 地产建筑
  "fdc": ["real_estate_agent"], // 房地产
  "zygs": ["real_estate_agent"], // 置业顾问
  "jzs": ["architect"], // 建筑师
  "gcs": ["civil_engineer"], // 工程师
  "xmjl": ["project_manager"], // 项目经理
  "wyfzr": ["property_manager"], // 物业负责人
  
  // 航空酒店旅游
  "kc": ["flight_attendant"], // 空乘
  "kj_air": ["flight_attendant"], // 空姐
  "fxy": ["pilot"], // 飞行员
  "jdgl": ["hotel_manager"], // 酒店管理
  "dyjl": ["tour_guide"], // 导游经理
  "dy_tour": ["tour_guide"], // 导游
  "lxch": ["travel_planner"], // 旅行策划
  "lxdz": ["travel_planner"], // 旅行定制
  
  // 生活方式
  "jslj": ["fitness_coach"], // 健身教练
  "sj": ["fitness_coach"], // 私教
  "ygls": ["yoga_instructor"], // 瑜伽老师
  "ygjl": ["yoga_instructor"], // 瑜伽教练
  "ygs": ["nutritionist"], // 营养师
  "mrs": ["beautician"], // 美容师
  "pfgl": ["beautician"], // 皮肤管理
  "mfs": ["hairstylist"], // 美发师
  "fxs": ["hairstylist"], // 发型师
  "tony": ["hairstylist"], // Tony老师
  "mjs": ["nail_artist"], // 美甲师
  "wss": ["tattoo_artist"], // 纹身师
  "cqs": ["tattoo_artist"], // 刺青师
  "ams": ["massage_therapist"], // 按摩师
  "tns": ["massage_therapist"], // 推拿师
  "spa": ["massage_therapist"], // SPA
  "cs": ["chef"], // 厨师
  "tds": ["bartender"], // 调酒师
  "kfs": ["barista"], // 咖啡师
  "tdss": ["pastry_chef"], // 甜点师
  "hps": ["pastry_chef"], // 烘焙师
  "cys": ["tea_master"], // 茶艺师
  "hhs": ["florist"], // 花艺师
  "cwmrs": ["pet_groomer"], // 宠物美容师
  "cwxls": ["pet_trainer"], // 宠物训练师
  "cwys": ["veterinarian"], // 宠物医生
  "sy": ["veterinarian"], // 兽医
  "dj": ["dj"], // DJ
  "srms": ["personal_shopper"], // 私人买手
  "dg": ["personal_shopper"], // 代购
  
  // 其他
  "gwy": ["civil_servant"], // 公务员
  "sydw": ["civil_servant"], // 事业单位
  "tzn": ["civil_servant"], // 体制内
  "yg": ["entrepreneur"], // 创业
  "cy": ["entrepreneur"], // 创业
  "gygl": ["supply_chain"], // 供应链管理
  "cg": ["supply_chain"], // 采购
  "sczz": ["manufacturing"], // 生产制造
  "fy": ["translator"], // 翻译
  "mszl": ["secretary"], // 秘书助理
  "ea": ["secretary"],
  "zxxs": ["student_grad"], // 在校学生
  "xs": ["student_grad"], // 学生
  "dxs": ["student_grad"], // 大学生
  "yjs_student": ["student_grad"], // 研究生
  "gap": ["gap_year"],
  "qzjt": ["homemaker"], // 全职家庭
  "qzmm": ["homemaker"], // 全职妈妈
  "tx": ["retired"], // 退休
  "fire": ["retired"],
};

// ========== 辅助函数 ==========

// 通过ID获取职业
export function getOccupationById(id: string): Occupation | undefined {
  return OCCUPATIONS.find(o => o.id === id);
}

// 通过ID获取行业
export function getIndustryById(id: string): Industry | undefined {
  return INDUSTRIES.find(i => i.id === id);
}

// 获取行业下的所有职业
export function getOccupationsByIndustry(industryId: string): Occupation[] {
  return OCCUPATIONS.filter(o => o.industryId === industryId);
}

// 获取热门职业（用于快捷选择）
export function getHotOccupations(limit: number = 20): Occupation[] {
  return OCCUPATIONS.filter(o => o.hot).slice(0, limit);
}

// 检查是否为纯英文/拼音字符（用于判断是否为拼音输入）
function isPinyinInput(query: string): boolean {
  return /^[a-zA-Z_]+$/.test(query);
}

// 拼音首字母匹配
function getPinyinMatches(query: string): Set<string> {
  const q = query.toLowerCase();
  const matches = new Set<string>();
  
  // 精确匹配
  if (PINYIN_MAP[q]) {
    PINYIN_MAP[q].forEach(id => matches.add(id));
  }
  
  // 前缀匹配（支持部分输入）
  Object.entries(PINYIN_MAP).forEach(([pinyin, ids]) => {
    if (pinyin.startsWith(q) || q.startsWith(pinyin)) {
      ids.forEach(id => matches.add(id));
    }
  });
  
  return matches;
}

// 智能搜索职业（支持同义词、关键词、拼音首字母匹配）
export function searchOccupations(query: string): Occupation[] {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  const q = query.toLowerCase().trim();
  
  // 获取拼音匹配结果
  const pinyinMatches = isPinyinInput(q) ? getPinyinMatches(q) : new Set<string>();
  
  // 评分函数：匹配度越高分数越高
  const scoreOccupation = (occ: Occupation): number => {
    let score = 0;
    const name = occ.displayName.toLowerCase();
    
    // 精确匹配职业名
    if (name === q) return 100;
    
    // 拼音首字母精确匹配（高优先级）
    if (pinyinMatches.has(occ.id)) score += 85;
    
    // 职业名包含查询词
    if (name.includes(q)) score += 50;
    
    // 同义词精确匹配
    if (occ.synonyms.some(s => s.toLowerCase() === q)) score += 80;
    
    // 同义词包含查询词
    if (occ.synonyms.some(s => s.toLowerCase().includes(q))) score += 40;
    
    // 关键词匹配
    if (occ.keywords.some(k => k.toLowerCase().includes(q))) score += 30;
    
    // 查询词包含在职业名中（反向匹配）
    if (q.includes(name)) score += 20;
    
    return score;
  };
  
  // 过滤并排序
  return OCCUPATIONS
    .map(occ => ({ occ, score: scoreOccupation(occ) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.occ);
}

// 根据社交目的获取引导文案
export function getOccupationGuidance(intent: string): { title: string; subtitle: string; matchPreview: string } {
  switch (intent) {
    case "networking":
      return {
        title: "你是做什么的？",
        subtitle: "小悦会帮你匹配同行或互补技能的职场搭子",
        matchPreview: "小悦会优先帮你匹配：同行伙伴、互补技能搭子"
      };
    case "friends":
      return {
        title: "你是做什么的？",
        subtitle: "小悦会根据兴趣和性格匹配，职业只是参考",
        matchPreview: "小悦会根据你们的共同兴趣来匹配，职业只是加分项"
      };
    case "romance":
      return {
        title: "你是做什么的？",
        subtitle: "小悦会综合考虑职业背景和生活方式",
        matchPreview: "小悦会综合考虑，帮你找到聊得来的人"
      };
    case "fun":
      return {
        title: "你是做什么的？",
        subtitle: "小悦会匹配聊得来的人，不聊工作也很开心",
        matchPreview: "放心，小悦不会只给你匹配同事类型的人"
      };
    case "discussion":
      return {
        title: "你是做什么的？",
        subtitle: "小悦会匹配有深度见解的人，一起碰撞想法",
        matchPreview: "小悦会帮你找到有独特视角的交流对象"
      };
    default:
      return {
        title: "你是做什么的？",
        subtitle: "小悦会根据你的职业，帮你找到合适的社交搭子",
        matchPreview: "小悦会根据你的背景智能匹配"
      };
  }
}

// 职业ID到显示名的映射
export const OCCUPATION_ID_TO_NAME: Record<string, string> = Object.fromEntries(
  OCCUPATIONS.map(o => [o.id, o.displayName])
);

// 行业ID到标签的映射
export const INDUSTRY_ID_TO_LABEL: Record<string, string> = Object.fromEntries(
  INDUSTRIES.map(i => [i.id, i.label])
);

// 统计信息
export const OCCUPATION_STATS = {
  totalIndustries: INDUSTRIES.length,
  totalOccupations: OCCUPATIONS.length,
  hotOccupations: OCCUPATIONS.filter(o => o.hot).length,
};

// 工作身份标签映射
export const WORK_MODE_TO_LABEL: Record<WorkMode, string> = {
  founder: "创始人",
  self_employed: "自由职业",
  employed: "在职",
  student: "学生",
};

// 获取用户职业显示标签（组合职业+身份）
export function getOccupationDisplayLabel(
  occupationId: string | null | undefined,
  workMode: string | null | undefined,
  options?: { showWorkMode?: boolean; fallback?: string }
): string {
  const { showWorkMode = false, fallback = "" } = options || {};
  
  if (!occupationId) return fallback;
  
  const occupation = getOccupationById(occupationId);
  if (!occupation) return fallback;
  
  const occupationName = occupation.displayName;
  
  if (showWorkMode && workMode && workMode in WORK_MODE_TO_LABEL) {
    const workModeLabel = WORK_MODE_TO_LABEL[workMode as WorkMode];
    // 学生身份特殊处理：直接显示"学生"，不加职业
    if (workMode === "student") {
      return "学生";
    }
    // 创始人/自由职业前缀
    if (workMode === "founder" || workMode === "self_employed") {
      return `${workModeLabel} · ${occupationName}`;
    }
  }
  
  return occupationName;
}

// 获取用户行业显示标签
export function getIndustryDisplayLabel(
  occupationId: string | null | undefined,
  fallback: string = ""
): string {
  if (!occupationId) return fallback;
  
  const occupation = getOccupationById(occupationId);
  if (!occupation) return fallback;
  
  const industry = getIndustryById(occupation.industryId);
  return industry?.label || fallback;
}
