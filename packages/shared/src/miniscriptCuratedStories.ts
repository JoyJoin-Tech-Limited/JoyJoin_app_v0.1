/**
 * MiniScript Curated Stories — Production-Grade Playable Fallbacks
 *
 * Complete, schema-valid MiniScriptStoryFramework v2 entries used as the
 * ultimate deterministic fallback when AI generation fails AND the server
 * catalog has no entry for the requested style (e.g. western_court, xianxia).
 *
 * Authoring rules (keep in sync with the mini_script hard constraints):
 * - Low-stakes mishap tone only: no violence, no death, no real-person names.
 * - Every role is NAMED and evocative; every secret is a concrete, actable act.
 * - Every clue is concrete (object + detail), readable aloud, and points
 *   toward or clears a specific named role. No self-numbering prefixes like
 *   「线索 1：」 — the client owns numbering.
 * - `solution.who` must reference a roleLabel present in `characters`, and the
 *   culprit must sit in slots 0–3 so the solution stays consistent when
 *   `adaptCatalogEntry` slices down to 4 players.
 * - No raw snake_case style/genre machine keys in any user-facing string.
 */

import type {
  MiniScriptGenre,
  MiniScriptStoryFramework,
  MiniScriptStyle,
} from './miniscriptStoryFramework';

// ─── 西欧宫廷 · 凡尔赛胸针（轻推理） ──────────────────────────────────────────

const VERSAILLES_BROOCH: MiniScriptStoryFramework = {
  schemaVersion: 2,
  style: 'western_court',
  genres: ['light_reasoning'],
  title: '凡尔赛的胸针',
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
    '凡尔赛宫的下午茶会上，男爵夫人那枚象征家族荣誉的蓝宝石胸针不见了。门窗完好，没有人离开过客厅——它只是，消失了。',
  characters: [
    {
      slotIndex: 0,
      roleLabel: '健忘的男爵夫人',
      sinHook: '被「健忘」绊了一下——三句话不离她的猫，却想不起胸针昨晚别在了哪件裙子上。',
      alibi: '整个下午都在客厅招呼客人，怀里抱着猫，哪儿也没去。',
      secret: '你早上其实打开过首饰盒，拿出胸针看了一眼又放回去——你怕说出来，大家会觉得你老糊涂。',
    },
    {
      slotIndex: 1,
      roleLabel: '好面子的伯爵夫人',
      sinHook: '被「好面子」绊了一下——坚称自己从不读诗人的诗，却背得出每一句。',
      alibi: '一直在露台上赏玫瑰，只回客厅喝过一次茶。',
      secret: '你偷看过诗人压在胸针下面的诗稿开头，脸红了半小时，却装作什么都不知道。',
    },
    {
      slotIndex: 2,
      roleLabel: '忧郁的宫廷诗人',
      sinHook: '被「逞强」绊了一下——说好了日落前交出新诗，到现在只写了三行。',
      alibi: '一下午都坐在角落改诗，只向管家借过一次「灵感」。',
      secret: '你向管家借了胸针压在没有写完的诗稿上，想日落前改完就悄悄还回——结果一紧张，忘了。',
    },
    {
      slotIndex: 3,
      roleLabel: '慌张的年轻侍者',
      sinHook: '被「嘴硬」绊了一下——明明看见了一切，却因为怕挨骂，说什么都不知道。',
      alibi: '在茶几与厨房之间跑了一下午，没碰过任何首饰。',
      secret: '你看见诗人把胸针别在了纸上，但诗人替你瞒过打碎酒杯的事，你答应过不说。',
    },
  ],
  act_flow: [
    {
      actNumber: 1,
      title: '开场：宝石去哪儿了',
      beats: ['男爵夫人宣布胸针失踪', '每人讲述自己下午的行程', '管家的记事板被当众提起'],
      cliffhanger: '猫突然从诗人的座位底下钻出来，爪子底下扒着一小截蓝色缎带。',
      evidence: [
        {
          id: 'e1',
          name: '空丝绒胸针盒',
          description: '首饰盒敞着，丝绒凹槽空荡荡的，只沾着一小片干枯的薰衣草花瓣。',
          iconKey: '盒子',
          evidenceReactions: {
            '1': '夫人接过盒子愣了半天：「明明昨晚还在……哎，瞧我这记性，许是我自己放到别处去了？」',
            '2': '伯爵夫人凑近闻了闻：「薰衣草？客厅可没人用这种香。」说完若无其事地别开了眼。',
            '3': '诗人只看了一眼就低下头：「夫人的首饰，我一个写诗的，哪儿敢碰。」手指却绞紧了袖口。',
            '4': '侍者慌忙摆手：「我只管端茶递水，首饰盒碰都没碰过！」声音大得把自己吓了一跳。',
          },
        },
        {
          id: 'e2',
          name: '一截蓝色缎带',
          description: '猫爪底下扒出来的一小截蓝色缎带，颜色与胸针上的缎带一般无二。',
          iconKey: '手帕',
          evidenceReactions: {
            '1': '夫人眯眼看了半天：「是我那枚胸针上的缎带没错！好孩子，快告诉我你在哪儿捡的？」',
            '2': '伯爵夫人用扇子尖挑起缎带：「这料子倒是眼熟……哎呀，可别往我身上想。」',
            '3': '诗人的目光黏在缎带上挪不开，喃喃道：「蓝得真好看……像、像今天下午的天。」',
            '4': '侍者盯着缎带咽了口唾沫：「我……我什么都没看见，真的什么都没看见。」',
          },
        },
      ],
    },
    {
      actNumber: 2,
      title: '升温：薰衣草与诗稿',
      beats: ['传看敞开的胸针盒', '检查茶几上那张有压痕的纸', '每人可以私下向一个人提一个问题'],
      cliffhanger: '诗人的脸色，比胸针盒里的丝绒还要白。',
      evidence: [
        {
          id: 'e3',
          name: '带压痕的诗稿纸',
          description: '茶几上一张诗稿纸，被压出四四方方的印痕，印痕中央有一个小小的针孔。',
          iconKey: '纸',
          evidenceReactions: {
            '1': '夫人端详着那个针孔：「哟，谁拿首饰压纸了？这可真是……别致的镇纸。」',
            '2': '伯爵夫人一眼认出纸上的笔迹，话到嘴边又咽了回去，只端起茶杯轻轻咳了一声。',
            '3': '诗人一把将纸抚平：「草稿而已，写得不好，诸位就别笑话我了。」耳根通红。',
            '4': '侍者的眼神在纸和诗人之间来回飘：「这张纸啊……下午好像就一直在这儿的吧？」',
          },
        },
        {
          id: 'e4',
          name: '干枯的薰衣草',
          description: '丝绒凹槽里沾着的一小片薰衣草，已经干枯，却仍留着淡淡的香气。',
          iconKey: '花',
          evidenceReactions: {
            '1': '夫人拈起花瓣想了想：「今天谁襟前别着薰衣草来着？瞧我，又记不得了。」',
            '2': '伯爵夫人轻轻嗅了嗅：「是今早新摘的，露水味还在呢。」说罢摇起扇子，别开了话头。',
            '3': '诗人下意识按住自己的衣襟，干笑两声：「花嘛，宫里到处都是，到处都是。」',
            '4': '侍者挠了挠头：「早上剪花的时候，我好像看见谁来着……不，我什么都没看见。」',
          },
        },
      ],
    },
    {
      actNumber: 3,
      title: '收束：一首没写完的诗',
      beats: ['公开投票指认', '诗人当众朗读那首没写完的诗', '男爵夫人决定如何收场'],
      evidence: [
        {
          id: 'e5',
          name: '管家的记事板',
          description: '记事板上写着：「申时三刻，诗人先生借阅了夫人的首饰盒，说是要找灵感。」',
          iconKey: '本子',
          evidenceReactions: {
            '1': '夫人瞪大眼睛：「借了首饰盒？我怎么一点印象都没有……哦，也许我答应过？」',
            '2': '伯爵夫人摇着扇子慢悠悠道：「借东西总要还的，管家呀，怎么不记下还了没有呢？」',
            '3': '诗人长叹一口气：「灵感这东西，借了是要还的——东西也一样，我记得的。」',
            '4': '侍者小声嘀咕：「申时三刻啊……那时候我正在厨房洗杯子呢，一直在洗杯子。」',
          },
        },
        {
          id: 'e6',
          name: '未写完的诗稿',
          description: '诗人座位垫下压着一页诗稿，只写了三行，末尾一个字晕开了一小团墨。',
          iconKey: '纸',
          evidenceReactions: {
            '1': '夫人读了两行就笑了：「写得真好，就是……这纸怎么皱成这样，被什么压过吧？」',
            '2': '伯爵夫人别过脸去直摇头：「诗嘛，我看不懂的。」耳根却悄悄红了一片。',
            '3': '诗人把诗稿往怀里一收：「没写完的东西见不得人，日落前……日落前我一定写完。」',
            '4': '侍者盯着那团墨迹出神：「这字写得真用力啊……压了好久吧。」说完就闭紧了嘴。',
          },
        },
      ],
    },
  ],
  ending: {
    resolutionSummary:
      '真相是：诗人借走胸针压住没写完的情诗稿，本想日落前改完就还，结果一紧张忘了。胸针就别在他座位垫下的诗稿上。',
    confessionMechanic:
      '主持人请诗人当众朗读那首诗，再请每个人用一句话说说自己「借了忘了还」的小故事。',
  },
  clues: [
    {
      clueId: 'c1',
      text: '胸针盒敞着，丝绒凹槽里沾着一小片干枯的薰衣草——在场只有一个人今天襟前别着薰衣草。',
      revealedInAct: 2,
      implies: ['c2'],
    },
    {
      clueId: 'c2',
      text: '客厅茶几上有一张诗稿纸，被压出四四方方的印痕，印痕中央是一个小小的针孔。',
      revealedInAct: 2,
      implies: ['c3'],
    },
    {
      clueId: 'c3',
      text: '管家的记事板上写着：「申时三刻，诗人先生借阅了夫人的首饰盒，说是要找灵感。」',
      revealedInAct: 3,
      implies: ['c4'],
    },
    {
      clueId: 'c4',
      text: '男爵夫人的猫一直蹲在诗人的座位旁不肯走，爪子底下扒着一小截蓝色缎带——和胸针上的缎带一个颜色。',
      revealedInAct: 3,
      implies: [],
    },
  ],
  solution: {
    who: '忧郁的宫廷诗人',
    what: '借走胸针压住没写完的诗稿，打算下午茶结束前悄悄还回，结果忘了',
    why: '他想赶在日落前把情诗改到满意——用宝石压纸，是他改稿时的老习惯',
    whoSlot: 3,
    motiveIndex: 0,
  },
  motiveOptions: [
    '他想赶在日落前把情诗改到满意——用宝石压纸，是他改稿时的老习惯',
    '他想把胸针拿去变卖，补贴被拖欠的薪水',
    '他一时起了贪念，想把蓝宝石据为己有',
    '他想藏起胸针，逗大家玩一场寻人游戏',
  ],
  playerKnowledge: [
    {
      slotIndex: 0,
      knownFacts: ['胸针昨晚还在首饰盒里', '我早上打开过首饰盒', '我的猫今天一直黏着诗人'],
      secretAgenda: '我不想让别人知道我早上动过首饰盒——怕被说成老糊涂',
      truthfulAlibi: '下午一直在客厅招呼客人，抱着猫没离开过沙发',
    },
    {
      slotIndex: 1,
      knownFacts: ['我在露台待了一下午', '我回来时看见诗人在写东西', '我认得诗人的笔迹'],
      secretAgenda: '我偷看了那首诗的开头——而且，我希望它是写给我的',
      truthfulAlibi: '在露台赏玫瑰，只回客厅喝过一次茶',
    },
    {
      slotIndex: 2,
      knownFacts: ['我申时向管家借过首饰盒', '胸针别在我的诗稿上', '诗稿压在座位垫下面'],
      secretAgenda: '必须赶在下午茶结束前把胸针还回去——还要藏好那首诗',
      truthfulAlibi: '借了胸针压诗稿，本想悄悄还回，结果忘了',
    },
    {
      slotIndex: 3,
      knownFacts: ['我看见诗人把胸针别在纸上', '诗人替我瞒过打碎酒杯的事', '我一下午都在端茶'],
      secretAgenda: '我不能供出诗人——他帮过我',
      truthfulAlibi: '在茶几和厨房之间跑了一下午',
    },
  ],
  deductionChain: [
    {
      stepNumber: 1,
      fromClues: ['c1'],
      conclusion: '薰衣草把嫌疑指向诗人——他襟前正别着一枝',
    },
    {
      stepNumber: 2,
      fromClues: ['c2', 'c3'],
      conclusion: '胸针被用来压纸，而诗人确实借过首饰盒',
    },
    {
      stepNumber: 3,
      fromClues: ['c1', 'c2', 'c4'],
      conclusion: '胸针就在诗人的诗稿上——猫扒出的缎带正是胸针上的',
    },
  ],
  voteOptions: {
    what: ['借走忘了还', '藏进了诗稿', '只是误会一场', '被猫叼走了'],
    why: ['善意', '胆怯', '好面子', '健忘'],
  },
};

// ─── 仙侠 · 灵舟桂花糕（荒诞喜剧） ────────────────────────────────────────────

const SPIRIT_BOAT_CAKE: MiniScriptStoryFramework = {
  schemaVersion: 2,
  style: 'xianxia',
  genres: ['absurd_comedy'],
  title: '失踪的桂花糕',
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
    '灵舟靠岸前的最后一晚，厨娘为掌门寿辰准备的九十九块桂花糕，少了一块。舟上无人承认，但每个人的嘴角都干干净净——干净得可疑。',
  characters: [
    {
      slotIndex: 0,
      roleLabel: '贪吃的小师弟',
      sinHook: '被「贪吃」绊了一下——第一个冲进膳房，却坚称自己只是路过。',
      alibi: '在甲板练剑，练着练着就……闻到了香味。',
      secret: '你确实进过膳房，但只从另一盘糕上掰了一小块边角——少了的那块，不是你干的。',
    },
    {
      slotIndex: 1,
      roleLabel: '端庄的大师姐',
      sinHook: '被「好面子」绊了一下——身为表率，绝不能让人知道自己半夜想吃甜的。',
      alibi: '在舱内打坐一整晚，心无杂念。',
      secret: '你半夜起来过，站在膳房门口犹豫了很久，最终没进去。',
    },
    {
      slotIndex: 2,
      roleLabel: '大嗓门的厨娘',
      sinHook: '被「嘴硬」绊了一下——坚称九十九块一块不少，直到当众数了三遍。',
      alibi: '蒸完糕就回舱睡了，蒸笼明明贴了封条。',
      secret: '封条是你半夜起来补的——你发现封条歪了重新贴过，怕被认为连蒸笼都看不住。',
    },
    {
      slotIndex: 3,
      roleLabel: '云游的说书人',
      sinHook: '被「逞强」绊了一下——号称走遍四海从不迷路，昨晚却在灵舟上走错了三次舱门。',
      alibi: '在船尾给大家讲了一晚上故事，讲完就睡了。',
      secret: '你不记得昨晚梦游做了什么，但醒来时，枕边的荷包里少了三个铜板。',
    },
  ],
  act_flow: [
    {
      actNumber: 1,
      title: '开场：九十九分之一的悬案',
      beats: ['厨娘宣布桂花糕少了一块', '每人交代昨晚的行踪', '蒸笼上的三个铜板被发现'],
      cliffhanger: '字条上的字工工整整：「饼钱两讫」——可谁会给一块糕点付账？',
      evidence: [
        {
          id: 'e1',
          name: '三个铜板',
          description: '蒸笼盖上整整齐齐码着三个铜板，一个不多一个不少，像是谁认真付的账。',
          iconKey: '铜板',
          evidenceReactions: {
            '1': '小师弟眼睛一亮：「三个铜板！够买半块糕了吧？」说完赶紧捂住自己的嘴。',
            '2': '大师姐淡淡扫了一眼：「用铜板结账的，倒是个讲规矩的。」指尖却捏紧了袖口。',
            '3': '厨娘嗓门一高：「我的糕是给掌门贺寿的，谁稀罕这三个铜板！」眼圈却红了。',
            '4': '说书人把铜板码了又码：「整整齐齐三个板儿，付钱这位，讲究得吓人。」',
          },
        },
        {
          id: 'e2',
          name: '一张字条',
          description: '铜板底下压着一张字条，字工工整整：「饼钱两讫，多谢款待。」',
          iconKey: '纸条',
          evidenceReactions: {
            '1': '小师弟凑着脑袋念了两遍：「饼钱两讫……吃了糕还付账？这人有意思！」',
            '2': '大师姐轻声念道：「字写得倒端正，就是『饼』字……我们这儿明明叫糕。」',
            '3': '厨娘一把抢过字条直嚷嚷：「谁写的？站出来！我的蒸笼可不是茶楼前的摊子！」',
            '4': '说书人眯眼端详半晌：「好字！工整成这样，写的人当时心里一定特别安稳。」',
          },
        },
      ],
    },
    {
      actNumber: 2,
      title: '升温：红绳、桂花与香灰',
      beats: ['传看字条与铜板', '检查膳房门闩上的红绳', '每人可以向一个人提一个问题'],
      cliffhanger: '说书人的醒木上，红绳正好短了一截。',
      evidence: [
        {
          id: 'e3',
          name: '门闩上的红绳',
          description: '膳房门闩上挂着一小截红绳，打结的手法很特别，像是系醒木用的绳。',
          iconKey: '红绳',
          evidenceReactions: {
            '1': '小师弟拿起来比划了一下：「这结打得真巧！我们剑穗上可打不出这样的结。」',
            '2': '大师姐若有所思地抚了抚衣袖：「膳房门闩挂着红绳……昨晚，谁最后离开的？」',
            '3': '厨娘一拍大腿嚷起来：「我说封条怎么歪了！原来是有人动过我的门闩！」',
            '4': '说书人挠挠头笑了：「红绳嘛，四海之内系什么的都有，兴许是风刮来的呢？」',
          },
        },
        {
          id: 'e4',
          name: '歪斜的封条',
          description: '蒸笼上的封条贴得歪歪扭扭，边缘有撕下来又重新贴过的痕迹。',
          iconKey: '纸条',
          evidenceReactions: {
            '1': '小师弟举手喊冤：「我走的时候封条还好好的，真的，我可以对剑发誓！」',
            '2': '大师姐摇摇头：「半夜动过蒸笼的人，手脚可真不利索。」说完轻轻叹了口气。',
            '3': '厨娘眼神飘了一下：「歪……歪了吗？蒸糕的蒸汽大，熏歪的也说不定！」',
            '4': '说书人眯眼瞧了瞧：「这封条贴得，像极了我昨晚走错舱门时扶过的那一扇。」',
          },
        },
      ],
    },
    {
      actNumber: 3,
      title: '收束：一块糕的乡愁',
      beats: ['公开投票', '说书人讲一个「团圆饼」的故事', '厨娘决定怎么处理这三个铜板'],
      evidence: [
        {
          id: 'e5',
          name: '半块糕的边角',
          description: '小师弟的剑谱夹层里藏着半块糕的边角，形状和缺口对不上，是另一块上的。',
          iconKey: '糕点',
          evidenceReactions: {
            '1': '小师弟跳起来：「这是我掰的没错，可这是另一块的边角！少的那块真不是我！」',
            '2': '大师姐端详片刻，把边角轻轻放回原处：「对不对得上，一比便知，我不下定论。」',
            '3': '厨娘凑近看了看：「切口整整齐齐，是用手掰的——我们膳房的刀可不背这锅。」',
            '4': '说书人咽了口唾沫：「香，真香。我昨晚故事讲得晚，回去倒头就睡了。」',
          },
        },
      ],
    },
  ],
  ending: {
    resolutionSummary:
      '真相是：说书人梦游时把桂花糕当成了家乡的团圆饼，吃了一块，还认真地付了三个铜板。厨娘数了三遍都没数明白的账，其实从一开始就是一笔「两讫」的买卖。',
    confessionMechanic:
      '主持人请说书人把「团圆饼」的故事讲完，再请每个人说一句自己最想吃的家乡味道。',
  },
  clues: [
    {
      clueId: 'c1',
      text: '蒸笼盖上整整齐齐码着三个铜板，底下压着一张字条：「饼钱两讫，多谢款待。」',
      revealedInAct: 2,
      implies: ['c2'],
    },
    {
      clueId: 'c2',
      text: '膳房门闩上挂着一小截醒木用的红绳——全船只有说书人的醒木系这种绳。',
      revealedInAct: 2,
      implies: ['c4'],
    },
    {
      clueId: 'c3',
      text: '大师姐说自己整夜打坐，她的鞋底却沾着膳房门口的香灰。',
      revealedInAct: 2,
      implies: [],
    },
    {
      clueId: 'c4',
      text: '小师弟的剑谱夹层里藏着半块桂花糕边角——形状和缺口对不上，是从另一块上掰下来的。',
      revealedInAct: 3,
      implies: [],
    },
  ],
  solution: {
    who: '云游的说书人',
    what: '梦游时把桂花糕当成了家乡的团圆饼，吃了一块，还认真地付了三个铜板',
    why: '他离家三年，闻到桂花味，梦见了娘做的饼',
    whoSlot: 4,
    motiveIndex: 0,
  },
  motiveOptions: [
    '他离家三年，闻到桂花味，梦见了娘做的饼',
    '他半夜嘴馋，没忍住偷偷尝了一块',
    '他想替大家先尝咸淡，结果忘了说',
    '他跟厨娘斗气，故意藏起一块开玩笑',
  ],
  playerKnowledge: [
    {
      slotIndex: 0,
      knownFacts: ['我进过膳房', '我只掰了一小块边角', '我离开时蒸笼上还没有铜板'],
      secretAgenda: '不能让人知道我掰过边角——大师兄会罚我抄经',
      truthfulAlibi: '练剑后进过膳房，只掰了一小块边角',
    },
    {
      slotIndex: 1,
      knownFacts: ['我半夜去过膳房门口', '我没有进去', '我鞋底沾了香灰'],
      secretAgenda: '绝不能让人知道表率半夜馋嘴',
      truthfulAlibi: '打坐一晚，半夜只在膳房门口站过一会儿',
    },
    {
      slotIndex: 2,
      knownFacts: ['我蒸了九十九块，一块不多', '我半夜补过封条', '我数了三遍都是九十八'],
      secretAgenda: '我不敢说封条补过——掌门会觉得我连蒸笼都看不住',
      truthfulAlibi: '蒸完糕回舱睡觉，半夜起来重新贴过封条',
    },
    {
      slotIndex: 3,
      knownFacts: ['我讲完故事就睡了', '我枕边的荷包少了三个铜板', '我不记得半夜起来过'],
      secretAgenda: '我怕大家知道我梦游——以后就没人敢听我讲睡前故事了',
      truthfulAlibi: '在船尾讲故事到深夜，之后的事不记得了',
    },
  ],
  redHerrings: [
    { text: '大师姐鞋底沾着膳房门口的香灰', misleadingTarget: '端庄的大师姐' },
    { text: '小师弟剑谱里藏着桂花糕边角', misleadingTarget: '贪吃的小师弟' },
  ],
  deductionChain: [
    {
      stepNumber: 1,
      fromClues: ['c1'],
      conclusion: '「付账」说明对方不认为自己是偷——更像迷糊或梦游',
    },
    {
      stepNumber: 2,
      fromClues: ['c2', 'c4'],
      conclusion: '红绳指向说书人；小师弟掰的是另一块的边角',
    },
    {
      stepNumber: 3,
      fromClues: ['c1', 'c3'],
      conclusion: '大师姐只到过门口——真正半夜进膳房的另有其人',
    },
  ],
  voteOptions: {
    what: ['梦游吃了一块', '贪吃掰了边角', '只是数错了', '被灵宠偷吃了'],
    why: ['乡愁', '贪吃', '善意', '好面子'],
  },
};

// ─── Registry + Lookup ────────────────────────────────────────────────────────

export const MINISCRIPT_CURATED_STORIES: readonly MiniScriptStoryFramework[] = [
  VERSAILLES_BROOCH,
  SPIRIT_BOAT_CAKE,
];

/**
 * Pick the best curated story for a fallback: prefer same style sharing at
 * least one genre, then same style, then the first entry. Returns undefined
 * only when the registry is empty.
 */
export function findCuratedMiniScriptStory(
  style: MiniScriptStyle,
  genres: MiniScriptGenre[],
): MiniScriptStoryFramework | undefined {
  if (MINISCRIPT_CURATED_STORIES.length === 0) return undefined;
  const sameStyle = MINISCRIPT_CURATED_STORIES.filter((story) => story.style === style);
  const genreSet = new Set(genres);
  return (
    sameStyle.find((story) => story.genres.some((g) => genreSet.has(g))) ??
    sameStyle[0] ??
    MINISCRIPT_CURATED_STORIES[0]
  );
}
