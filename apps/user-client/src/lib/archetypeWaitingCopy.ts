type FillState = "waiting" | "can_form" | "full";

interface ArchetypeTone {
  waitingHeadline: string;
  waitingSubtext: string;
  canFormHeadline: string;
  canFormSubtext: string;
  fullHeadline: string;
  fullSubtext: string;
}

export interface WaitingCopy {
  headline: string;
  subtext: string;
  badge: string | null;
  badgeGradient: string;
}

const FALLBACK_TONE: ArchetypeTone = {
  waitingHeadline: "好局正在慢慢集合",
  waitingSubtext: "与其随便凑一桌，不如等一个更对味的组合。",
  canFormHeadline: "已经有感觉了，再等等会更完整",
  canFormSubtext: "人数已到成局门槛，小悦还在替你找更合拍的最后几位。",
  fullHeadline: "人齐了，惊喜正在成形",
  fullSubtext: "大家已经到位，小悦正在把最舒服的组合锁定下来。",
};

const ARCHETYPE_TONES: Record<string, ArchetypeTone> = {
  开心柯基: {
    waitingHeadline: "好局正在集合！你的能量已在线",
    waitingSubtext: "再来几位会接梗、也会接住你的伙伴，这桌就会立刻热起来。",
    canFormHeadline: "热场阵容快齐了",
    canFormSubtext: "已经可以开聊，再等等，整桌的节奏会更带感。",
    fullHeadline: "全员到位，马上开局发光",
    fullSubtext: "这桌的气氛值已经拉满，小悦正在做最后的排兵布阵。",
  },
  太阳鸡: {
    waitingHeadline: "暖场的光已经亮起来了",
    waitingSubtext: "再来几位情绪稳定又会接住彼此的人，今晚就会很舒服。",
    canFormHeadline: "暖意已成形，再等等更圆满",
    canFormSubtext: "已经有成局的温度了，小悦在补最后一点刚刚好的亮度。",
    fullHeadline: "温暖阵容集结完成",
    fullSubtext: "大家都到了，接下来轮到惊喜自然发生。",
  },
  夸夸豚: {
    waitingHeadline: "会接住你的人正在路上",
    waitingSubtext: "我们在等那种一开口就会让人更放松、更敢表达的组合。",
    canFormHeadline: "舒服的回应感已经出现",
    canFormSubtext: "这一桌已经有被看见的感觉了，再等等会更完整。",
    fullHeadline: "会互相点亮的一桌到齐了",
    fullSubtext: "现在只差小悦把节奏排好，这场相遇就能顺滑展开。",
  },
  机智狐: {
    waitingHeadline: "有趣的人正在往你这桌靠近",
    waitingSubtext: "我们在等那种会抛梗、会接招、还能带来新鲜感的组合。",
    canFormHeadline: "灵感局已经冒头了",
    canFormSubtext: "人数够了，小悦还想再多找一点脑洞和默契。",
    fullHeadline: "灵感阵容已锁定",
    fullSubtext: "新鲜感和化学反应都到位了，接下来就是揭晓时刻。",
  },
  淡定海豚: {
    waitingHeadline: "节奏会舒服的人，正在慢慢靠拢",
    waitingSubtext: "我们宁愿多等一会，也想给你一桌自然、不卡壳的聊天频率。",
    canFormHeadline: "这桌已经开始顺起来了",
    canFormSubtext: "人数已够，小悦还在微调整体节拍，让你更轻松融进去。",
    fullHeadline: "顺频组合准备就绪",
    fullSubtext: "所有节奏点都已到位，接下来等小悦优雅揭晓。",
  },
  织网蛛: {
    waitingHeadline: "共同点正在被悄悄织起来",
    waitingSubtext: "小悦在找那些彼此之间会自然连上话题的人。",
    canFormHeadline: "这张网快织完整了",
    canFormSubtext: "已经可成局，再补上几位关键连接点，氛围会更顺。",
    fullHeadline: "会彼此连上的一桌已成形",
    fullSubtext: "共同点和火花都准备好了，就等揭开这张网。",
  },
  暖心熊: {
    waitingHeadline: "会让人安心的一桌，正在慢慢靠近",
    waitingSubtext: "我们在等会听、会回应、也会让人放松下来的人齐。",
    canFormHeadline: "这桌已经有被理解的感觉",
    canFormSubtext: "人数够了，小悦还在补一点更贴心的默契。",
    fullHeadline: "温柔阵容已经到齐",
    fullSubtext: "今晚大概率会是一场被认真接住的相遇。",
  },
  灵感章鱼: {
    waitingHeadline: "脑洞会被接住的人还在集合",
    waitingSubtext: "我们想给你一桌既能认真聊，也能突然跑偏到很好玩的伙伴。",
    canFormHeadline: "灵感已经开始冒泡了",
    canFormSubtext: "人数已到门槛，再等等，这桌会更有戏。",
    fullHeadline: "灵感局已蓄势待发",
    fullSubtext: "现在就差揭开盒子，看看谁会陪你把话题玩出花。",
  },
  沉思猫头鹰: {
    waitingHeadline: "值得深聊的人，正在被筛出来",
    waitingSubtext: "我们在等会认真听、会认真想，也愿意把话题聊深一点的人。",
    canFormHeadline: "深聊局已经有雏形了",
    canFormSubtext: "人数够了，小悦还在替你找最后几位高质量对话者。",
    fullHeadline: "高质量对话局已到位",
    fullSubtext: "盒子快开了，这桌很可能会聊得比你预期更深。",
  },
  定心大象: {
    waitingHeadline: "稳稳的一桌，值得再等等",
    waitingSubtext: "我们在找让人一坐下就安心、自然、不用硬撑气氛的伙伴。",
    canFormHeadline: "安心感已经开始出现",
    canFormSubtext: "人数够了，小悦正在补最后几位能把气场稳住的人。",
    fullHeadline: "安心阵容准备完毕",
    fullSubtext: "这桌已经很像会让人放松下来的那种相遇了。",
  },
  稳如龟: {
    waitingHeadline: "慢一点也没关系，好的局会自己浮现",
    waitingSubtext: "我们在等会思考、会观察、也不会给彼此压力的人齐。",
    canFormHeadline: "慢热但对味的组合快成了",
    canFormSubtext: "已经可以开局，再等等，整桌会更有层次。",
    fullHeadline: "沉稳阵容已经就位",
    fullSubtext: "这场相遇不急着热闹，但很可能越聊越有味道。",
  },
  隐身猫: {
    waitingHeadline: "静静等人齐，好的社交不需要喧闹",
    waitingSubtext: "我们在等那种不必用力表现，也能舒服待在一起的人。",
    canFormHeadline: "这桌已经有低压感了",
    canFormSubtext: "人数到了，小悦还在把气场调到更轻松、更不费力。",
    fullHeadline: "舒服的安静感已经成形",
    fullSubtext: "这场局不需要硬热场，合适的人已经都在路上了。",
  },
};

export function getArchetypeWaitingCopy(params: {
  archetype?: string | null;
  fillState: FillState;
  filledCount: number;
  minGroupSize: number;
  maxGroupSize: number;
}): WaitingCopy {
  const tone = (params.archetype && ARCHETYPE_TONES[params.archetype]) || FALLBACK_TONE;

  switch (params.fillState) {
    case "full":
      return {
        headline: tone.fullHeadline,
        subtext: tone.fullSubtext,
        badge: "人齐啦",
        badgeGradient: "from-emerald-400/90 via-violet-400/90 to-fuchsia-400/90",
      };
    case "can_form":
      return {
        headline: tone.canFormHeadline,
        subtext:
          params.filledCount >= params.maxGroupSize
            ? tone.fullSubtext
            : tone.canFormSubtext,
        badge: `已达 ${params.minGroupSize} 人成局线`,
        badgeGradient: "from-amber-400/90 to-orange-400/90",
      };
    case "waiting":
    default: {
      const need = Math.max(params.minGroupSize - params.filledCount, 0);
      return {
        headline: tone.waitingHeadline,
        subtext: need > 0 ? `${tone.waitingSubtext} 再来 ${need} 位就能成局。` : tone.waitingSubtext,
        badge: "盲盒集结中",
        badgeGradient: "from-violet-400/80 to-indigo-400/80",
      };
    }
  }
}
