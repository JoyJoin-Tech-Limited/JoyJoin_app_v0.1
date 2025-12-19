/**
 * 知识图谱 - 实体关系映射
 * 用于链式推断（如：腾讯 → 互联网 → 深圳）
 */

import type { KnowledgeNode, KnowledgeEdge } from './types';

// ============ 知名公司数据 ============

export const COMPANY_KNOWLEDGE: Array<{
  name: string;
  aliases: string[];
  industry: string;
  cities: string[];  // 可能的城市
  primaryCity: string;  // 主要城市
}> = [
  // 互联网大厂
  {
    name: '腾讯',
    aliases: ['tencent', '鹅厂', 'tx', '企鹅'],
    industry: '互联网/科技',
    cities: ['深圳', '北京', '上海', '广州', '成都'],
    primaryCity: '深圳'
  },
  {
    name: '阿里巴巴',
    aliases: ['alibaba', '阿里', '猫厂', 'ali'],
    industry: '互联网/科技',
    cities: ['杭州', '北京', '上海', '深圳'],
    primaryCity: '杭州'
  },
  {
    name: '字节跳动',
    aliases: ['bytedance', '字节', '今日头条', '抖音', 'tiktok'],
    industry: '互联网/科技',
    cities: ['北京', '上海', '深圳', '杭州'],
    primaryCity: '北京'
  },
  {
    name: '美团',
    aliases: ['meituan', '美团点评'],
    industry: '互联网/科技',
    cities: ['北京', '上海', '深圳'],
    primaryCity: '北京'
  },
  {
    name: '京东',
    aliases: ['jd', 'jingdong', '狗厂'],
    industry: '互联网/科技',
    cities: ['北京', '上海', '深圳'],
    primaryCity: '北京'
  },
  {
    name: '百度',
    aliases: ['baidu', '厂'],
    industry: '互联网/科技',
    cities: ['北京', '上海', '深圳'],
    primaryCity: '北京'
  },
  {
    name: '网易',
    aliases: ['netease', '猪厂'],
    industry: '互联网/科技',
    cities: ['杭州', '广州', '北京', '上海'],
    primaryCity: '杭州'
  },
  {
    name: '小米',
    aliases: ['xiaomi', 'mi'],
    industry: '互联网/科技',
    cities: ['北京', '武汉', '南京'],
    primaryCity: '北京'
  },
  {
    name: '华为',
    aliases: ['huawei', 'hw', '菊厂'],
    industry: '互联网/科技',
    cities: ['深圳', '东莞', '北京', '上海', '杭州', '西安', '成都'],
    primaryCity: '深圳'
  },
  {
    name: 'OPPO',
    aliases: ['oppo'],
    industry: '互联网/科技',
    cities: ['东莞', '深圳'],
    primaryCity: '东莞'
  },
  {
    name: 'VIVO',
    aliases: ['vivo'],
    industry: '互联网/科技',
    cities: ['东莞', '深圳'],
    primaryCity: '东莞'
  },
  {
    name: '大疆',
    aliases: ['dji', 'daji'],
    industry: '互联网/科技',
    cities: ['深圳'],
    primaryCity: '深圳'
  },
  {
    name: '拼多多',
    aliases: ['pdd', 'pinduoduo'],
    industry: '互联网/科技',
    cities: ['上海', '广州'],
    primaryCity: '上海'
  },
  {
    name: '滴滴',
    aliases: ['didi'],
    industry: '互联网/科技',
    cities: ['北京'],
    primaryCity: '北京'
  },
  {
    name: '快手',
    aliases: ['kuaishou', 'ks'],
    industry: '互联网/科技',
    cities: ['北京'],
    primaryCity: '北京'
  },
  {
    name: '小红书',
    aliases: ['xiaohongshu', 'red', 'xhs'],
    industry: '互联网/科技',
    cities: ['上海'],
    primaryCity: '上海'
  },
  {
    name: 'B站',
    aliases: ['bilibili', '哔哩哔哩'],
    industry: '互联网/科技',
    cities: ['上海'],
    primaryCity: '上海'
  },
  
  // 金融公司
  {
    name: '招商银行',
    aliases: ['招行', 'cmb'],
    industry: '金融',
    cities: ['深圳', '北京', '上海'],
    primaryCity: '深圳'
  },
  {
    name: '平安',
    aliases: ['中国平安', 'ping an', 'pingan'],
    industry: '金融',
    cities: ['深圳', '上海'],
    primaryCity: '深圳'
  },
  {
    name: '中金',
    aliases: ['中金公司', 'cicc'],
    industry: '金融',
    cities: ['北京', '上海', '深圳'],
    primaryCity: '北京'
  },
  {
    name: '高盛',
    aliases: ['goldman', 'gs', 'goldman sachs'],
    industry: '金融',
    cities: ['北京', '上海', '香港'],
    primaryCity: '香港'
  },
  {
    name: '摩根士丹利',
    aliases: ['morgan stanley', 'ms', '大摩'],
    industry: '金融',
    cities: ['北京', '上海', '香港'],
    primaryCity: '香港'
  },
  
  // 四大会计师事务所
  {
    name: '普华永道',
    aliases: ['pwc', '普华'],
    industry: '金融',
    cities: ['北京', '上海', '深圳', '广州', '香港'],
    primaryCity: '上海'
  },
  {
    name: '德勤',
    aliases: ['deloitte', 'dtt'],
    industry: '金融',
    cities: ['北京', '上海', '深圳', '广州', '香港'],
    primaryCity: '上海'
  },
  {
    name: '安永',
    aliases: ['ey', 'ernst young'],
    industry: '金融',
    cities: ['北京', '上海', '深圳', '广州', '香港'],
    primaryCity: '上海'
  },
  {
    name: '毕马威',
    aliases: ['kpmg'],
    industry: '金融',
    cities: ['北京', '上海', '深圳', '广州', '香港'],
    primaryCity: '上海'
  },
  
  // 咨询公司
  {
    name: '麦肯锡',
    aliases: ['mckinsey', 'mck'],
    industry: '咨询',
    cities: ['北京', '上海', '深圳', '香港'],
    primaryCity: '上海'
  },
  {
    name: '波士顿咨询',
    aliases: ['bcg', 'boston consulting'],
    industry: '咨询',
    cities: ['北京', '上海'],
    primaryCity: '上海'
  },
  {
    name: '贝恩',
    aliases: ['bain'],
    industry: '咨询',
    cities: ['北京', '上海'],
    primaryCity: '上海'
  }
];

// ============ 学校数据 ============

export const SCHOOL_KNOWLEDGE: Array<{
  name: string;
  aliases: string[];
  city: string;
  type: 'domestic' | 'overseas';
  tier: '985' | '211' | 'other' | 'ivy' | 'top_overseas';
}> = [
  // 国内顶尖高校
  { name: '清华大学', aliases: ['清华', 'thu', 'tsinghua'], city: '北京', type: 'domestic', tier: '985' },
  { name: '北京大学', aliases: ['北大', 'pku', 'peking'], city: '北京', type: 'domestic', tier: '985' },
  { name: '复旦大学', aliases: ['复旦', 'fudan'], city: '上海', type: 'domestic', tier: '985' },
  { name: '上海交通大学', aliases: ['上交', '交大', 'sjtu'], city: '上海', type: 'domestic', tier: '985' },
  { name: '浙江大学', aliases: ['浙大', 'zju'], city: '杭州', type: 'domestic', tier: '985' },
  { name: '中国科学技术大学', aliases: ['中科大', 'ustc'], city: '合肥', type: 'domestic', tier: '985' },
  { name: '南京大学', aliases: ['南大', 'nju'], city: '南京', type: 'domestic', tier: '985' },
  { name: '中山大学', aliases: ['中大', 'sysu'], city: '广州', type: 'domestic', tier: '985' },
  { name: '华南理工大学', aliases: ['华工', 'scut'], city: '广州', type: 'domestic', tier: '985' },
  { name: '深圳大学', aliases: ['深大', 'szu'], city: '深圳', type: 'domestic', tier: 'other' },
  { name: '香港大学', aliases: ['港大', 'hku'], city: '香港', type: 'domestic', tier: '985' },
  { name: '香港中文大学', aliases: ['港中文', 'cuhk'], city: '香港', type: 'domestic', tier: '985' },
  { name: '香港科技大学', aliases: ['港科大', 'hkust'], city: '香港', type: 'domestic', tier: '985' },
  
  // 海外顶尖高校
  { name: '哈佛大学', aliases: ['哈佛', 'harvard'], city: '波士顿', type: 'overseas', tier: 'ivy' },
  { name: '斯坦福大学', aliases: ['斯坦福', 'stanford'], city: '硅谷', type: 'overseas', tier: 'top_overseas' },
  { name: '麻省理工', aliases: ['MIT', '麻省理工学院'], city: '波士顿', type: 'overseas', tier: 'top_overseas' },
  { name: '牛津大学', aliases: ['牛津', 'oxford'], city: '牛津', type: 'overseas', tier: 'top_overseas' },
  { name: '剑桥大学', aliases: ['剑桥', 'cambridge'], city: '剑桥', type: 'overseas', tier: 'top_overseas' },
  { name: '耶鲁大学', aliases: ['耶鲁', 'yale'], city: '纽黑文', type: 'overseas', tier: 'ivy' },
  { name: '普林斯顿大学', aliases: ['普林斯顿', 'princeton'], city: '普林斯顿', type: 'overseas', tier: 'ivy' },
  { name: '哥伦比亚大学', aliases: ['哥大', 'columbia'], city: '纽约', type: 'overseas', tier: 'ivy' },
  { name: '宾夕法尼亚大学', aliases: ['宾大', 'upenn', 'penn'], city: '费城', type: 'overseas', tier: 'ivy' },
  { name: '加州大学伯克利分校', aliases: ['伯克利', 'berkeley', 'ucb'], city: '旧金山', type: 'overseas', tier: 'top_overseas' },
  { name: '加州大学洛杉矶分校', aliases: ['UCLA'], city: '洛杉矶', type: 'overseas', tier: 'top_overseas' },
  { name: '纽约大学', aliases: ['NYU'], city: '纽约', type: 'overseas', tier: 'top_overseas' },
  { name: '帝国理工学院', aliases: ['帝国理工', 'imperial', 'ic'], city: '伦敦', type: 'overseas', tier: 'top_overseas' },
  { name: '伦敦政治经济学院', aliases: ['LSE'], city: '伦敦', type: 'overseas', tier: 'top_overseas' },
  { name: '墨尔本大学', aliases: ['墨大', 'unimelb'], city: '墨尔本', type: 'overseas', tier: 'top_overseas' },
  { name: '悉尼大学', aliases: ['悉大', 'usyd'], city: '悉尼', type: 'overseas', tier: 'top_overseas' },
  { name: '多伦多大学', aliases: ['多大', 'uoft'], city: '多伦多', type: 'overseas', tier: 'top_overseas' },
  { name: '新加坡国立大学', aliases: ['NUS', '国大'], city: '新加坡', type: 'overseas', tier: 'top_overseas' }
];

// ============ 城市数据 ============

export const CITY_KNOWLEDGE: Array<{
  name: string;
  aliases: string[];
  region: string;
  tier: '一线' | '新一线' | '二线' | '海外';
}> = [
  // 一线城市
  { name: '北京', aliases: ['帝都', '首都', '京城', 'beijing'], region: '华北', tier: '一线' },
  { name: '上海', aliases: ['魔都', '沪', 'shanghai'], region: '华东', tier: '一线' },
  { name: '广州', aliases: ['羊城', '穗', 'guangzhou'], region: '华南', tier: '一线' },
  { name: '深圳', aliases: ['鹏城', 'shenzhen'], region: '华南', tier: '一线' },
  
  // 新一线城市
  { name: '杭州', aliases: ['hangzhou'], region: '华东', tier: '新一线' },
  { name: '成都', aliases: ['蓉城', 'chengdu'], region: '西南', tier: '新一线' },
  { name: '重庆', aliases: ['山城', 'chongqing'], region: '西南', tier: '新一线' },
  { name: '武汉', aliases: ['江城', 'wuhan'], region: '华中', tier: '新一线' },
  { name: '西安', aliases: ['长安', 'xian'], region: '西北', tier: '新一线' },
  { name: '南京', aliases: ['金陵', 'nanjing'], region: '华东', tier: '新一线' },
  { name: '苏州', aliases: ['suzhou'], region: '华东', tier: '新一线' },
  { name: '天津', aliases: ['tianjin'], region: '华北', tier: '新一线' },
  { name: '长沙', aliases: ['changsha'], region: '华中', tier: '新一线' },
  { name: '东莞', aliases: ['dongguan'], region: '华南', tier: '新一线' },
  { name: '佛山', aliases: ['foshan'], region: '华南', tier: '新一线' },
  { name: '珠海', aliases: ['zhuhai'], region: '华南', tier: '二线' },
  
  // 特别行政区
  { name: '香港', aliases: ['HK', 'hongkong', '港'], region: '华南', tier: '一线' },
  { name: '澳门', aliases: ['macau'], region: '华南', tier: '二线' },
  
  // 海外城市
  { name: '纽约', aliases: ['new york', 'nyc'], region: '北美', tier: '海外' },
  { name: '旧金山', aliases: ['san francisco', 'sf', '湾区'], region: '北美', tier: '海外' },
  { name: '洛杉矶', aliases: ['los angeles', 'la'], region: '北美', tier: '海外' },
  { name: '伦敦', aliases: ['london'], region: '欧洲', tier: '海外' },
  { name: '东京', aliases: ['tokyo'], region: '亚太', tier: '海外' },
  { name: '新加坡', aliases: ['singapore', '坡县'], region: '亚太', tier: '海外' },
  { name: '悉尼', aliases: ['sydney'], region: '大洋洲', tier: '海外' },
  { name: '多伦多', aliases: ['toronto'], region: '北美', tier: '海外' }
];

// ============ 知识图谱查询函数 ============

/**
 * 根据公司名查找信息
 */
export function findCompanyInfo(text: string): {
  found: boolean;
  company?: string;
  industry?: string;
  cities?: string[];
  primaryCity?: string;
  confidence: number;
} {
  const textLower = text.toLowerCase();
  
  for (const company of COMPANY_KNOWLEDGE) {
    // 检查公司名或别名
    const allNames = [company.name, ...company.aliases];
    const matched = allNames.some(name => 
      textLower.includes(name.toLowerCase())
    );
    
    if (matched) {
      return {
        found: true,
        company: company.name,
        industry: company.industry,
        cities: company.cities,
        primaryCity: company.primaryCity,
        confidence: 0.9
      };
    }
  }
  
  return { found: false, confidence: 0 };
}

/**
 * 根据学校名查找信息
 */
export function findSchoolInfo(text: string): {
  found: boolean;
  school?: string;
  city?: string;
  isOverseas?: boolean;
  tier?: string;
  confidence: number;
} {
  const textLower = text.toLowerCase();
  
  for (const school of SCHOOL_KNOWLEDGE) {
    const allNames = [school.name, ...school.aliases];
    const matched = allNames.some(name => 
      textLower.includes(name.toLowerCase())
    );
    
    if (matched) {
      return {
        found: true,
        school: school.name,
        city: school.city,
        isOverseas: school.type === 'overseas',
        tier: school.tier,
        confidence: 0.92
      };
    }
  }
  
  return { found: false, confidence: 0 };
}

/**
 * 根据城市名查找信息
 */
export function findCityInfo(text: string): {
  found: boolean;
  city?: string;
  region?: string;
  tier?: string;
  confidence: number;
} {
  const textLower = text.toLowerCase();
  
  for (const city of CITY_KNOWLEDGE) {
    const allNames = [city.name, ...city.aliases];
    const matched = allNames.some(name => 
      textLower.includes(name.toLowerCase())
    );
    
    if (matched) {
      return {
        found: true,
        city: city.name,
        region: city.region,
        tier: city.tier,
        confidence: 0.95
      };
    }
  }
  
  return { found: false, confidence: 0 };
}

/**
 * 综合实体识别
 */
export function extractEntities(text: string): {
  companies: string[];
  schools: string[];
  cities: string[];
  industries: string[];
} {
  const result = {
    companies: [] as string[],
    schools: [] as string[],
    cities: [] as string[],
    industries: [] as string[]
  };
  
  const companyInfo = findCompanyInfo(text);
  if (companyInfo.found && companyInfo.company) {
    result.companies.push(companyInfo.company);
    if (companyInfo.industry) {
      result.industries.push(companyInfo.industry);
    }
  }
  
  const schoolInfo = findSchoolInfo(text);
  if (schoolInfo.found && schoolInfo.school) {
    result.schools.push(schoolInfo.school);
  }
  
  const cityInfo = findCityInfo(text);
  if (cityInfo.found && cityInfo.city) {
    result.cities.push(cityInfo.city);
  }
  
  return result;
}

/**
 * 链式推断：从实体推断其他属性
 */
export function chainInference(text: string): Array<{
  field: string;
  value: string;
  confidence: number;
  evidence: string;
  reasoning: string;
}> {
  const inferences: Array<{
    field: string;
    value: string;
    confidence: number;
    evidence: string;
    reasoning: string;
  }> = [];
  
  // 公司 → 行业 → 城市
  const companyInfo = findCompanyInfo(text);
  if (companyInfo.found) {
    // 推断行业
    if (companyInfo.industry) {
      inferences.push({
        field: 'industry',
        value: companyInfo.industry,
        confidence: 0.92,
        evidence: `提到了${companyInfo.company}`,
        reasoning: `${companyInfo.company}是${companyInfo.industry}公司`
      });
    }
    
    // 推断城市（较低置信度，因为大公司有多个办公室）
    if (companyInfo.primaryCity && companyInfo.cities && companyInfo.cities.length === 1) {
      inferences.push({
        field: 'city',
        value: companyInfo.primaryCity,
        confidence: 0.75,
        evidence: `提到在${companyInfo.company}工作`,
        reasoning: `${companyInfo.company}总部在${companyInfo.primaryCity}`
      });
    } else if (companyInfo.primaryCity) {
      // 多城市公司，置信度更低
      inferences.push({
        field: 'city',
        value: companyInfo.primaryCity,
        confidence: 0.5,
        evidence: `提到在${companyInfo.company}工作`,
        reasoning: `${companyInfo.company}总部在${companyInfo.primaryCity}，但有多个办公室`
      });
    }
  }
  
  // 学校 → 城市 + 海归标签
  const schoolInfo = findSchoolInfo(text);
  if (schoolInfo.found) {
    if (schoolInfo.isOverseas) {
      inferences.push({
        field: 'isReturnee',
        value: 'true',
        confidence: 0.88,
        evidence: `提到了${schoolInfo.school}`,
        reasoning: `${schoolInfo.school}是海外院校`
      });
      
      inferences.push({
        field: 'languages',
        value: '英语',
        confidence: 0.8,
        evidence: `就读海外院校${schoolInfo.school}`,
        reasoning: '海外留学通常具备英语能力'
      });
    }
  }
  
  return inferences;
}
