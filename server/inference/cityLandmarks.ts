/**
 * 城市地标知识库
 * 
 * 用于通过地标/商圈/地铁站等推断用户所在城市
 * 覆盖港深广沪京等主要城市，约150条高频地标
 */

export interface CityLandmark {
  name: string;
  aliases: string[];
  city: string;
  type: 'district' | 'landmark' | 'mall' | 'metro' | 'area';
  confidence: number;
}

export const CITY_LANDMARKS: CityLandmark[] = [
  // ============ 深圳 ============
  // 区域/街道
  { name: '南山', aliases: ['南山区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '福田', aliases: ['福田区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '罗湖', aliases: ['罗湖区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '宝安', aliases: ['宝安区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '龙华', aliases: ['龙华区'], city: '深圳', type: 'district', confidence: 0.9 },
  { name: '龙岗', aliases: ['龙岗区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '盐田', aliases: ['盐田区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '光明', aliases: ['光明区'], city: '深圳', type: 'district', confidence: 0.9 },
  { name: '坪山', aliases: ['坪山区'], city: '深圳', type: 'district', confidence: 0.95 },
  { name: '大鹏', aliases: ['大鹏新区'], city: '深圳', type: 'district', confidence: 0.95 },
  
  // 知名地标/商务区
  { name: '科技园', aliases: ['南山科技园', '高新园', '深圳科技园'], city: '深圳', type: 'area', confidence: 0.95 },
  { name: '粤海街道', aliases: ['粤海', '宇宙中心粤海'], city: '深圳', type: 'area', confidence: 0.98 },
  { name: '前海', aliases: ['前海自贸区', '前海湾'], city: '深圳', type: 'area', confidence: 0.95 },
  { name: '后海', aliases: ['后海总部基地'], city: '深圳', type: 'area', confidence: 0.95 },
  { name: '蛇口', aliases: ['蛇口港', '海上世界'], city: '深圳', type: 'area', confidence: 0.95 },
  { name: '车公庙', aliases: ['车公庙CBD'], city: '深圳', type: 'area', confidence: 0.98 },
  { name: '华强北', aliases: ['华强'], city: '深圳', type: 'area', confidence: 0.98 },
  { name: '东门', aliases: ['东门老街'], city: '深圳', type: 'area', confidence: 0.9 },
  { name: '坂田', aliases: ['坂田华为'], city: '深圳', type: 'area', confidence: 0.95 },
  { name: '西丽', aliases: ['西丽湖'], city: '深圳', type: 'area', confidence: 0.95 },
  { name: '留仙洞', aliases: ['留仙洞总部基地'], city: '深圳', type: 'area', confidence: 0.98 },
  
  // 商场
  { name: '海岸城', aliases: ['南山海岸城'], city: '深圳', type: 'mall', confidence: 0.95 },
  { name: '万象城', aliases: ['深圳万象城', '罗湖万象城'], city: '深圳', type: 'mall', confidence: 0.7 },
  { name: '万象天地', aliases: ['深圳万象天地'], city: '深圳', type: 'mall', confidence: 0.95 },
  { name: '欢乐海岸', aliases: [], city: '深圳', type: 'mall', confidence: 0.95 },
  { name: 'cocopark', aliases: ['coco park', '购物公园'], city: '深圳', type: 'mall', confidence: 0.9 },
  { name: '壹方城', aliases: ['宝安壹方城'], city: '深圳', type: 'mall', confidence: 0.95 },
  { name: '来福士', aliases: ['深圳来福士'], city: '深圳', type: 'mall', confidence: 0.7 },
  
  // 地铁站（特色站点）
  { name: '深圳北站', aliases: ['深圳北', '北站'], city: '深圳', type: 'metro', confidence: 0.95 },
  { name: '福田口岸', aliases: ['福田口岸站'], city: '深圳', type: 'metro', confidence: 0.98 },
  { name: '皇岗口岸', aliases: ['皇岗'], city: '深圳', type: 'metro', confidence: 0.98 },
  { name: '罗湖口岸', aliases: ['罗湖站'], city: '深圳', type: 'metro', confidence: 0.95 },
  { name: '世界之窗', aliases: [], city: '深圳', type: 'landmark', confidence: 0.98 },
  { name: '欢乐谷', aliases: ['深圳欢乐谷'], city: '深圳', type: 'landmark', confidence: 0.9 },
  
  // ============ 香港 ============
  // 区域
  { name: '中环', aliases: ['Central'], city: '香港', type: 'district', confidence: 0.95 },
  { name: '金钟', aliases: ['Admiralty'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '湾仔', aliases: ['Wanchai', '灣仔'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '铜锣湾', aliases: ['Causeway Bay', '銅鑼灣', 'CWB'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '尖沙咀', aliases: ['TST', '尖沙嘴', '尖咀'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '旺角', aliases: ['Mongkok', '旺角站'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '太古', aliases: ['Taikoo', '太古城'], city: '香港', type: 'district', confidence: 0.95 },
  { name: '�的蓟仔', aliases: ['Quarry Bay', '鰂魚涌'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '九龙塘', aliases: ['Kowloon Tong'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '观塘', aliases: ['Kwun Tong', '觀塘'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '荃湾', aliases: ['Tsuen Wan'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '沙田', aliases: ['Sha Tin'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '上环', aliases: ['Sheung Wan'], city: '香港', type: 'district', confidence: 0.98 },
  { name: '西九龙', aliases: ['West Kowloon'], city: '香港', type: 'district', confidence: 0.95 },
  
  // 地标
  { name: 'IFC', aliases: ['国际金融中心', '國際金融中心'], city: '香港', type: 'landmark', confidence: 0.95 },
  { name: 'ICC', aliases: ['环球贸易广场', '環球貿易廣場'], city: '香港', type: 'landmark', confidence: 0.98 },
  { name: '兰桂坊', aliases: ['Lan Kwai Fong', 'LKF', '蘭桂坊'], city: '香港', type: 'landmark', confidence: 0.98 },
  { name: '维多利亚港', aliases: ['维港', '維港', 'Victoria Harbour'], city: '香港', type: 'landmark', confidence: 0.95 },
  { name: '海港城', aliases: ['Harbour City'], city: '香港', type: 'mall', confidence: 0.98 },
  { name: 'K11', aliases: ['K11 Musea', 'K11购物艺术馆'], city: '香港', type: 'mall', confidence: 0.9 },
  { name: '时代广场', aliases: ['Times Square'], city: '香港', type: 'mall', confidence: 0.8 },
  { name: '太古广场', aliases: ['Pacific Place'], city: '香港', type: 'mall', confidence: 0.98 },
  { name: '数码港', aliases: ['Cyberport'], city: '香港', type: 'area', confidence: 0.98 },
  { name: '科学园', aliases: ['Science Park', '香港科学园'], city: '香港', type: 'area', confidence: 0.95 },
  
  // ============ 广州 ============
  { name: '天河', aliases: ['天河区'], city: '广州', type: 'district', confidence: 0.95 },
  { name: '珠江新城', aliases: ['CBD', '广州CBD'], city: '广州', type: 'area', confidence: 0.95 },
  { name: '越秀', aliases: ['越秀区'], city: '广州', type: 'district', confidence: 0.95 },
  { name: '海珠', aliases: ['海珠区'], city: '广州', type: 'district', confidence: 0.95 },
  { name: '番禺', aliases: ['番禺区'], city: '广州', type: 'district', confidence: 0.95 },
  { name: '白云', aliases: ['白云区'], city: '广州', type: 'district', confidence: 0.85 },
  { name: '黄埔', aliases: ['黄埔区'], city: '广州', type: 'district', confidence: 0.9 },
  { name: '琶洲', aliases: ['琶洲互联网集聚区'], city: '广州', type: 'area', confidence: 0.98 },
  { name: '体育西', aliases: ['体育西路'], city: '广州', type: 'metro', confidence: 0.95 },
  { name: '北京路', aliases: ['北京路步行街'], city: '广州', type: 'landmark', confidence: 0.9 },
  { name: '太古汇', aliases: ['广州太古汇'], city: '广州', type: 'mall', confidence: 0.95 },
  { name: '正佳广场', aliases: ['正佳'], city: '广州', type: 'mall', confidence: 0.98 },
  { name: '天环', aliases: ['天环广场'], city: '广州', type: 'mall', confidence: 0.98 },
  { name: '小蛮腰', aliases: ['广州塔', 'Canton Tower'], city: '广州', type: 'landmark', confidence: 0.98 },
  
  // ============ 上海 ============
  { name: '浦东', aliases: ['浦东新区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '陆家嘴', aliases: ['LJZ'], city: '上海', type: 'area', confidence: 0.98 },
  { name: '静安', aliases: ['静安区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '徐汇', aliases: ['徐汇区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '黄浦', aliases: ['黄浦区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '长宁', aliases: ['长宁区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '虹口', aliases: ['虹口区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '杨浦', aliases: ['杨浦区'], city: '上海', type: 'district', confidence: 0.95 },
  { name: '张江', aliases: ['张江高科', '张江科学城'], city: '上海', type: 'area', confidence: 0.98 },
  { name: '漕河泾', aliases: ['漕河泾开发区'], city: '上海', type: 'area', confidence: 0.98 },
  { name: '虹桥', aliases: ['虹桥商务区', '虹桥枢纽'], city: '上海', type: 'area', confidence: 0.9 },
  { name: '南京路', aliases: ['南京东路', '南京西路'], city: '上海', type: 'landmark', confidence: 0.9 },
  { name: '外滩', aliases: ['the Bund'], city: '上海', type: 'landmark', confidence: 0.95 },
  { name: '新天地', aliases: ['上海新天地'], city: '上海', type: 'landmark', confidence: 0.9 },
  { name: '田子坊', aliases: [], city: '上海', type: 'landmark', confidence: 0.98 },
  { name: '静安寺', aliases: [], city: '上海', type: 'landmark', confidence: 0.95 },
  { name: '人民广场', aliases: [], city: '上海', type: 'landmark', confidence: 0.85 },
  { name: '淮海路', aliases: ['淮海中路'], city: '上海', type: 'landmark', confidence: 0.95 },
  { name: '恒隆广场', aliases: ['上海恒隆'], city: '上海', type: 'mall', confidence: 0.9 },
  { name: '环球港', aliases: ['上海环球港'], city: '上海', type: 'mall', confidence: 0.95 },
  { name: 'iapm', aliases: ['上海iapm'], city: '上海', type: 'mall', confidence: 0.95 },
  
  // ============ 北京 ============
  { name: '朝阳', aliases: ['朝阳区'], city: '北京', type: 'district', confidence: 0.95 },
  { name: '海淀', aliases: ['海淀区'], city: '北京', type: 'district', confidence: 0.95 },
  { name: '西城', aliases: ['西城区'], city: '北京', type: 'district', confidence: 0.95 },
  { name: '东城', aliases: ['东城区'], city: '北京', type: 'district', confidence: 0.95 },
  { name: '丰台', aliases: ['丰台区'], city: '北京', type: 'district', confidence: 0.95 },
  { name: '大兴', aliases: ['大兴区'], city: '北京', type: 'district', confidence: 0.95 },
  { name: '中关村', aliases: ['ZGC', '中关村软件园'], city: '北京', type: 'area', confidence: 0.98 },
  { name: '望京', aliases: ['望京SOHO'], city: '北京', type: 'area', confidence: 0.98 },
  { name: '国贸', aliases: ['国贸CBD', 'CBD'], city: '北京', type: 'area', confidence: 0.9 },
  { name: '三里屯', aliases: ['三里屯太古里'], city: '北京', type: 'landmark', confidence: 0.98 },
  { name: '亦庄', aliases: ['亦庄经开区', '北京经济技术开发区'], city: '北京', type: 'area', confidence: 0.98 },
  { name: '西二旗', aliases: ['后厂村', '后厂村路'], city: '北京', type: 'area', confidence: 0.98 },
  { name: '五道口', aliases: ['宇宙中心'], city: '北京', type: 'area', confidence: 0.95 },
  { name: '上地', aliases: ['上地软件园'], city: '北京', type: 'area', confidence: 0.98 },
  { name: '金融街', aliases: ['北京金融街'], city: '北京', type: 'area', confidence: 0.95 },
  { name: '王府井', aliases: [], city: '北京', type: 'landmark', confidence: 0.95 },
  { name: 'SKP', aliases: ['北京SKP'], city: '北京', type: 'mall', confidence: 0.9 },
  { name: '合生汇', aliases: ['北京合生汇'], city: '北京', type: 'mall', confidence: 0.9 },
  { name: '颐堤港', aliases: ['Indigo'], city: '北京', type: 'mall', confidence: 0.95 },
  
  // ============ 杭州 ============
  { name: '西湖区', aliases: ['西湖'], city: '杭州', type: 'district', confidence: 0.9 },
  { name: '滨江', aliases: ['滨江区', '杭州滨江'], city: '杭州', type: 'district', confidence: 0.95 },
  { name: '余杭', aliases: ['余杭区'], city: '杭州', type: 'district', confidence: 0.95 },
  { name: '未来科技城', aliases: ['阿里巴巴西溪园区', '西溪'], city: '杭州', type: 'area', confidence: 0.95 },
  { name: '钱江新城', aliases: ['杭州CBD'], city: '杭州', type: 'area', confidence: 0.98 },
  { name: '武林广场', aliases: ['武林'], city: '杭州', type: 'landmark', confidence: 0.95 },
  { name: '龙翔桥', aliases: [], city: '杭州', type: 'metro', confidence: 0.98 },
];

/**
 * 从文本中识别城市
 */
export function recognizeCityFromText(text: string): { city: string; confidence: number; evidence: string } | null {
  const lowerText = text.toLowerCase();
  let bestMatch: { city: string; confidence: number; evidence: string } | null = null;
  
  for (const landmark of CITY_LANDMARKS) {
    const allNames = [landmark.name.toLowerCase(), ...landmark.aliases.map(a => a.toLowerCase())];
    
    for (const name of allNames) {
      if (lowerText.includes(name)) {
        if (!bestMatch || landmark.confidence > bestMatch.confidence) {
          bestMatch = {
            city: landmark.city,
            confidence: landmark.confidence,
            evidence: landmark.name
          };
        }
      }
    }
  }
  
  return bestMatch;
}

/**
 * 获取某城市的所有地标关键词（用于正则匹配）
 */
export function getCityKeywords(city: string): string[] {
  const keywords: string[] = [];
  
  for (const landmark of CITY_LANDMARKS) {
    if (landmark.city === city) {
      keywords.push(landmark.name);
      keywords.push(...landmark.aliases);
    }
  }
  
  return keywords;
}

/**
 * 生成城市识别正则表达式
 */
export function buildCityRegex(city: string): RegExp {
  const keywords = getCityKeywords(city);
  const escapedKeywords = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(escapedKeywords.join('|'), 'i');
}
