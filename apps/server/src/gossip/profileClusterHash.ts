/**
 * 画像簇哈希算法 - 用于碎嘴系统 V3 缓存
 * 将相似用户画像聚类到同一个缓存键
 */

export interface ProfileClusterInput {
  industry?: string;
  topInterests?: string[];
  hometownProvince?: string;
  intent?: string[];
  gender?: string;
  lifeStage?: string;
}

const INDUSTRY_GROUPS: Record<string, string> = {
  '金融': 'finance',
  '投资': 'finance',
  '银行': 'finance',
  '保险': 'finance',
  'PE': 'finance',
  'VC': 'finance',
  '互联网': 'tech',
  '科技': 'tech',
  'IT': 'tech',
  '软件': 'tech',
  'AI': 'tech',
  '人工智能': 'tech',
  '医疗': 'health',
  '医药': 'health',
  '健康': 'health',
  '教育': 'edu',
  '培训': 'edu',
  '法律': 'legal',
  '律师': 'legal',
  '咨询': 'consulting',
  '广告': 'creative',
  '设计': 'creative',
  '媒体': 'creative',
  '制造': 'manufacturing',
  '工业': 'manufacturing',
  '贸易': 'trade',
  '电商': 'trade',
  '餐饮': 'service',
  '酒店': 'service',
  '房地产': 'realestate',
};

const PROVINCE_GROUPS: Record<string, string> = {
  '广东': 'gd',
  '香港': 'hk',
  '深圳': 'gd',
  '广州': 'gd',
  '北京': 'bj',
  '上海': 'sh',
  '江苏': 'jiangsu',
  '浙江': 'zhejiang',
  '四川': 'sichuan',
  '湖北': 'hubei',
  '湖南': 'hunan',
  '福建': 'fujian',
  '河南': 'henan',
  '山东': 'shandong',
  '东北': 'dongbei',
  '辽宁': 'dongbei',
  '吉林': 'dongbei',
  '黑龙江': 'dongbei',
};

const INTEREST_PRIORITY = [
  '美食', '旅行', '电影', '音乐', '健身',
  '户外', '阅读', '游戏', '摄影', '艺术',
  '投资', '创业', '宠物', '烹饪', '咖啡',
  '红酒', '威士忌', '徒步', '滑雪', '潜水'
];

function normalizeIndustry(industry?: string): string {
  if (!industry) return 'other';
  for (const [keyword, group] of Object.entries(INDUSTRY_GROUPS)) {
    if (industry.includes(keyword)) {
      return group;
    }
  }
  return 'other';
}

function normalizeProvince(hometown?: string): string {
  if (!hometown) return 'other';
  for (const [keyword, group] of Object.entries(PROVINCE_GROUPS)) {
    if (hometown.includes(keyword)) {
      return group;
    }
  }
  return 'other';
}

function normalizeInterests(interests?: string[]): string {
  if (!interests || interests.length === 0) return 'none';
  
  const prioritized = interests
    .filter(i => INTEREST_PRIORITY.some(p => i.includes(p)))
    .slice(0, 3)
    .sort();
  
  if (prioritized.length === 0) {
    return interests.slice(0, 2).sort().join(',') || 'none';
  }
  
  return prioritized.join(',');
}

function normalizeIntent(intent?: string[]): string {
  if (!intent || intent.length === 0) return 'flexible';
  
  const intentOrder = ['networking', 'friends', 'discussion', 'fun', 'romance'];
  const sorted = intent
    .filter(i => intentOrder.includes(i))
    .sort((a, b) => intentOrder.indexOf(a) - intentOrder.indexOf(b));
  
  return sorted.slice(0, 2).join(',') || 'flexible';
}

/**
 * 生成画像簇哈希键
 * 格式: industry|interests|province|intent
 * 示例: "tech|美食,旅行,电影|gd|networking,friends"
 */
export function generateProfileClusterHash(profile: ProfileClusterInput): string {
  const parts = [
    normalizeIndustry(profile.industry),
    normalizeInterests(profile.topInterests),
    normalizeProvince(profile.hometownProvince),
    normalizeIntent(profile.intent),
  ];
  
  return parts.join('|');
}

/**
 * 生成带触发类型的完整缓存键
 */
export function generateGossipCacheKey(
  profile: ProfileClusterInput,
  triggerType: string
): string {
  const clusterHash = generateProfileClusterHash(profile);
  return `${triggerType}:${clusterHash}`;
}

/**
 * 从用户数据提取画像簇输入
 */
export function extractProfileClusterInput(userData: Record<string, any>): ProfileClusterInput {
  return {
    industry: userData.industry || userData.occupationDescription,
    topInterests: userData.interestsTop || userData.primaryInterests,
    hometownProvince: userData.hometownRegionCity || userData.hometown,
    intent: userData.intent,
    gender: userData.gender,
    lifeStage: userData.lifeStage,
  };
}
