/**
 * Trait Display Configuration
 * 性格维度展示文案配置
 * 
 * 用于集中管理性格维度的用户侧展示文案，优化为"小聚同频匹配"场景
 */

export interface TraitDisplayConfig {
  key: string;
  chineseName: string;
  englishName: string;
  simpleDesc: string;      // 简洁版定义（用于 tooltip）
  fullDesc: string;        // 完整版定义（用于详细说明）
  matchingValue: string;   // 小聚同频价值（帮助用户理解维度意义）
  lowEndLabel: string;     // 低分端标签
  highEndLabel: string;    // 高分端标签
}

export const TRAIT_DISPLAY_CONFIG: Record<string, TraitDisplayConfig> = {
  'A': {
    key: 'A',
    chineseName: '亲和力',
    englishName: 'Affinity',
    simpleDesc: '建立温暖联结、拉近距离的能力',
    fullDesc: '与人建立温暖联结、拉近距离的能力',
    matchingValue: '决定小聚中能否快速融入、拉近陌生人距离',
    lowEndLabel: '保持距离',
    highEndLabel: '热情亲近'
  },
  'C': {
    key: 'C',
    chineseName: '责任心',
    englishName: 'Conscientiousness',
    simpleDesc: '可靠守诺，有规划与条理性',
    fullDesc: '做事可靠守诺，有规划性和条理性',
    matchingValue: '决定小聚中是否守时守规则、靠谱可依赖',
    lowEndLabel: '随性自由',
    highEndLabel: '严谨自律'
  },
  'O': {
    key: 'O',
    chineseName: '开放性',
    englishName: 'Openness',
    simpleDesc: '接纳新事物、新话题的好奇心',
    fullDesc: '对新事物、新话题的好奇心与接纳度',
    matchingValue: '决定小聚中能否接受新话题、聊得来不同背景的人',
    lowEndLabel: '传统务实',
    highEndLabel: '开放探索'
  },
  'E': {
    key: 'E',
    chineseName: '情绪稳定性',
    englishName: 'Emotional Stability',
    simpleDesc: '应对变化/压力的情绪平稳度',
    fullDesc: '面对变化/压力时的情绪冷静度与平稳性',
    matchingValue: '决定小聚中应对氛围变化、临时调整的情绪舒适度',
    lowEndLabel: '情绪敏感',
    highEndLabel: '情绪淡定'
  },
  'X': {
    key: 'X',
    chineseName: '外向性',
    englishName: 'Extraversion',
    simpleDesc: '社交的能量感、主动性与参与度',
    fullDesc: '社交中的能量感、互动主动性与参与度',
    matchingValue: '决定小聚中喜欢热闹还是安静、主动破冰还是观察等待',
    lowEndLabel: '安静内敛',
    highEndLabel: '活跃外放'
  },
  'P': {
    key: 'P',
    chineseName: '积极性',
    englishName: 'Positivity',
    simpleDesc: '待人的乐观心态与人际热情度',
    fullDesc: '待人处事的乐观心态与人际间的热情程度',
    matchingValue: '决定小聚中聊天是理性分析风还是感性共鸣风',
    lowEndLabel: '理性务实',
    highEndLabel: '感性乐观'
  }
};

// 兼容性导出函数
export const getTraitSimpleDesc = (key: string): string => 
  TRAIT_DISPLAY_CONFIG[key]?.simpleDesc || '';

export const getTraitFullDesc = (key: string): string => 
  TRAIT_DISPLAY_CONFIG[key]?.fullDesc || '';

export const getTraitMatchingValue = (key: string): string => 
  TRAIT_DISPLAY_CONFIG[key]?.matchingValue || '';

export const getTraitBipolarLabels = (key: string): { low: string; high: string } => ({
  low: TRAIT_DISPLAY_CONFIG[key]?.lowEndLabel || '',
  high: TRAIT_DISPLAY_CONFIG[key]?.highEndLabel || ''
});
