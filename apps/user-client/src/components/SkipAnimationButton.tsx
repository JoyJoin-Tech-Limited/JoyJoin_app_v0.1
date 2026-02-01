import { motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SkipAnimationButtonProps {
  onSkip: () => void;
  delay?: number; // Show button after delay (ms)
}

export function SkipAnimationButton({ onSkip, delay = 2000 }: SkipAnimationButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: delay / 1000 }}
      className="fixed right-4 z-50"
      style={{
        bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onSkip}
        className="gap-2 bg-background/80 backdrop-blur-sm"
      >
        <SkipForward className="w-4 h-4" />
        跳过动画
      </Button>
    </motion.div>
  );
}
