/**
 * Lie Detective V2 — Curated Fallback Statement Pool
 * 36 pre-written sets (3 per archetype × 12 archetypes) used when AI
 * generation fails (degrade chain final fallback)
 *
 * Each set: 2 true statements (from archetype-matched tags) + 1 plausible AI fake.
 * All statement texts are ≤ 30 characters to fit mobile UI constraints.
 */

export interface LieDetectiveV2FallbackStatement {
  index: 1 | 2 | 3;
  text: string;
  is_ai: boolean;
  source_tag: string | null;
}

export interface LieDetectiveV2FallbackSet {
  /** Canonical archetype machine ID (e.g., 'corgi', 'owl') */
  archetype: string;
  statements: [
    LieDetectiveV2FallbackStatement,
    LieDetectiveV2FallbackStatement,
    LieDetectiveV2FallbackStatement,
  ];
}

export const LIE_DETECTIVE_V2_FALLBACK_SETS: LieDetectiveV2FallbackSet[] = [
  // ═══════════════════════════════════════════════════════════════
  //  社牛柯基 (corgi) — outgoing, energetic, humorous ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'corgi',
    statements: [
      { index: 1, text: '聚会冷场时我会主动讲段子', is_ai: false, source_tag: '讲段子' },
      { index: 2, text: 'KTV里我总是第一个抢麦', is_ai: false, source_tag: 'KTV麦霸' },
      { index: 3, text: '我养了一只柯基叫火锅', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'corgi',
    statements: [
      { index: 1, text: '我能和陌生人聊成老朋友', is_ai: false, source_tag: '聚会达人' },
      { index: 2, text: '手机里有五千个表情包', is_ai: false, source_tag: '表情包大户' },
      { index: 3, text: '我曾经在地铁上即兴演讲', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'corgi',
    statements: [
      { index: 1, text: '我讲冷笑话自己先笑场', is_ai: false, source_tag: '冷笑话' },
      { index: 2, text: '新同事第一天就被我带去吃饭', is_ai: false, source_tag: '组饭搭子' },
      { index: 3, text: '我在朋友婚礼上救场唱过歌', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  小太阳鸡 (rooster) — warm, positive, stable ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'rooster',
    statements: [
      { index: 1, text: '我已经连续五年六点起床', is_ai: false, source_tag: '早起达人' },
      { index: 2, text: '朋友难过时我会先倾听', is_ai: false, source_tag: '安慰别人' },
      { index: 3, text: '我每天晨跑十公里', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'rooster',
    statements: [
      { index: 1, text: '我会给每天拍一张天空照', is_ai: false, source_tag: '记录生活' },
      { index: 2, text: '压力大时我会做一桌子菜', is_ai: false, source_tag: '做饭治愈' },
      { index: 3, text: '我考过厨师证二级', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'rooster',
    statements: [
      { index: 1, text: '我给绿植浇水三年没断过', is_ai: false, source_tag: '养绿植' },
      { index: 2, text: '我是朋友圈的早安担当', is_ai: false, source_tag: '早安问候' },
      { index: 3, text: '我跑完过一次全程马拉松', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  夸夸仓鼠 (hamster_praise) — encouraging, warm ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'hamster_praise',
    statements: [
      { index: 1, text: '我会记住朋友的小进步', is_ai: false, source_tag: '夸夸群员' },
      { index: 2, text: '我喜欢亲手做礼物送人', is_ai: false, source_tag: '手工礼物' },
      { index: 3, text: '我做过三个月主播', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'hamster_praise',
    statements: [
      { index: 1, text: '我能发现别人换了新发型', is_ai: false, source_tag: '细心观察' },
      { index: 2, text: '每年年末我给朋友写贺卡', is_ai: false, source_tag: '写感谢卡' },
      { index: 3, text: '我大学是辩论队队长', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'hamster_praise',
    statements: [
      { index: 1, text: '我夸人一定会夸到细节上', is_ai: false, source_tag: '细节夸夸' },
      { index: 2, text: '同事低落时我会递小零食', is_ai: false, source_tag: '投喂安慰' },
      { index: 3, text: '我做过婚礼司仪', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  寻宝狐 (fox) — curious, adventurous, discovers ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'fox',
    statements: [
      { index: 1, text: '我知道城里所有隐藏小店', is_ai: false, source_tag: '探店达人' },
      { index: 2, text: '我收藏了三百部冷门电影', is_ai: false, source_tag: '小众电影' },
      { index: 3, text: '我独自穿越过沙漠', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'fox',
    statements: [
      { index: 1, text: '我每周六都随机坐公交玩', is_ai: false, source_tag: 'citywalk' },
      { index: 2, text: '我在旧货市场淘到过宝', is_ai: false, source_tag: '二手淘宝' },
      { index: 3, text: '我懂六种方言', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'fox',
    statements: [
      { index: 1, text: '我爱逛菜市场找时令菜', is_ai: false, source_tag: '逛菜市场' },
      { index: 2, text: '我的地图收藏夹全是小店', is_ai: false, source_tag: '收藏小店' },
      { index: 3, text: '我徒步走完过川藏线', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  机灵海豚 (dolphin_calm) — empathetic, reads room ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'dolphin_calm',
    statements: [
      { index: 1, text: '我能感觉到谁今天不开心', is_ai: false, source_tag: '察言观色' },
      { index: 2, text: '我常用一句话化解冷场', is_ai: false, source_tag: '化解尴尬' },
      { index: 3, text: '我学过三年心理学', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'dolphin_calm',
    statements: [
      { index: 1, text: '我记得朋友提过的小喜好', is_ai: false, source_tag: '记住细节' },
      { index: 2, text: '聚会吵架时我会打圆场', is_ai: false, source_tag: '调和气氛' },
      { index: 3, text: '我是家里排行老大', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'dolphin_calm',
    statements: [
      { index: 1, text: '朋友换头像我能猜出心情', is_ai: false, source_tag: '读心日常' },
      { index: 2, text: '我递台阶的速度特别快', is_ai: false, source_tag: '递台阶' },
      { index: 3, text: '我做过电台深夜节目主播', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  人脉蛛 (spider) — connector, weaves relationships ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'spider',
    statements: [
      { index: 1, text: '我促成过两对朋友成为好友', is_ai: false, source_tag: '牵线搭桥' },
      { index: 2, text: '我擅长把不同圈子凑一起', is_ai: false, source_tag: '组局达人' },
      { index: 3, text: '我写过一本聚会指南', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'spider',
    statements: [
      { index: 1, text: '我记得所有朋友的生日', is_ai: false, source_tag: '记住生日' },
      { index: 2, text: '我能快速找到两人的交集', is_ai: false, source_tag: '发现共同点' },
      { index: 3, text: '我组织过百人相亲', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'spider',
    statements: [
      { index: 1, text: '我的通讯录按特长分了组', is_ai: false, source_tag: '通讯录分组' },
      { index: 2, text: '拼桌吃饭我也能攒成熟人', is_ai: false, source_tag: '攒局达人' },
      { index: 3, text: '我策划过百人城市徒步', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  树洞考拉 (koala) — gentle, listener, storyteller ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'koala',
    statements: [
      { index: 1, text: '朋友凌晨三点也找我聊天', is_ai: false, source_tag: '深夜倾听' },
      { index: 2, text: '我写日记已经写了十二年', is_ai: false, source_tag: '写日记' },
      { index: 3, text: '我养过一只考拉', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'koala',
    statements: [
      { index: 1, text: '我有一套专门的茶具', is_ai: false, source_tag: '泡茶静心' },
      { index: 2, text: '我能把平凡小事讲得有趣', is_ai: false, source_tag: '编故事' },
      { index: 3, text: '我出过一本散文集', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'koala',
    statements: [
      { index: 1, text: '我听人倾诉从不打断', is_ai: false, source_tag: '耐心倾听' },
      { index: 2, text: '我给朋友的手写信攒了一盒', is_ai: false, source_tag: '手写书信' },
      { index: 3, text: '我给广播剧配过音', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  脑洞章鱼 (octopus) — creative, quirky,发散思维 ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'octopus',
    statements: [
      { index: 1, text: '我常把不相关的事连起来', is_ai: false, source_tag: '脑洞大开' },
      { index: 2, text: '我会给路边物品编故事', is_ai: false, source_tag: '即兴创作' },
      { index: 3, text: '我设计过一款桌游', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'octopus',
    statements: [
      { index: 1, text: '我喜欢从反方向想问题', is_ai: false, source_tag: '逆向思考' },
      { index: 2, text: '我的穿搭总是出其不意', is_ai: false, source_tag: '混搭风格' },
      { index: 3, text: '我发明过一种语言', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'octopus',
    statements: [
      { index: 1, text: '我用快递盒给猫做过窝', is_ai: false, source_tag: '废物改造' },
      { index: 2, text: '我给每个朋友起过专属外号', is_ai: false, source_tag: '起外号' },
      { index: 3, text: '我画的表情包上架过商店', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  好奇猫头鹰 (owl) — analytical, deep thinker ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'owl',
    statements: [
      { index: 1, text: '我看书一定会查所有出处', is_ai: false, source_tag: '追根究底' },
      { index: 2, text: '我爱玩推理类的解谜游戏', is_ai: false, source_tag: '逻辑控' },
      { index: 3, text: '我家里有一千本书', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'owl',
    statements: [
      { index: 1, text: '我看纪录片一定会做笔记', is_ai: false, source_tag: '纪录片笔记' },
      { index: 2, text: '买东西前我会比价三天', is_ai: false, source_tag: '比价研究' },
      { index: 3, text: '我进过知识竞赛的决赛', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'owl',
    statements: [
      { index: 1, text: '我能背出本城地铁线路图', is_ai: false, source_tag: '活地图' },
      { index: 2, text: '我追剧会查历史原型', is_ai: false, source_tag: '考据党' },
      { index: 3, text: '我翻译过一本外文书', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  靠谱大象 (elephant) — reliable, stable anchor ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'elephant',
    statements: [
      { index: 1, text: '我的文件有三个备份', is_ai: false, source_tag: '备份狂魔' },
      { index: 2, text: '我约会从不迟到超过五分', is_ai: false, source_tag: '守时达人' },
      { index: 3, text: '我坚持十年写日记', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'elephant',
    statements: [
      { index: 1, text: '我的日程表精确到半小时', is_ai: false, source_tag: '日程管理' },
      { index: 2, text: '答应别人的事我一定做到', is_ai: false, source_tag: '说到做到' },
      { index: 3, text: '我十年没误过一次火车', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'elephant',
    statements: [
      { index: 1, text: '家里的药箱我按月清点', is_ai: false, source_tag: '生活管家' },
      { index: 2, text: '朋友搬家第一个想到我', is_ai: false, source_tag: '搬家首选' },
      { index: 3, text: '我考过急救员证书', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  慢热龟 (turtle) — observant, slow but deep ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'turtle',
    statements: [
      { index: 1, text: '我进新圈子会先观察三天', is_ai: false, source_tag: '慢热观察' },
      { index: 2, text: '我看人的直觉很少出错', is_ai: false, source_tag: '精准判断' },
      { index: 3, text: '我养过一只乌龟十年', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'turtle',
    statements: [
      { index: 1, text: '我吃饭爱选靠墙的位置', is_ai: false, source_tag: '靠墙座位' },
      { index: 2, text: '我记着同事们的咖啡口味', is_ai: false, source_tag: '记住口味' },
      { index: 3, text: '我手冲咖啡坚持了五年', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'turtle',
    statements: [
      { index: 1, text: '我看电影先刷影评再决定', is_ai: false, source_tag: '先看影评' },
      { index: 2, text: '我更习惯用文字表达想法', is_ai: false, source_tag: '文字表达' },
      { index: 3, text: '我拿过围棋业余三段', is_ai: true, source_tag: null },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  小透明猫 (cat) — quiet, independent, observer ×3
  // ═══════════════════════════════════════════════════════════════
  {
    archetype: 'cat',
    statements: [
      { index: 1, text: '聚会时我喜欢坐在角落', is_ai: false, source_tag: '角落生物' },
      { index: 2, text: '深聊比群聊让我更舒服', is_ai: false, source_tag: '一对一' },
      { index: 3, text: '我参加过即兴喜剧', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'cat',
    statements: [
      { index: 1, text: '我的周末标配是独处', is_ai: false, source_tag: '独处充电' },
      { index: 2, text: '我耳机里常年放着白噪音', is_ai: false, source_tag: '白噪音' },
      { index: 3, text: '我组过一支乐队', is_ai: true, source_tag: null },
    ],
  },
  {
    archetype: 'cat',
    statements: [
      { index: 1, text: '我能一个人逛美术馆半天', is_ai: false, source_tag: '独自逛展' },
      { index: 2, text: '我朋友圈三个月才发一条', is_ai: false, source_tag: '低产朋友圈' },
      { index: 3, text: '我上台弹过钢琴独奏', is_ai: true, source_tag: null },
    ],
  },
];

/**
 * Get a random fallback set.
 * If `archetype` is provided, picks from sets matching that archetype;
 * otherwise picks uniformly from the entire pool.
 */
export function getRandomFallbackSet(archetype?: string): LieDetectiveV2FallbackSet {
  const pool = archetype
    ? LIE_DETECTIVE_V2_FALLBACK_SETS.filter((s) => s.archetype === archetype)
    : LIE_DETECTIVE_V2_FALLBACK_SETS;

  if (pool.length === 0) {
    // Fallback-of-last-resort: return the very first set (corgi)
    return LIE_DETECTIVE_V2_FALLBACK_SETS[0];
  }

  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}
