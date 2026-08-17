/**
 * MiniScript Curated Mystery Catalog
 *
 * Pre-authored, playtested mystery scenarios that serve as the ultimate
 * deterministic fallback when AI generation or validation fails.
 * Each entry is a valid MiniScriptStoryFramework v2.
 */

import type {
  MiniScriptStoryFramework,
  MiniScriptStyle,
  MiniScriptGenre,
} from '@shared/miniscriptStoryFramework';

export const CATALOG_VERSION = 'v2.0.0';

export interface CatalogEntry {
  id: string;
  style: MiniScriptStyle;
  genres: MiniScriptGenre[];
  framework: MiniScriptStoryFramework;
}

// ─── Catalog Entries ──────────────────────────────────────────────────────────

const CATALOG_ENTRIES: CatalogEntry[] = [
  // ─── 轻推理 + 现代都市 ──────────────────────────────────────────────────────
  {
    id: 'modern-urban-light-reasoning-001',
    style: 'modern_urban',
    genres: ['light_reasoning'],
    framework: {
      schemaVersion: 2,
      style: 'modern_urban',
      genres: ['light_reasoning'],
      gameModeConfig: {
        clueCountRange: [3, 4],
        hasRedHerrings: false,
        hasHiddenAgendas: false,
        votingStyle: 'consensus',
        winCondition: 'solve_mystery',
        targetPlayMinutes: 12,
        difficulty: 'easy',
      },
      premise:
        '周五晚的写字楼茶水间，有人发现冰箱上贴着一张便利贴："最后一杯燕麦奶被我喝了，sorry~"——但冰箱里明明还有半盒。谁写了这张纸条？',
      characters: [
        {
          slotIndex: 0,
          roleLabel: '加班设计师',
          sinHook: '被「嘴硬」绊了一下——明明喝了燕麦奶却说是豆浆。',
          alibi: '一直在工位改图，没离开过。',
          secret: '其实去茶水间倒过三次水，每次都瞄了一眼冰箱。',
        },
        {
          slotIndex: 1,
          roleLabel: '实习生',
          sinHook: '被「心软」绊了一下——帮大家点了奶茶但忘了自己那份。',
          alibi: '下午在会议室培训，五点才回工位。',
          secret: '培训中途溜出来泡过咖啡，看到有人在冰箱前站了很久。',
        },
        {
          slotIndex: 2,
          roleLabel: '产品经理',
          sinHook: '被「逞强」绊了一下——说自己在减肥其实偷偷吃零食。',
          alibi: '整天在开会，连午饭都是外卖在会议室吃的。',
          secret: '早上七点就来公司了，是第一个打开冰箱的人。',
        },
        {
          slotIndex: 3,
          roleLabel: '运维小哥',
          sinHook: '被「逃避」绊了一下——服务器报警假装没看见先去泡茶。',
          alibi: '在机房处理故障，下午才上来。',
          secret: '路过茶水间时顺手把燕麦奶倒进了自己的保温杯。',
        },
      ],
      act_flow: [
        {
          actNumber: 1,
          title: '开场：便利贴之谜',
          beats: ['读出便利贴内容', '每人分享今天和茶水间的交集', '发现纸条字迹有点眼熟'],
        },
        {
          actNumber: 2,
          title: '升温：三条线索',
          beats: ['线索A：监控显示下午3点有人进出茶水间', '线索B：垃圾桶里有撕掉的便利贴草稿', '线索C：燕麦奶盒上的指纹'],
        },
        {
          actNumber: 3,
          title: '收束：真相大白',
          beats: ['合并线索推导出"谁写了纸条"', '发现真正的"凶手"其实没恶意', '用一杯奶茶和解'],
        },
      ],
      ending: {
        resolutionSummary: '真相是：运维小哥喝了燕麦奶，产品经理写了道歉便利贴（因为她早上看到快没了想提醒大家），结果运维下午才来，造成了时间差误会。',
        confessionMechanic: '主持人揭晓：产品经理的便利贴是早上写的，运维小哥是下午喝的——两人都没错，只是时间错开了。',
      },
      clues: [
        {
          clueId: 'c1',
          text: '监控显示下午3:15有人进入茶水间，停留了约2分钟。',
          revealedInAct: 2,
          implies: ['c2'],
        },
        {
          clueId: 'c2',
          text: '垃圾桶里有一张撕掉的便利贴草稿，上面只写了"最后"两个字。',
          revealedInAct: 2,
          implies: ['c3'],
        },
        {
          clueId: 'c3',
          text: '燕麦奶盒上有一个模糊的指纹，和某位角色早上碰过的东西上的指纹一致。',
          revealedInAct: 2,
          implies: [],
        },
      ],
      solution: {
        who: '运维小哥喝了燕麦奶，产品经理写了纸条',
        what: '运维下午喝了奶，产品经理早上看到快没了写了提醒',
        why: '时间差造成的误会——两人都没想撒谎',
      },
      playerKnowledge: [
        {
          slotIndex: 0,
          knownFacts: ['我确实没喝燕麦奶', '但我看到实习生下午在茶水间'],
          secretAgenda: '我想知道谁喝了燕麦奶，因为我明天想喝',
          truthfulAlibi: '一直在工位，但去倒过水',
        },
        {
          slotIndex: 1,
          knownFacts: ['培训五点结束', '我三点溜出来泡咖啡时看到有人在冰箱前'],
          secretAgenda: '我不想让主管知道我溜号',
          truthfulAlibi: '培训中途确实离开过10分钟',
        },
        {
          slotIndex: 2,
          knownFacts: ['我早上七点来的', '我看到燕麦奶快没了'],
          secretAgenda: '我写了一张便利贴提醒大家',
          truthfulAlibi: '早上第一个到，确实开了冰箱',
        },
        {
          slotIndex: 3,
          knownFacts: ['我下午才从机房上来', '我确实泡了茶'],
          secretAgenda: '我把燕麦奶倒进保温杯了',
          truthfulAlibi: '下午3:15在茶水间，停留了2分钟',
        },
      ],
      deductionChain: [
        {
          stepNumber: 1,
          fromClues: ['c1'],
          conclusion: '下午3:15有人在茶水间待了2分钟——足够倒一杯奶',
        },
        {
          stepNumber: 2,
          fromClues: ['c2'],
          conclusion: '便利贴是提前写的（草稿被撕），不是事后补救',
        },
        {
          stepNumber: 3,
          fromClues: ['c1', 'c2', 'c3'],
          conclusion: '产品经理早上写了提醒 → 运维下午喝了奶 → 时间差误会',
        },
      ],
    },
  },

  // ─── 惊悚悬疑 + 民国 ────────────────────────────────────────────────────────
  {
    id: 'republican-era-thriller-001',
    style: 'republican_era',
    genres: ['thriller_mystery'],
    framework: {
      schemaVersion: 2,
      style: 'republican_era',
      genres: ['thriller_mystery'],
      gameModeConfig: {
        clueCountRange: [5, 7],
        hasRedHerrings: true,
        hasHiddenAgendas: true,
        votingStyle: 'accusation',
        winCondition: 'find_traitor',
        targetPlayMinutes: 18,
        difficulty: 'hard',
      },
      premise:
        '1943年，上海某小报馆。主编发现明天要发的头版社论被人篡改了一句话，把"呼吁和平"改成了"支持合作"。这在当时足以让报馆关门。谁在深夜潜入了排版室？',
      characters: [
        {
          slotIndex: 0,
          roleLabel: '副主编',
          sinHook: '被「虚荣」绊了一下——一直想证明自己比主编强。',
          alibi: '昨晚在家写稿子，邻居可以作证。',
          secret: '确实想过接班，但没敢做这种事。',
        },
        {
          slotIndex: 1,
          roleLabel: '排版学徒',
          sinHook: '被「嘴硬」绊了一下——说锁是自己坏的。',
          alibi: '最后一个离开报馆，但锁好了门。',
          secret: '发现门没锁好，但怕担责任没说。',
        },
        {
          slotIndex: 2,
          roleLabel: '记者',
          sinHook: '被「心软」绊了一下——曾同情某个敏感人物。',
          alibi: '整晚在咖啡馆采访证人。',
          secret: '采访对象是反对派，可能被人跟踪了。',
        },
        {
          slotIndex: 3,
          roleLabel: '会计',
          sinHook: '被「逃避」绊了一下——账上少了钱一直没查。',
          alibi: '在家算账，有账本为证。',
          secret: '收到过匿名信威胁，但没告诉任何人。',
        },
      ],
      act_flow: [
        {
          actNumber: 1,
          title: '开场：风雨欲来',
          beats: ['主编展示被篡改的校样', '每人陈述昨晚行踪', '发现排版室的锁有撬痕'],
        },
        {
          actNumber: 2,
          title: '疑云：真假线索',
          beats: ['真线索：油墨痕迹显示篡改时间是凌晨2点', '假线索：副主编桌上有一把排版室钥匙（其实是主编借给他的）', '真线索：学徒的考勤记录显示他确实最后离开'],
        },
        {
          actNumber: 3,
          title: '交锋：指控与辩解',
          beats: ['每人可以指控一个最可疑的人', '被指控者有一次辩解机会', '隐藏任务者可以选择是否暴露身份'],
        },
        {
          actNumber: 4,
          title: '真相：黎明之前',
          beats: ['揭晓真正的篡改者', '解释所有假线索的设计', '报馆的命运如何？'],
        },
      ],
      ending: {
        resolutionSummary: '真相是：会计被威胁后被迫配合，但真正动手的是外来者（跟踪记者的人）。会计是内应，不是主谋。',
        confessionMechanic: '主持人揭晓：会计打开窗户放人进来，但篡改是外部势力做的。会计的懦弱酿成了大错。',
      },
      clues: [
        {
          clueId: 'c1',
          text: '校样上的油墨干涸程度显示，篡改发生在凌晨2点左右。',
          revealedInAct: 2,
          implies: ['c2'],
        },
        {
          clueId: 'c2',
          text: '排版室窗户内侧有脚印，但门没有被撬——是有人从内部开的窗。',
          revealedInAct: 2,
          implies: ['c4'],
        },
        {
          clueId: 'c3',
          text: '副主编的钥匙是主编三天前借给他的，有借据为证。——【假线索】',
          revealedInAct: 2,
          implies: [],
        },
        {
          clueId: 'c4',
          text: '会计的抽屉里有一封匿名信，上面写着"按我说的做，否则账本公开"。',
          revealedInAct: 3,
          implies: ['c5'],
        },
        {
          clueId: 'c5',
          text: '记者在咖啡馆的采访对象，今天下午被带走了。',
          revealedInAct: 3,
          implies: [],
        },
      ],
      solution: {
        who: '外部势力（跟踪记者的人）+ 会计作为内应',
        what: '会计开窗放人进来，外部势力篡改了社论',
        why: '外部势力想借报馆制造舆论，会计被账本威胁被迫配合',
      },
      playerKnowledge: [
        {
          slotIndex: 0,
          knownFacts: ['我确实想接班', '但我昨晚在家', '主编三天前借给我钥匙'],
          secretAgenda: '我想查清谁比我更有机会接班',
          truthfulAlibi: '在家写稿，邻居作证',
        },
        {
          slotIndex: 1,
          knownFacts: ['我最后离开', '门确实锁了', '但回来时发现窗户开着'],
          secretAgenda: '我怕担责任，没报告窗户的事',
          truthfulAlibi: '最后离开，但早上回来时窗户是开的',
        },
        {
          slotIndex: 2,
          knownFacts: ['我采访的是反对派', '咖啡馆在报馆三条街外', '今天下午采访对象被带走了'],
          secretAgenda: '我可能被人跟踪了，但我没注意',
          truthfulAlibi: '整晚在咖啡馆',
        },
        {
          slotIndex: 3,
          knownFacts: ['账上确实少了钱', '我收到过威胁信', '我昨晚在家算账'],
          secretAgenda: '我按威胁信的要求开了窗户',
          truthfulAlibi: '在家算账，但中途回过报馆',
        },
      ],
      redHerrings: [
        {
          text: '副主编桌上有排版室钥匙',
          misleadingTarget: '副主编',
        },
        {
          text: '学徒说"锁是自己坏的"',
          misleadingTarget: '学徒',
        },
      ],
      deductionChain: [
        {
          stepNumber: 1,
          fromClues: ['c1', 'c2'],
          conclusion: '凌晨2点有人篡改，且是从窗户进入——说明有内应开窗',
        },
        {
          stepNumber: 2,
          fromClues: ['c4'],
          conclusion: '会计被威胁，有动机当内应',
        },
        {
          stepNumber: 3,
          fromClues: ['c2', 'c4', 'c5'],
          conclusion: '会计开窗 → 跟踪记者的外部势力进入 → 篡改社论',
        },
      ],
    },
  },

  // ─── 浪漫爱情 + 古风 ────────────────────────────────────────────────────────
  {
    id: 'ancient-chinese-romance-001',
    style: 'ancient_chinese',
    genres: ['romance'],
    framework: {
      schemaVersion: 2,
      style: 'ancient_chinese',
      genres: ['romance'],
      gameModeConfig: {
        clueCountRange: [3, 5],
        hasRedHerrings: false,
        hasHiddenAgendas: true,
        votingStyle: 'consensus',
        winCondition: 'match_pairs',
        targetPlayMinutes: 14,
        difficulty: 'easy',
      },
      premise:
        '长安上元灯会，一盏走马灯上被人题了一首诗："众里寻他千百度，蓦然回首——"后面被人补了半句。谁写的？写给谁的？',
      characters: [
        {
          slotIndex: 0,
          roleLabel: '绣娘',
          sinHook: '被「心软」绊了一下——替别人绣了荷包却不敢署名。',
          alibi: '整晚在绣庄赶工，但中间出去送过一次货。',
          secret: '绣过一个荷包，上面绣了某人的名字缩写。',
        },
        {
          slotIndex: 1,
          roleLabel: '书肆伙计',
          sinHook: '被「逃避」绊了一下——明明会写诗却说不会。',
          alibi: '在书肆整理账目，但关门后去了河边。',
          secret: '河边写过几首诗，都揉掉了。',
        },
        {
          slotIndex: 2,
          roleLabel: '酒坊 daughter',
          sinHook: '被「逞强」绊了一下——说不需要人陪其实怕黑。',
          alibi: '在酒坊招待客人，但中间去后院取过酒。',
          secret: '后院井边放了一盏小灯笼，是信号。',
        },
        {
          slotIndex: 3,
          roleLabel: '琴师',
          sinHook: '被「虚荣」绊了一下——琴声太好想让人知道是谁。',
          alibi: '在酒楼弹琴，但中间休息过一炷香时间。',
          secret: '休息时在走马灯上题了诗的前半句。',
        },
      ],
      act_flow: [
        {
          actNumber: 1,
          title: '开场：灯会初遇',
          beats: ['展示走马灯上的诗', '每人分享今晚去过的地方', '发现诗的后半句笔迹和前半句不同'],
        },
        {
          actNumber: 2,
          title: '心动：三条情书',
          beats: ['线索：绣娘荷包上的缩写', '线索：书肆伙计的袖口有墨迹', '线索：酒坊后院的小灯笼'],
        },
        {
          actNumber: 3,
          title: '配对：谁的心意',
          beats: ['每人猜测诗是写给谁的', '共识表决最可能的配对', '揭晓正确答案'],
        },
      ],
      ending: {
        resolutionSummary: '真相是：琴师题了前半句，书肆伙计补了后半句——两人互相暗恋却不知对方心意。绣娘的荷包是送给酒坊女儿的，酒坊女儿的灯笼是给琴师的信号。两对互相错位的心。',
        confessionMechanic: '主持人揭晓：琴师→书肆伙计（诗），绣娘→酒坊女儿（荷包），酒坊女儿→琴师（灯笼）。',
      },
      clues: [
        {
          clueId: 'c1',
          text: '走马灯上前半句的字迹纤细有力，像是惯用毛笔的人写的。',
          revealedInAct: 2,
          implies: ['c2'],
        },
        {
          clueId: 'c2',
          text: '后半句的字迹潦草但有力，像是平时写字多但不用毛笔的人。',
          revealedInAct: 2,
          implies: ['c3'],
        },
        {
          clueId: 'c3',
          text: '绣娘的荷包上绣着"酒"字的花纹——不是店名，是人名。',
          revealedInAct: 2,
          implies: [],
        },
        {
          clueId: 'c4',
          text: '酒坊后院的灯笼上有一朵小小的梅花——和琴师琴袋上的图案一样。',
          revealedInAct: 2,
          implies: [],
        },
      ],
      solution: {
        who: '琴师和书肆伙计互相暗恋',
        what: '琴师题了诗的前半句，书肆伙计补了后半句',
        why: '两人都在试探对方心意，却都不敢直接表白',
      },
      playerKnowledge: [
        {
          slotIndex: 0,
          knownFacts: ['我绣了荷包', '上面绣了酒字', '我今晚去送过一次货'],
          secretAgenda: '我想把酒坊女儿约出来看灯',
          truthfulAlibi: '在绣庄，但出去送过货',
        },
        {
          slotIndex: 1,
          knownFacts: ['我会写诗', '我袖口有墨迹', '我关门后去了河边'],
          secretAgenda: '我在河边写诗，想送给一个人',
          truthfulAlibi: '在书肆，关门后去河边',
        },
        {
          slotIndex: 2,
          knownFacts: ['我后院有灯笼', '灯笼上有梅花', '我去过后院取酒'],
          secretAgenda: '灯笼是给琴师的信号',
          truthfulAlibi: '在酒坊，去过后院',
        },
        {
          slotIndex: 3,
          knownFacts: ['我题了诗的前半句', '我休息过一炷香', '我的琴袋上有梅花'],
          secretAgenda: '我想让某个人看到我的诗',
          truthfulAlibi: '在酒楼弹琴，休息过一炷香',
        },
      ],
      deductionChain: [
        {
          stepNumber: 1,
          fromClues: ['c1', 'c2'],
          conclusion: '前半句是毛笔字（琴师），后半句是硬笔迹（书肆伙计）——两人合写了一首诗',
        },
        {
          stepNumber: 2,
          fromClues: ['c3'],
          conclusion: '绣娘的荷包是给酒坊女儿的',
        },
        {
          stepNumber: 3,
          fromClues: ['c4'],
          conclusion: '酒坊女儿的灯笼是给琴师的——但琴师的心在书肆伙计身上',
        },
      ],
    },
  },

  // ─── 荒诞喜剧 + 中世纪 ──────────────────────────────────────────────────────
  {
    id: 'medieval-absurd-comedy-001',
    style: 'medieval',
    genres: ['absurd_comedy'],
    framework: {
      schemaVersion: 2,
      style: 'medieval',
      genres: ['absurd_comedy'],
      gameModeConfig: {
        clueCountRange: [2, 4],
        hasRedHerrings: true,
        hasHiddenAgendas: false,
        votingStyle: 'none',
        winCondition: 'laugh_track',
        targetPlayMinutes: 10,
        difficulty: 'easy',
      },
      premise:
        '城堡粮仓钥匙不见了。国王下令：找不到钥匙，今晚的晚宴就改吃素。四个骑士互相指责，但真相离谱到没人想得到。',
      characters: [
        {
          slotIndex: 0,
          roleLabel: '吃货骑士',
          sinHook: '被「怠惰」绊了一下——明明力气最大却假装搬不动箱子。',
          alibi: '一直在厨房试吃，没去过粮仓。',
          secret: '其实去了粮仓，但只是为了闻一闻腊肉的味道。',
        },
        {
          slotIndex: 1,
          roleLabel: '洁癖骑士',
          sinHook: '被「虚荣」绊了一下——盔甲擦得太亮被人当成镜子。',
          alibi: '在擦盔甲，根本不想碰粮仓的门。',
          secret: '盔甲太亮，反射的阳光晃到了看门狗，狗追着他跑了。',
        },
        {
          slotIndex: 2,
          roleLabel: '路痴骑士',
          sinHook: '被「逃避」绊了一下——说自己在巡逻其实迷路了。',
          alibi: '在城堡外围巡逻，有巡逻记录。',
          secret: '巡逻记录是瞎编的，他其实走到了邻村的集市。',
        },
        {
          slotIndex: 3,
          roleLabel: '失眠骑士',
          sinHook: '被「心软」绊了一下——给看门狗讲故事讲到自己睡着。',
          alibi: '在值夜，但中间打了个盹。',
          secret: '他睡着时钥匙从口袋里滑出来，被狗叼走了。',
        },
      ],
      act_flow: [
        {
          actNumber: 1,
          title: '开场：钥匙呢？！',
          beats: ['国王宣布改吃素', '四个骑士互相撇清', '发现看门狗行为异常'],
        },
        {
          actNumber: 2,
          title: '混乱：离谱线索',
          beats: ['线索：粮仓门口有一根狗毛', '线索：失眠骑士的口袋有个洞', '假线索：吃货骑士嘴角有油（其实是从厨房带来的）'],
        },
        {
          actNumber: 3,
          title: '高潮：谁干的？',
          beats: ['每人讲一个越来越离谱的猜测', '最后发现真相比所有猜测都离谱', '看门狗叼着钥匙出现了'],
        },
      ],
      ending: {
        resolutionSummary: '真相是：失眠骑士值夜时给狗讲故事睡着了，钥匙从破口袋里滑出来，狗把钥匙叼到了狗窝里当玩具。没有阴谋，只有困。',
        confessionMechanic: '主持人揭晓：看门狗从狗窝里叼出钥匙，摇着尾巴交给国王。国王决定今晚加一道狗肉……不，加一道鸡腿。',
      },
      clues: [
        {
          clueId: 'c1',
          text: '粮仓门口有一根金色的狗毛。',
          revealedInAct: 2,
          implies: ['c2'],
        },
        {
          clueId: 'c2',
          text: '失眠骑士的制服口袋上有个小洞，刚好能掉出一把钥匙。',
          revealedInAct: 2,
          implies: [],
        },
        {
          clueId: 'c3',
          text: '看门狗的窝里有东西在反光——像是金属。',
          revealedInAct: 3,
          implies: [],
        },
      ],
      solution: {
        who: '失眠骑士（无意）+ 看门狗（帮凶）',
        what: '失眠骑士睡着时钥匙从破口袋滑出，狗叼走了',
        why: '因为失眠骑士太困了，狗太无聊了',
      },
      playerKnowledge: [
        {
          slotIndex: 0,
          knownFacts: ['我在厨房', '我确实闻了腊肉', '我没碰过钥匙'],
          secretAgenda: '我只是想闻闻腊肉味',
          truthfulAlibi: '在厨房试吃',
        },
        {
          slotIndex: 1,
          knownFacts: ['我在擦盔甲', '盔甲很亮', '狗追过我'],
          secretAgenda: '狗追我是因为我的盔甲反光',
          truthfulAlibi: '在擦盔甲',
        },
        {
          slotIndex: 2,
          knownFacts: ['我在巡逻', '但我迷路了', '我到了邻村集市'],
          secretAgenda: '我根本不知道粮仓在哪',
          truthfulAlibi: '在邻村集市',
        },
        {
          slotIndex: 3,
          knownFacts: ['我在值夜', '我打了盹', '我口袋有个洞'],
          secretAgenda: '我睡着时钥匙掉了',
          truthfulAlibi: '在值夜，确实睡着了',
        },
      ],
      redHerrings: [
        {
          text: '吃货骑士嘴角有油',
          misleadingTarget: '吃货骑士',
        },
      ],
      deductionChain: [
        {
          stepNumber: 1,
          fromClues: ['c1', 'c2'],
          conclusion: '狗毛 + 口袋破洞 = 狗可能接触过钥匙',
        },
        {
          stepNumber: 2,
          fromClues: ['c3'],
          conclusion: '狗窝里有金属反光——钥匙在狗窝里！',
        },
      ],
    },
  },

  // ─── 混合：轻推理+浪漫爱情 + 未来科技 ───────────────────────────────────────
  {
    id: 'future-tech-light-romance-001',
    style: 'future_tech',
    genres: ['light_reasoning', 'romance'],
    framework: {
      schemaVersion: 2,
      style: 'future_tech',
      genres: ['light_reasoning', 'romance'],
      gameModeConfig: {
        clueCountRange: [3, 5],
        hasRedHerrings: false,
        hasHiddenAgendas: true,
        votingStyle: 'consensus',
        winCondition: 'match_pairs',
        targetPlayMinutes: 14,
        difficulty: 'easy',
      },
      premise:
        '2147年，轨道站"方舟7号"。AI管家报告：有人把今天的营养剂口味从"标准"改成了"草莓"——但只有管理员有权限。谁破解了AI？',
      characters: [
        {
          slotIndex: 0,
          roleLabel: '工程师',
          sinHook: '被「嘴硬」绊了一下——说自己的代码没有bug。',
          alibi: '在机房维护服务器，有操作日志。',
          secret: '确实改了AI参数，但只是为了给某人一个惊喜。',
        },
        {
          slotIndex: 1,
          roleLabel: '医官',
          sinHook: '被「心软」绊了一下——偷偷给病人加过糖。',
          alibi: '在医疗舱值班，有监控。',
          secret: '知道工程师喜欢草莓味，但没说是自己暗示的。',
        },
        {
          slotIndex: 2,
          roleLabel: '通讯员',
          sinHook: '被「逃避」绊了一下——收到情书假装是系统通知。',
          alibi: '在通讯室转发地球消息，有发送记录。',
          secret: '收到过一条匿名消息："今天想尝尝草莓吗？"',
        },
        {
          slotIndex: 3,
          roleLabel: '植物学家',
          sinHook: '被「逞强」绊了一下——说无土栽培很简单其实很难。',
          alibi: '在温室照顾植物，有环境传感器记录。',
          secret: '温室里种了一株偷偷培育的草莓苗。',
        },
      ],
      act_flow: [
        {
          actNumber: 1,
          title: '开场：AI报警',
          beats: ['AI播报口味被改', '每人展示自己在做什么', '发现修改时间是午休时间'],
        },
        {
          actNumber: 2,
          title: '排查：数字足迹',
          beats: ['线索：工程师的代码提交记录', '线索：医官的医疗舱出入时间', '线索：通讯室有一条未加密的本地消息'],
        },
        {
          actNumber: 3,
          title: '真相：草莓味的告白',
          beats: ['合并线索发现不是"入侵"而是"告白"', '找出谁喜欢草莓味', '揭晓浪漫的真相'],
        },
      ],
      ending: {
        resolutionSummary: '真相是：工程师知道医官喜欢草莓味，偷偷改了AI参数。医官其实早就知道，因为那条匿名消息就是她发的。植物学家的草莓苗是后备计划。通讯员是吃瓜群众。',
        confessionMechanic: '主持人揭晓：这不是入侵，是太空站上的浪漫告白。工程师和医官互相暗恋，用AI传情。',
      },
      clues: [
        {
          clueId: 'c1',
          text: '工程师在12:03提交了一段AI参数修改代码，注释是"taste test"。',
          revealedInAct: 2,
          implies: ['c2'],
        },
        {
          clueId: 'c2',
          text: '医官在12:00离开医疗舱，12:05回来——刚好是修改时间。',
          revealedInAct: 2,
          implies: ['c3'],
        },
        {
          clueId: 'c3',
          text: '通讯室有一条本地消息，发件人匿名，内容只有一个草莓emoji。',
          revealedInAct: 2,
          implies: [],
        },
        {
          clueId: 'c4',
          text: '植物学家的温室传感器显示，12:01有人进入温室，停留了30秒——只够看一眼草莓苗。',
          revealedInAct: 2,
          implies: [],
        },
      ],
      solution: {
        who: '工程师改了AI，医官是幕后推手',
        what: '工程师用代码告白，医官用匿名消息暗示',
        why: '两人在太空站上互相暗恋，找不到机会表白',
      },
      playerKnowledge: [
        {
          slotIndex: 0,
          knownFacts: ['我改了AI参数', '我知道有人喜欢草莓', '我在机房'],
          secretAgenda: '我想给医官一个惊喜',
          truthfulAlibi: '在机房维护服务器',
        },
        {
          slotIndex: 1,
          knownFacts: ['我离开过医疗舱', '我喜欢草莓味', '我收到过匿名消息'],
          secretAgenda: '我发了那条草莓emoji消息给工程师',
          truthfulAlibi: '在医疗舱值班',
        },
        {
          slotIndex: 2,
          knownFacts: ['我在通讯室', '我转发消息', '我看到那条草莓emoji'],
          secretAgenda: '我只是吃瓜群众',
          truthfulAlibi: '在通讯室',
        },
        {
          slotIndex: 3,
          knownFacts: ['我在温室', '我种了草莓苗', '有人来看过'],
          secretAgenda: '我的草莓苗是后备计划（如果告白失败就送草莓）',
          truthfulAlibi: '在温室',
        },
      ],
      deductionChain: [
        {
          stepNumber: 1,
          fromClues: ['c1'],
          conclusion: '工程师改了AI参数——他有技术能力',
        },
        {
          stepNumber: 2,
          fromClues: ['c2', 'c3'],
          conclusion: '医官在修改时间前后离开过，且发过草莓emoji——她是幕后推手',
        },
        {
          stepNumber: 3,
          fromClues: ['c1', 'c2', 'c3'],
          conclusion: '工程师执行了修改，医官暗示了修改——两人合谋的浪漫告白',
        },
      ],
    },
  },
];

// ─── Catalog API ──────────────────────────────────────────────────────────────

export function getCatalogEntries(): readonly CatalogEntry[] {
  return CATALOG_ENTRIES;
}

export function findCatalogEntry(
  style: MiniScriptStyle,
  genres: MiniScriptGenre[]
): CatalogEntry | undefined {
  const genreSet = new Set(genres);
  return CATALOG_ENTRIES.find((entry) => {
    if (entry.style !== style) return false;
    const entryGenreSet = new Set(entry.genres);
    if (genreSet.size !== entryGenreSet.size) return false;
    return Array.from(genreSet).every((g) => entryGenreSet.has(g));
  });
}

/**
 * Return a random catalog entry that matches at least one genre.
 * Used as ultimate fallback when no exact match exists.
 */
export function getRandomCatalogEntry(
  style: MiniScriptStyle,
  genres: MiniScriptGenre[]
): CatalogEntry | undefined {
  const sameStyle = CATALOG_ENTRIES.filter((entry) => entry.style === style);
  const candidates = sameStyle.filter((entry) =>
    entry.genres.some((g) => genres.includes(g)),
  );
  const pool = candidates.length > 0 ? candidates : sameStyle;
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getCatalogEntryById(id: string): CatalogEntry | undefined {
  return CATALOG_ENTRIES.find((e) => e.id === id);
}
