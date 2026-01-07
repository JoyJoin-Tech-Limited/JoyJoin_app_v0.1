import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, PartyPopper, Smile, Meh, Frown, X } from "lucide-react";

interface AtmosphereCheckModalProps {
  open: boolean;
  onSubmit: (rating: AtmosphereRating) => void;
  onSkip: () => void;
}

export type AtmosphereRating = 'great' | 'good' | 'okay' | 'awkward';

interface RatingOption {
  id: AtmosphereRating;
  label: string;
  description: string;
  icon: typeof PartyPopper;
  color: string;
  bgColor: string;
}

const ratingOptions: RatingOption[] = [
  {
    id: 'great',
    label: '很棒',
    description: '气氛热烈，互动持续',
    icon: PartyPopper,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50',
  },
  {
    id: 'good',
    label: '不错',
    description: '偶尔冷场，整体顺畅',
    icon: Smile,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50',
  },
  {
    id: 'okay',
    label: '一般',
    description: '需要辅助话题/小游戏',
    icon: Meh,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50',
  },
  {
    id: 'awkward',
    label: '有点尴尬',
    description: '分组或话题不匹配',
    icon: Frown,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50',
  },
];

export function AtmosphereCheckModal({
  open,
  onSubmit,
  onSkip,
}: AtmosphereCheckModalProps) {
  const [selectedRating, setSelectedRating] = useState<AtmosphereRating | null>(null);

  const handleSubmit = () => {
    if (selectedRating) {
      onSubmit(selectedRating);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="atmosphere-check-modal"
        >
          <motion.div
            className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onSkip}
                className="h-8 w-8"
                data-testid="button-skip-atmosphere"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center mb-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-1">活动进行得如何？</h3>
              <p className="text-sm text-muted-foreground">
                已经交流 60 分钟啦！小悦想了解一下氛围~
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {ratingOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedRating === option.id;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedRating(option.id)}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${option.bgColor} ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    data-testid={`button-rating-${option.id}`}
                  >
                    <div className={`w-10 h-10 rounded-full bg-white/80 dark:bg-background flex items-center justify-center ${option.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${option.color}`}>{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                你的反馈将帮助我们更细粒度地优化匹配算法，提升下次体验。
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onSkip}
                data-testid="button-skip"
              >
                稍后再说
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!selectedRating}
                data-testid="button-submit-atmosphere"
              >
                提交反馈
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
