/**
 * 内容过滤模块 - 敏感词检测
 * 检测政治、色情、暴力等敏感内容
 */

export type ViolationType = 'political' | 'pornographic' | 'violent' | 'spam' | 'harassment' | 'illegal';

export interface ContentFilterResult {
  isViolation: boolean;
  violationType?: ViolationType;
  severity: 'none' | 'warning' | 'severe';
  matchedKeywords: string[];
  message?: string;
}

const sensitiveWordLists: Record<ViolationType, { keywords: string[]; severity: 'warning' | 'severe' }> = {
  political: {
    keywords: [
      '共产党', '国民党', '习近平', '毛泽东', '六四', '天安门', '法轮功', 
      '台独', '藏独', '疆独', '民运', '反党', '颠覆政权', '推翻政府',
      '专制', '独裁', '维尼熊', '膜蛤', '翻墙', '防火长城'
    ],
    severity: 'severe'
  },
  pornographic: {
    keywords: [
      '约炮', '一夜情', '做爱', '性交', '口交', '肛交', '自慰', '手淫',
      '阴茎', '阴道', '乳房', '裸体', '色情', '黄片', 'AV', '成人片',
      '嫖娼', '卖淫', '援交', '包养', '情人', '小三', '出轨'
    ],
    severity: 'severe'
  },
  violent: {
    keywords: [
      '杀人', '谋杀', '自杀', '枪击', '爆炸', '恐怖袭击', '绑架', '强奸',
      '虐待', '酷刑', '血腥', '砍死', '打死', '弄死'
    ],
    severity: 'severe'
  },
  harassment: {
    keywords: [
      '傻逼', '操你妈', '草泥马', '你妈死了', '去死', '滚蛋', '废物',
      '垃圾', '白痴', '智障', '脑残', '神经病', '变态', '恶心'
    ],
    severity: 'warning'
  },
  spam: {
    keywords: [
      '微信', 'QQ', '加我', '联系方式', '手机号', '电话', '私聊',
      '免费领取', '点击链接', '扫码', '转账', '红包', '抽奖', '中奖'
    ],
    severity: 'warning'
  },
  illegal: {
    keywords: [
      '毒品', '冰毒', '海洛因', '大麻', '赌博', '洗钱', '诈骗', 
      '偷盗', '抢劫', '走私', '贩卖', '传销'
    ],
    severity: 'severe'
  }
};

export function filterContent(text: string): ContentFilterResult {
  const lowerText = text.toLowerCase();
  const matchedKeywords: string[] = [];
  let highestSeverity: 'none' | 'warning' | 'severe' = 'none';
  let violationType: ViolationType | undefined;

  for (const [type, config] of Object.entries(sensitiveWordLists) as [ViolationType, { keywords: string[]; severity: 'warning' | 'severe' }][]) {
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
        if (config.severity === 'severe' || (config.severity === 'warning' && highestSeverity === 'none')) {
          highestSeverity = config.severity;
          violationType = type;
        }
      }
    }
  }

  if (matchedKeywords.length === 0) {
    return {
      isViolation: false,
      severity: 'none',
      matchedKeywords: []
    };
  }

  const messages: Record<ViolationType, string> = {
    political: '您的消息包含敏感政治内容，请保持友好的对话氛围。',
    pornographic: '您的消息包含不当内容，请遵守社区规范。',
    violent: '您的消息包含暴力相关内容，请保持文明对话。',
    harassment: '您的消息包含不友好内容，请尊重他人。',
    spam: '您的消息包含疑似广告或联系方式，请遵守社区规范。',
    illegal: '您的消息包含违规内容，请遵守法律法规。'
  };

  return {
    isViolation: true,
    violationType,
    severity: highestSeverity,
    matchedKeywords,
    message: violationType ? messages[violationType] : '您的消息包含敏感内容，请修改后重试。'
  };
}

export function detectGibberish(text: string): boolean {
  if (text.length < 3) return false;
  
  const repeatedCharPattern = /(.)\1{4,}/;
  if (repeatedCharPattern.test(text)) return true;
  
  const randomCharsPattern = /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{10,}$/;
  if (randomCharsPattern.test(text) && !/\s/.test(text)) {
    const uniqueChars = new Set(text.toLowerCase()).size;
    if (uniqueChars < text.length * 0.3) return true;
  }
  
  const keyboardSmashPattern = /[asdfghjkl]{5,}|[qwertyuiop]{5,}|[zxcvbnm]{5,}/i;
  if (keyboardSmashPattern.test(text)) return true;
  
  return false;
}

export function detectRepetition(text: string): boolean {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) return false;
  
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    const lower = word.toLowerCase();
    wordCounts.set(lower, (wordCounts.get(lower) || 0) + 1);
  }
  
  for (const [, count] of wordCounts) {
    if (count >= 5 && count / words.length > 0.5) {
      return true;
    }
  }
  
  return false;
}
