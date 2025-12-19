/**
 * 模拟用户场景生成器
 * 生成500个测试场景用于评估推断引擎
 */

import type { 
  SimulatedUserProfile, 
  SimulatedScenario, 
  SimulatedDialogueTurn,
  InferredAttribute 
} from './types';

// ============ 用户画像模板 ============

interface PersonaTemplate {
  type: SimulatedUserProfile['persona'];
  groundTruthOptions: Array<SimulatedUserProfile['groundTruth']>;
  dialogueTemplates: {
    style: SimulatedUserProfile['linguisticStyle'];
    turns: string[];
    inferableFields: Array<{ field: string; value: string; turnIndex: number }>;
  }[];
}

const PERSONA_TEMPLATES: PersonaTemplate[] = [
  // ============ 创业者 ============
  {
    type: 'entrepreneur',
    groundTruthOptions: [
      { lifeStage: '创业中', industry: '互联网/科技', city: '深圳', age: 32, gender: '男' },
      { lifeStage: '创业中', industry: '餐饮/服务', city: '广州', age: 28, gender: '女' },
      { lifeStage: '创业中', industry: '教育', city: '北京', age: 35, gender: '男' },
      { lifeStage: '创业中', industry: '金融', city: '上海', age: 30, gender: '女' },
    ],
    dialogueTemplates: [
      // 直接表达
      {
        style: 'direct',
        turns: [
          '我现在自己创业，做一个小公司',
          '主要是做互联网相关的',
          '在深圳这边',
          '我32了，创业三年了'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '创业中', turnIndex: 0 },
          { field: 'industry', value: '互联网/科技', turnIndex: 1 },
          { field: 'city', value: '深圳', turnIndex: 2 },
          { field: 'age', value: '32', turnIndex: 3 }
        ]
      },
      // 隐含暗示
      {
        style: 'implicit',
        turns: [
          '最近忙着见投资人，融资的事挺累的',
          '我们团队现在十几个人',
          '每天在科技园加班到很晚',
          '老婆总说我不顾家'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '创业中', turnIndex: 0 },
          { field: 'lifeStage', value: '创业中', turnIndex: 1 },
          { field: 'gender', value: '男', turnIndex: 3 },
          { field: 'relationshipStatus', value: '已婚', turnIndex: 3 }
        ]
      },
      // 否定转折
      {
        style: 'negative',
        turns: [
          '以前在大厂工作，后来出来自己干了',
          '不是那种传统行业，是做科技的',
          '不在北京，在深圳这边',
          '创业不容易，但不后悔'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '创业中', turnIndex: 0 },
          { field: 'industry', value: '互联网/科技', turnIndex: 1 },
          { field: 'city', value: '深圳', turnIndex: 2 }
        ]
      },
      // 方言俚语
      {
        style: 'dialect',
        turns: [
          '我系自己做嘢嘅，开咗间公司',
          '喺南山科技园度',
          '做互联网嘅嘢',
          '都三十几岁啦'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '创业中', turnIndex: 0 },
          { field: 'city', value: '深圳', turnIndex: 1 },
          { field: 'industry', value: '互联网/科技', turnIndex: 2 }
        ]
      },
      // 中英混杂
      {
        style: 'mixed',
        turns: [
          '我是startup founder，自己create了一家公司',
          '做的是tech相关的business',
          '在Shenzhen，南山这边',
          'Age的话，32岁'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '创业中', turnIndex: 0 },
          { field: 'industry', value: '互联网/科技', turnIndex: 1 },
          { field: 'city', value: '深圳', turnIndex: 2 },
          { field: 'age', value: '32', turnIndex: 3 }
        ]
      }
    ]
  },
  
  // ============ 学生 ============
  {
    type: 'student',
    groundTruthOptions: [
      { lifeStage: '学生党', education: '本科', city: '北京', age: 21, gender: '女' },
      { lifeStage: '学生党', education: '研究生', city: '上海', age: 24, gender: '男' },
      { lifeStage: '学生党', education: '博士', city: '杭州', age: 27, gender: '女' },
      { lifeStage: '学生党', education: '本科', city: '广州', age: 20, gender: '男' },
    ],
    dialogueTemplates: [
      {
        style: 'direct',
        turns: [
          '我还在读书，大三',
          '在北大念的',
          '学的是计算机',
          '21岁，女生'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '学生党', turnIndex: 0 },
          { field: 'city', value: '北京', turnIndex: 1 },
          { field: 'industry', value: '互联网/科技', turnIndex: 2 },
          { field: 'age', value: '21', turnIndex: 3 },
          { field: 'gender', value: '女', turnIndex: 3 }
        ]
      },
      {
        style: 'implicit',
        turns: [
          '最近期末考试压力好大',
          '每天泡在图书馆',
          '室友都在准备考研',
          '等毕业了想去大厂'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '学生党', turnIndex: 0 },
          { field: 'lifeStage', value: '学生党', turnIndex: 1 },
          { field: 'lifeStage', value: '学生党', turnIndex: 2 }
        ]
      },
      {
        style: 'negative',
        turns: [
          '还没毕业呢，不是已经工作的',
          '不是本科，是研究生',
          '不在老家，在上海读书',
          '不是理工科，是学金融的'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '学生党', turnIndex: 0 },
          { field: 'education', value: '研究生', turnIndex: 1 },
          { field: 'city', value: '上海', turnIndex: 2 },
          { field: 'industry', value: '金融', turnIndex: 3 }
        ]
      },
      {
        style: 'dialect',
        turns: [
          '我还系学生仔嚟嘅',
          '喺中大读紧书',
          '读嘅系经济',
          '今年大四啦'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '学生党', turnIndex: 0 },
          { field: 'city', value: '广州', turnIndex: 1 }
        ]
      },
      {
        style: 'mixed',
        turns: [
          '我是student，还在school读书',
          '在Fudan念master',
          '专业是finance',
          '24岁，male'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '学生党', turnIndex: 0 },
          { field: 'city', value: '上海', turnIndex: 1 },
          { field: 'education', value: '研究生', turnIndex: 1 },
          { field: 'industry', value: '金融', turnIndex: 2 },
          { field: 'age', value: '24', turnIndex: 3 },
          { field: 'gender', value: '男', turnIndex: 3 }
        ]
      }
    ]
  },
  
  // ============ 职场人 ============
  {
    type: 'corporate',
    groundTruthOptions: [
      { lifeStage: '职场老手', industry: '互联网/科技', city: '北京', age: 30, gender: '男' },
      { lifeStage: '职场新人', industry: '金融', city: '上海', age: 25, gender: '女' },
      { lifeStage: '职场老手', industry: '咨询', city: '深圳', age: 35, gender: '男' },
      { lifeStage: '职场新人', industry: '媒体/传播', city: '广州', age: 24, gender: '女' },
    ],
    dialogueTemplates: [
      {
        style: 'direct',
        turns: [
          '我在腾讯工作，做产品',
          '在深圳总部',
          '工作五年了',
          '30岁，男'
        ],
        inferableFields: [
          { field: 'industry', value: '互联网/科技', turnIndex: 0 },
          { field: 'city', value: '深圳', turnIndex: 1 },
          { field: 'lifeStage', value: '职场老手', turnIndex: 2 },
          { field: 'age', value: '30', turnIndex: 3 },
          { field: 'gender', value: '男', turnIndex: 3 }
        ]
      },
      {
        style: 'implicit',
        turns: [
          '每天早上挤地铁去陆家嘴上班',
          '在一家投行做分析师',
          '经常加班到凌晨',
          '刚毕业两年，还在学习中'
        ],
        inferableFields: [
          { field: 'city', value: '上海', turnIndex: 0 },
          { field: 'industry', value: '金融', turnIndex: 1 },
          { field: 'lifeStage', value: '职场新人', turnIndex: 3 }
        ]
      },
      {
        style: 'negative',
        turns: [
          '不是创业，是在公司上班',
          '不是互联网，是做金融的',
          '不在北京，在上海',
          '工作不久，刚毕业一年'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '职场新人', turnIndex: 3 },
          { field: 'industry', value: '金融', turnIndex: 1 },
          { field: 'city', value: '上海', turnIndex: 2 }
        ]
      },
      {
        style: 'dialect',
        turns: [
          '我喺字节返工',
          '喺北京嘅office',
          '做运营嘅',
          '返咗几年工啦'
        ],
        inferableFields: [
          { field: 'industry', value: '互联网/科技', turnIndex: 0 },
          { field: 'city', value: '北京', turnIndex: 1 },
          { field: 'lifeStage', value: '职场老手', turnIndex: 3 }
        ]
      },
      {
        style: 'mixed',
        turns: [
          '我在McKinsey做consultant',
          '在Shanghai office',
          '主要做strategy的project',
          '工作3年了，算是senior了'
        ],
        inferableFields: [
          { field: 'industry', value: '咨询', turnIndex: 0 },
          { field: 'city', value: '上海', turnIndex: 1 },
          { field: 'lifeStage', value: '职场老手', turnIndex: 3 }
        ]
      }
    ]
  },
  
  // ============ 海归 ============
  {
    type: 'returnee',
    groundTruthOptions: [
      { lifeStage: '职场新人', isReturnee: true, languages: ['英语'], city: '上海', age: 26, gender: '女' },
      { lifeStage: '职场老手', isReturnee: true, languages: ['英语'], city: '北京', age: 32, gender: '男' },
      { lifeStage: '创业中', isReturnee: true, languages: ['英语'], city: '深圳', age: 30, gender: '男' },
      { lifeStage: '学生党', isReturnee: true, languages: ['英语'], city: '香港', age: 24, gender: '女' },
    ],
    dialogueTemplates: [
      {
        style: 'direct',
        turns: [
          '我是海归，之前在美国读书',
          '在哥大念的MBA',
          '刚回国一年，在上海工作',
          '26岁，女生'
        ],
        inferableFields: [
          { field: 'isReturnee', value: 'true', turnIndex: 0 },
          { field: 'languages', value: '英语', turnIndex: 0 },
          { field: 'education', value: '研究生', turnIndex: 1 },
          { field: 'city', value: '上海', turnIndex: 2 },
          { field: 'lifeStage', value: '职场新人', turnIndex: 2 },
          { field: 'age', value: '26', turnIndex: 3 },
          { field: 'gender', value: '女', turnIndex: 3 }
        ]
      },
      {
        style: 'implicit',
        turns: [
          '刚从硅谷回来不久',
          '之前在Google工作了几年',
          '英语比中文说得溜',
          '回国创业，做AI方向'
        ],
        inferableFields: [
          { field: 'isReturnee', value: 'true', turnIndex: 0 },
          { field: 'industry', value: '互联网/科技', turnIndex: 1 },
          { field: 'languages', value: '英语', turnIndex: 2 },
          { field: 'lifeStage', value: '创业中', turnIndex: 3 }
        ]
      },
      {
        style: 'negative',
        turns: [
          '不是土著，是从国外回来的',
          '不是英国，是美国那边',
          '不是留学生了，已经毕业工作了',
          '没在国外定居，选择回国发展'
        ],
        inferableFields: [
          { field: 'isReturnee', value: 'true', turnIndex: 0 },
          { field: 'languages', value: '英语', turnIndex: 1 }
        ]
      },
      {
        style: 'dialect',
        turns: [
          '我之前喺美国读书嘅',
          'UCLA毕业',
          '返咗嚟香港',
          '而家喺投行做嘢'
        ],
        inferableFields: [
          { field: 'isReturnee', value: 'true', turnIndex: 0 },
          { field: 'languages', value: '英语', turnIndex: 0 },
          { field: 'city', value: '香港', turnIndex: 2 },
          { field: 'industry', value: '金融', turnIndex: 3 }
        ]
      },
      {
        style: 'mixed',
        turns: [
          '我是returnee，从US回来的',
          '在Stanford读的CS PhD',
          '现在在Beijing，加入了一家AI startup',
          '32岁，male'
        ],
        inferableFields: [
          { field: 'isReturnee', value: 'true', turnIndex: 0 },
          { field: 'languages', value: '英语', turnIndex: 0 },
          { field: 'education', value: '博士', turnIndex: 1 },
          { field: 'city', value: '北京', turnIndex: 2 },
          { field: 'lifeStage', value: '创业中', turnIndex: 2 },
          { field: 'age', value: '32', turnIndex: 3 },
          { field: 'gender', value: '男', turnIndex: 3 }
        ]
      }
    ]
  },
  
  // ============ 自由职业 ============
  {
    type: 'freelancer',
    groundTruthOptions: [
      { lifeStage: '自由职业', industry: '设计/创意', city: '杭州', age: 28, gender: '女' },
      { lifeStage: '自由职业', industry: '媒体/传播', city: '成都', age: 30, gender: '男' },
      { lifeStage: '自由职业', industry: '互联网/科技', city: '深圳', age: 35, gender: '男' },
      { lifeStage: '自由职业', industry: '教育', city: '北京', age: 32, gender: '女' },
    ],
    dialogueTemplates: [
      {
        style: 'direct',
        turns: [
          '我是自由职业者',
          '做设计的，主要接私活',
          '在杭州，可以远程工作',
          '28岁，女'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '自由职业', turnIndex: 0 },
          { field: 'industry', value: '设计/创意', turnIndex: 1 },
          { field: 'city', value: '杭州', turnIndex: 2 },
          { field: 'age', value: '28', turnIndex: 3 },
          { field: 'gender', value: '女', turnIndex: 3 }
        ]
      },
      {
        style: 'implicit',
        turns: [
          '自己当自己的老板，时间很自由',
          '主要靠做自媒体赚钱',
          '在B站有几十万粉丝',
          '住在成都，生活成本低'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '自由职业', turnIndex: 0 },
          { field: 'industry', value: '媒体/传播', turnIndex: 1 },
          { field: 'city', value: '成都', turnIndex: 3 }
        ]
      },
      {
        style: 'negative',
        turns: [
          '不上班，不是朝九晚五那种',
          '不是创业，就是自己接活做',
          '没有固定办公室，在家工作',
          '不年轻了，35了'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '自由职业', turnIndex: 0 },
          { field: 'lifeStage', value: '自由职业', turnIndex: 1 },
          { field: 'age', value: '35', turnIndex: 3 }
        ]
      },
      {
        style: 'dialect',
        turns: [
          '我系做freelance嘅',
          '帮人整网站同APP',
          '喺深圳住',
          '时间好自由'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '自由职业', turnIndex: 0 },
          { field: 'industry', value: '互联网/科技', turnIndex: 1 },
          { field: 'city', value: '深圳', turnIndex: 2 }
        ]
      },
      {
        style: 'mixed',
        turns: [
          '我是freelancer，做independent consultant',
          '主要帮startup做product design',
          '在Shenzhen base',
          '35岁了，自由职业五年'
        ],
        inferableFields: [
          { field: 'lifeStage', value: '自由职业', turnIndex: 0 },
          { field: 'industry', value: '设计/创意', turnIndex: 1 },
          { field: 'city', value: '深圳', turnIndex: 2 },
          { field: 'age', value: '35', turnIndex: 3 }
        ]
      }
    ]
  }
];

// ============ 场景生成器 ============

/**
 * 生成指定数量的模拟场景
 */
export function generateScenarios(count: number = 500): SimulatedScenario[] {
  const scenarios: SimulatedScenario[] = [];
  
  // 每种人设 * 每种语言风格 = 5 * 5 = 25种组合
  // 每种组合生成 count/25 个场景
  const perCombination = Math.ceil(count / 25);
  
  let scenarioId = 0;
  
  for (const template of PERSONA_TEMPLATES) {
    for (const dialogueTemplate of template.dialogueTemplates) {
      for (let i = 0; i < perCombination && scenarioId < count; i++) {
        // 随机选择一个ground truth
        const groundTruth = template.groundTruthOptions[i % template.groundTruthOptions.length];
        
        // 构建场景
        const scenario: SimulatedScenario = {
          id: `scenario_${scenarioId++}`,
          profile: {
            id: `user_${scenarioId}`,
            persona: template.type,
            groundTruth,
            linguisticStyle: dialogueTemplate.style
          },
          dialogue: dialogueTemplate.turns.map((content, idx) => ({
            role: 'user' as const,
            content,
            containsInferableInfo: dialogueTemplate.inferableFields
              .filter(f => f.turnIndex === idx)
              .map(f => ({
                field: f.field,
                value: f.value,
                expressionType: dialogueTemplate.style === 'negative' ? 'negation' as const : 
                               dialogueTemplate.style === 'implicit' ? 'implicit' as const : 
                               'explicit' as const
              }))
          })),
          expectedInferences: dialogueTemplate.inferableFields.map(f => ({
            field: f.field,
            value: f.value,
            confidence: dialogueTemplate.style === 'direct' ? 0.9 :
                       dialogueTemplate.style === 'implicit' ? 0.7 :
                       dialogueTemplate.style === 'negative' ? 0.6 : 0.75,
            evidence: dialogueTemplate.turns[f.turnIndex]
          })),
          potentialDuplicateQuestions: dialogueTemplate.inferableFields.map(f => f.field)
        };
        
        scenarios.push(scenario);
      }
    }
  }
  
  return scenarios;
}

/**
 * 生成带干扰的对话场景（更真实）
 */
export function generateRealisticScenario(persona: SimulatedUserProfile['persona']): SimulatedScenario {
  const template = PERSONA_TEMPLATES.find(t => t.type === persona);
  if (!template) {
    throw new Error(`Unknown persona: ${persona}`);
  }
  
  // 随机选择一个ground truth和对话模板
  const groundTruth = template.groundTruthOptions[Math.floor(Math.random() * template.groundTruthOptions.length)];
  const dialogueTemplate = template.dialogueTemplates[Math.floor(Math.random() * template.dialogueTemplates.length)];
  
  // 添加一些干扰对话（不包含推断信息的闲聊）
  const fillerTurns = [
    '最近天气不错',
    '哈哈是的',
    '嗯嗯',
    '好的',
    '这样啊',
    '原来如此'
  ];
  
  const dialogue: SimulatedDialogueTurn[] = [];
  let turnIndex = 0;
  
  for (const turn of dialogueTemplate.turns) {
    // 50%概率在关键对话前添加干扰
    if (Math.random() < 0.5) {
      dialogue.push({
        role: 'user',
        content: fillerTurns[Math.floor(Math.random() * fillerTurns.length)]
      });
    }
    
    dialogue.push({
      role: 'user',
      content: turn,
      containsInferableInfo: dialogueTemplate.inferableFields
        .filter(f => f.turnIndex === turnIndex)
        .map(f => ({
          field: f.field,
          value: f.value,
          expressionType: 'explicit' as const
        }))
    });
    
    turnIndex++;
  }
  
  return {
    id: `realistic_${Date.now()}`,
    profile: {
      id: `user_${Date.now()}`,
      persona,
      groundTruth,
      linguisticStyle: dialogueTemplate.style
    },
    dialogue,
    expectedInferences: dialogueTemplate.inferableFields.map(f => ({
      field: f.field,
      value: f.value,
      confidence: 0.8,
      evidence: dialogueTemplate.turns[f.turnIndex]
    })),
    potentialDuplicateQuestions: dialogueTemplate.inferableFields.map(f => f.field)
  };
}

// 导出生成的500个场景
export const TEST_SCENARIOS = generateScenarios(500);

// ============ 辅助函数 ============

/**
 * 获取场景统计信息
 */
export function getScenarioStats() {
  const stats = {
    total: TEST_SCENARIOS.length,
    byPersona: {} as Record<string, number>,
    byStyle: {} as Record<string, number>,
    byFieldCoverage: {} as Record<string, number>,
  };
  
  for (const scenario of TEST_SCENARIOS) {
    // 按人设统计
    const persona = scenario.profile.persona;
    stats.byPersona[persona] = (stats.byPersona[persona] || 0) + 1;
    
    // 按语言风格统计
    const style = scenario.profile.linguisticStyle;
    stats.byStyle[style] = (stats.byStyle[style] || 0) + 1;
    
    // 按字段覆盖统计
    for (const inf of scenario.expectedInferences) {
      stats.byFieldCoverage[inf.field] = (stats.byFieldCoverage[inf.field] || 0) + 1;
    }
  }
  
  return stats;
}

/**
 * 获取随机场景样本
 */
export function getRandomScenarios(count: number = 10): SimulatedScenario[] {
  const shuffled = [...TEST_SCENARIOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, TEST_SCENARIOS.length));
}

/**
 * 按条件筛选场景
 */
export function filterScenarios(options: {
  persona?: SimulatedUserProfile['persona'];
  style?: SimulatedUserProfile['linguisticStyle'];
  hasField?: string;
}): SimulatedScenario[] {
  return TEST_SCENARIOS.filter(scenario => {
    if (options.persona && scenario.profile.persona !== options.persona) return false;
    if (options.style && scenario.profile.linguisticStyle !== options.style) return false;
    if (options.hasField && !scenario.expectedInferences.some(i => i.field === options.hasField)) return false;
    return true;
  });
}
