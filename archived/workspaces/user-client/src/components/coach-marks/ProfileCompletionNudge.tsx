import { motion } from "framer-motion";
import { TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface ProfileCompletionNudgeProps {
  onDismiss: () => void;
}

export function ProfileCompletionNudge({ onDismiss }: ProfileCompletionNudgeProps) {
  const [, setLocation] = useLocation();

  const handleComplete = () => {
    onDismiss();
    setLocation("/onboarding/extended");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="mx-4 mb-4 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-background dark:from-amber-950/20 dark:via-orange-950/20 dark:to-background border border-amber-200 dark:border-amber-800 p-4 shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
          <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground mb-1">
            完善资料提升匹配率 +42% 📈
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            添加兴趣标签、社交风格等信息，让小悦为你匹配更契合的桌友
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleComplete}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              去完善
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              稍后
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
