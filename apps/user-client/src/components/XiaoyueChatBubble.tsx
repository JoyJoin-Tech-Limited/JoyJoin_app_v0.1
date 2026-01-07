import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import xiaoyueThinking from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueCasual from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";

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

/**
 * Parse and format analysis text with intelligent formatting:
 * - Split by sentences for better readability
 * - Highlight trait scores (e.g., "亲和力95分")
 * - Emphasize first sentence as summary
 */
function parseAnalysisContent(content: string, animate: boolean) {
  // Split by double newlines first (explicit paragraphs)
  const explicitParagraphs = content.split('\n\n').filter(p => p.trim());
  
  // Further split long paragraphs by periods for better readability
  const segments: string[] = [];
  explicitParagraphs.forEach((para) => {
    // Split by Chinese and English periods, but keep the period
    const sentences = para.match(/[^。.]+[。.]?/g) || [para];
    segments.push(...sentences.map(s => s.trim()).filter(s => s));
  });

  // Render each segment with appropriate styling
  return segments.map((segment, idx) => {
    const isFirstSentence = idx === 0;
    
    // Highlight trait scores and percentages in the text
    const formattedSegment = highlightScores(segment);
    
    return (
      <motion.div
        key={idx}
        initial={animate ? { opacity: 0, y: 8 } : undefined}
        animate={animate ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: 0.3 + idx * 0.08 }}
        className={cn(
          "leading-relaxed",
          idx > 0 && "mt-3",
          isFirstSentence && "text-[1.05em] font-medium text-foreground"
        )}
      >
        {formattedSegment}
      </motion.div>
    );
  });
}

/**
 * Highlight trait scores and data in the text
 * Examples: "亲和力95分", "外向性80%", "开放性拉满"
 */
function highlightScores(text: string) {
  // Patterns to match:
  // - 特质名+数字+分/% (e.g., "亲和力95分", "外向性80%")
  // - 特质名+拉满/不低/都高等描述
  const patterns = [
    // Pattern 1: 特质名+数字+分/%
    /([亲和力|开放性|责任心|情绪稳定性|外向性|正能量性]+)\s*(\d+)\s*([分%])/g,
    // Pattern 2: 特质名+"拉满"/"不低"/"都高"等
    /([亲和力|开放性|责任心|情绪稳定性|外向性|正能量性]+)(拉满|不低|都高|很高|偏高)/g,
  ];

  let parts: React.ReactNode[] = [text];
  
  // Apply pattern matching and highlighting
  patterns.forEach((pattern) => {
    const newParts: React.ReactNode[] = [];
    parts.forEach((part) => {
      if (typeof part !== 'string') {
        newParts.push(part);
        return;
      }
      
      let lastIndex = 0;
      const matches = Array.from(part.matchAll(pattern));
      
      if (matches.length === 0) {
        newParts.push(part);
        return;
      }
      
      matches.forEach((match, matchIdx) => {
        // Add text before match
        if (match.index! > lastIndex) {
          newParts.push(part.substring(lastIndex, match.index));
        }
        
        // Add highlighted match
        newParts.push(
          <Badge
            key={`badge-${matchIdx}-${match.index}`}
            variant="secondary"
            className="mx-0.5 px-1.5 py-0 text-[0.9em] font-semibold bg-primary/15 text-primary border-primary/25 hover:bg-primary/20"
          >
            {match[0]}
          </Badge>
        );
        
        lastIndex = match.index! + match[0].length;
      });
      
      // Add remaining text
      if (lastIndex < part.length) {
        newParts.push(part.substring(lastIndex));
      }
    });
    
    parts = newParts;
  });
  
  return <>{parts}</>;
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
            "relative rounded-2xl p-6",
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
              className="text-foreground/90 text-base"
              data-testid="text-xiaoyue-analysis"
            >
              {parseAnalysisContent(content, animate)}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default XiaoyueChatBubble;
