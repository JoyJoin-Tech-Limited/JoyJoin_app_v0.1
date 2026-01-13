import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  InterestCard, 
  SwipeResult, 
  INTEREST_CARDS,
  MACRO_CATEGORY_LABELS,
  MACRO_CATEGORY_COLORS 
} from "@/data/interestCardsData";
import { XiaoyueChatBubble } from "@/components/XiaoyueChatBubble";

interface InterestResultSummaryProps {
  results: SwipeResult[];
  onConfirm: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}

interface CategoryStats {
  category: InterestCard['macroCategory'];
  likeCount: number;
  loveCount: number;
  totalLiked: number;
  percentage: number;
}

function analyzeResults(results: SwipeResult[]): {
  lovedCards: InterestCard[];
  likedCards: InterestCard[];
  topCategories: CategoryStats[];
  personalityInsight: string;
} {
  const cardMap = new Map(INTEREST_CARDS.map(c => [c.id, c]));
  
  const lovedCards = results
    .filter(r => r.choice === 'love')
    .map(r => cardMap.get(r.cardId))
    .filter((c): c is InterestCard => !!c);
    
  const likedCards = results
    .filter(r => r.choice === 'like')
    .map(r => cardMap.get(r.cardId))
    .filter((c): c is InterestCard => !!c);

  const categoryStatsMap = new Map<InterestCard['macroCategory'], { like: number; love: number }>();
  
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
    }))
    .filter(s => s.totalLiked > 0)
    .sort((a, b) => b.totalLiked - a.totalLiked)
    .slice(0, 3);

  let personalityInsight = "";
  if (topCategories.length > 0) {
    const topCategory = topCategories[0].category;
    const insights: Record<InterestCard['macroCategory'], string> = {
      leisure: "你是个会享受生活的人！喜欢和朋友一起玩乐，聚会时一定是气氛担当～",
      food: "美食达人就是你！对吃很有追求，和你一起探店一定很有趣～",
      lifestyle: "你热爱生活，喜欢尝试新事物，是个很有活力的人！",
      culture: "文艺青年本人！有品味有内涵，聊起来一定很有深度～",
      social: "你关注时事话题，见多识广，是饭桌上的话题王！",
    };
    personalityInsight = insights[topCategory];
    
    if (topCategories.length >= 2) {
      personalityInsight += `同时也对${MACRO_CATEGORY_LABELS[topCategories[1].category]}很感兴趣。`;
    }
  } else {
    personalityInsight = "我们还在了解你，继续探索更多兴趣吧！";
  }

  return { lovedCards, likedCards, topCategories, personalityInsight };
}

export function InterestResultSummary({
  results,
  onConfirm,
  onEdit,
  isLoading = false,
}: InterestResultSummaryProps) {
  const { lovedCards, likedCards, topCategories, personalityInsight } = analyzeResults(results);
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

      {topCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-3"
        >
          <h3 className="text-sm font-medium text-muted-foreground">你的兴趣分布</h3>
          <div className="space-y-2">
            {topCategories.map((cat, idx) => (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + idx * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm bg-gradient-to-br",
                  MACRO_CATEGORY_COLORS[cat.category]
                )}>
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{MACRO_CATEGORY_LABELS[cat.category]}</span>
                    <span className="text-sm text-muted-foreground">{cat.percentage}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.percentage}%` }}
                      transition={{ delay: 0.5 + idx * 0.1, duration: 0.5 }}
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
          transition={{ delay: 0.5, duration: 0.5 }}
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
        transition={{ delay: 0.7, duration: 0.5 }}
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
