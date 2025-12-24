import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sparkles, PartyPopper, ChevronRight } from "lucide-react";
import ConfettiCelebration from "./ConfettiCelebration";

interface MatchCelebrationOverlayProps {
  isVisible: boolean;
  onContinue: () => void;
  eventType?: string;
}

const XIAOYUE_CELEBRATION_MESSAGES = [
  "恭喜你！小悦已经为你找到了最佳的小伙伴～",
  "太棒啦！你们的缘分就从今天开始！",
  "终于等到你们相遇了！小悦好开心～",
  "匹配成功！期待你们创造美好回忆！",
];

export default function MatchCelebrationOverlay({
  isVisible,
  onContinue,
  eventType = "活动",
}: MatchCelebrationOverlayProps) {
  const message = XIAOYUE_CELEBRATION_MESSAGES[
    Math.floor(Math.random() * XIAOYUE_CELEBRATION_MESSAGES.length)
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <ConfettiCelebration isActive={isVisible} duration={4000} />
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
              className="max-w-sm w-full text-center space-y-6"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="inline-flex items-center justify-center"
              >
                <div className="relative">
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 20px 5px rgba(139, 92, 246, 0.3)",
                        "0 0 40px 10px rgba(139, 92, 246, 0.5)",
                        "0 0 20px 5px rgba(139, 92, 246, 0.3)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="rounded-full"
                  >
                    <Avatar className="h-24 w-24 border-4 border-white shadow-2xl">
                      <AvatarFallback className="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white text-2xl font-bold">
                        <PartyPopper className="h-10 w-10" />
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="absolute -top-2 -right-2"
                  >
                    <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-full p-1.5">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                  匹配成功！
                </h2>
                <p className="text-muted-foreground">
                  {eventType}小伙伴已就位
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0 border border-primary/20">
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm">
                      悦
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-left leading-relaxed">
                    {message}
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white gap-2"
                  onClick={onContinue}
                  data-testid="button-continue-after-celebration"
                >
                  查看小伙伴
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
