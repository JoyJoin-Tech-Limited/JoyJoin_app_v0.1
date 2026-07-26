export type FlashInvitationKind = "life_invitation" | "npc_message";

export type FlashInvitationDefinition = {
  code: string;
  category: string;
  title: string;
  brief: string;
  instructions: string;
  tags: string[];
  npcSlugs: string[];
  kind: FlashInvitationKind;
  targetNpcSlug?: string;
  targetNpcName?: string;
  messageCopy?: string;
};

const ALANG = ["alang"];
const LIZI = ["lizi"];
const MOMO = ["momo"];
const SHIQI = ["shiqi"];
const ATUAN = ["atuan"];

export const FLASH_INVITATION_DEFINITIONS: FlashInvitationDefinition[] = [
  { code: "T01", category: "城市出发", title: "今天换一小段路", brief: "现在挑一段安全但不熟悉的路，今天出门时从那里走一小段。不需要走远，回来告诉阿浪你看见了什么。", instructions: "不记录路线；时间、天气或环境不合适就沿熟路回去。", tags: ["invitation:life", "城市", "散步", "低门槛"], npcSlugs: ALANG, kind: "life_invitation" },
  { code: "T02", category: "城市出发", title: "打开一个收藏过的地方", brief: "现在打开收藏夹，选一个一直想去却没去的地方。条件合适就今天去看看；暂时出不了门，至少把它从收藏变成一个确定的目的地。", instructions: "地点由你决定；不要求消费，也不在时间、天气不安全时出发。", tags: ["invitation:life", "城市", "愿望", "探索"], npcSlugs: ALANG, kind: "life_invitation" },
  { code: "T03", category: "城市出发", title: "今天去看一次天色", brief: "现在看看今天的日落时间，选一个安全、开放的公共空间。天气和时间合适就去看一会儿，回来告诉阿浪今天的天是什么颜色。", instructions: "不前往偏僻、临水或封闭区域；天气、时间不合适就只完成选点。", tags: ["invitation:life", "城市", "自然", "放松"], npcSlugs: ALANG, kind: "life_invitation" },
  { code: "T04", category: "城市出发", title: "今天提前一站走走", brief: "现在想想今天的一段行程。时间充裕、路线熟悉安全的话，提前一站下车，把剩下的一小段慢慢走完。", instructions: "只在熟悉、安全、天气合适时尝试；条件不合适就不提前下车。", tags: ["invitation:life", "城市", "散步", "轻运动"], npcSlugs: ALANG, kind: "life_invitation" },
  { code: "T05", category: "城市出发", title: "现在给周末选个去处", brief: "现在选一个周末真正想去的公共空间，把名字记下来。到了周末还想去就出发；改变主意也回来告诉阿浪。", instructions: "先完成选择；是否出发由当天的时间、天气和你的意愿决定。", tags: ["invitation:life", "城市", "周末", "探索"], npcSlugs: ALANG, kind: "life_invitation" },

  { code: "T06", category: "文化娱乐", title: "看一部一直想看的电影", brief: "现在从想看片单里挑一部一直没看的电影，把它真正打开。看十分钟也算出发。下次见面，回来跟栗子讲讲你喜不喜欢。", instructions: "选择合法内容来源；看不完可以停，不需要为了完成任务勉强看下去。", tags: ["invitation:life", "电影", "娱乐", "独处"], npcSlugs: LIZI, kind: "life_invitation" },
  { code: "T07", category: "文化娱乐", title: "现在把那本书翻开", brief: "现在拿起一本一直想读却没开始的书，只读十页。读到一句想留下的话，下次可以讲给默默听。", instructions: "纸书或电子书都可以；十页以前不想读了也可以停。", tags: ["invitation:life", "阅读", "安静", "低门槛"], npcSlugs: MOMO, kind: "life_invitation" },
  { code: "T08", category: "文化娱乐", title: "现在播放那张专辑", brief: "现在找一张喜欢过或好奇很久的专辑，从第一首开始播放。听一首也算开始，下次告诉默默哪种声音留了下来。", instructions: "不要求听完或写感想；使用已有的合法内容来源。", tags: ["invitation:life", "音乐", "娱乐", "放松"], npcSlugs: MOMO, kind: "life_invitation" },
  { code: "T09", category: "文化娱乐", title: "现在选一场真正想看的", brief: "现在从电影、展览、演出或公开活动里，选一件真正感兴趣的，打开时间和地点看清楚。适合今天就去；不适合就先把决定做出来。", instructions: "预算和时间由你决定；不因这次邀请勉强消费或预约。", tags: ["invitation:life", "文化", "娱乐", "计划"], npcSlugs: LIZI, kind: "life_invitation" },
  { code: "T10", category: "文化娱乐", title: "重温一部旧喜欢", brief: "现在挑一部以前很喜欢的电影、书或节目，重新打开看看。下次遇见默默，告诉它现在的你还喜不喜欢。", instructions: "选任何合法可访问的内容；看一小段就可以，不需要得出结论。", tags: ["invitation:life", "电影", "阅读", "回忆"], npcSlugs: MOMO, kind: "life_invitation" },

  { code: "T11", category: "身体动起来", title: "现在动十五分钟", brief: "现在选一种自己熟悉的轻运动，先做十五分钟。不用追回过去的状态，只让今天的身体醒一醒。", instructions: "按自己的身体情况决定强度；不适就立刻停止。", tags: ["invitation:life", "运动", "低门槛", "健康边界"], npcSlugs: ATUAN, kind: "life_invitation" },
  { code: "T12", category: "身体动起来", title: "现在约一场熟悉的运动", brief: "现在给一个熟悉的人发消息，约一次你们都熟悉的运动。约成是后续，今天先把邀请发出去。", instructions: "不联系陌生人；对方没有回应就到此为止，时间和强度由双方决定。", tags: ["invitation:life", "运动", "熟人", "连接"], npcSlugs: LIZI, kind: "life_invitation" },
  { code: "T13", category: "身体动起来", title: "现在出去走一小段", brief: "现在看看身体和天气，如果都舒服，就在安全的地方慢慢走十几分钟。不追步数，只听一会儿周围的声音。", instructions: "天气或身体不舒服时不做；只走熟悉、开放、安全的路线。", tags: ["invitation:life", "散步", "放松", "低门槛"], npcSlugs: MOMO, kind: "life_invitation" },
  { code: "T14", category: "身体动起来", title: "现在碰一下旧爱好", brief: "现在重新碰一次以前喜欢的运动，只做最轻松、最熟悉的那部分。看看身体还记不记得它。", instructions: "不挑战危险动作，不拿过去的水平要求现在。", tags: ["invitation:life", "运动", "重新开始", "兴趣"], npcSlugs: SHIQI, kind: "life_invitation" },
  { code: "T15", category: "身体动起来", title: "现在去户外透口气", brief: "现在看看天气和时间，合适就到安全、开放的户外待一会儿。走不走都可以，先让今天多一点外面的空气。", instructions: "避开极端天气、偏僻区域、危险水边和天黑后的陌生路线。", tags: ["invitation:life", "户外", "城市", "放松"], npcSlugs: ATUAN, kind: "life_invitation" },

  { code: "T16", category: "一直想做", title: "现在把拖延缩成五分钟", brief: "现在挑一件一直想做的事，只完成最前面的五分钟。五分钟以后停不停，由你决定。", instructions: "目标不是做完，而是让它今天真正开始。", tags: ["invitation:life", "开始", "拖延", "低门槛"], npcSlugs: SHIQI, kind: "life_invitation" },
  { code: "T17", category: "一直想做", title: "现在安排那口一直想吃的", brief: "现在想一道惦记很久的食物。能做就从第一步开始；不想做饭，就把它认真安排进今天的一餐。", instructions: "尊重饮食限制和预算；不要求消费或选择具体商户。", tags: ["invitation:life", "食物", "愿望", "生活"], npcSlugs: LIZI, kind: "life_invitation" },
  { code: "T18", category: "一直想做", title: "现在把小作品拿出来", brief: "现在把搁置的画、文字、手工或其他小作品重新打开，碰它五分钟。不是催你完成，只想看看它还会不会回应你。", instructions: "不用完成，也不用公开给任何人看。", tags: ["invitation:life", "创作", "重新开始", "独处"], npcSlugs: SHIQI, kind: "life_invitation" },
  { code: "T19", category: "一直想做", title: "现在学十五分钟", brief: "现在打开一个一直想学的小技能，只学十五分钟。今天不需要变厉害，只要留下第一个痕迹。", instructions: "不购买课程也可以；先使用已有的合法资源。", tags: ["invitation:life", "学习", "兴趣", "低门槛"], npcSlugs: SHIQI, kind: "life_invitation" },
  { code: "T20", category: "一直想做", title: "现在处理一个小角落", brief: "现在从一直拖着的事情里，挑一个三十分钟内能处理的小角落。只动这一小块，结束以后就停。", instructions: "不要因此开启大扫除；只处理事先选定的范围。", tags: ["invitation:life", "整理", "完成", "生活"], npcSlugs: SHIQI, kind: "life_invitation" },

  { code: "T21", category: "关系连接", title: "现在把那次见面约出来", brief: "现在找一位熟悉且愿意联系的人，为一直说却没约成的见面发出一个具体邀请。今天只负责开口。", instructions: "只联系熟人；对方没有回应或拒绝就到此为止。", tags: ["invitation:life", "熟人", "见面", "连接"], npcSlugs: ATUAN, kind: "life_invitation" },
  { code: "T22", category: "关系连接", title: "现在发一句真心问候", brief: "现在给一位确实想联系的熟人发一句简单问候，不用想很长的开场。发出去以后，就把回应留给对方。", instructions: "不联系已明确拒绝沟通的人，也不要求对方回复。", tags: ["invitation:life", "熟人", "问候", "低压力"], npcSlugs: ATUAN, kind: "life_invitation" },
  { code: "T23", category: "关系连接", title: "今天认真吃一顿饭", brief: "现在决定今天哪一顿饭不敷衍自己。可以和熟悉的人一起，也可以只和自己，认真吃一顿真正想吃的。", instructions: "预算、饮食限制和是否消费都由你决定。", tags: ["invitation:life", "食物", "熟人", "独处"], npcSlugs: MOMO, kind: "life_invitation" },
  { code: "T24", category: "关系连接", title: "现在把一句谢谢说出来", brief: "如果心里确实有一个想感谢的熟人，现在用合适的方式把谢谢说出来。不用写得漂亮，真心就够了。", instructions: "不要求公开表达，不联系已拒绝沟通的人，也不要求对方回应。", tags: ["invitation:life", "熟人", "感谢", "连接"], npcSlugs: ATUAN, kind: "life_invitation" },
  { code: "T25", category: "关系连接", title: "现在启动共同的小计划", brief: "现在给熟悉的人发一句话，把你们一直说着要做的小事往前推一步。先定下第一步，不要求今天全部完成。", instructions: "只联系熟人；双方都可以改期、取消或换一个计划。", tags: ["invitation:life", "熟人", "计划", "一起"], npcSlugs: LIZI, kind: "life_invitation" },

  { code: "T26", category: "NPC传话", title: "替阿浪把话带给栗子", brief: "下次遇见栗子时，替阿浪说：我没有不想一起走，只是走得慢了一点。", instructions: "只在小程序里向数字NPC转交；你可以原话带到、换种说法或不说。", tags: ["invitation:npc_message", "target-npc:lizi", "阿浪", "栗子"], npcSlugs: ["alang"], kind: "npc_message", targetNpcSlug: "lizi", targetNpcName: "栗子", messageCopy: "我没有不想一起走，只是走得慢了一点。" },
  { code: "T27", category: "NPC传话", title: "替栗子问问默默", brief: "下次遇见默默时，替栗子问：要不要找一天一起去看看风？", instructions: "只在小程序里向数字NPC转交；不涉及现实人物。", tags: ["invitation:npc_message", "target-npc:momo", "栗子", "默默"], npcSlugs: ["lizi"], kind: "npc_message", targetNpcSlug: "momo", targetNpcName: "默默", messageCopy: "要不要找一天一起去看看风？" },
  { code: "T28", category: "NPC传话", title: "替默默谢谢阿团", brief: "下次遇见阿团时，替默默说：上次你留的位置，我记得。", instructions: "只在小程序里向数字NPC转交；忘了也没关系。", tags: ["invitation:npc_message", "target-npc:atuan", "默默", "阿团"], npcSlugs: ["momo"], kind: "npc_message", targetNpcSlug: "atuan", targetNpcName: "阿团", messageCopy: "上次你留的位置，我记得。" },
  { code: "T29", category: "NPC传话", title: "替拾柒确认一句话", brief: "下次遇见阿浪时，替拾柒问：那根黑色羽毛，你真的没看见吗？", instructions: "只在小程序里向数字NPC转交；这是虚构角色之间的故事。", tags: ["invitation:npc_message", "target-npc:alang", "拾柒", "阿浪"], npcSlugs: ["shiqi"], kind: "npc_message", targetNpcSlug: "alang", targetNpcName: "阿浪", messageCopy: "那根黑色羽毛，你真的没看见吗？" },
  { code: "T30", category: "NPC传话", title: "替阿团叫住拾柒", brief: "下次遇见拾柒时，替阿团说：别总走那么快，我还留了一句话。", instructions: "只在小程序里向数字NPC转交；你可以选择这次不说。", tags: ["invitation:npc_message", "target-npc:shiqi", "阿团", "拾柒"], npcSlugs: ["atuan"], kind: "npc_message", targetNpcSlug: "shiqi", targetNpcName: "拾柒", messageCopy: "别总走那么快，我还留了一句话。" },
];

export function getFlashInvitationDefinition(code: string): FlashInvitationDefinition | null {
  return FLASH_INVITATION_DEFINITIONS.find((item) => item.code === code) ?? null;
}
