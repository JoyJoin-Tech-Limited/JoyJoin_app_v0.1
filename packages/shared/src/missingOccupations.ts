/**
 * Missing Occupations from 100 Chinese Occupations Test
 * These will be added to occupations.ts to reach 95%+ accuracy
 */

import type { Occupation } from './occupations';

export const MISSING_OCCUPATIONS: Occupation[] = [
  // ========== Tech (Additional) ==========
  { 
    id: "cloud_engineer", 
    displayName: "云计算工程师", 
    industryId: "tech", 
    synonyms: ["云架构师", "云开发", "AWS工程师", "阿里云工程师", "腾讯云工程师", "云平台工程师", "Cloud Engineer"], 
    keywords: ["云计算", "云架构", "AWS", "云平台"], 
    hot: true,
    seedMappings: { category: "tech", segment: "software_dev" }
  },
  { 
    id: "iot_engineer", 
    displayName: "物联网工程师", 
    industryId: "tech", 
    synonyms: ["IoT工程师", "物联网开发", "智能硬件工程师", "IoT Developer"], 
    keywords: ["物联网", "IoT", "智能硬件"], 
    hot: true,
    seedMappings: { category: "tech", segment: "software_dev" }
  },
  { 
    id: "video_engineer", 
    displayName: "音视频工程师", 
    industryId: "tech", 
    synonyms: ["流媒体工程师", "音视频开发", "RTC工程师", "视频编解码工程师"], 
    keywords: ["音视频", "流媒体", "视频编解码"], 
    hot: false,
    seedMappings: { category: "tech", segment: "software_dev" }
  },
  { 
    id: "bigdata_engineer", 
    displayName: "大数据工程师", 
    industryId: "ai", 
    synonyms: ["大数据开发", "数据平台工程师", "Hadoop工程师", "Spark工程师"], 
    keywords: ["大数据", "Hadoop", "Spark"], 
    hot: true,
    seedMappings: { category: "tech", segment: "data_analytics" }
  },
  
  // ========== Legal & Government ==========
  { 
    id: "lawyer", 
    displayName: "律师", 
    industryId: "legal", 
    synonyms: ["法律顾问", "诉讼律师", "律政人", "法务律师", "Lawyer", "Attorney"], 
    keywords: ["法律", "诉讼", "律师"], 
    hot: true,
    seedMappings: { category: "professional_services", segment: "legal" }
  },
  { 
    id: "judge", 
    displayName: "法官", 
    industryId: "legal", 
    synonyms: ["审判员", "法院法官", "Judge"], 
    keywords: ["法官", "审判", "法院"], 
    hot: false,
    seedMappings: { category: "government" }
  },
  { 
    id: "prosecutor", 
    displayName: "检察官", 
    industryId: "legal", 
    synonyms: ["检察员", "公诉人", "Prosecutor"], 
    keywords: ["检察", "公诉", "检察官"], 
    hot: false,
    seedMappings: { category: "government" }
  },
  { 
    id: "notary", 
    displayName: "公证员", 
    industryId: "legal", 
    synonyms: ["公证处", "Notary"], 
    keywords: ["公证", "公证员"], 
    hot: false,
    seedMappings: { category: "professional_services", segment: "legal" }
  },
  { 
    id: "patent_agent", 
    displayName: "专利代理人", 
    industryId: "legal", 
    synonyms: ["专利代理", "知识产权代理", "Patent Agent"], 
    keywords: ["专利", "知识产权"], 
    hot: false,
    seedMappings: { category: "professional_services", segment: "legal" }
  },
  
  // ========== Media & Creative ==========
  { 
    id: "journalist", 
    displayName: "记者", 
    industryId: "media", 
    synonyms: ["新闻记者", "媒体记者", "Reporter", "Journalist"], 
    keywords: ["新闻", "采访", "记者"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "journalism" }
  },
  { 
    id: "editor", 
    displayName: "编辑", 
    industryId: "media", 
    synonyms: ["文字编辑", "内容编辑", "Editor"], 
    keywords: ["编辑", "内容", "文字"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "journalism" }
  },
  { 
    id: "social_media_ops", 
    displayName: "新媒体运营", 
    industryId: "marketing", 
    synonyms: ["新媒体", "社交媒体运营", "公众号运营", "Social Media"], 
    keywords: ["新媒体", "运营", "社交媒体"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "marketing" }
  },
  { 
    id: "video_editor", 
    displayName: "视频剪辑师", 
    industryId: "creative", 
    synonyms: ["剪辑师", "后期制作", "Video Editor", "Premiere剪辑"], 
    keywords: ["剪辑", "视频", "后期"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "video_production" }
  },
  { 
    id: "photographer", 
    displayName: "摄影师", 
    industryId: "creative", 
    synonyms: ["商业摄影", "人像摄影", "Photographer"], 
    keywords: ["摄影", "拍照"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "photography" }
  },
  { 
    id: "graphic_designer", 
    displayName: "平面设计师", 
    industryId: "creative", 
    synonyms: ["平面设计", "Graphic Designer", "视觉设计"], 
    keywords: ["平面设计", "设计"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "design" }
  },
  { 
    id: "animator", 
    displayName: "动漫原画师", 
    industryId: "creative", 
    synonyms: ["原画", "动画师", "Animator", "动漫设计"], 
    keywords: ["动漫", "原画", "动画"], 
    hot: false,
    seedMappings: { category: "media_creative", segment: "design" }
  },
  { 
    id: "writer", 
    displayName: "作家", 
    industryId: "media", 
    synonyms: ["编剧", "文字工作者", "Writer", "作者"], 
    keywords: ["写作", "作家", "文字"], 
    hot: false,
    seedMappings: { category: "media_creative", segment: "content" }
  },
  { 
    id: "curator", 
    displayName: "策展人", 
    industryId: "creative", 
    synonyms: ["展览策划", "Curator", "艺术策展"], 
    keywords: ["策展", "展览"], 
    hot: false,
    seedMappings: { category: "media_creative" }
  },
  
  // ========== Manufacturing & Engineering ==========
  { 
    id: "mechanical_engineer", 
    displayName: "机械工程师", 
    industryId: "hardware", 
    synonyms: ["机械设计", "Mechanical Engineer", "机械工程"], 
    keywords: ["机械", "设计", "工程"], 
    hot: false,
    seedMappings: { category: "manufacturing", segment: "machinery" }
  },
  { 
    id: "electrical_engineer", 
    displayName: "电气工程师", 
    industryId: "hardware", 
    synonyms: ["电气设计", "Electrical Engineer", "电力工程师"], 
    keywords: ["电气", "电力"], 
    hot: false,
    seedMappings: { category: "manufacturing", segment: "electronics" }
  },
  { 
    id: "civil_engineer", 
    displayName: "土木工程师", 
    industryId: "realestate", 
    synonyms: ["土木工程", "Civil Engineer", "结构工程师"], 
    keywords: ["土木", "工程", "结构"], 
    hot: false,
    seedMappings: { category: "real_estate", segment: "construction" }
  },
  { 
    id: "process_engineer", 
    displayName: "工艺工程师", 
    industryId: "hardware", 
    synonyms: ["生产工艺", "Process Engineer", "制造工艺"], 
    keywords: ["工艺", "生产"], 
    hot: false,
    seedMappings: { category: "manufacturing" }
  },
  { 
    id: "industrial_designer", 
    displayName: "工业设计师", 
    industryId: "creative", 
    synonyms: ["产品设计", "Industrial Designer"], 
    keywords: ["工业设计", "产品设计"], 
    hot: false,
    seedMappings: { category: "manufacturing" }
  },
  { 
    id: "architect", 
    displayName: "建筑设计师", 
    industryId: "realestate", 
    synonyms: ["建筑师", "Architect", "设计院"], 
    keywords: ["建筑", "设计"], 
    hot: true,
    seedMappings: { category: "real_estate", segment: "architecture" }
  },
  { 
    id: "urban_planner", 
    displayName: "城市规划师", 
    industryId: "realestate", 
    synonyms: ["规划师", "Urban Planner", "城市规划"], 
    keywords: ["规划", "城市"], 
    hot: false,
    seedMappings: { category: "real_estate", segment: "architecture" }
  },
  { 
    id: "environmental_engineer", 
    displayName: "环境工程师", 
    industryId: "other", 
    synonyms: ["环保工程师", "Environmental Engineer"], 
    keywords: ["环境", "环保"], 
    hot: false,
    seedMappings: { category: "energy_environment", segment: "environmental" }
  },
  
  // ========== Healthcare (Additional) ==========
  { 
    id: "rehab_therapist", 
    displayName: "康复治疗师", 
    industryId: "medical", 
    synonyms: ["康复师", "Physical Therapist", "理疗师"], 
    keywords: ["康复", "治疗", "理疗"], 
    hot: false,
    seedMappings: { category: "healthcare", segment: "medical_services" }
  },
  { 
    id: "nutritionist", 
    displayName: "营养师", 
    industryId: "medical", 
    synonyms: ["营养顾问", "Nutritionist", "膳食顾问"], 
    keywords: ["营养", "膳食"], 
    hot: false,
    seedMappings: { category: "healthcare" }
  },
  { 
    id: "medical_device_engineer", 
    displayName: "医疗器械工程师", 
    industryId: "medical", 
    synonyms: ["医疗设备工程师", "Medical Device Engineer"], 
    keywords: ["医疗器械", "医疗设备"], 
    hot: false,
    seedMappings: { category: "healthcare" }
  },
  { 
    id: "genetic_counselor", 
    displayName: "基因检测顾问", 
    industryId: "medical", 
    synonyms: ["基因顾问", "Genetic Counselor"], 
    keywords: ["基因", "检测"], 
    hot: false,
    seedMappings: { category: "healthcare" }
  },
  
  // ========== Education (Additional) ==========
  { 
    id: "university_lecturer", 
    displayName: "大学讲师", 
    industryId: "education", 
    synonyms: ["大学教师", "高校教师", "University Lecturer", "Lecturer"], 
    keywords: ["大学", "教师", "讲师"], 
    hot: false,
    seedMappings: { category: "education" }
  },
  { 
    id: "vocational_trainer", 
    displayName: "职业培训师", 
    industryId: "education", 
    synonyms: ["培训讲师", "Vocational Trainer", "职业教育"], 
    keywords: ["培训", "职业教育"], 
    hot: false,
    seedMappings: { category: "education", segment: "vocational" }
  },
  { 
    id: "edu_product_dev", 
    displayName: "教育产品研发", 
    industryId: "education", 
    synonyms: ["教育产品经理", "课程研发", "Education Product"], 
    keywords: ["教育产品", "课程"], 
    hot: false,
    seedMappings: { category: "education" }
  },
  { 
    id: "researcher", 
    displayName: "科学研究员", 
    industryId: "education", 
    synonyms: ["研究员", "科研人员", "Researcher", "Scientist"], 
    keywords: ["研究", "科研"], 
    hot: false,
    seedMappings: { category: "education" }
  },
  
  // ========== Finance (Additional) ==========
  { 
    id: "securities_trader", 
    displayName: "证券交易员", 
    industryId: "finance", 
    synonyms: ["交易员", "Trader", "股票交易员"], 
    keywords: ["交易", "证券"], 
    hot: false,
    seedMappings: { category: "finance", segment: "securities" }
  },
  { 
    id: "auditor", 
    displayName: "审计师", 
    industryId: "finance", 
    synonyms: ["审计", "Auditor", "内审"], 
    keywords: ["审计"], 
    hot: false,
    seedMappings: { category: "professional_services", segment: "accounting" }
  },
  { 
    id: "cpa", 
    displayName: "注册会计师", 
    industryId: "finance", 
    synonyms: ["注会", "CPA", "Certified Public Accountant"], 
    keywords: ["会计师", "CPA"], 
    hot: false,
    seedMappings: { category: "professional_services", segment: "accounting" }
  },
  { 
    id: "financial_planner", 
    displayName: "财务规划师", 
    industryId: "finance", 
    synonyms: ["理财规划师", "Financial Planner", "CFP"], 
    keywords: ["理财", "规划"], 
    hot: false,
    seedMappings: { category: "finance" }
  },
  
  // ========== Services & Management ==========
  { 
    id: "hr_manager", 
    displayName: "人力资源管理", 
    industryId: "consulting", 
    synonyms: ["HR", "人力资源", "人事", "HRBP", "Human Resources"], 
    keywords: ["人力", "HR", "人事"], 
    hot: true,
    seedMappings: { category: "professional_services", segment: "hr" }
  },
  { 
    id: "admin_specialist", 
    displayName: "行政专员", 
    industryId: "consulting", 
    synonyms: ["行政", "Admin", "行政管理"], 
    keywords: ["行政", "办公"], 
    hot: false,
    seedMappings: { category: "professional_services", segment: "admin" }
  },
  { 
    id: "project_manager", 
    displayName: "项目经理", 
    industryId: "consulting", 
    synonyms: ["项目管理", "Project Manager", "PM", "PMP"], 
    keywords: ["项目", "管理"], 
    hot: true,
    seedMappings: { category: "professional_services", segment: "consulting" }
  },
  { 
    id: "logistics_manager", 
    displayName: "物流师", 
    industryId: "other", 
    synonyms: ["物流管理", "Logistics Manager", "供应链"], 
    keywords: ["物流", "配送"], 
    hot: false,
    seedMappings: { category: "logistics", segment: "logistics_mgmt" }
  },
  { 
    id: "supply_chain", 
    displayName: "供应链管理", 
    industryId: "other", 
    synonyms: ["供应链", "Supply Chain", "SCM"], 
    keywords: ["供应链"], 
    hot: false,
    seedMappings: { category: "logistics", segment: "supply_chain" }
  },
  { 
    id: "foreign_trade", 
    displayName: "外贸业务员", 
    industryId: "ecommerce", 
    synonyms: ["外贸", "外贸专员", "Foreign Trade"], 
    keywords: ["外贸", "进出口"], 
    hot: false,
    seedMappings: { category: "consumer_retail", segment: "sales" }
  },
  { 
    id: "travel_planner", 
    displayName: "旅游策划师", 
    industryId: "hospitality", 
    synonyms: ["旅游策划", "Travel Planner", "定制旅游"], 
    keywords: ["旅游", "策划"], 
    hot: false,
    seedMappings: { category: "life_services", segment: "travel" }
  },
  { 
    id: "housekeeping_service", 
    displayName: "家政服务师", 
    industryId: "lifestyle", 
    synonyms: ["家政", "Housekeeping", "家政人员"], 
    keywords: ["家政", "服务"], 
    hot: false,
    seedMappings: { category: "life_services", segment: "household" }
  },
  { 
    id: "community_worker", 
    displayName: "社区工作者", 
    industryId: "other", 
    synonyms: ["社区服务", "Community Worker", "社工"], 
    keywords: ["社区", "服务"], 
    hot: false,
    seedMappings: { category: "government" }
  },
  
  // ========== Emerging Occupations ==========
  { 
    id: "drone_operator", 
    displayName: "无人机飞手", 
    industryId: "tech", 
    synonyms: ["无人机操作员", "Drone Operator", "航拍飞手"], 
    keywords: ["无人机", "航拍"], 
    hot: false,
    seedMappings: { category: "tech" }
  },
  { 
    id: "digital_manager", 
    displayName: "数字化管理师", 
    industryId: "tech", 
    synonyms: ["数字化转型", "Digital Manager"], 
    keywords: ["数字化", "管理"], 
    hot: false,
    seedMappings: { category: "tech", segment: "product" }
  },
  { 
    id: "pet_nutritionist", 
    displayName: "宠物营养师", 
    industryId: "lifestyle", 
    synonyms: ["宠物营养", "Pet Nutritionist"], 
    keywords: ["宠物", "营养"], 
    hot: false,
    seedMappings: { category: "life_services", segment: "pets" }
  },
  { 
    id: "organizing_consultant", 
    displayName: "收纳整理师", 
    industryId: "lifestyle", 
    synonyms: ["整理师", "收纳师", "Organizing Consultant"], 
    keywords: ["收纳", "整理"], 
    hot: false,
    seedMappings: { category: "life_services", segment: "household" }
  },
  { 
    id: "script_writer_mystery", 
    displayName: "剧本杀编剧", 
    industryId: "creative", 
    synonyms: ["剧本杀作者", "Mystery Script Writer"], 
    keywords: ["剧本杀", "剧本"], 
    hot: false,
    seedMappings: { category: "media_creative", segment: "content" }
  },
  { 
    id: "carbon_manager", 
    displayName: "碳排放管理员", 
    industryId: "other", 
    synonyms: ["碳排放管理", "Carbon Manager", "ESG"], 
    keywords: ["碳排放", "环保"], 
    hot: false,
    seedMappings: { category: "energy_environment", segment: "environmental" }
  },
  { 
    id: "elderly_assessor", 
    displayName: "老年人能力评估师", 
    industryId: "medical", 
    synonyms: ["养老评估", "Elderly Assessor"], 
    keywords: ["养老", "评估"], 
    hot: false,
    seedMappings: { category: "healthcare" }
  },
  { 
    id: "online_learning_service", 
    displayName: "在线学习服务师", 
    industryId: "education", 
    synonyms: ["在线教育", "Online Learning Service"], 
    keywords: ["在线学习", "教育"], 
    hot: false,
    seedMappings: { category: "education", segment: "online" }
  },
  { 
    id: "homestay_host", 
    displayName: "民宿房东", 
    industryId: "hospitality", 
    synonyms: ["民宿", "Homestay Host", "Airbnb房东"], 
    keywords: ["民宿", "住宿"], 
    hot: false,
    seedMappings: { category: "life_services", segment: "hospitality" }
  },
  
  // ========== Sales & Marketing (Additional) ==========
  { 
    id: "sales_manager", 
    displayName: "销售经理", 
    industryId: "other", 
    synonyms: ["销售", "Sales Manager", "业务经理"], 
    keywords: ["销售", "业务"], 
    hot: true,
    seedMappings: { category: "consumer_retail", segment: "retail", niche: "sales" }
  },
  { 
    id: "ecommerce_ops", 
    displayName: "电商运营", 
    industryId: "ecommerce", 
    synonyms: ["电商", "E-commerce Operations"], 
    keywords: ["电商", "运营"], 
    hot: true,
    seedMappings: { category: "consumer_retail", segment: "ecommerce" }
  },
  { 
    id: "live_streaming_host", 
    displayName: "直播带货主播", 
    industryId: "media", 
    synonyms: ["主播", "直播", "Live Streaming Host", "带货"], 
    keywords: ["直播", "带货", "主播"], 
    hot: true,
    seedMappings: { category: "media_creative", segment: "live_streaming" }
  },
  { 
    id: "bd_specialist", 
    displayName: "商务拓展", 
    industryId: "consulting", 
    synonyms: ["BD", "Business Development", "商务"], 
    keywords: ["商务", "拓展", "BD"], 
    hot: false,
    seedMappings: { category: "professional_services", segment: "consulting" }
  },
  { 
    id: "customer_success", 
    displayName: "客户成功经理", 
    industryId: "tech", 
    synonyms: ["客户成功", "Customer Success", "CSM"], 
    keywords: ["客户", "成功"], 
    hot: false,
    seedMappings: { category: "tech", segment: "product" }
  },
  { 
    id: "brand_planning", 
    displayName: "品牌策划", 
    industryId: "marketing", 
    synonyms: ["品牌", "Brand Planning"], 
    keywords: ["品牌", "策划"], 
    hot: false,
    seedMappings: { category: "media_creative", segment: "marketing" }
  },
  { 
    id: "pr_specialist", 
    displayName: "公关专员", 
    industryId: "marketing", 
    synonyms: ["公关", "PR", "Public Relations"], 
    keywords: ["公关", "PR"], 
    hot: false,
    seedMappings: { category: "media_creative", segment: "pr" }
  },
];
