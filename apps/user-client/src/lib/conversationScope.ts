/**
 * 小悦对话流程 - Answer Scope 设计
 * 
 * 定义每个对话阶段的预期回复类型、有效选项、示例答案
 * 用于：
 * 1. 引导用户给出有效回答
 * 2. 减少AI解析错误
 * 3. 碎嘴系统按阶段匹配触发器
 */

export type AnswerType = 'text' | 'selection' | 'multiselect' | 'date' | 'number' | 'boolean' | 'freeform';

export interface ConversationStep {
  stepId: string;
  phase: 'warmup' | 'identity' | 'career' | 'interests' | 'social' | 'closing';
  targetField: string;
  label: string;
  expectedTypes: AnswerType[];
  validOptions?: string[];
  examples?: string[];
  fallbackPrompt?: string;
  isRequired: boolean;
  tier: 1 | 2 | 3;
  sensitivityLevel: 'low' | 'medium' | 'high';
  gossipTriggers: string[];
}

export const CONVERSATION_STEPS: ConversationStep[] = [
  // ============ Phase 1: Warmup (破冰) ============
  {
    stepId: 'greeting',
    phase: 'warmup',
    targetField: 'displayName',
    label: '称呼',
    expectedTypes: ['text'],
    examples: ['叫我小明', '我是Amy', '大家都叫我阿豪'],
    fallbackPrompt: '怎么称呼你比较好？一个字、两个字、英文名都行～',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: ['name_style', 'name_creative'],
  },

  // ============ Phase 2: Identity (身份基础) ============
  {
    stepId: 'gender',
    phase: 'identity',
    targetField: 'gender',
    label: '性别',
    expectedTypes: ['selection'],
    validOptions: ['男', '女', '其他', '不想说'],
    examples: ['男生', '女', '我是女生'],
    fallbackPrompt: '方便告诉我你是男生还是女生吗？这样聊天更自然～',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: [],
  },
  {
    stepId: 'birthYear',
    phase: 'identity',
    targetField: 'birthYear',
    label: '出生年份',
    expectedTypes: ['number', 'text'],
    examples: ['95年', '1992', '我是90后', '28岁'],
    fallbackPrompt: '大概哪年出生的？或者告诉我年龄也行～',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'medium',
    gossipTriggers: ['age_90s', 'age_95plus', 'age_00s'],
  },
  {
    stepId: 'currentCity',
    phase: 'identity',
    targetField: 'currentCity',
    label: '当前城市',
    expectedTypes: ['selection', 'text'],
    validOptions: ['深圳', '香港', '广州', '东莞', '珠海', '其他'],
    examples: ['在深圳', '南山', '香港', '福田区'],
    fallbackPrompt: '现在在哪个城市呀？',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: ['city_shenzhen', 'city_hongkong', 'city_newcomer'],
  },
  {
    stepId: 'hometown',
    phase: 'identity',
    targetField: 'hometown',
    label: '家乡',
    expectedTypes: ['text'],
    examples: ['老家湖南', '广东人', '东北的', '潮汕'],
    fallbackPrompt: '老家是哪里的？',
    isRequired: false,
    tier: 2,
    sensitivityLevel: 'low',
    gossipTriggers: ['hometown_north', 'hometown_south', 'hometown_coastal', 'hometown_cantonese', 'hometown_sichuan', 'hometown_dongbei'],
  },

  // ============ Phase 3: Career (职业背景) ============
  {
    stepId: 'industry',
    phase: 'career',
    targetField: 'industry',
    label: '行业',
    expectedTypes: ['selection', 'text'],
    validOptions: [
      '互联网/科技', '金融', '教育', '医疗健康', '房地产', 
      '消费品/零售', '制造业', '传媒/娱乐', '法律', '咨询',
      '政府/事业单位', '创业', '自由职业', '其他'
    ],
    examples: ['做互联网的', '金融行业', '在医院工作', '自己创业'],
    fallbackPrompt: '在什么行业工作呀？',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: ['industry_tech', 'industry_finance', 'industry_creative', 'industry_startup'],
  },
  {
    stepId: 'occupation',
    phase: 'career',
    targetField: 'occupationDescription',
    label: '职业描述',
    expectedTypes: ['text', 'freeform'],
    examples: ['产品经理', '做设计的', '写代码', '销售', '运营'],
    fallbackPrompt: '具体做什么工作呢？简单说说就行～',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: ['job_pm', 'job_engineer', 'job_designer', 'job_sales', 'job_creative'],
  },

  // ============ Phase 4: Interests (兴趣爱好) ============
  {
    stepId: 'interests',
    phase: 'interests',
    targetField: 'interestsTop',
    label: '兴趣爱好',
    expectedTypes: ['multiselect', 'freeform'],
    validOptions: [
      '运动健身', '音乐', '电影', '阅读', '旅行', '美食探店',
      '摄影', '游戏', '户外', '艺术', '宠物', '烹饪',
      'K歌', '桌游', '脱口秀', '露营', '其他'
    ],
    examples: ['喜欢跑步和看电影', '爱吃会做饭', '周末喜欢宅着打游戏'],
    fallbackPrompt: '平时有什么兴趣爱好？',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: ['interest_sports', 'interest_music', 'interest_food', 'interest_travel', 'interest_games', 'interest_pets', 'interest_outdoor'],
  },
  {
    stepId: 'pets',
    phase: 'interests',
    targetField: 'hasPets',
    label: '养宠物',
    expectedTypes: ['boolean', 'text'],
    validOptions: ['有', '没有', '想养'],
    examples: ['养了一只猫', '有狗', '没养宠物', '想养但没条件'],
    fallbackPrompt: '有养宠物吗？',
    isRequired: false,
    tier: 3,
    sensitivityLevel: 'low',
    gossipTriggers: ['pet_cat', 'pet_dog', 'pet_exotic', 'pet_multi'],
  },

  // ============ Phase 5: Social (社交偏好) ============
  {
    stepId: 'intent',
    phase: 'social',
    targetField: 'intent',
    label: '社交目的',
    expectedTypes: ['selection', 'freeform'],
    validOptions: ['认识新朋友', '拓展人脉', '找志同道合的人', '脱单', '随便看看'],
    examples: ['想认识新朋友', '拓展一下圈子', '找有共同爱好的人'],
    fallbackPrompt: '来这里主要是想？',
    isRequired: true,
    tier: 1,
    sensitivityLevel: 'low',
    gossipTriggers: ['intent_friends', 'intent_network', 'intent_dating', 'intent_hobby'],
  },
  {
    stepId: 'socialStyle',
    phase: 'social',
    targetField: 'socialStyle',
    label: '社交风格',
    expectedTypes: ['selection', 'text'],
    validOptions: ['外向活泼', '内敛观察', '看情况', '慢热型'],
    examples: ['比较外向', '有点社恐', '看场合', '慢热但熟了话多'],
    fallbackPrompt: '社交场合你通常是什么风格？',
    isRequired: false,
    tier: 2,
    sensitivityLevel: 'low',
    gossipTriggers: ['style_extrovert', 'style_introvert', 'style_ambivert', 'style_warmup'],
  },
  {
    stepId: 'relationshipStatus',
    phase: 'social',
    targetField: 'relationshipStatus',
    label: '感情状态',
    expectedTypes: ['selection'],
    validOptions: ['单身', '恋爱中', '已婚', '不想说'],
    examples: ['单身', '有对象了', '已婚'],
    fallbackPrompt: '方便说一下感情状态吗？这样匹配更合适～',
    isRequired: false,
    tier: 2,
    sensitivityLevel: 'high',
    gossipTriggers: [],
  },

  // ============ Phase 6: Closing (收尾) ============
  {
    stepId: 'topicAvoidances',
    phase: 'closing',
    targetField: 'topicAvoidances',
    label: '避开话题',
    expectedTypes: ['multiselect', 'freeform'],
    validOptions: ['政治', '宗教', '收入', '婚育', '前任', '都可以聊'],
    examples: ['别聊政治', '收入话题比较敏感', '都可以'],
    fallbackPrompt: '有什么话题是你不太想在活动中聊的？',
    isRequired: false,
    tier: 3,
    sensitivityLevel: 'low',
    gossipTriggers: [],
  },
];

export function getStepByField(fieldName: string): ConversationStep | undefined {
  return CONVERSATION_STEPS.find(step => step.targetField === fieldName);
}

export function getStepsByPhase(phase: ConversationStep['phase']): ConversationStep[] {
  return CONVERSATION_STEPS.filter(step => step.phase === phase);
}

export function getRequiredSteps(): ConversationStep[] {
  return CONVERSATION_STEPS.filter(step => step.isRequired);
}

export function getGossipTriggersForPhase(phase: ConversationStep['phase']): string[] {
  const steps = getStepsByPhase(phase);
  return steps.flatMap(step => step.gossipTriggers);
}

export function getAllGossipTriggers(): Map<string, ConversationStep> {
  const map = new Map<string, ConversationStep>();
  for (const step of CONVERSATION_STEPS) {
    for (const trigger of step.gossipTriggers) {
      map.set(trigger, step);
    }
  }
  return map;
}

export const PHASE_ORDER: ConversationStep['phase'][] = [
  'warmup', 'identity', 'career', 'interests', 'social', 'closing'
];

export function getPhaseLabel(phase: ConversationStep['phase']): string {
  const labels: Record<ConversationStep['phase'], string> = {
    warmup: '破冰',
    identity: '基础信息',
    career: '职业背景',
    interests: '兴趣爱好',
    social: '社交偏好',
    closing: '收尾',
  };
  return labels[phase];
}
