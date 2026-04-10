import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PersonalityRadarChart from "@/components/PersonalityRadarChart";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import StyleSpectrum from "@/components/StyleSpectrum";
import { ShareCardModal } from "@/components/ShareCardModal";
import { Sparkles, Users, TrendingUp, Heart, Eye, Crown, ChevronDown, Zap, Star, MessageSquare, ThumbsUp, ThumbsDown, Loader2, Image } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  archetypeAvatars, 
  getArchetypeGradient, 
  getArchetypeNarrative, 
  getArchetypeInsights 
} from '@/lib/archetypeAdapter';
import { getCompatibilityDescription } from "@/lib/archetypeCompatibility";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useXiaoyueAnalysis } from "@/hooks/useXiaoyueAnalysis";
import { useAnonymousPersonalityTestResults } from "@/hooks/useAnonymousPersonalityTestResults";
import PersonalityShareToolkit from "@/components/personality/PersonalityShareToolkit";
import { derivePersonalityShareToolkit } from "@/lib/personalityResultShareToolkit";
import { personalityResultAnalytics } from "@/lib/personalityResultAnalytics";
import { getStyleSpectrum, getAllArchetypeScores } from "@shared/personality/matcherV2";
import { ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateUserDerivedQueries } from "@/lib/userStateInvalidation";
import { FancyLineLoadingScreen } from "@/components/FancyLineLoadingScreen";
import { ArchetypeSlotMachine } from "@/components/slot-machine";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import type { AuthUser } from "@/hooks/useAuth";
import { getArchetypeColorHSL } from "@/components/slot-machine/archetypeData";
import { SkipAnimationButton } from "@/components/SkipAnimationButton";
import { useAuth } from "@/hooks/useAuth";
import type { PersonalityTopArchetypeCandidate } from "@/lib/personalityResultShareToolkit";

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

const reducedMotionContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const reducedMotionItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
};

// Stable shake keyframes for results hero — defined outside component so the
// reference never changes between renders, ensuring the shake plays only once.
const heroShakeAnimate = { opacity: 1, x: [0, -6, 6, -4, 4, -2, 2, 0] } as const;
const heroFadeAnimate = { opacity: 1 } as const;
const heroShakeTransition = { duration: 0.6, ease: "easeOut" } as const;

const traitLabels: Record<string, string> = {
  A: '亲和力',
  O: '开放性',
  C: '责任心',
  E: '情绪稳定',
  X: '外向性',
  P: '正能量',
};

// Canonical archetype trait weights from matcherV2 PROTOTYPE_SOUL_TRAITS
// primary: 1.6-1.8x weight, secondary: 1.2-1.3x, avoid: 0.4-0.8x (penalized)
const ARCHETYPE_TRAIT_WEIGHTS: Record<string, { 
  primary: Record<string, number>; 
  secondary: Record<string, number>;
  avoid: Record<string, number>; 
}> = {
  "定心大象": { primary: { E: 1.8 }, secondary: { C: 1.3, A: 1.2 }, avoid: { X: 0.7, O: 0.7 } },
  "织网蛛": { primary: { C: 1.8 }, secondary: { E: 1.3, A: 1.2 }, avoid: { P: 0.7, X: 0.8 } },
  "太阳鸡": { primary: { P: 1.8 }, secondary: { E: 1.3, C: 1.2, X: 1.2 }, avoid: { O: 0.6 } },
  "夸夸豚": { primary: { A: 1.7, X: 1.6 }, secondary: { P: 1.3 }, avoid: { C: 0.7, O: 0.8 } },
  "机智狐": { primary: { O: 1.8 }, secondary: { X: 1.3, P: 1.2 }, avoid: { A: 0.7, C: 0.7 } },
  "暖心熊": { primary: { A: 1.8 }, secondary: { E: 1.3, P: 1.2 }, avoid: { O: 0.7, X: 0.4 } },
  "稳如龟": { primary: { E: 1.8, C: 1.7 }, secondary: { A: 1.2 }, avoid: { X: 0.6, O: 0.6, P: 0.7 } },
  "开心柯基": { primary: { X: 1.7, P: 1.6 }, secondary: { A: 1.3, E: 1.2 }, avoid: { C: 0.8, O: 0.8 } },
  "沉思猫头鹰": { primary: { O: 1.8 }, secondary: { C: 1.3, E: 1.2 }, avoid: { X: 0.6, A: 0.7, P: 0.7 } },
  "淡定海豚": { primary: { E: 1.7, O: 1.5 }, secondary: { A: 1.2 }, avoid: { X: 0.7, P: 0.6 } },
  "隐身猫": { primary: { E: 1.6 }, secondary: { O: 1.2 }, avoid: { X: 0.6, A: 0.6 } },
  "灵感章鱼": { primary: { O: 1.8 }, secondary: { P: 1.3, X: 1.2 }, avoid: { C: 0.6, E: 0.8 } },
};

// Find the key differentiating trait between two archetypes with matcher weight context
function findDifferentiatingTrait(
  primaryArchetype: string,
  runnerUpArchetype: string,
  userTraits: Record<string, number>
): { trait: string; reason: string; weightContext: string } {
  const primaryWeights = ARCHETYPE_TRAIT_WEIGHTS[primaryArchetype];
  const runnerUpWeights = ARCHETYPE_TRAIT_WEIGHTS[runnerUpArchetype];
  
  // Default fallback - always return something
  const fallbackTrait = Object.keys(primaryWeights?.primary || { A: 1.0 })[0] || 'A';
  const fallbackScore = userTraits[fallbackTrait] || 50;
  const fallback = {
    trait: fallbackTrait,
    reason: `你的${traitLabels[fallbackTrait]}得分（${Math.round(fallbackScore)}）与${primaryArchetype}的风格更匹配`,
    weightContext: ''
  };
  
  if (!primaryWeights || !runnerUpWeights) return fallback;
  
  // Case 1: Find a trait that primary values highly (1.6-1.8x) but runner-up avoids (0.4-0.8x)
  for (const [trait, weight] of Object.entries(primaryWeights.primary)) {
    const avoidWeight = runnerUpWeights.avoid[trait];
    if (avoidWeight !== undefined) {
      const score = userTraits[trait] || 50;
      return {
        trait,
        reason: `${traitLabels[trait]}是${primaryArchetype}的核心特质（${weight}×权重），而${runnerUpArchetype}反而会回避这项（${avoidWeight}×）`,
        weightContext: `你的${traitLabels[trait]}得分 ${Math.round(score)}，正好符合${primaryArchetype}的偏好`
      };
    }
  }
  
  // Case 2: Find a trait that primary avoids but runner-up values
  for (const [trait, avoidWeight] of Object.entries(primaryWeights.avoid)) {
    const runnerPrimaryWeight = runnerUpWeights.primary[trait];
    if (runnerPrimaryWeight !== undefined) {
      const score = userTraits[trait] || 50;
      const isLow = score < 55;
      return {
        trait,
        reason: isLow 
          ? `你的${traitLabels[trait]}偏低（${Math.round(score)}），${primaryArchetype}对此不敏感（${avoidWeight}×），但${runnerUpArchetype}需要高${traitLabels[trait]}（${runnerPrimaryWeight}×）`
          : `${runnerUpArchetype}需要高${traitLabels[trait]}（${runnerPrimaryWeight}×），但${primaryArchetype}的特质组合更平衡`,
        weightContext: `算法权重差异：${primaryArchetype}对${traitLabels[trait]}权重${avoidWeight}× vs ${runnerUpArchetype}的${runnerPrimaryWeight}×`
      };
    }
  }
  
  // Case 3: Compare the largest weighted gap between archetypes
  // Find the trait where primary vs runner-up weights differ most
  let bestDiff = 0;
  let bestTrait = '';
  let primaryWeight = 0;
  let runnerWeight = 0;
  
  // Check all traits for the biggest weight difference
  const allTraits = ['A', 'O', 'C', 'E', 'X', 'P'];
  for (const trait of allTraits) {
    const pWeight = primaryWeights.primary[trait] || primaryWeights.secondary[trait] || 
                    (primaryWeights.avoid[trait] ? primaryWeights.avoid[trait] : 1.0);
    const rWeight = runnerUpWeights.primary[trait] || runnerUpWeights.secondary[trait] || 
                    (runnerUpWeights.avoid[trait] ? runnerUpWeights.avoid[trait] : 1.0);
    const diff = Math.abs(pWeight - rWeight);
    if (diff > bestDiff) {
      bestDiff = diff;
      bestTrait = trait;
      primaryWeight = pWeight;
      runnerWeight = rWeight;
    }
  }
  
  if (bestTrait && bestDiff > 0.2) {
    const score = userTraits[bestTrait] || 50;
    const primaryHigher = primaryWeight > runnerWeight;
    return {
      trait: bestTrait,
      reason: primaryHigher
        ? `${primaryArchetype}对${traitLabels[bestTrait]}的偏好更强（${primaryWeight}×），而${runnerUpArchetype}只有${runnerWeight}×`
        : `${runnerUpArchetype}对${traitLabels[bestTrait]}权重${runnerWeight}×，${primaryArchetype}则是${primaryWeight}×——你的分数（${Math.round(score)}）更适合后者`,
      weightContext: `两个原型的${traitLabels[bestTrait]}权重差距最大（${primaryWeight}× vs ${runnerWeight}×）`
    };
  }
  
  // Absolute fallback: just use primary's top trait with explicit comparison
  const primaryTraitEntry = Object.entries(primaryWeights.primary)[0];
  if (primaryTraitEntry) {
    const [trait, weight] = primaryTraitEntry;
    const score = userTraits[trait] || 50;
    const runnerWeightForTrait = runnerUpWeights.primary[trait] || runnerUpWeights.secondary[trait] || 
                                  (runnerUpWeights.avoid[trait] ? runnerUpWeights.avoid[trait] : 1.0);
    return {
      trait,
      reason: `${primaryArchetype}对${traitLabels[trait]}权重${weight}×，${runnerUpArchetype}的权重是${runnerWeightForTrait}×——你的得分（${Math.round(score)}）更贴合${primaryArchetype}`,
      weightContext: `核心特质权重对比：${weight}× vs ${runnerWeightForTrait}×`
    };
  }
  
  return fallback;
}

function getFallbackAnalysis(archetype: string): string {
  const fallbacks: Record<string, string> = {
    "开心柯基": "你是开心柯基型：热场快，接梗快，给人安全感也快。很多局有你在，气氛会自然松下来。只是别总顾着让大家开心，自己的电量也得留一点。",
    "太阳鸡": "你是太阳鸡型：情绪稳，正能量真，出了状况也不慌。别人焦虑的时候你那份稳，让整个场子缓下来。这种底气不是表演出来的，是刻在里头的。",
    "夸夸豚": "你是夸夸豚型：发现别人的好，然后真心说出来，不是客套。被你夸到的人，会记很久。这种看见人的能力，比多数社交技巧都稀缺。",
    "机智狐": "你是机智狐型：反应快，点子多，能在谈话里找到最有意思的角度。饭桌上那个率先提新方向的，通常是你。有时候话说快了，记得等一等慢半拍的人。",
    "淡定海豚": "你是淡定海豚型：情绪稳，读人准，在任何人群里都能找到自己的节奏。你那种淡定不是疏离，是心里有底。局里最让人放心的，往往是你这种人。",
    "织网蛛": "你是织网蛛型：发现两个人应该认识，然后悄悄搭一座桥。撮合成功了你是最高兴的那个，也是最不显眼的那个。这种连接的眼光，不是所有人都有。",
    "暖心熊": "你是暖心熊型：别人说话你真的在听，不是在等自己开口。这种陪伴让人觉得被接住了，在社交里很稀缺。只是别忘了，你自己也需要被接住的时候。",
    "灵感章鱼": "你是灵感章鱼型：脑洞停不下来，能把八竿子打不着的东西串在一起，然后说一句让大家愣一下的话。这种跳跃性思维是创意的核心。如果有时候能把想法落地一下就更完整了。",
    "沉思猫头鹰": "你是沉思猫头鹰型：大群体里你不一定最活跃，但你说出来的话往往比热闹了半天的人更准。观察、消化、再开口，这个节奏是你的强项，不是弱点。",
    "定心大象": "你是定心大象型：出了状况你不乱，身边的人看见你在就先稳了三分。这种靠谱是从内到外的，不是刻意维持的。只是别把别人的事全扛到自己身上。",
    "稳如龟": "你是稳如龟型：慢热，但认准了就是真的认准了。你那双看人的眼睛很准，不容易看走眼。这种判断力在人多的场合里其实是优势。",
    "隐身猫": "你是隐身猫型：坐在那里不怎么说话，但其实全场最清楚谁是真有趣、谁在表演。人群让你耗电，但一对一你完全是另一个人。这种深度，多数人一辈子才遇到一两次。",
  };
  return fallbacks[archetype] || `${archetype}，你的特质组合挺有意思。继续探索一下自己的社交风格吧。`;
}

interface XiaoyueResultSnapshot {
  headline: string;
  socialRole: string;
  bestScene: string;
  microAction: string;
  shareLine: string;
  stateLabel: string;
}

function getFallbackXiaoyueSnapshot(archetype: string): XiaoyueResultSnapshot {
  const snapshots: Record<string, XiaoyueResultSnapshot> = {
    "开心柯基": {
      headline: "你不是硬撑热闹，你是自然带热的人",
      socialRole: "你更像开场加速器，能让陌生局更快松下来。",
      bestScene: "更适合6到8人的轻松热场局，有接梗空间会更舒服。",
      microAction: "下次进新局先抛一个轻松问题，再接住第一个回应你的人。",
      shareLine: "我是开心柯基型，属于一进场就会慢慢把气氛带起来的那种。",
      stateLabel: "快热带动型",
    },
    "太阳鸡": {
      headline: "你不抢镜，但全场会跟着你稳下来",
      socialRole: "你更像节奏稳定器，能把场子从散乱拉回舒服的推进感。",
      bestScene: "更适合有主题、能边聊边推进的饭局或桌游局。",
      microAction: "下次参加活动，先认领一个能稳节奏的小动作。",
      shareLine: "我是太阳鸡型，不吵，但会把场子慢慢稳住。",
      stateLabel: "稳场推进型",
    },
    "夸夸豚": {
      headline: "你不是场面话选手，你是真的会看见人",
      socialRole: "你更像关系升温器，能把陌生感聊成舒服感。",
      bestScene: "更适合2到6人的局，能给彼此一点真实交流空间。",
      microAction: "下次遇到顺眼的人，先给一个具体的真诚反馈。",
      shareLine: "我是夸夸豚型，看着温和，其实很会把关系聊热。",
      stateLabel: "熟了更有火花型",
    },
    "机智狐": {
      headline: "你不靠硬聊破冰，你靠灵感把场子聊活",
      socialRole: "你更像话题点火器，能把普通聊天拐到更有意思的方向。",
      bestScene: "更适合有探索感的新局、主题活动或能交换想法的场子。",
      microAction: "下次开场先准备一个最近看到的有趣东西。",
      shareLine: "我是机智狐型，属于会把普通聊天聊出新鲜感的那种。",
      stateLabel: "灵感破冰型",
    },
    "淡定海豚": {
      headline: "你不是掉线型，你是先看气场再发力",
      socialRole: "你更像安静观察者，关键时刻往往说到点上。",
      bestScene: "更适合3到6人的轻松聚会，或者先有共同话题的场景。",
      microAction: "下次别逼自己立刻热起来，先记住一个想继续聊的人。",
      shareLine: "我是淡定海豚型，习惯先看气场，再决定什么时候出手。",
      stateLabel: "低耗观察型",
    },
    "织网蛛": {
      headline: "你不是社交用力派，你是把关系慢慢织起来",
      socialRole: "你更像连接器，擅长让对的人自然搭上线。",
      bestScene: "更适合有轮流交流空间的小局，而不是只顾抢话的大场子。",
      microAction: "下次进局先记下两个可能聊得来的人，再顺手搭一座桥。",
      shareLine: "我是织网蛛型，更擅长让关系慢慢连起来，不是硬撑热闹。",
      stateLabel: "局内升温型",
    },
    "暖心熊": {
      headline: "你不是慢，你只是只对对的人升温",
      socialRole: "你更像深聊引线，能让对方很快觉得被接住。",
      bestScene: "更适合2到4人的小局、饭后散步局或咖啡局。",
      microAction: "下次先和一个顺眼的人聊深两轮，不用急着全场营业。",
      shareLine: "我是暖心熊型，看着慢热，其实聊到点上就很能聊。",
      stateLabel: "慢热深聊型",
    },
    "灵感章鱼": {
      headline: "你不靠热闹存在，你靠脑洞让人记住",
      socialRole: "你更像灵感点火器，总能把聊天拐到别人没想到的地方。",
      bestScene: "更适合主题活动、创意局，或能交换观点的小范围聚会。",
      microAction: "下次开场先抛一个你最近觉得有意思的问题。",
      shareLine: "我是灵感章鱼型，属于会把聊天聊出新方向的那种。",
      stateLabel: "灵感破冰型",
    },
    "沉思猫头鹰": {
      headline: "你不是社交慢，你只是更擅长聊到点上",
      socialRole: "你更像深聊引线，话不一定多，但往往最有记忆点。",
      bestScene: "更适合2到4人的小局、一对一深聊，或有明确主题的场景。",
      microAction: "下次只要提前准备一个你真想聊的问题就够了。",
      shareLine: "我是沉思猫头鹰型，看着安静，其实聊到点上会很能聊。",
      stateLabel: "慢热深聊型",
    },
    "定心大象": {
      headline: "你不抢戏，但大家会因为你在而更安心",
      socialRole: "你更像局里的稳定器，能让大家更快进入舒服节奏。",
      bestScene: "更适合有一点主题、需要人稳住节奏的小局。",
      microAction: "下次参加活动，先认领一个能帮大家进入状态的小动作。",
      shareLine: "我是定心大象型，不吵，但会让场子先稳下来。",
      stateLabel: "稳场推进型",
    },
    "稳如龟": {
      headline: "你不是慢半拍，你是先判断再投入",
      socialRole: "你更像安静观察者，一旦决定靠近就会很靠谱。",
      bestScene: "更适合允许留白的3到6人局，而不是一上来就很吵的场子。",
      microAction: "下次别要求自己立刻融入，先锁定一个值得继续聊的人。",
      shareLine: "我是稳如龟型，习惯先判断气场，再决定什么时候发力。",
      stateLabel: "低耗观察型",
    },
    "隐身猫": {
      headline: "你不是掉线型，你是先观察再发力",
      socialRole: "你更像安静观察者，关键时刻往往能说到点上。",
      bestScene: "更适合一对一深聊，或节奏不吵、允许留白的小局。",
      microAction: "下次先记住一个你真正想继续聊的人，再顺着靠近。",
      shareLine: "我是隐身猫型，习惯先看气场，再决定什么时候出手。",
      stateLabel: "低耗观察型",
    },
  };

  return snapshots[archetype] || {
    headline: "你不是硬撑社交，你是把关系慢慢聊热",
    socialRole: "你更像局内升温器，能让相处慢慢变舒服。",
    bestScene: "更适合能让人逐步进入状态的小局，而不是一上来就很吵的场子。",
    microAction: "下次进新局先锁定一个你能自然接上的话题。",
    shareLine: `我是${archetype}型，属于相处越往后越容易让人觉得舒服的那种。`,
    stateLabel: "局内升温型",
  };
}

interface UnifiedAssessmentResult {
  algorithmVersion: string;
  primaryArchetype: string;
  secondaryArchetype?: string;
  topArchetypes?: PersonalityTopArchetypeCandidate[] | null;
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
  totalQuestions: number;
  chemistryList: Array<{ role: string; percentage: number; reason?: string }>;
  archetypeTraitProfile: Record<string, number> | null;
  matchDetails: any;
  isDecisive: boolean;
  completedAt: string;
}

const archetypeUniqueTraits: Record<string, { trait: string; description: string }[]> = {
  "开心柯基": [
    { trait: "自带氛围感", description: "你走到哪里，快乐就跟到哪里。这种天然的感染力让你在人群中像发光体一样，总能带动周围人的情绪。" },
    { trait: "破冰达人", description: "让陌生人也能迅速放下防备。你善于寻找轻松的话题切入点，能敏锐察觉尴尬气氛并用幽默化解，让初次见面变得简单。" },
  ],
  "太阳鸡": [
    { trait: "正能量持久输出", description: "你的积极态度不是一时兴起，而是源于内在的稳定发电。即便在压力之下，你也能保持乐观，给予他人持续的鼓舞。" },
    { trait: "情绪恒温器", description: "遇事不慌，还能稳住别人。你拥有强大的自我调节能力，像一个恒温器一样维持着环境的心理安全感。" },
  ],
  "夸夸豚": [
    { trait: "真诚赞美", description: "你的夸奖从不是客套的奉承，而是基于细致观察后的真心认可。这种真诚让你播撒的善意拥有真实的力量。" },
    { trait: "情感敏锐", description: "你总能敏锐地捕捉到别人被忽略的闪光点。通过你这面镜子，周围的人往往能看到一个更美好、更有价值的自己。" },
  ],
  "机智狐": [
    { trait: "创意脑洞", description: "你能把平凡的事物变得趣味横生，点子源源不断且不落俗套。你的存在让原本枯燥的聚会总能多出一份惊喜。" },
    { trait: "快速适应", description: "无论环境如何变化，你总能迅速找准定位并与不同背景的人接轨。这种灵活的认知切换让你在各种场合都能游刃有余。" },
  ],
  "淡定海豚": [
    { trait: "张弛有度", description: "你在热闹喧嚣与宁静独处之间自如切换。你懂得在社交中释放魅力，也懂得在安静中通过自我思考来沉淀和恢复。" },
    { trait: "情商在线", description: "你对社交分寸感的把握精准。你能在不冒犯他人的前提下表达真实见解，在人际网络中游走得既自在又得体。" },
  ],
  "织网蛛": [
    { trait: "人脉连接", description: "你不仅是信息的汇聚点，更是人际关系的桥接者。你总能一眼看出谁和谁会碰撞出火花，并乐于成就他人的连接。" },
    { trait: "长情维护", description: "你珍视每一份关系，记得朋友们那些细碎的喜好与重要时刻。你的细水长流让关系网络不仅广阔，而且温润持久。" },
  ],
  "暖心熊": [
    { trait: "主动关怀", description: "你拥有极强的共情能力，往往在对方开口之前就已感知其需求。这种无声的理解往往比任何言语都更具疗愈力。" },
    { trait: "安全感担当", description: "你温和且包容的特质让人不自觉地想要敞开心扉。在你面前，人们无需伪装，这种心理安全感是你给予他人最珍贵的礼物。" },
  ],
  "灵感章鱼": [
    { trait: "跨界联想", description: "你的思维跳跃且广阔，能将互不相关的领域奇妙地联系起来。这种独特的跨界洞察力让你总能提供令人耳目一新的视角。" },
    { trait: "深度对话", description: "你厌倦浅尝辄止的社交，更倾心于直抵灵魂的深度交流。在这一对一的深谈中，你的智慧和深度总能带给对方深刻启发。" },
  ],
  "沉思猫头鹰": [
    { trait: "观察敏锐", description: "你像是一个冷静的旁观者，那些被大多数人忽略的细节和底层逻辑都逃不过你的眼睛。这让你总能把握事物的本质。" },
    { trait: "一针见血", description: "你不喜欢废话，但每一次开口都直指核心。你的言语虽然不多，但分量十足，总能在关键时刻提供关键的决策参考。" },
  ],
  "定心大象": [
    { trait: "稳定可靠", description: "你是团队中的定海神针，在混乱局面中依然能保持定力。这种基于实力的稳重，让你自然而然地成为大家的依赖。" },
    { trait: "责任担当", description: "你对承诺有着近乎偏执的坚守，言出必行是你的底色。这种极高的可预测性，构建了你无可替代的个人品牌信誉。" },
  ],
  "稳如龟": [
    { trait: "看人准", description: "你从不急于对人下定论，而是通过长期的静默观察来过滤噪音。这种慢火烘焙出的洞察力，让你极少在重大判断上失误。" },
    { trait: "深度交往", description: "你的朋友圈可能不大，但每一段关系都历经考验且深厚无比。你更愿意把精力投入在那些值得深交一生的人身上。" },
  ],
  "隐身猫": [
    { trait: "独立自主", description: "你拥有一个丰盈且自洽的内心世界，不随波逐流。这种精神上的独立让你即便身处孤身，也能自得其乐且保持高昂的能量。" },
    { trait: "质量至上", description: "你对社交极度挑剔，坚持‘无意义的社交不如高质量的独处’。这种对品质的坚持，确保了你生活中的每一份连接都是真实且有意义的。" },
  ],
};

function UniqueTraitsSection({ archetype }: { archetype: string }) {
  const traits = archetypeUniqueTraits[archetype];
  if (!traits || traits.length === 0) return null;

  return (
    <Card data-testid="unique-traits-card" className="border-primary/20 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          你的独特之处
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {traits.map((item, index) => (
          <div 
            key={index} 
            className="flex items-start gap-4 p-4 bg-gradient-to-br from-primary/5 to-transparent rounded-xl border border-primary/5"
            data-testid={`unique-trait-${index}`}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 shadow-inner">
              <span className="text-primary font-bold text-lg">{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-base block text-primary/90">{item.trait}</span>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                <span className="no-orphan">{item.description}</span>
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MatchFeedbackSection({ archetype }: { archetype: string }) {
  const [feedback, setFeedback] = useState<'accurate' | 'partial' | 'inaccurate' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFeedback = async (value: 'accurate' | 'partial' | 'inaccurate') => {
    setFeedback(value);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/assessment/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archetype, accuracy: value }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `请求失败 (${res.status})`);
      }
      
      setSubmitted(true);
    } catch (error: any) {
      setFeedback(null);
      toast({ 
        title: '反馈提交失败', 
        description: error.message || '请稍后再试',
        variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card data-testid="feedback-submitted-card" className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <p className="text-sm text-muted-foreground">感谢反馈！你的意见帮助我们做得更好</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="feedback-card">
      <CardContent className="py-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm">这个结果符合你对自己的认知吗？</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={feedback === 'accurate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFeedback('accurate')}
              disabled={isSubmitting}
              data-testid="feedback-accurate"
              className="gap-1"
            >
              <ThumbsUp className="w-4 h-4" />
              很准
            </Button>
            <Button
              variant={feedback === 'partial' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFeedback('partial')}
              disabled={isSubmitting}
              data-testid="feedback-partial"
            >
              部分符合
            </Button>
            <Button
              variant={feedback === 'inaccurate' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFeedback('inaccurate')}
              disabled={isSubmitting}
              data-testid="feedback-inaccurate"
              className="gap-1"
            >
              <ThumbsDown className="w-4 h-4" />
              不太像
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MatchExplanationSection({ result }: { result: UnifiedAssessmentResult }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const generateMatchExplanation = () => {
    const archetype = result.primaryArchetype;
    const config = getArchetypeNarrative(archetype);
    
    if (result.isDecisive) {
      return `根据你回答的${result.totalQuestions}道题目，你的特质轮廓与「${archetype}」高度匹配！你在社交中展现出的特点，与这个原型的核心特质非常契合。`;
    }
    
    return `通过${result.totalQuestions}道测试题的分析，我们发现你具有「${archetype}」的核心特质。虽然你可能也有其他原型的一些影子，但整体上最接近这个类型。`;
  };

  const getTopTraits = () => {
    const traits = [
      { key: 'A', label: traitLabels.A, score: result.affinityScore },
      { key: 'O', label: traitLabels.O, score: result.opennessScore },
      { key: 'C', label: traitLabels.C, score: result.conscientiousnessScore },
      { key: 'E', label: traitLabels.E, score: result.emotionalStabilityScore },
      { key: 'X', label: traitLabels.X, score: result.extraversionScore },
      { key: 'P', label: traitLabels.P, score: result.positivityScore },
    ];
    
    return traits.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  const topTraits = getTopTraits();

  return (
    <Card data-testid="match-explanation-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          匹配解读
          {result.isDecisive && (
            <Badge variant="outline" className="ml-2 text-xs">
              高置信
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground"
              data-testid="button-trait-breakdown-toggle"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                查看关键特质
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">你的三大核心特质:</p>
              {topTraits.map((trait, index) => (
                <div 
                  key={trait.key}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  data-testid={`top-trait-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <span className="font-medium text-sm">{trait.label}</span>
                  </div>
                  <span className="text-primary font-bold">{Math.round(trait.score)}%</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

type AnimationPhase = 'slot' | 'unlock' | 'results';

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('slot');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [skipToResults, setSkipToResults] = useState(false);
  const resultsViewedTrackedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => (prefersReducedMotion ? reducedMotionContainerVariants : staggerContainerVariants),
    [prefersReducedMotion]
  );

  const itemVariants = useMemo(
    () => (prefersReducedMotion ? reducedMotionItemVariants : staggerItemVariants),
    [prefersReducedMotion]
  );

  // Load results with clean authenticated vs. anonymous split
  // Authenticated users: use dedicated endpoint
  const { data: authResult, isLoading: authLoading } = useQuery<UnifiedAssessmentResult>({
    queryKey: ['/api/assessment/result'],
    enabled: isAuthenticated,
    retry: 3,
    retryDelay: 1000,
  });

  // Anonymous users: use localStorage hook (unchanged)
  const { data: anonResult, isLoading: anonLoading } = useAnonymousPersonalityTestResults();

  // Prefer authenticated result when available, but gracefully fall back to anonymous result
  const finalResult = isAuthenticated ? (authResult ?? anonResult) : anonResult;
  const finalIsLoading = isAuthenticated ? (authLoading && !finalResult) : anonLoading;
  const xiaoyueConfidence = finalResult ? (finalResult.isDecisive ? 0.9 : 0.66) : undefined;


  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality-test/stats'],
  });

  // Load Xiaoyue analysis async as soon as result is available
  // This allows it to load in the background during animations
  const xiaoyueAnalysis = useXiaoyueAnalysis({
    archetype: finalResult?.primaryArchetype || null,
    secondaryArchetype: finalResult?.secondaryArchetype || null,
    topArchetypes: finalResult?.topArchetypes || null,
    traitScores: finalResult ? {
      A: finalResult.affinityScore / 100,
      O: finalResult.opennessScore / 100,
      C: finalResult.conscientiousnessScore / 100,
      E: finalResult.emotionalStabilityScore / 100,
      X: finalResult.extraversionScore / 100,
      P: finalResult.positivityScore / 100,
    } : null,
    confidence: xiaoyueConfidence,
    enabled: !!finalResult, // Enable immediately when result is available
  });

  const styleSpectrum = useMemo(() => {
    if (!finalResult) return null;
    try {
      const traits = {
        A: finalResult.affinityScore,
        O: finalResult.opennessScore,
        C: finalResult.conscientiousnessScore,
        E: finalResult.emotionalStabilityScore,
        X: finalResult.extraversionScore,
        P: finalResult.positivityScore,
      };
      // Pass primaryRole to ensure StyleSpectrum matches backend result
      return getStyleSpectrum(traits, undefined, finalResult.primaryArchetype);
    } catch {
      return null;
    }
  }, [finalResult]);

  const allArchetypeScores = useMemo(() => {
    if (!finalResult) return [];
    try {
      const traits = {
        A: finalResult.affinityScore,
        O: finalResult.opennessScore,
        C: finalResult.conscientiousnessScore,
        E: finalResult.emotionalStabilityScore,
        X: finalResult.extraversionScore,
        P: finalResult.positivityScore,
      };
      return getAllArchetypeScores(traits);
    } catch {
      return [];
    }
  }, [finalResult]);

  const [showDebugScores, setShowDebugScores] = useState(false);

  // Cache filtered chemistry list (only show ≥70% compatibility)
  const highCompatibilityPartners = useMemo(() => {
    if (!finalResult?.chemistryList) return [];
    return finalResult.chemistryList.filter(c => c.percentage >= 70);
  }, [finalResult?.chemistryList]);

  // Skip slot machine animation if user prefers reduced motion
  useEffect(() => {
    if (prefersReducedMotion && animationPhase === 'slot') {
      setAnimationPhase('results');
    }
  }, [prefersReducedMotion, animationPhase]);

  const devBypassMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/phone-login", {
        phoneNumber: "+8613800000001",
        code: "666666",
      });
      return await response.json();
    },
    onSuccess: async () => {
      // Clear anonymous assessment data, same as handleWeChatLogin
      localStorage.removeItem('joyjoin_v4_presignup_answers');
      localStorage.removeItem('joyjoin_v4_assessment_session');
      localStorage.removeItem('joyjoin_synced_session_id');
      localStorage.removeItem('joyjoin_synced_answer_count');

      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({ title: "登录成功", description: "正在为你准备个性化匹配..." });
      const updatedUser = await queryClient.fetchQuery({ queryKey: ["/api/auth/user"] }) as AuthUser;
      const nextPath = updatedUser?.nextStep === 'discover' ? '/discover'
        : updatedUser?.nextStep === 'guide' ? '/guide'
        : updatedUser?.nextStep === 'extended-data' ? '/onboarding/extended'
        : updatedUser?.nextStep === 'profile-review' ? '/onboarding/review'
        : '/onboarding/setup';
      setTimeout(() => setLocation(nextPath), 500);
    },
    onError: (error: Error) => {
      toast({
        title: "登录失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle slot machine completion
  const handleSlotMachineComplete = useCallback(() => {
    setAnimationPhase('unlock');
  }, []);

  // Handle unlock overlay completion
  const handleUnlockComplete = useCallback(() => {
    setAnimationPhase('results');
  }, []);

  // Handle skip animation during slot machine phase
  const handleSkipSlotMachine = useCallback(() => {
    setSkipToResults(true);
    // Compress animation to 0.5s before showing results
    setTimeout(() => setAnimationPhase('unlock'), 500);
  }, []);

  // Handle skip animation during unlock overlay phase
  const handleSkipUnlock = useCallback(() => {
    setSkipToResults(true);
    // Go immediately to results
    setAnimationPhase('results');
  }, []);

  // Mark personality test as complete and navigate to profile setup
  // Uses optimistic updates to eliminate race conditions (Phase 0: Fix #2)
  const completeTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/complete-personality-test");
    },
    onMutate: async () => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/auth/user"] });
      
      // Snapshot the previous value
      const previousUser = queryClient.getQueryData(["/api/auth/user"]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
        ...old,
        hasCompletedPersonalityTest: true,
      }));
      
      // Return context with previous value for rollback
      return { previousUser };
    },
    onSuccess: () => {
      // Immediate navigation with optimistic data (zero perceived latency)
      setLocation('/onboarding/setup');
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousUser) {
        queryClient.setQueryData(["/api/auth/user"], context.previousUser);
      }
      
      toast({
        title: "出错了",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Refetch in background to sync server state
      invalidateUserDerivedQueries();
    },
  });

  if (finalIsLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <FancyLineLoadingScreen loop visible />
        <p className="text-lg text-muted-foreground animate-pulse">
          正在生成您的测试结果...
        </p>
      </div>
    );
  }

  if (!finalResult || !finalResult.primaryArchetype) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="text-lg text-muted-foreground">未找到测试结果</div>
          <p className="text-sm text-muted-foreground">
            无法加载您的测试结果，请稍后重试
          </p>
          <Button
            data-testid="button-back-to-test"
            className="mt-4"
            onClick={() => setLocation('/personality-test')}
          >
            返回测试
          </Button>
        </div>
      </div>
    );
  }

  const gradient = getArchetypeGradient(finalResult.primaryArchetype) || 'from-purple-500 to-pink-500';
  const primaryAvatar = archetypeAvatars[finalResult.primaryArchetype];
  const primaryArchetypeConfig = getArchetypeNarrative(finalResult.primaryArchetype);
  const nickname = primaryArchetypeConfig?.nickname || '';
  const tagline = primaryArchetypeConfig?.tagline || '';
  const epicDescription = primaryArchetypeConfig?.epicDescription || '';
  const styleQuote = primaryArchetypeConfig?.styleQuote || '';
  const fallbackSnapshot = getFallbackXiaoyueSnapshot(finalResult.primaryArchetype);
  const xiaoyueSnapshot = {
    headline: xiaoyueAnalysis.headline || fallbackSnapshot.headline,
    analysis: xiaoyueAnalysis.analysis || getFallbackAnalysis(finalResult.primaryArchetype),
    socialRole: xiaoyueAnalysis.socialRole || fallbackSnapshot.socialRole,
    bestScene: xiaoyueAnalysis.bestScene || fallbackSnapshot.bestScene,
    microAction: xiaoyueAnalysis.microAction || fallbackSnapshot.microAction,
    shareLine: xiaoyueAnalysis.shareLine || fallbackSnapshot.shareLine,
    stateLabel: xiaoyueAnalysis.stateLabel || fallbackSnapshot.stateLabel,
  };
  const shareToolkit = derivePersonalityShareToolkit({
    archetype: finalResult.primaryArchetype,
    secondaryArchetype: finalResult.secondaryArchetype ?? null,
    topArchetypes: finalResult.topArchetypes ?? null,
    headline: xiaoyueSnapshot.headline,
    shareLine: xiaoyueSnapshot.shareLine,
    stateLabel: xiaoyueSnapshot.stateLabel,
    bestScene: xiaoyueSnapshot.bestScene,
    socialRole: xiaoyueSnapshot.socialRole,
    blendLine: xiaoyueAnalysis.blendLine,
    whyThisFits: xiaoyueAnalysis.whyThisFits,
    expressionTags: xiaoyueAnalysis.expressionTags,
    shareVariants: xiaoyueAnalysis.shareVariants,
  });

  useEffect(() => {
    if (animationPhase !== 'results' || resultsViewedTrackedRef.current) return;
    resultsViewedTrackedRef.current = true;
    personalityResultAnalytics.track('personality_result_viewed', {
      archetype: finalResult.primaryArchetype,
      secondaryArchetype: finalResult.secondaryArchetype ?? null,
      stateLabel: xiaoyueSnapshot.stateLabel,
      tagCount: shareToolkit.expressionTags.length,
    });
  }, [
    animationPhase,
    finalResult.primaryArchetype,
    finalResult.secondaryArchetype,
    shareToolkit.expressionTags.length,
    xiaoyueSnapshot.stateLabel,
  ]);

  const handleCopyPrimaryShare = async () => {
    await navigator.clipboard.writeText(`${xiaoyueSnapshot.shareLine} ${window.location.origin + '/personality-test'}`);
    personalityResultAnalytics.track('personality_text_share_copied', {
      archetype: finalResult.primaryArchetype,
      stateLabel: xiaoyueSnapshot.stateLabel,
      source: 'primary-share-line',
    });
    toast({ title: '已复制文字版结果' });
  };

  const handleCopyShareVariant = async (
    variantKey: 'selfIntro' | 'friendCallout' | 'socialInvite',
    text: string,
  ) => {
    await navigator.clipboard.writeText(text);
    personalityResultAnalytics.track('personality_share_variant_copied', {
      archetype: finalResult.primaryArchetype,
      stateLabel: xiaoyueSnapshot.stateLabel,
      variantKey,
    });
    toast({ title: '已复制分享文案' });
  };

  const handleContinue = () => {
    completeTestMutation.mutate();
  };

  return (
    <AnimatePresence mode="wait">
      {animationPhase === 'slot' && (
        <motion.div
          key="slot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ArchetypeSlotMachine
            finalArchetype={finalResult.primaryArchetype}
            confidence={finalResult.isDecisive ? 0.9 : undefined}
            onComplete={handleSlotMachineComplete}
          />
          <SkipAnimationButton onSkip={handleSkipSlotMachine} delay={2000} />
        </motion.div>
      )}
      
      {animationPhase === 'unlock' && (
        <motion.div
          key="unlock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <UnlockOverlay
            archetype={finalResult.primaryArchetype}
            accentColor={getArchetypeColorHSL(finalResult.primaryArchetype)}
            onComplete={handleUnlockComplete}
          />
          <SkipAnimationButton onSkip={handleSkipUnlock} delay={1000} />
        </motion.div>
      )}
      
      {animationPhase === 'results' && (
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="min-h-screen bg-background"
        >
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={prefersReducedMotion ? heroFadeAnimate : heroShakeAnimate}
        transition={heroShakeTransition}
        className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-6"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
        <div className="relative z-10 text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex justify-center">
            <div className={`w-44 h-44 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl p-1`}>
              {primaryAvatar ? (
                <img src={primaryAvatar} alt={finalResult.primaryArchetype} className="w-full h-full rounded-full object-cover" />
              ) : (
                <Sparkles className="w-16 h-16 text-primary" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="font-cn-display text-4xl font-bold" data-testid="text-primary-archetype">{finalResult.primaryArchetype}</h1>
            {nickname && <p className="text-xl font-medium text-primary">{nickname}</p>}
            {tagline && <p className="text-base text-muted-foreground italic">{tagline}</p>}
          </div>
          {finalResult.algorithmVersion === 'v2' && finalResult.isDecisive && (
            <Badge variant="outline" className="mt-2">
              <Crown className="w-3 h-3 mr-1" />
              高置信匹配
            </Badge>
          )}
        </div>
      </motion.div>

      <motion.div
        className="max-w-2xl mx-auto p-4 pb-24 space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* 1. StyleSpectrum - 风格谱系展示 (now includes unique traits, orbital, and archetype info) */}
        {styleSpectrum && (
          <motion.div variants={itemVariants}>
            <StyleSpectrum
              primary={styleSpectrum.primary}
              adjacentStyles={styleSpectrum.adjacentStyles}
              spectrumPosition={styleSpectrum.spectrumPosition}
              isDecisive={styleSpectrum.isDecisive}
              decisionReason={styleSpectrum.decisionReason}
              onClaimCard={() => {
                if (!isAuthenticated) {
                  setLocation('/personality-test/auth-gate');
                  return;
                }
                setShareModalOpen(true);
              }}
              traitScores={{
                A: finalResult.affinityScore,
                O: finalResult.opennessScore,
                C: finalResult.conscientiousnessScore,
                E: finalResult.emotionalStabilityScore,
                X: finalResult.extraversionScore,
                P: finalResult.positivityScore,
              }}
              uniqueTraits={archetypeUniqueTraits[finalResult.primaryArchetype]}
              epicDescription={epicDescription}
              styleQuote={styleQuote}
              counterIntuitiveInsight={(() => {
                const insight = getArchetypeInsights(finalResult.primaryArchetype);
                return insight ? {
                  text: insight.counterIntuitive,
                  rarityPercentage: insight.rarityPercentage
                } : undefined;
              })()}
            />
          </motion.div>
        )}

        <motion.div variants={itemVariants}>
          <PersonalityShareToolkit
            headline={xiaoyueSnapshot.headline}
            shareLine={xiaoyueSnapshot.shareLine}
            stateLabel={xiaoyueSnapshot.stateLabel}
            expressionTags={shareToolkit.expressionTags}
            blendLine={shareToolkit.blendLine}
            whyThisFits={shareToolkit.whyThisFits}
            shareVariants={shareToolkit.shareVariants}
            onCopyPrimary={handleCopyPrimaryShare}
            onCopyVariant={handleCopyShareVariant}
          />
        </motion.div>

        {/* Debug: All 12 Archetype Scores - Only show in development mode */}
        {import.meta.env.DEV && allArchetypeScores.length > 0 && (
          <motion.div variants={itemVariants}>
            <Collapsible open={showDebugScores} onOpenChange={setShowDebugScores}>
              <Card className="border-dashed border-muted-foreground/30">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                    <CardTitle className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        调试: 全部12个原型分数
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showDebugScores ? 'rotate-180' : ''}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {allArchetypeScores.map((item, index) => {
                        const isPrimary = index === 0;
                        const isHighScore = item.score >= 70;
                        return (
                          <div
                            key={item.archetype}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              isPrimary 
                                ? 'bg-primary/10 border border-primary/30' 
                                : isHighScore 
                                  ? 'bg-muted/50' 
                                  : 'bg-muted/20'
                            }`}
                            data-testid={`debug-archetype-score-${index}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg w-6 text-center">{item.emoji}</span>
                              <span className={`font-medium ${isPrimary ? 'text-primary' : ''}`}>
                                {item.archetype}
                                {isPrimary && <Badge variant="outline" className="ml-2 text-xs">主类型</Badge>}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${isPrimary ? 'bg-primary' : isHighScore ? 'bg-primary/60' : 'bg-muted-foreground/40'}`}
                                  style={{ width: `${item.score}%` }}
                                />
                              </div>
                              <span className={`font-mono text-sm w-12 text-right ${isPrimary ? 'text-primary font-bold' : ''}`}>
                                {item.score}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      排名依据实际计算分数，主类型为最高分原型。
                    </p>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )}

        {/* 2. 小悦分析 */}
        <motion.div variants={itemVariants}>
          <XiaoyueChatBubble
            content={xiaoyueSnapshot.analysis}
            pose={xiaoyueAnalysis.hasAnalysis ? "casual" : "thinking"}
            isLoading={xiaoyueAnalysis.isLoading}
            loadingText="小悦正在分析你的特质..."
            animate={!prefersReducedMotion}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "你在局里的作用",
                icon: Star,
                content: xiaoyueSnapshot.socialRole,
              },
              {
                title: "更适合的局",
                icon: Users,
                content: xiaoyueSnapshot.bestScene,
              },
              {
                title: "下一步更顺手",
                icon: Zap,
                content: xiaoyueSnapshot.microAction,
              },
            ].map(({ title, icon: Icon, content }) => (
              <Card key={title} className="border-border/70">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="w-4 h-4 text-primary" />
                    {title}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/90">{content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* 3. 最佳搭档 - 移到小悦分析后面，只显示≥70%的搭档 */}
        {highCompatibilityPartners.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  最佳搭档
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {highCompatibilityPartners.map((chemistry, index) => (
                  <div
                    key={chemistry.role}
                    className="p-4 bg-muted/50 rounded-lg space-y-3"
                    data-testid={`chemistry-item-${index}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getArchetypeGradient(chemistry.role) || 'from-gray-400 to-gray-500'} flex items-center justify-center`}>
                          {archetypeAvatars[chemistry.role] ? (
                            <img src={archetypeAvatars[chemistry.role]} alt={chemistry.role} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <span className="font-medium">{chemistry.role}</span>
                      </div>
                      <Badge variant="secondary" className="text-sm">
                        {chemistry.percentage}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {getCompatibilityDescription(finalResult.primaryArchetype, chemistry.role)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 4. 想了解更多？ - 可折叠的深度分析 */}
        <motion.div variants={itemVariants}>
          <Collapsible>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover-elevate rounded-t-lg">
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="w-5 h-5" />
                    想了解更多？
                  </CardTitle>
                  <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <PersonalityRadarChart 
                    affinityScore={finalResult.affinityScore}
                    opennessScore={finalResult.opennessScore}
                    conscientiousnessScore={finalResult.conscientiousnessScore}
                    emotionalStabilityScore={finalResult.emotionalStabilityScore}
                    extraversionScore={finalResult.extraversionScore}
                    positivityScore={finalResult.positivityScore}
                  />
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {[
                      { key: 'A', label: '亲和力', score: finalResult.affinityScore },
                      { key: 'O', label: '开放性', score: finalResult.opennessScore },
                      { key: 'C', label: '责任心', score: finalResult.conscientiousnessScore },
                      { key: 'E', label: '情绪稳定', score: finalResult.emotionalStabilityScore },
                      { key: 'X', label: '外向性', score: finalResult.extraversionScore },
                      { key: 'P', label: '正能量', score: finalResult.positivityScore },
                    ].map(({ key, label, score }) => (
                      <div key={key} className="flex flex-col p-2 bg-muted/50 rounded-lg">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-lg font-bold text-primary">{Math.round(score)}%</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 算法说明 */}
                  {finalResult.algorithmVersion === 'v2' && (
                    <div className="mt-4 pt-4 border-t">
                      <MatchExplanationSection result={finalResult} />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>

        {/* Note: AdjacentArchetypesOrbit has been merged into StyleSpectrum */}

        <motion.div variants={itemVariants}>
          <MatchFeedbackSection archetype={finalResult.primaryArchetype} />
        </motion.div>

        <motion.div variants={itemVariants} className="py-6">
          {/* Poster share remains visual-first so it complements the text-first share module above */}
          <div className="relative group">
            {/* Glowing background blur effect */}
            <div 
              className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-2xl blur-md opacity-50 group-hover:opacity-70 transition-opacity duration-300`}
              aria-hidden="true"
            />
            
            {/* Main button */}
            <Button 
              className={`relative w-full h-16 rounded-2xl text-lg font-bold shadow-xl bg-gradient-to-r ${gradient} hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-2 border-white/30`}
              onClick={() => {
                // Unauthenticated: redirect to auth-gate to sign in first
                if (!isAuthenticated) {
                  setLocation('/personality-test/auth-gate');
                  return;
                }
                
                // Authenticated: open share modal normally
                try {
                  if (navigator.vibrate) navigator.vibrate(50);
                } catch (e) {
                  // Silently fail if vibrate API throws an error
                }
                personalityResultAnalytics.track('personality_poster_opened', {
                  archetype: finalResult.primaryArchetype,
                  stateLabel: xiaoyueSnapshot.stateLabel,
                });
                setShareModalOpen(true);
              }} 
              data-testid="button-share"
              aria-label={`下载你的${finalResult.primaryArchetype}原型海报`}
            >
              <div className="flex items-center justify-center gap-3 w-full">
                <Image className="w-6 h-6 animate-pulse" aria-hidden="true" />
                <span>下载你的{finalResult.primaryArchetype}海报</span>
                <Badge variant="secondary" className="ml-2 bg-white/20 backdrop-blur-sm border-white/40 text-xs" aria-label="限定版">
                  🖼️ 海报
                </Badge>
              </div>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              上面的文字版适合直接发出去，这张海报更适合截图收藏或发朋友圈。
            </p>
          </div>
        </motion.div>

        {/* Spacer for floating button */}
        <div className="h-24" />
      </motion.div>

      {/* Floating CTA button */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
      >
        <div className="max-w-2xl mx-auto space-y-3">
          {isAuthenticated ? (
            /* Authenticated users - continue to profile setup */
            <>
              <Button 
                className={`w-full h-14 rounded-2xl text-lg font-bold shadow-lg bg-gradient-to-r ${gradient} hover:opacity-90 transition-all duration-200 border-0`}
                onClick={handleContinue}
                disabled={completeTestMutation.isPending}
                data-testid="button-continue-profile"
              >
                {completeTestMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    加载中...
                  </>
                ) : (
                  <>
                    继续完善个人信息
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                完善资料，获得更精准的匹配推荐
              </p>
            </>
          ) : import.meta.env.DEV ? (
            /* DEV-only quick pass for unauthenticated testers */
            <div className="space-y-1 text-center">
              <p className="text-xs text-amber-500 font-medium">🧪 DEV: 跳过微信，用测试账号登录</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-amber-400 text-amber-600 hover:bg-amber-50"
                data-testid="button-dev-wechat-bypass"
                disabled={devBypassMutation.isPending}
                onClick={() => devBypassMutation.mutate()}
              >
                {devBypassMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    登录中...
                  </>
                ) : (
                  "⚡ 测试账号登录"
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </motion.div>
        </motion.div>
      )}
      
      {/* Share Card Modal */}
      <ShareCardModal open={shareModalOpen} onOpenChange={setShareModalOpen} />
    </AnimatePresence>
  );
}
