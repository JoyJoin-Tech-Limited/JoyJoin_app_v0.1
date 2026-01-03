import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

import xiaoyueThinking from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueCasual from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

export type XiaoyuePose = "thinking" | "casual" | "pointing";

const POSE_IMAGES: Record<XiaoyuePose, string> = {
  thinking: xiaoyueThinking,
  casual: xiaoyueCasual,
  pointing: xiaoyuePointing,
};

interface XiaoyueChatBubbleProps {
  content: string;
  pose?: XiaoyuePose;
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
  animate?: boolean;
}

export function XiaoyueChatBubble({
  content,
  pose = "casual",
  isLoading = false,
  loadingText = "小悦正在分析你的特质...",
  className,
  animate = true,
}: XiaoyueChatBubbleProps) {
  const avatarImage = POSE_IMAGES[pose];

  return (
    <div 
      className={cn("flex flex-col items-center gap-4 w-full", className)}
      data-testid="xiaoyue-chat-bubble"
    >
      <motion.div
        initial={animate ? { scale: 0.8, opacity: 0 } : undefined}
        animate={animate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
        className="relative"
      >
        <div className="w-24 h-24 relative">
          <motion.div
            animate={{ 
              boxShadow: [
                "0 0 0 0 rgba(139, 92, 246, 0.4)",
                "0 0 0 12px rgba(139, 92, 246, 0)",
              ]
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              ease: "easeOut" 
            }}
            className="absolute inset-0 rounded-full"
          />
          <img
            src={avatarImage}
            alt="小悦"
            className="w-full h-full object-contain drop-shadow-lg"
            data-testid="img-xiaoyue-avatar-large"
          />
        </div>
      </motion.div>

      <motion.div
        initial={animate ? { y: 20, opacity: 0 } : undefined}
        animate={animate ? { y: 0, opacity: 1 } : undefined}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-primary/10 dark:bg-primary/20 rotate-45 rounded-sm" />
        
        <div 
          className={cn(
            "relative rounded-2xl p-5",
            "bg-primary/10 dark:bg-primary/20",
            "border-2 border-primary/20 dark:border-primary/30",
            "shadow-lg shadow-primary/5"
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-muted-foreground text-sm">{loadingText}</span>
            </div>
          ) : (
            <div 
              className="text-foreground text-base leading-relaxed whitespace-pre-wrap"
              data-testid="text-xiaoyue-analysis"
            >
              {content.split('\n\n').map((paragraph, idx) => (
                <motion.p
                  key={idx}
                  initial={animate ? { opacity: 0, y: 10 } : undefined}
                  animate={animate ? { opacity: 1, y: 0 } : undefined}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  className={idx > 0 ? "mt-4" : ""}
                >
                  {paragraph}
                </motion.p>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default XiaoyueChatBubble;
