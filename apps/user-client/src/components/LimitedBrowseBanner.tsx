/**
 * LimitedBrowseBanner — shown on DiscoverPage when the user entered via the
 * "browse first" path from FinalProfileReviewPage.
 *
 * Experiment: joyjoin_exp_limited_browse
 * Gating constant: ENABLE_LIMITED_BROWSE_MODE (FinalProfileReviewPage.tsx)
 *
 * The banner:
 *  - Explains what is available now (browse events, view match preview)
 *  - Explains what improves after joining an event (precise matching, invite,
 *    full social experience)
 *  - Is dismissible; dismissed state is persisted to localStorage
 *  - Respects reduced-motion preferences
 */

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Sparkles, Lock, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const LIMITED_BROWSE_MODE_KEY = "joyjoin_exp_limited_browse_mode";
const BANNER_DISMISSED_KEY = "joyjoin_exp_limited_browse_banner_dismissed";

interface LimitedBrowseBannerProps {
  /** Callback so parent can scroll to the event list */
  onExploreEvents?: () => void;
  className?: string;
}

/**
 * Returns true if the user is currently in limited-browse mode
 * (i.e. they chose "browse first" on the profile-review page).
 */
export function isInLimitedBrowseMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LIMITED_BROWSE_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Marks the user as having entered limited-browse mode.
 * Called by FinalProfileReviewPage when the secondary CTA is tapped.
 */
export function enterLimitedBrowseMode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIMITED_BROWSE_MODE_KEY, "true");
  } catch {}
}

/**
 * Clears the limited-browse mode flag entirely.
 * Called when the banner is permanently dismissed.
 */
export function exitLimitedBrowseMode(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LIMITED_BROWSE_MODE_KEY);
    localStorage.removeItem(BANNER_DISMISSED_KEY);
  } catch {}
}

export default function LimitedBrowseBanner({
  onExploreEvents,
  className,
}: LimitedBrowseBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const inBrowseMode = isInLimitedBrowseMode();
    let dismissed = false;
    if (typeof window !== "undefined") {
      try {
        dismissed = localStorage.getItem(BANNER_DISMISSED_KEY) === "true";
      } catch {
        dismissed = false;
      }
    }
    setIsVisible(inBrowseMode && !dismissed);
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, "true");
    } catch {}
    setIsVisible(false);
  };

  if (!isVisible) return null;

  const unlockedItems = [
    "查看所有活动信息",
    "了解盲盒匹配玩法",
    "预览你的性格档案",
  ];

  const lockedItems = [
    "精准 AI 匹配同桌伙伴",
    "活动揭晓邀请",
    "完整社交体验",
  ];

  const content = (
    <div
      className={`relative rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-background to-purple-50/60 overflow-hidden shadow-sm ${className ?? ""}`}
      role="region"
      aria-label="先浏览模式提示"
      data-testid="limited-browse-banner"
    >
      {/* Subtle background accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />

      <div className="relative p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">先浏览，随时可以入座</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                你的档案已准备好，入座后小悦为你精准匹配
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0 opacity-50 hover:opacity-100 -mt-0.5 -mr-1"
            onClick={handleDismiss}
            aria-label="关闭提示"
            data-testid="limited-browse-banner-dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Unlocked / locked columns */}
        <div className="grid grid-cols-2 gap-3">
          {/* Unlocked now */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">
              现在可以
            </p>
            {unlockedItems.map((item) => (
              <div key={item} className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-foreground/80 leading-snug">{item}</span>
              </div>
            ))}
          </div>

          {/* Unlocked after joining */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              入座后解锁
            </p>
            {lockedItems.map((item) => (
              <div key={item} className="flex items-start gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-muted-foreground leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Explore CTA */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-primary hover:text-primary border border-primary/20 hover:bg-primary/5 h-9 text-xs rounded-xl"
          onClick={() => {
            onExploreEvents?.();
          }}
          data-testid="limited-browse-banner-explore"
        >
          浏览活动，感受氛围
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );

  if (prefersReducedMotion) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {content}
    </motion.div>
  );
}
