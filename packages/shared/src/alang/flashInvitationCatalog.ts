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

const ALL_NPCS = ["alang", "lizi", "momo", "shiqi", "atuan"];

export const FLASH_INVITATION_DEFINITIONS: FlashInvitationDefinition[] = [
  { code: "T01", category: "城市出发", title: "换一条路回去", brief: "下次出门时，挑一段安全但不熟悉的路走走，不需要走远。", instructions: "不记录路线；觉得不合适就沿熟路回去。", tags: ["invitation:life", "城市", "散步", "低门槛"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T02", category: "城市出发", title: "去一个收藏过的地方", brief: "从收藏夹里选一个一直想去却没去的地方，找个合适时间真正去一次。", instructions: "地点由你决定；不要求消费，也不要求当天完成。", tags: ["invitation:life", "城市", "愿望", "探索"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T03", category: "城市出发", title: "看一次日落", brief: "找一个安全、开放的地方，认真看一次日落；错过了就改天。", instructions: "不前往偏僻、临水或封闭区域；天气不合适就放弃。", tags: ["invitation:life", "城市", "自然", "放松"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T04", category: "城市出发", title: "提前一站慢慢走", brief: "哪次时间充裕时，提前一站下车，把剩下的一小段走完。", instructions: "只在熟悉、安全、天气合适时尝试。", tags: ["invitation:life", "城市", "散步", "轻运动"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T05", category: "城市出发", title: "给周末一个去处", brief: "在周末之前决定一个真正想去的公共空间，到了那天再看要不要出发。", instructions: "只负责做决定；临时不想去也没关系。", tags: ["invitation:life", "城市", "周末", "探索"], npcSlugs: ALL_NPCS, kind: "life_invitation" },

  { code: "T06", category: "文化娱乐", title: "看掉收藏很久的电影", brief: "从想看片单里挑一部，不再继续收藏；只要把它真正打开就算开始。", instructions: "选择合法内容来源；看不完可以以后继续。", tags: ["invitation:life", "电影", "娱乐", "独处"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T07", category: "文化娱乐", title: "把那本书读十页", brief: "拿起一本一直想读却没开始的书，只读十页。", instructions: "纸书或电子书都可以；十页以后随时停下。", tags: ["invitation:life", "阅读", "安静", "低门槛"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T08", category: "文化娱乐", title: "听完一张专辑", brief: "找一张喜欢过或好奇很久的专辑，从头到尾听一次。", instructions: "不要求写感想；通勤、散步或休息时都可以。", tags: ["invitation:life", "音乐", "娱乐", "放松"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T09", category: "文化娱乐", title: "去看一场想看的东西", brief: "从电影、展览、演出或公开活动里，选一件真正感兴趣的安排下来。", instructions: "预算和时间由你决定；不因这次邀请勉强消费。", tags: ["invitation:life", "文化", "娱乐", "计划"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T10", category: "文化娱乐", title: "重看一次旧喜欢", brief: "重新看一部曾经喜欢的电影、书或节目，看看现在的你还喜不喜欢。", instructions: "选任何合法可访问的内容，不需要得出结论。", tags: ["invitation:life", "电影", "阅读", "回忆"], npcSlugs: ALL_NPCS, kind: "life_invitation" },

  { code: "T11", category: "身体动起来", title: "重新动十五分钟", brief: "选一种自己熟悉的轻运动，只做十五分钟。", instructions: "按自己的身体情况决定强度；不适就立刻停止。", tags: ["invitation:life", "运动", "低门槛", "健康边界"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T12", category: "身体动起来", title: "约一场熟悉的运动", brief: "约一个熟悉的人，重新打一场球、跑一次步或做一项你们都熟悉的运动。", instructions: "不联系陌生人；时间和强度由双方决定。", tags: ["invitation:life", "运动", "熟人", "连接"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T13", category: "身体动起来", title: "饭后走一小段", brief: "选一顿饭后，在安全的地方慢慢走十几分钟。", instructions: "天气或身体不舒服时不做；不追求步数。", tags: ["invitation:life", "散步", "放松", "低门槛"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T14", category: "身体动起来", title: "把旧爱好拿回来", brief: "重新碰一次以前喜欢的运动，只做最轻松的那部分。", instructions: "不挑战危险动作，不拿过去的水平要求现在。", tags: ["invitation:life", "运动", "重新开始", "兴趣"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T15", category: "身体动起来", title: "去户外待半小时", brief: "找个安全、开放的时间，到户外待半小时；走不走都可以。", instructions: "避开极端天气、偏僻区域和危险水边。", tags: ["invitation:life", "户外", "城市", "放松"], npcSlugs: ALL_NPCS, kind: "life_invitation" },

  { code: "T16", category: "一直想做", title: "把拖延缩成五分钟", brief: "挑一件一直想做的事，只完成它最前面的五分钟。", instructions: "目标不是做完，而是让它真正开始。", tags: ["invitation:life", "开始", "拖延", "低门槛"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T17", category: "一直想做", title: "做一道一直想吃的东西", brief: "做一道一直想尝试的食物；不想做饭，也可以认真安排一次想吃的东西。", instructions: "尊重饮食限制和预算；不要求选择具体商户。", tags: ["invitation:life", "食物", "愿望", "生活"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T18", category: "一直想做", title: "把小作品重新拿出来", brief: "把搁置的画、文字、手工或其他小作品重新拿出来碰一会儿。", instructions: "不用完成，也不用公开给任何人看。", tags: ["invitation:life", "创作", "重新开始", "独处"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T19", category: "一直想做", title: "学十五分钟就停", brief: "打开一个一直想学的小技能，只学十五分钟。", instructions: "不购买课程也可以；先使用已有资源。", tags: ["invitation:life", "学习", "兴趣", "低门槛"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T20", category: "一直想做", title: "处理一个小角落", brief: "从一直拖着的事情里，挑一个三十分钟内能处理的小角落。", instructions: "不要因此开启大扫除；只处理事先选定的范围。", tags: ["invitation:life", "整理", "完成", "生活"], npcSlugs: ALL_NPCS, kind: "life_invitation" },

  { code: "T21", category: "关系连接", title: "约一次说了很久的见面", brief: "找一位熟悉且愿意联系的人，把一直说却没约成的见面定下来。", instructions: "只联系熟人；对方没有回应就到此为止。", tags: ["invitation:life", "熟人", "见面", "连接"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T22", category: "关系连接", title: "发一句真心的问候", brief: "给一位确实想联系的熟人发一句简单问候，不需要铺垫很长。", instructions: "不联系已明确拒绝沟通的人，也不要求对方回复。", tags: ["invitation:life", "熟人", "问候", "低压力"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T23", category: "关系连接", title: "认真吃一顿饭", brief: "和熟悉的人，或者只和自己，认真吃一顿一直想吃的饭。", instructions: "预算、饮食限制和是否消费都由你决定。", tags: ["invitation:life", "食物", "熟人", "独处"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T24", category: "关系连接", title: "把一句谢谢说出来", brief: "如果心里确实有一个想感谢的熟人，找个合适方式把谢谢说出来。", instructions: "不要求公开表达，不要求对方作出回应。", tags: ["invitation:life", "熟人", "感谢", "连接"], npcSlugs: ALL_NPCS, kind: "life_invitation" },
  { code: "T25", category: "关系连接", title: "完成一次共同的小计划", brief: "和熟悉的人完成一件一直说着要做、但还没开始的小事。", instructions: "双方都可以随时改期或取消。", tags: ["invitation:life", "熟人", "计划", "一起"], npcSlugs: ALL_NPCS, kind: "life_invitation" },

  { code: "T26", category: "NPC传话", title: "替阿浪把话带给栗子", brief: "下次遇见栗子时，替阿浪说：我没有不想一起走，只是走得慢了一点。", instructions: "只在小程序里向数字NPC转交；你可以原话带到、换种说法或不说。", tags: ["invitation:npc_message", "target-npc:lizi", "阿浪", "栗子"], npcSlugs: ["alang"], kind: "npc_message", targetNpcSlug: "lizi", targetNpcName: "栗子", messageCopy: "我没有不想一起走，只是走得慢了一点。" },
  { code: "T27", category: "NPC传话", title: "替栗子问问默默", brief: "下次遇见默默时，替栗子问：要不要找一天一起去看看风？", instructions: "只在小程序里向数字NPC转交；不涉及现实人物。", tags: ["invitation:npc_message", "target-npc:momo", "栗子", "默默"], npcSlugs: ["lizi"], kind: "npc_message", targetNpcSlug: "momo", targetNpcName: "默默", messageCopy: "要不要找一天一起去看看风？" },
  { code: "T28", category: "NPC传话", title: "替默默谢谢阿团", brief: "下次遇见阿团时，替默默说：上次你留的位置，我记得。", instructions: "只在小程序里向数字NPC转交；忘了也没关系。", tags: ["invitation:npc_message", "target-npc:atuan", "默默", "阿团"], npcSlugs: ["momo"], kind: "npc_message", targetNpcSlug: "atuan", targetNpcName: "阿团", messageCopy: "上次你留的位置，我记得。" },
  { code: "T29", category: "NPC传话", title: "替拾柒确认一句话", brief: "下次遇见阿浪时，替拾柒问：那根黑色羽毛，你真的没看见吗？", instructions: "只在小程序里向数字NPC转交；这是虚构角色之间的故事。", tags: ["invitation:npc_message", "target-npc:alang", "拾柒", "阿浪"], npcSlugs: ["shiqi"], kind: "npc_message", targetNpcSlug: "alang", targetNpcName: "阿浪", messageCopy: "那根黑色羽毛，你真的没看见吗？" },
  { code: "T30", category: "NPC传话", title: "替阿团叫住拾柒", brief: "下次遇见拾柒时，替阿团说：别总走那么快，我还留了一句话。", instructions: "只在小程序里向数字NPC转交；你可以选择这次不说。", tags: ["invitation:npc_message", "target-npc:shiqi", "阿团", "拾柒"], npcSlugs: ["atuan"], kind: "npc_message", targetNpcSlug: "shiqi", targetNpcName: "拾柒", messageCopy: "别总走那么快，我还留了一句话。" },
];

export function getFlashInvitationDefinition(code: string): FlashInvitationDefinition | null {
  return FLASH_INVITATION_DEFINITIONS.find((item) => item.code === code) ?? null;
}
