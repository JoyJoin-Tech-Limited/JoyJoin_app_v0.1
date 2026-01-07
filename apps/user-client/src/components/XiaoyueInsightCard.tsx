import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

import xiaoyueThinking from "@assets/Xiao_Yue_Avatar-01.png";
import xiaoyueCasual from "@assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04.png";
import xiaoyueFullBody from "@assets/Xiao_Yue_Avatar-06.png";

export type XiaoyuePose = "thinking" | "casual" | "pointing" | "fullBody";
export type XiaoyueTone = "playful" | "confident" | "alert" | "neutral";

const POSE_IMAGES: Record<XiaoyuePose, string> = {
  thinking: xiaoyueThinking,
  casual: xiaoyueCasual,
  pointing: xiaoyuePointing,
  fullBody: xiaoyueFullBody,
};

const TONE_STYLES: Record<XiaoyueTone, { border: string; bg: string; accent: string }> = {
  playful: {
    border: "border-primary/30 dark:border-primary/40",
    bg: "bg-primary/5 dark:bg-primary/10",
    accent: "text-primary dark:text-primary",
  },
  confident: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    accent: "text-blue-600 dark:text-blue-400",
  },
  alert: {
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    accent: "text-amber-600 dark:text-amber-400",
  },
  neutral: {
    border: "border-border",
    bg: "bg-muted/50 dark:bg-muted/30",
    accent: "text-muted-foreground",
  },
};

interface XiaoyueInsightCardProps {
  title?: string;
  content: string;
  pose?: XiaoyuePose;
  tone?: XiaoyueTone;
  showBadge?: boolean;
  badgeText?: string;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
  children?: ReactNode;
}

export function XiaoyueInsightCard({
  title,
  content,
  pose = "thinking",
  tone = "playful",
  showBadge = true,
  badgeText = "小悦说",
  avatarSize = "md",
  className,
  animate = true,
  children,
}: XiaoyueInsightCardProps) {
  const toneStyle = TONE_STYLES[tone];
  const avatarImage = POSE_IMAGES[pose];
  
  const avatarSizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "relative rounded-xl border-2 p-4",
        toneStyle.border,
        toneStyle.bg,
        className
      )}
      data-testid="xiaoyue-insight-card"
    >
      {showBadge && (
        <Badge
          variant="secondary"
          className={cn(
            "absolute -top-2.5 left-4 gap-1 px-2 py-0.5 text-xs font-medium",
            toneStyle.accent,
            "bg-white dark:bg-gray-900 border",
            toneStyle.border
          )}
          data-testid="badge-xiaoyue"
        >
          <Sparkles className="w-3 h-3" />
          {badgeText}
        </Badge>
      )}

      <div className="flex gap-3">
        <div
          className={cn(
            "flex-shrink-0",
            avatarSizeClasses[avatarSize]
          )}
        >
          <img
            src={avatarImage}
            alt="小悦"
            className="w-full h-full object-contain"
            data-testid="img-xiaoyue-avatar"
          />
        </div>

        <div className="flex-1 min-w-0 pt-1">
          {title && (
            <h4
              className={cn("font-semibold text-sm mb-1", toneStyle.accent)}
              data-testid="text-xiaoyue-title"
            >
              {title}
            </h4>
          )}
          <p
            className="text-sm text-foreground/90 leading-relaxed"
            data-testid="text-xiaoyue-content"
          >
            {content}
          </p>
          {children}
        </div>
      </div>
    </Wrapper>
  );
}

interface XiaoyueBadgeProps {
  text?: string;
  className?: string;
}

export function XiaoyueRecommendBadge({ 
  text = "小悦推荐", 
  className 
}: XiaoyueBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 px-2 py-0.5 text-xs font-medium",
        "bg-primary/10 dark:bg-primary/20",
        "text-primary dark:text-primary",
        "border border-primary/20 dark:border-primary/30",
        className
      )}
      data-testid="badge-xiaoyue-recommend"
    >
      <Sparkles className="w-3 h-3" />
      {text}
    </Badge>
  );
}

export function XiaoyueAnalysisBadge({ 
  text = "小悦分析", 
  className 
}: XiaoyueBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 px-2 py-0.5 text-xs font-medium",
        "bg-blue-50 dark:bg-blue-950/30",
        "text-blue-600 dark:text-blue-400",
        "border border-blue-200 dark:border-blue-800",
        className
      )}
      data-testid="badge-xiaoyue-analysis"
    >
      <Sparkles className="w-3 h-3" />
      {text}
    </Badge>
  );
}

export default XiaoyueInsightCard;
