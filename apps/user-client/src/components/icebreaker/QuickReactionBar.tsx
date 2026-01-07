import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Flame, ThumbsUp, HelpCircle, Laugh, Hand } from "lucide-react";

interface Reaction {
  id: string;
  icon: typeof Heart;
  label: string;
  count: number;
  hasReacted: boolean;
}

interface QuickReactionBarProps {
  activityName?: string;
  onReaction?: (reactionId: string) => void;
  compact?: boolean;
}

const defaultReactions: Omit<Reaction, 'count' | 'hasReacted'>[] = [
  { id: 'love', icon: Heart, label: '喜欢' },
  { id: 'fire', icon: Flame, label: '火热' },
  { id: 'thumbsup', icon: ThumbsUp, label: '赞同' },
  { id: 'thinking', icon: HelpCircle, label: '考虑' },
  { id: 'laugh', icon: Laugh, label: '有趣' },
  { id: 'clap', icon: Hand, label: '厉害' },
];

export function QuickReactionBar({
  activityName,
  onReaction,
  compact = false,
}: QuickReactionBarProps) {
  const [reactions, setReactions] = useState<Reaction[]>(() =>
    defaultReactions.map(r => ({
      ...r,
      count: Math.floor(Math.random() * 3),
      hasReacted: false,
    }))
  );

  const [showBurst, setShowBurst] = useState<string | null>(null);

  const handleReaction = useCallback((reactionId: string) => {
    setReactions(prev =>
      prev.map(r => {
        if (r.id === reactionId) {
          const newHasReacted = !r.hasReacted;
          return {
            ...r,
            hasReacted: newHasReacted,
            count: newHasReacted ? r.count + 1 : Math.max(0, r.count - 1),
          };
        }
        return r;
      })
    );

    setShowBurst(reactionId);
    setTimeout(() => setShowBurst(null), 600);
    onReaction?.(reactionId);
  }, [onReaction]);

  const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div 
      className="bg-card/80 backdrop-blur-sm rounded-xl border p-3 space-y-2"
      data-testid="quick-reaction-bar"
    >
      {activityName && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">
            对 <span className="font-medium text-foreground">{activityName}</span> 的反应
          </p>
          {totalReactions > 0 && (
            <Badge variant="secondary" className="text-xs">
              {totalReactions} 个反应
            </Badge>
          )}
        </div>
      )}

      <div className={`flex ${compact ? 'gap-1' : 'gap-2'} flex-wrap justify-center`}>
        {reactions.map((reaction) => (
          <div key={reaction.id} className="relative">
            {(() => {
              const Icon = reaction.icon;
              return (
                <>
                  <Button
                    variant={reaction.hasReacted ? "default" : "outline"}
                    size={compact ? "sm" : "default"}
                    onClick={() => handleReaction(reaction.id)}
                    className={`relative transition-all ${
                      reaction.hasReacted 
                        ? 'bg-primary/20 border-primary text-primary hover:bg-primary/30' 
                        : 'hover:border-primary/50'
                    } ${compact ? 'px-2 py-1 h-8' : 'px-3 py-2'}`}
                    data-testid={`reaction-${reaction.id}`}
                  >
                    <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
                    {reaction.count > 0 && (
                      <motion.span
                        key={reaction.count}
                        initial={{ scale: 1.3 }}
                        animate={{ scale: 1 }}
                        className={`ml-1 font-medium ${compact ? 'text-xs' : 'text-sm'}`}
                      >
                        {reaction.count}
                      </motion.span>
                    )}
                  </Button>

                  <AnimatePresence>
                    {showBurst === reaction.id && (
                      <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      >
                        <Icon className="w-6 h-6 text-primary" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {!compact && (
        <p className="text-xs text-center text-muted-foreground mt-2">
          点击表情表达你的想法
        </p>
      )}
    </div>
  );
}

export default QuickReactionBar;
