/**
 * Archetype Waiting Copy (Wave 2 — EXP_ARCHETYPE_WAITING)
 *
 * Maps the user's primary archetype to personalised waiting-screen copy.
 * Archetypes are clustered by social energy level so that we only need
 * 4 copy clusters rather than 12 individual variants.
 *
 * Cluster mapping (based on energyLevel in archetypes.ts):
 *   HIGH_ENERGY  (energyLevel ≥ 85): corgi, rooster, hamster_praise
 *   CONNECTOR    (energyLevel 70-84): fox, dolphin_calm, spider
 *   WARMTH       (energyLevel 55-69): koala, octopus
 *   STEADY       (energyLevel <  55): owl, elephant, turtle, cat
 *
 * Falls back to the generic copy exported as `GENERIC_ARCHETYPE_WAITING_COPY`.
 */

export interface ArchetypeWaitingCopy {
  headline: string;
  subtext: string;
  badge: string | null;
  badgeGradient: string;
}

type ArchetypeCopyCluster = "high_energy" | "connector" | "warmth" | "steady";

const ARCHETYPE_CLUSTER_MAP: Record<string, ArchetypeCopyCluster> = {
  corgi: "high_energy",
  rooster:   "high_energy",
  hamster_praise:   "high_energy",
  fox:   "connector",
  dolphin_calm: "connector",
  spider:   "connector",
  koala:   "warmth",
  octopus: "warmth",
  owl: "steady",
  elephant: "steady",
  turtle:   "steady",
  cat:   "steady",
};

const CLUSTER_COPY: Record<ArchetypeCopyCluster, ArchetypeWaitingCopy> = {
  high_energy: {
    headline: "你的能量正在感召同频的人！",
    subtext:
      "小悦已经感受到你的活力了 ✨ 正在帮你物色几个气场一样旺盛的伙伴，准备好迎接好玩的人吧！",
    badge: "活力召唤中",
    badgeGradient: "from-orange-400/80 to-amber-400/80",
  },
  connector: {
    headline: "你的魅力已经开始起作用了",
    subtext:
      "有趣的对话需要有趣的人。小悦正在为你找那些一见如故、聊开了停不下来的人 🦊",
    badge: "连接中",
    badgeGradient: "from-purple-400/80 to-violet-400/80",
  },
  warmth: {
    headline: "专属你的温暖一桌正在成形",
    subtext:
      "小悦在帮你找那些能让对话变得温暖真实的伙伴 🐻 稍等片刻，好的组合需要一点耐心。",
    badge: "精心配对中",
    badgeGradient: "from-rose-400/80 to-pink-400/80",
  },
  steady: {
    headline: "你的那桌人正在悄悄就位",
    subtext:
      "不急，好的组合不将就 🦉 小悦正在认真筛选，确保你这次遇到的人都值得一谈。",
    badge: "稳步推进中",
    badgeGradient: "from-teal-400/80 to-cyan-400/80",
  },
};

export const GENERIC_ARCHETYPE_WAITING_COPY: ArchetypeWaitingCopy = {
  headline: "小悦正在为你寻找气场相符的伙伴",
  subtext: "正在匹配中，稍等片刻就能和新朋友见面啦！",
  badge: null,
  badgeGradient: "",
};

/**
 * Returns archetype-personalised waiting copy for the given archetype string.
 * Returns `GENERIC_ARCHETYPE_WAITING_COPY` when the archetype is unknown or
 * the input is null / undefined.
 */
export function getArchetypeWaitingCopy(
  archetype: string | null | undefined,
): ArchetypeWaitingCopy {
  if (!archetype) return GENERIC_ARCHETYPE_WAITING_COPY;
  const cluster = ARCHETYPE_CLUSTER_MAP[archetype];
  if (!cluster) return GENERIC_ARCHETYPE_WAITING_COPY;
  return CLUSTER_COPY[cluster];
}
