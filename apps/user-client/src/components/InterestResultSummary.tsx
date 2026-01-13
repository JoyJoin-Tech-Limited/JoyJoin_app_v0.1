import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  InterestCard, 
  SwipeResult, 
  INTEREST_CARDS,
  MACRO_CATEGORY_LABELS,
  MACRO_CATEGORY_COLORS,
  MacroCategory,
  RiasecType,
  initSmartSelectionState,
  updateSelectionState,
  identifyCoreInterests,
  calculateConfidenceScore,
} from "@/data/interestCardsData";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";

interface InterestResultSummaryProps {
  results: SwipeResult[];
  onConfirm: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}

interface CategoryStats {
  category: MacroCategory;
  likeCount: number;
  loveCount: number;
  totalLiked: number;
  percentage: number;
  isCore: boolean;
}

function analyzeResults(results: SwipeResult[]): {
  lovedCards: InterestCard[];
  likedCards: InterestCard[];
  topCategories: CategoryStats[];
  coreCategories: MacroCategory[];
  generalCategories: MacroCategory[];
  confidenceScore: number;
  personalityInsight: string;
} {
  const cardMap = new Map(INTEREST_CARDS.map(c => [c.id, c]));
  
  let state = initSmartSelectionState();
  for (const result of results) {
    const card = cardMap.get(result.cardId);
    if (card) {
      state = updateSelectionState(state, card, result);
    }
  }

  const { core: coreCategories, general: generalCategories } = identifyCoreInterests(state);
  const confidenceScore = calculateConfidenceScore(state);
  
  const lovedCards = results
    .filter(r => r.choice === 'love')
    .map(r => cardMap.get(r.cardId))
    .filter((c): c is InterestCard => !!c);
    
  const likedCards = results
    .filter(r => r.choice === 'like')
    .map(r => cardMap.get(r.cardId))
    .filter((c): c is InterestCard => !!c);

  const categoryStatsMap = new Map<MacroCategory, { like: number; love: number }>();
  
  for (const result of results) {
    const card = cardMap.get(result.cardId);
    if (!card) continue;
    
    const stats = categoryStatsMap.get(card.macroCategory) || { like: 0, love: 0 };
    if (result.choice === 'love') {
      stats.love++;
    } else if (result.choice === 'like') {
      stats.like++;
    }
    categoryStatsMap.set(card.macroCategory, stats);
  }

  const totalLiked = lovedCards.length + likedCards.length;
  
  const topCategories: CategoryStats[] = Array.from(categoryStatsMap.entries())
    .map(([category, stats]) => ({
      category,
      likeCount: stats.like,
      loveCount: stats.love,
      totalLiked: stats.like + stats.love,
      percentage: totalLiked > 0 ? Math.round(((stats.like + stats.love) / totalLiked) * 100) : 0,
      isCore: coreCategories.includes(category),
    }))
    .filter(s => s.totalLiked > 0)
    .sort((a, b) => b.totalLiked - a.totalLiked)
    .slice(0, 3);

  let personalityInsight = "";
  if (coreCategories.length > 0) {
    const coreLabels = coreCategories.map(c => MACRO_CATEGORY_LABELS[c]).join('、');
    personalityInsight = `你对「${coreLabels}」特别感兴趣！`;
    
    if (generalCategories.length > 0) {
      const generalLabel = MACRO_CATEGORY_LABELS[generalCategories[0]];
      personalityInsight += `同时也喜欢${generalLabel}。`;
    }
    
    personalityInsight += "我会帮你找到志同道合的饭搭子～";
  } else if (topCategories.length > 0) {
    const topCategory = topCategories[0].category;
    const insights: Record<MacroCategory, string> = {
      entertainment: "你是个会享受生活的人！喜欢和朋友一起玩乐，聚会时一定是气氛担当～",
      food: "美食达人就是你！对吃很有追求，和你一起探店一定很有趣～",
      lifestyle: "你热爱生活，喜欢尝试新事物，是个很有活力的人！",
      culture: "文艺青年本人！有品味有内涵，聊起来一定很有深度～",
      social: "你关注时事话题，见多识广，是饭桌上的话题王！",
    };
    personalityInsight = insights[topCategory];
  } else {
    personalityInsight = "我们还在了解你，继续探索更多兴趣吧！";
  }

  return { 
    lovedCards, 
    likedCards, 
    topCategories, 
    coreCategories,
    generalCategories,
    confidenceScore,
    personalityInsight 
  };
}

export function InterestResultSummary({
  results,
  onConfirm,
  onEdit,
  isLoading = false,
}: InterestResultSummaryProps) {
  const { 
    lovedCards, 
    likedCards, 
    topCategories, 
    coreCategories,
    confidenceScore,
    personalityInsight 
  } = analyzeResults(results);
  const allLikedCards = [...lovedCards, ...likedCards];

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <XiaoyueChatBubble
          content={personalityInsight}
          pose="casual"
          animate
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 dark:border-purple-800"
      >
        <TrendingUp className="w-5 h-5 text-purple-500" />
        <span className="text-sm font-medium">匹配置信度</span>
        <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {confidenceScore}%
        </span>
      </motion.div>

      {coreCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <h3 className="text-sm font-medium text-muted-foreground">核心兴趣</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {coreCategories.map((cat) => (
              <Badge
                key={cat}
                className={cn(
                  "bg-gradient-to-r text-white border-0 px-3 py-1",
                  MACRO_CATEGORY_COLORS[cat]
                )}
              >
                <Star className="w-3 h-3 mr-1 fill-current" />
                {MACRO_CATEGORY_LABELS[cat]}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}

      {topCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-medium text-muted-foreground">兴趣分布</h3>
          <div className="space-y-2">
            {topCategories.map((cat, idx) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br",
                  MACRO_CATEGORY_COLORS[cat.category]
                )}>
                  {cat.isCore ? <Star className="w-4 h-4 fill-current" /> : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {MACRO_CATEGORY_LABELS[cat.category]}
                      {cat.isCore && <span className="ml-1 text-xs text-yellow-500">核心</span>}
                    </span>
                    <span className="text-sm text-muted-foreground">{cat.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ delay: 0.6 + idx * 0.1, duration: 0.5 }}
                      className={cn("h-full bg-gradient-to-r", MACRO_CATEGORY_COLORS[cat.category])}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {allLikedCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-medium text-muted-foreground">
            你喜欢的 ({allLikedCards.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {lovedCards.map((card) => (
              <Badge
                key={card.id}
                variant="default"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {card.label}
              </Badge>
            ))}
            {likedCards.map((card) => (
              <Badge
                key={card.id}
                variant="secondary"
              >
                {card.label}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="flex flex-col gap-2 pt-4"
      >
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-all duration-200 border-0"
          data-testid="button-confirm-interests"
        >
          {isLoading ? (
            <>保存中...</>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              确认，开始匹配
            </>
          )}
        </Button>
        
        {onEdit && (
          <Button
            variant="ghost"
            onClick={onEdit}
            className="text-muted-foreground"
            data-testid="button-edit-interests"
          >
            重新选择
          </Button>
        )}
      </motion.div>
    </div>
  );
}

export default InterestResultSummary;
