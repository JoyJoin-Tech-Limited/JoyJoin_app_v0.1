import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { CoachMarkTooltip } from "./CoachMarkTooltip";

interface XiaoyueFABProps {
  showTooltip?: boolean;
  onTooltipDismiss?: () => void;
  onClick?: () => void;
}

export function XiaoyueFAB({
  showTooltip = false,
  onTooltipDismiss,
  onClick,
}: XiaoyueFABProps) {
  const [showTip, setShowTip] = useState(showTooltip);

  useEffect(() => {
    setShowTip(showTooltip);
  }, [showTooltip]);

  const handleDismiss = () => {
    setShowTip(false);
    onTooltipDismiss?.();
  };

  const handleClick = () => {
    handleDismiss();
    onClick?.();
  };

  return (
    <div className="fixed bottom-20 right-4 z-40">
      <div className="relative">
        <AnimatePresence>
          {showTip && (
            <div className="absolute bottom-full right-0 mb-2">
              <CoachMarkTooltip
                message="有问题找小悦~ 💬"
                position="top"
                autoDismiss={3000}
                onDismiss={handleDismiss}
              />
            </div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            size="icon"
            onClick={handleClick}
            aria-label="打开小悦互动"
            className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <motion.div
              animate={{
                rotate: [0, -10, 10, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              <MessageCircle className="h-6 w-6" />
            </motion.div>
          </Button>
        </motion.div>

        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary"
          animate={{
            scale: [1, 1.5],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      </div>
    </div>
  );
}
