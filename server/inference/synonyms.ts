/**
 * 同义词和语义映射表
 * 用于快速匹配层，处理同一概念的不同表达方式
 */

import type { SynonymGroup, InferenceRule } from './types';

// ============ 人生阶段相关同义词 ============

export const LIFE_STAGE_SYNONYMS: SynonymGroup[] = [
  {
    canonical: '创业中',
    variants: [
      '创业', '在创业', '自己创业', '开公司', '自己开公司', '当老板',
      '做老板', '自己做', '自己干', '单干', '开店', '自己开店',
      '做生意', '经商', '创业者', '企业主', '老板', '创始人',
      'CEO', 'founder', '合伙人', '联合创始人', '自主创业'
    ],
    field: 'lifeStage',
    value: '创业中'
  },
  {
    canonical: '学生党',
    variants: [
      '学生', '在读', '还在读书', '上学', '读书', '念书',
      '在校', '在校生', '大学生', '研究生', '博士生', '硕士',
      '本科', '大一', '大二', '大三', '大四', '研一', '研二', '研三',
      '高中生', '中学生', '留学生', '交换生', '在读研究生'
    ],
    field: 'lifeStage',
    value: '学生党'
  },
  {
    canonical: '职场新人',
    variants: [
      '刚毕业', '应届', '应届生', '刚工作', '工作一年', '工作两年',
      '职场新人', '新人', '刚入职', '试用期', '实习', '实习生',
      '工作不久', '刚开始工作', '毕业生', '初入职场'
    ],
    field: 'lifeStage',
    value: '职场新人'
  },
  {
    canonical: '职场老手',
    variants: [
      '工作多年', '老员工', '资深', '高级', 'senior', '经理',
      '总监', '主管', '负责人', '带团队', '管理层', '中层',
      '工作五年', '工作十年', '职场老人', '老司机'
    ],
    field: 'lifeStage',
    value: '职场老手'
  },
  {
    canonical: '自由职业',
    variants: [
      '自由职业', '自由职业者', 'freelancer', '自媒体', '博主',
      'up主', '网红', 'KOL', '独立顾问', '独立咨询', '接私活',
      '兼职', '灵活就业', '斜杠青年', '数字游民', '远程工作'
    ],
    field: 'lifeStage',
    value: '自由职业'
  },
  {
    canonical: '退休享乐',
    variants: [
      '退休', '已退休', '退休了', '不工作了', '享受生活',
      '养老', '退休人员', '离退休'
    ],
    field: 'lifeStage',
    value: '退休享乐'
  },
  {
    canonical: '全职爸妈',
    variants: [
      '全职妈妈', '全职爸爸', '全职太太', '全职主妇', '家庭主妇',
      '在家带娃', '专职带娃', '照顾家庭', '全职带孩子'
    ],
    field: 'lifeStage',
    value: '全职爸妈'
  }
];

// ============ 行业相关同义词 ============

export const INDUSTRY_SYNONYMS: SynonymGroup[] = [
  {
    canonical: '互联网/科技',
    variants: [
      '互联网', 'IT', '科技', '技术', '程序员', '码农', '开发',
      '软件', '产品经理', 'PM', '运营', '技术总监', 'CTO',
      '人工智能', 'AI', '大数据', '云计算', '区块链', 'web3'
    ],
    field: 'industry',
    value: '互联网/科技'
  },
  {
    canonical: '金融',
    variants: [
      '金融', '银行', '投资', '基金', '证券', '保险', '风投',
      'VC', 'PE', '投行', '理财', '财务', 'CFO', '会计',
      '审计', '四大', '券商'
    ],
    field: 'industry',
    value: '金融'
  },
  {
    canonical: '教育',
    variants: [
      '教育', '老师', '教师', '培训', '讲师', '教授', '助教',
      '辅导', '教学', '学校', '教研', 'K12', '在线教育'
    ],
    field: 'industry',
    value: '教育'
  },
  {
    canonical: '医疗/健康',
    variants: [
      '医疗', '医生', '护士', '医院', '健康', '医药', '制药',
      '生物', '临床', '主治', '住院医', '药剂师', '康复'
    ],
    field: 'industry',
    value: '医疗/健康'
  },
  {
    canonical: '设计/创意',
    variants: [
      '设计', '设计师', 'UI', 'UX', '视觉', '平面', '交互',
      '美术', '创意', '广告', '4A', '品牌', '艺术'
    ],
    field: 'industry',
    value: '设计/创意'
  },
  {
    canonical: '媒体/传播',
    variants: [
      '媒体', '传媒', '新闻', '记者', '编辑', '内容', '公关',
      '市场', '营销', 'marketing', '品牌', '广告'
    ],
    field: 'industry',
    value: '媒体/传播'
  },
  {
    canonical: '法律',
    variants: [
      '法律', '律师', '法务', '律所', '法官', '检察官',
      '法学', '司法', '仲裁'
    ],
    field: 'industry',
    value: '法律'
  },
  {
    canonical: '房地产',
    variants: [
      '房地产', '地产', '物业', '中介', '房产', '建筑',
      '工程', '开发商', '甲方'
    ],
    field: 'industry',
    value: '房地产'
  },
  {
    canonical: '餐饮/服务',
    variants: [
      '餐饮', '餐厅', '酒店', '服务业', '零售', '门店',
      '连锁', '加盟'
    ],
    field: 'industry',
    value: '餐饮/服务'
  },
  {
    canonical: '国企/央企',
    variants: [
      '国企', '央企', '国有企业', '中字头', '事业单位', '体制内',
      '公务员', '机关', '政府', '国有', '央属'
    ],
    field: 'industry',
    value: '国企/央企'
  }
];

// ============ 海归相关同义词 ============

export const RETURNEE_SYNONYMS: SynonymGroup[] = [
  {
    canonical: '海归',
    variants: [
      '海归', '留学', '留过学', '海外', '国外', '出国',
      '回国', '刚回国', '从国外回来', '在国外', '留学回来',
      '美国回来', '英国回来', '澳洲回来', '加拿大回来',
      '留学生', '海龟', 'returnee', '归国'
    ],
    field: 'isReturnee',
    value: 'true'
  }
];

// ============ 感情状态同义词 ============

export const RELATIONSHIP_SYNONYMS: SynonymGroup[] = [
  {
    canonical: '单身',
    variants: [
      '单身', '没对象', '没有对象', '一个人', '母胎solo',
      '单着', '还单着', '目前单身', '刚分手', '空窗期'
    ],
    field: 'relationshipStatus',
    value: '单身'
  },
  {
    canonical: '恋爱中',
    variants: [
      '恋爱', '有对象', '有男朋友', '有女朋友', '谈恋爱',
      '在一起', '交往中', '热恋', '稳定交往'
    ],
    field: 'relationshipStatus',
    value: '恋爱中'
  },
  {
    canonical: '已婚',
    variants: [
      '已婚', '结婚', '结婚了', '老公', '老婆', '爱人',
      '另一半', '伴侣', '夫妻', '配偶', '家属'
    ],
    field: 'relationshipStatus',
    value: '已婚'
  },
  {
    canonical: '离异',
    variants: [
      '离婚', '离异', '离过婚', '单亲', '前夫', '前妻'
    ],
    field: 'relationshipStatus',
    value: '离异'
  }
];

// ============ 否定表达模式 ============

export const NEGATION_PATTERNS: string[] = [
  '不是', '不做', '没有', '不再', '以前', '曾经', '之前',
  '不干了', '不做了', '放弃了', '退出了', '离开了',
  '不想', '不打算', '不会', '别', '勿', '非',
  '还没', '尚未', '未曾', '从未', '从不'
];

// ============ 时间修饰词（影响推断） ============

export const TEMPORAL_MODIFIERS: Record<string, 'past' | 'present' | 'future'> = {
  '以前': 'past',
  '之前': 'past',
  '曾经': 'past',
  '过去': 'past',
  '原来': 'past',
  '现在': 'present',
  '目前': 'present',
  '当前': 'present',
  '正在': 'present',
  '将来': 'future',
  '以后': 'future',
  '打算': 'future',
  '计划': 'future',
  '准备': 'future'
};

// ============ 快速推断规则 ============

export const QUICK_INFERENCE_RULES: InferenceRule[] = [
  // 人生阶段推断
  {
    id: 'life_stage_entrepreneur',
    name: '创业者人生阶段',
    trigger: {
      type: 'keyword',
      keywords: ['创业', '开公司', '自己做', '当老板', '做老板', '单干', '开店', 'CEO', '创始人', 'founder']
    },
    infers: [
      { field: 'lifeStage', value: '创业中', confidence: 0.92 }
    ],
    excludePatterns: ['不创业', '不想创业', '以前创业', '曾经创业', '放弃创业'],
    priority: 10
  },
  {
    id: 'life_stage_student',
    name: '学生人生阶段',
    trigger: {
      type: 'keyword',
      keywords: ['是学生', '还是学生', '我是学生', '在读', '上学', '念书', '读大学', '上大学', '在大学', '读研', '在校生', '大学生', '在校']
    },
    infers: [
      { field: 'lifeStage', value: '学生党', confidence: 0.95 }
    ],
    excludePatterns: ['不是学生', '毕业了', '已经毕业', '大学城', '大学路'],
    priority: 10
  },
  {
    id: 'life_stage_new_worker',
    name: '职场新人人生阶段',
    trigger: {
      type: 'keyword',
      keywords: ['刚毕业', '应届', '刚工作', '工作一年', '工作两年', '实习', '试用期']
    },
    infers: [
      { field: 'lifeStage', value: '职场新人', confidence: 0.88 }
    ],
    excludePatterns: [],
    priority: 9
  },
  {
    id: 'life_stage_freelancer',
    name: '自由职业人生阶段',
    trigger: {
      type: 'keyword',
      keywords: ['自由职业', 'freelancer', '自媒体', '博主', 'up主', '独立顾问', '接私活', '数字游民']
    },
    infers: [
      { field: 'lifeStage', value: '自由职业', confidence: 0.90 }
    ],
    excludePatterns: ['不是自由职业'],
    priority: 10
  },
  
  // 海归标签推断
  {
    id: 'returnee_detection',
    name: '海归识别',
    trigger: {
      type: 'keyword',
      keywords: ['留学', '海归', '国外回来', '留学回来', '在国外', '从美国', '从英国', '从澳洲', '从加拿大', '硅谷', '湾区', 'Silicon Valley', '华尔街', 'Wall Street', '美国回来', '英国回来', '回国创业']
    },
    infers: [
      { field: 'isReturnee', value: 'true', confidence: 0.90 },
      { field: 'languages', value: '英语', confidence: 0.75 }  // 海归很可能会英语
    ],
    excludePatterns: ['没留过学', '没出过国'],
    priority: 8
  },
  
  // 感情状态推断 - 单身
  {
    id: 'relationship_single',
    name: '单身状态',
    trigger: {
      type: 'keyword',
      keywords: ['单身', '没对象', '没有对象', '母胎solo', '单着', '空窗期', '刚分手', '还是一个人']
    },
    infers: [
      { field: 'relationshipStatus', value: '单身', confidence: 0.90 }
    ],
    excludePatterns: ['不是单身', '脱单', '告别单身'],
    priority: 9
  },
  
  // 感情状态推断 - 离异
  {
    id: 'relationship_divorced',
    name: '离异状态',
    trigger: {
      type: 'keyword',
      keywords: ['离异', '离婚', '离过婚', '单亲', '离异带娃', '离异带孩子']
    },
    infers: [
      { field: 'relationshipStatus', value: '离异', confidence: 0.92 }
    ],
    excludePatterns: [],
    priority: 9
  },
  
  // 设计行业
  {
    id: 'industry_design',
    name: '设计行业',
    trigger: {
      type: 'keyword',
      keywords: ['设计师', '做设计', 'UI设计', 'UX设计', '平面设计', '视觉设计', '交互设计', '室内设计', '建筑设计']
    },
    infers: [
      { field: 'industry', value: '设计/创意', confidence: 0.90 }
    ],
    excludePatterns: [],
    priority: 8
  },
  
  // 教育水平推断
  {
    id: 'education_graduate',
    name: '研究生学历',
    trigger: {
      type: 'keyword',
      keywords: ['读研', '研究生', '硕士', '在读研', '读硕', '硕士生', 'master', 'Masters']
    },
    infers: [
      { field: 'educationLevel', value: '研究生', confidence: 0.92 },
      { field: 'lifeStage', value: '学生党', confidence: 0.85 }
    ],
    excludePatterns: ['不读研', '没读研', '毕业了'],
    priority: 9
  },
  {
    id: 'education_phd',
    name: '博士学历',
    trigger: {
      type: 'keyword',
      keywords: ['博士', '博士生', '读博', '在读博士', 'PhD', 'Ph.D']
    },
    infers: [
      { field: 'educationLevel', value: '博士', confidence: 0.92 },
      { field: 'lifeStage', value: '学生党', confidence: 0.90 }
    ],
    excludePatterns: ['博士后', '不读博'],
    priority: 9
  },
  {
    id: 'education_bachelor',
    name: '本科学历',
    trigger: {
      type: 'keyword',
      keywords: ['本科', '大学', '大学生', '本科生', 'bachelor']
    },
    infers: [
      { field: 'educationLevel', value: '本科', confidence: 0.88 }
    ],
    excludePatterns: ['不是本科', '本科毕业'],
    priority: 7
  },
  
  // 全职父母
  {
    id: 'life_stage_fulltime_parent',
    name: '全职父母',
    trigger: {
      type: 'keyword',
      keywords: ['全职妈妈', '全职爸爸', '全职太太', '全职主妇', '家庭主妇', '在家带娃', '专职带娃']
    },
    infers: [
      { field: 'lifeStage', value: '全职爸妈', confidence: 0.95 },
      { field: 'hasChildren', value: 'true', confidence: 0.95 }
    ],
    excludePatterns: [],
    priority: 10
  },
  
  // 国企/央企
  {
    id: 'industry_state_owned',
    name: '国企央企',
    trigger: {
      type: 'keyword',
      keywords: ['国企', '央企', '国有企业', '中字头', '事业单位', '体制内', '公务员', '机关']
    },
    infers: [
      { field: 'industry', value: '国企/央企', confidence: 0.92 }
    ],
    excludePatterns: ['不在国企', '离开国企'],
    priority: 8
  },
  
  // 性别推断（谨慎使用）
  {
    id: 'gender_male_hint',
    name: '性别男性暗示',
    trigger: {
      type: 'keyword',
      keywords: ['老婆', '女朋友', '女友', '媳妇', '我老婆', '我女朋友']
    },
    infers: [
      { field: 'gender', value: '男', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 5
  },
  {
    id: 'gender_female_hint',
    name: '性别女性暗示',
    trigger: {
      type: 'keyword',
      keywords: ['老公', '男朋友', '男友', '先生', '我老公', '我男朋友', '孩子妈', '当妈']
    },
    infers: [
      { field: 'gender', value: '女', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 5
  },
  
  // 家庭状态推断
  {
    id: 'has_children',
    name: '有孩子',
    trigger: {
      type: 'keyword',
      keywords: ['孩子', '儿子', '女儿', '宝宝', '娃', '小孩', '带娃', '接孩子', '幼儿园', '上学']
    },
    infers: [
      { field: 'hasChildren', value: 'true', confidence: 0.88 }
    ],
    excludePatterns: ['没有孩子', '没孩子', '不想要孩子'],
    priority: 7
  },
  
  // ============ 隐含表达推断 ============
  
  // 创业隐含表达
  {
    id: 'implicit_entrepreneur',
    name: '创业隐含表达',
    trigger: {
      type: 'keyword',
      keywords: ['见投资人', '融资', '拿投资', 'A轮', 'B轮', 'C轮', '天使轮', '种子轮', 
                 '我们团队', '团队成员', '招人', '招聘', '合伙人', '股权', '期权',
                 '烧钱', '现金流', '盈利模式', '商业计划']
    },
    infers: [
      { field: 'lifeStage', value: '创业中', confidence: 0.88 }
    ],
    excludePatterns: [],
    priority: 8
  },
  
  // 学生隐含表达
  {
    id: 'implicit_student',
    name: '学生隐含表达',
    trigger: {
      type: 'keyword',
      keywords: ['考试', '期末', '论文', '毕业论文', '导师', '教授', '课程', '上课', 
                 '学分', '实验室', '图书馆', '宿舍', '食堂', '校园', '同学']
    },
    infers: [
      { field: 'lifeStage', value: '学生党', confidence: 0.85 }
    ],
    excludePatterns: ['孩子考试', '孩子上课'],
    priority: 7
  },
  
  // 职场人士隐含表达
  {
    id: 'implicit_employed',
    name: '职场人士隐含表达',
    trigger: {
      type: 'keyword',
      keywords: ['加班', '开会', '汇报', '领导', '老板', '同事', 'OKR', 'KPI', 
                 '年终奖', '涨薪', '晋升', '项目', '出差']
    },
    infers: [
      { field: 'lifeStage', value: '职场老手', confidence: 0.80 }
    ],
    excludePatterns: ['不加班', '不开会'],
    priority: 6
  },
  
  // 已婚隐含表达
  {
    id: 'implicit_married',
    name: '已婚隐含表达',
    trigger: {
      type: 'keyword',
      keywords: ['结婚', '婚后', '婚礼', '老公', '老婆', '爱人', '另一半', '配偶',
                 '婆媳', '公婆', '丈母娘', '岳父', '婚姻']
    },
    infers: [
      { field: 'relationshipStatus', value: '已婚', confidence: 0.90 }
    ],
    excludePatterns: ['未婚', '不结婚', '没结婚', '还没结婚'],
    priority: 8
  },
  
  // ============ 粤语方言推断 ============
  
  // 粤语创业者
  {
    id: 'cantonese_entrepreneur',
    name: '粤语创业者',
    trigger: {
      type: 'keyword',
      keywords: ['自己做嘢', '开咗间公司', '自己开公司', '做老闆', '做老细']
    },
    infers: [
      { field: 'lifeStage', value: '创业中', confidence: 0.88 }
    ],
    excludePatterns: [],
    priority: 8
  },
  
  // 粤语科技园→深圳
  {
    id: 'cantonese_shenzhen',
    name: '粤语深圳地标',
    trigger: {
      type: 'keyword',
      keywords: ['南山科技园', '科技园度', '喺深圳', '深圳嗰边', '前海', '福田']
    },
    infers: [
      { field: 'city', value: '深圳', confidence: 0.92 }
    ],
    excludePatterns: [],
    priority: 9
  },
  
  // 粤语互联网
  {
    id: 'cantonese_tech',
    name: '粤语科技行业',
    trigger: {
      type: 'keyword',
      keywords: ['做互联网嘅', '做IT嘅', '写code', '做tech']
    },
    infers: [
      { field: 'industry', value: '互联网/科技', confidence: 0.88 }
    ],
    excludePatterns: [],
    priority: 8
  },
  
  // ============ 中英混杂推断 ============
  
  // 中英混杂创业者
  {
    id: 'mixed_entrepreneur',
    name: '中英混杂创业者',
    trigger: {
      type: 'keyword',
      keywords: ['startup founder', 'startup', 'co-founder', 'create了一家公司', 
                 '做business', 'run公司', 'own business']
    },
    infers: [
      { field: 'lifeStage', value: '创业中', confidence: 0.90 }
    ],
    excludePatterns: [],
    priority: 9
  },
  
  // 中英混杂科技行业
  {
    id: 'mixed_tech',
    name: '中英混杂科技行业',
    trigger: {
      type: 'keyword',
      keywords: ['tech相关', 'tech行业', 'IT行业', 'tech公司', 'technology', 
                 '做software', 'engineer', '程序员', '码农', 'developer']
    },
    infers: [
      { field: 'industry', value: '互联网/科技', confidence: 0.88 }
    ],
    excludePatterns: [],
    priority: 8
  },
  
  // 中英混杂金融
  {
    id: 'mixed_finance',
    name: '中英混杂金融行业',
    trigger: {
      type: 'keyword',
      keywords: ['finance', 'banking', 'investment banking', 'PE', 'VC', 
                 '做投资', '基金', 'hedge fund', 'asset management']
    },
    infers: [
      { field: 'industry', value: '金融', confidence: 0.88 }
    ],
    excludePatterns: [],
    priority: 8
  },
  
  // 中英混杂城市
  {
    id: 'mixed_shenzhen',
    name: '中英混杂深圳',
    trigger: {
      type: 'keyword',
      keywords: ['Shenzhen', '在Shenzhen', 'Shenzhen这边', '深圳Nanshan']
    },
    infers: [
      { field: 'city', value: '深圳', confidence: 0.92 }
    ],
    excludePatterns: [],
    priority: 9
  },
  
  // ============ 地标推断城市 ============
  
  // 深圳地标
  {
    id: 'landmark_shenzhen',
    name: '深圳地标',
    trigger: {
      type: 'keyword',
      keywords: ['科技园', '南山', '福田', '前海', '华强北', '蛇口', '宝安']
    },
    infers: [
      { field: 'city', value: '深圳', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 7
  },
  
  // 北京地标
  {
    id: 'landmark_beijing',
    name: '北京地标',
    trigger: {
      type: 'keyword',
      keywords: ['中关村', '望京', '国贸', '三里屯', '朝阳', '海淀', '西二旗']
    },
    infers: [
      { field: 'city', value: '北京', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 7
  },
  
  // 上海地标
  {
    id: 'landmark_shanghai',
    name: '上海地标',
    trigger: {
      type: 'keyword',
      keywords: ['陆家嘴', '浦东', '张江', '静安', '徐汇', '虹桥', '外滩']
    },
    infers: [
      { field: 'city', value: '上海', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 7
  },
  
  // 广州地标
  {
    id: 'landmark_guangzhou',
    name: '广州地标',
    trigger: {
      type: 'keyword',
      keywords: ['天河', '珠江新城', '琶洲', '番禺', '白云', '越秀']
    },
    infers: [
      { field: 'city', value: '广州', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 7
  },
  
  // 成都地标
  {
    id: 'landmark_chengdu',
    name: '成都地标',
    trigger: {
      type: 'keyword',
      keywords: ['春熙路', '太古里', '高新区', '天府新区', '锦江', '武侯']
    },
    infers: [
      { field: 'city', value: '成都', confidence: 0.85 }
    ],
    excludePatterns: [],
    priority: 7
  },
  
  // ============ 转折/否定后的当前状态 ============
  
  // 从大厂出来创业
  {
    id: 'turnaround_to_entrepreneur',
    name: '转型创业者',
    trigger: {
      type: 'keyword',
      keywords: ['出来自己干', '出来创业', '辞职创业', '离职创业', '不干了自己做', 
                 '出来单干', '跳出来创业']
    },
    infers: [
      { field: 'lifeStage', value: '创业中', confidence: 0.90 }
    ],
    excludePatterns: [],
    priority: 9
  },
  
  // ============ 年龄推断 ============
  
  // 直接年龄表达
  {
    id: 'age_direct',
    name: '直接年龄表达',
    trigger: {
      type: 'pattern',
      pattern: '(?:我|今年|都|已经)?\\s*(\\d{2})\\s*(?:岁|了|多)'
    },
    infers: [
      { field: 'age', value: '$1', confidence: 0.95 }  // $1会被实际匹配替换
    ],
    excludePatterns: [],
    priority: 10
  },
  
  // 三十几岁
  {
    id: 'age_thirties',
    name: '三十几岁',
    trigger: {
      type: 'keyword',
      keywords: ['三十几', '三十多', '30多', '30几', '快四十']
    },
    infers: [
      { field: 'age', value: '35', confidence: 0.70 }
    ],
    excludePatterns: [],
    priority: 6
  }
];

// ============ 辅助函数 ============

/**
 * 检查文本是否包含否定表达
 */
export function containsNegation(text: string): boolean {
  return NEGATION_PATTERNS.some(pattern => text.includes(pattern));
}

/**
 * 获取时间修饰词的时态
 */
export function getTemporalContext(text: string): 'past' | 'present' | 'future' | null {
  for (const [modifier, tense] of Object.entries(TEMPORAL_MODIFIERS)) {
    if (text.includes(modifier)) {
      return tense;
    }
  }
  return null;
}

/**
 * 合并所有同义词组
 */
export function getAllSynonymGroups(): SynonymGroup[] {
  return [
    ...LIFE_STAGE_SYNONYMS,
    ...INDUSTRY_SYNONYMS,
    ...RETURNEE_SYNONYMS,
    ...RELATIONSHIP_SYNONYMS
  ];
}

/**
 * 根据变体查找标准形式和对应属性
 */
export function findCanonicalForm(text: string): {
  found: boolean;
  canonical?: string;
  field?: string;
  value?: string;
  confidence: number;
} {
  const allGroups = getAllSynonymGroups();
  
  for (const group of allGroups) {
    // 检查是否匹配任何变体
    const matchedVariant = group.variants.find(variant => 
      text.toLowerCase().includes(variant.toLowerCase())
    );
    
    if (matchedVariant) {
      // 检查是否被否定
      const isNegated = containsNegation(text);
      const temporalContext = getTemporalContext(text);
      
      // 如果是过去时态或被否定，降低置信度或跳过
      if (isNegated || temporalContext === 'past') {
        return {
          found: true,
          canonical: group.canonical,
          field: group.field,
          value: undefined,  // 不确定当前值
          confidence: 0.3
        };
      }
      
      return {
        found: true,
        canonical: group.canonical,
        field: group.field,
        value: group.value,
        confidence: 0.9
      };
    }
  }
  
  return { found: false, confidence: 0 };
}
