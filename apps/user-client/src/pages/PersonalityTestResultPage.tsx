import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PersonalityRadarChart from "@/components/PersonalityRadarChart";
import { XiaoyueInsightCard } from "@/components/XiaoyueInsightCard";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";
import StyleSpectrum from "@/components/StyleSpectrum";
import { Sparkles, Users, TrendingUp, Heart, Share2, Quote, Eye, Crown, ChevronDown, Zap, Star, MessageSquare, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  archetypeAvatars, 
  getArchetypeGradient, 
  getArchetypeNarrative, 
  getArchetypeInsights 
} from '@/lib/archetypeAdapter';
import { getCompatibilityDescription } from "@/lib/archetypeCompatibility";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useXiaoyueAnalysis } from "@/hooks/useXiaoyueAnalysis";
import { getStyleSpectrum } from "@shared/personality/matcherV2";
import { ArrowRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingLogoSleek } from "@/components/LoadingLogoSleek";
import { ArchetypeSlotMachine } from "@/components/slot-machine";

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
    "开心柯基": "开心柯基，能量满满的那种。你的正能量和亲和力都不低，这让你在聚会里很容易成为气氛组。不过别忘了，偶尔也给自己充充电。",
    "太阳鸡": "太阳鸡，稳定输出型选手。情绪稳定性和正能量是你的强项，遇到事不慌，还能给别人打气。这种人在饭局上是定海神针。",
    "夸夸豚": "夸夸豚，真诚赞美的行家。亲和力拉满，善于发现别人的闪光点。你给的认可不是客套，是真心觉得对方不错。",
    "机智狐": "机智狐，点子王。开放性高，新东西对你有吸引力，思路也灵活。在聚会上你多半是那个提议去新地方的人。",
    "淡定海豚": "淡定海豚，高情商选手。情绪稳定性和亲和力都不错，能在人群里游刃有余。你的淡定不是冷漠，是心里有数。",
    "织网蛛": "织网蛛，社交连接器。你喜欢撮合人，看到两个人有共同话题会暗暗高兴。这种能力很多人学不来。",
    "暖心熊": "暖心熊，天生的倾听者。亲和力是你的主场，让人愿意敞开心扉。不过也记得给自己留点空间。",
    "灵感章鱼": "灵感章鱼，创意脑洞王。开放性拉满，联想能力强，能把八竿子打不着的东西联系起来。这是创意工作的核心技能。",
    "沉思猫头鹰": "沉思猫头鹰，深度思考派。你更擅长一对一的深聊，热闹场合可能需要预热一下。但你的观点往往一针见血。",
    "定心大象": "定心大象，安全感担当。情绪稳定性和责任心都在线，让人觉得靠谱。出了状况你多半是那个拿主意的。",
    "稳如龟": "稳如龟，慢热但可靠。你看人的眼光准，认定了就是认定了。这种判断力在社交里很稀缺。",
    "隐身猫": "隐身猫，安静的观察者。你不是不想社交，只是大群体让你消耗大。一对一的深度交流才是你的主场。",
  };
  return fallbacks[archetype] || `${archetype}，你的特质组合挺有意思。继续探索一下自己的社交风格吧。`;
}

interface UnifiedAssessmentResult {
  algorithmVersion: string;
  primaryRole: string;
  primaryArchetype: string;
  secondaryRole?: string;
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
    const archetype = result.primaryRole;
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
        <XiaoyueInsightCard
          content={generateMatchExplanation()}
          pose="thinking"
          tone={result.isDecisive ? "confident" : "playful"}
          badgeText="小悦分析"
          avatarSize="sm"
          animate={false}
        />
        
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

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showSlotMachine, setShowSlotMachine] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => (prefersReducedMotion ? reducedMotionContainerVariants : staggerContainerVariants),
    [prefersReducedMotion]
  );

  const itemVariants = useMemo(
    () => (prefersReducedMotion ? reducedMotionItemVariants : staggerItemVariants),
    [prefersReducedMotion]
  );

  const { data: result, isLoading } = useQuery<UnifiedAssessmentResult>({
    queryKey: ['/api/assessment/result'],
  });

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality-test/stats'],
  });

  const xiaoyueAnalysis = useXiaoyueAnalysis({
    archetype: result?.primaryRole || null,
    traitScores: result ? {
      A: result.affinityScore / 100,
      O: result.opennessScore / 100,
      C: result.conscientiousnessScore / 100,
      E: result.emotionalStabilityScore / 100,
      X: result.extraversionScore / 100,
      P: result.positivityScore / 100,
    } : null,
    enabled: !!result && !showSlotMachine,
  });

  const styleSpectrum = useMemo(() => {
    if (!result) return null;
    try {
      const traits = {
        A: result.affinityScore,
        O: result.opennessScore,
        C: result.conscientiousnessScore,
        E: result.emotionalStabilityScore,
        X: result.extraversionScore,
        P: result.positivityScore,
      };
      // Pass primaryRole to ensure StyleSpectrum matches backend result
      return getStyleSpectrum(traits, undefined, result.primaryRole);
    } catch {
      return null;
    }
  }, [result]);

  // Cache filtered chemistry list (only show ≥70% compatibility)
  const highCompatibilityPartners = useMemo(() => {
    if (!result?.chemistryList) return [];
    return result.chemistryList.filter(c => c.percentage >= 70);
  }, [result?.chemistryList]);

  // Skip slot machine animation if user prefers reduced motion
  useEffect(() => {
    if (prefersReducedMotion && showSlotMachine) {
      setShowSlotMachine(false);
    }
  }, [prefersReducedMotion, showSlotMachine]);

  // Handle slot machine completion
  const handleSlotMachineComplete = useCallback(() => {
    setShowSlotMachine(false);
  }, []);

  // Mark personality test as complete and navigate to profile setup
  const completeTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/complete-personality-test");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation('/onboarding/setup');
    },
    onError: (error: Error) => {
      toast({
        title: "出错了",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingLogoSleek loop visible />
      </div>
    );
  }

  if (!result || !result.primaryRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">未找到测试结果</div>
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

  const gradient = getArchetypeGradient(result.primaryRole) || 'from-purple-500 to-pink-500';
  const primaryAvatar = archetypeAvatars[result.primaryRole];
  const primaryRoleConfig = getArchetypeNarrative(result.primaryRole);
  const nickname = primaryRoleConfig?.nickname || '';
  const tagline = primaryRoleConfig?.tagline || '';
  const epicDescription = primaryRoleConfig?.epicDescription || '';
  const styleQuote = primaryRoleConfig?.styleQuote || '';

  const handleShare = async () => {
    const shareData = {
      title: `我的社交角色是${result.primaryRole}！`,
      text: `刚完成了JoyJoin性格测评，发现我是${result.primaryRole}！快来测测你的社交特质吧~`,
      url: window.location.origin + '/personality-test',
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      toast({ title: '已复制到剪贴板！' });
    }
  };

  const handleContinue = () => {
    completeTestMutation.mutate();
  };

  const isLegacyV1 = result.algorithmVersion === 'v1' || !result.algorithmVersion;

  // Show slot machine animation if not yet completed
  if (showSlotMachine) {
    return (
      <ArchetypeSlotMachine
        finalArchetype={result.primaryRole}
        confidence={result.isDecisive ? 0.9 : undefined}
        onComplete={handleSlotMachineComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-6"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
        <div className="relative z-10 text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex justify-center">
            <div className={`w-44 h-44 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl p-1`}>
              {primaryAvatar ? (
                <img src={primaryAvatar} alt={result.primaryRole} className="w-full h-full rounded-full object-cover" />
              ) : (
                <Sparkles className="w-16 h-16 text-primary" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold" data-testid="text-primary-archetype">{result.primaryRole}</h1>
            {nickname && <p className="text-xl font-medium text-primary">{nickname}</p>}
            {tagline && <p className="text-base text-muted-foreground italic">{tagline}</p>}
          </div>
          {result.algorithmVersion === 'v2' && result.isDecisive && (
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
              traitScores={{
                A: result.affinityScore,
                O: result.opennessScore,
                C: result.conscientiousnessScore,
                E: result.emotionalStabilityScore,
                X: result.extraversionScore,
                P: result.positivityScore,
              }}
              uniqueTraits={archetypeUniqueTraits[result.primaryRole]}
              epicDescription={epicDescription}
              styleQuote={styleQuote}
              counterIntuitiveInsight={(() => {
                const insight = getArchetypeInsights(result.primaryRole);
                return insight ? {
                  text: insight.counterIntuitive,
                  rarityPercentage: insight.rarityPercentage
                } : undefined;
              })()}
            />
          </motion.div>
        )}

        {/* 2. 小悦分析 */}
        <motion.div variants={itemVariants}>
          <XiaoyueChatBubble
            content={xiaoyueAnalysis.analysis || getFallbackAnalysis(result.primaryRole)}
            pose={xiaoyueAnalysis.hasAnalysis ? "casual" : "thinking"}
            isLoading={xiaoyueAnalysis.isLoading}
            loadingText="小悦正在分析你的特质..."
            animate={!prefersReducedMotion}
          />
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
                      {getCompatibilityDescription(result.primaryRole, chemistry.role)}
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
                    affinityScore={result.affinityScore}
                    opennessScore={result.opennessScore}
                    conscientiousnessScore={result.conscientiousnessScore}
                    emotionalStabilityScore={result.emotionalStabilityScore}
                    extraversionScore={result.extraversionScore}
                    positivityScore={result.positivityScore}
                  />
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {[
                      { key: 'A', label: '亲和力', score: result.affinityScore },
                      { key: 'O', label: '开放性', score: result.opennessScore },
                      { key: 'C', label: '责任心', score: result.conscientiousnessScore },
                      { key: 'E', label: '情绪稳定', score: result.emotionalStabilityScore },
                      { key: 'X', label: '外向性', score: result.extraversionScore },
                      { key: 'P', label: '正能量', score: result.positivityScore },
                    ].map(({ key, label, score }) => (
                      <div key={key} className="flex flex-col p-2 bg-muted/50 rounded-lg">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-lg font-bold text-primary">{Math.round(score)}%</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* 算法说明 */}
                  {result.algorithmVersion === 'v2' && (
                    <div className="mt-4 pt-4 border-t">
                      <MatchExplanationSection result={result} />
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </motion.div>

        {/* Note: AdjacentArchetypesOrbit has been merged into StyleSpectrum */}

        <motion.div variants={itemVariants}>
          <MatchFeedbackSection archetype={result.primaryRole} />
        </motion.div>

        <motion.div variants={itemVariants} className="flex flex-col gap-3 py-6">
          <Button variant="outline" className="w-full" onClick={handleShare} data-testid="button-share">
            <Share2 className="w-5 h-5 mr-2" />分享我的社交角色
          </Button>
          {isLegacyV1 ? (
            <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-xs text-center text-muted-foreground">
                我们升级了测试算法，新版本更精准。
              </p>
              <Button 
                variant="outline" 
                className="w-full bg-background hover:bg-primary/5" 
                onClick={() => setLocation('/personality-test')} 
                data-testid="button-upgrade-retest"
              >
                <Zap className="w-4 h-4 mr-2 text-primary" />
                体验新版算法重新测试
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setLocation('/personality-test')} data-testid="button-retest">
              重新测试
            </Button>
          )}
        </motion.div>

        {/* Spacer for floating button */}
        <div className="h-24" />
      </motion.div>

      {/* Duolingo-style floating CTA button */}
      <motion.div 
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
      >
        <div className="max-w-2xl mx-auto">
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
          <p className="text-center text-xs text-muted-foreground mt-2">
            完善资料，获得更精准的匹配推荐
          </p>
        </div>
      </motion.div>
    </div>
  );
}
