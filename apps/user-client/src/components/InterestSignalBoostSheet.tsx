/**
 * InterestSignalBoostSheet
 *
 * An optional bottom sheet that lets users calibrate a "conversation-fit signal"
 * for one of their interests before matching.
 *
 * MVP: text-first, 2 steps (discussion style + conversation depth).
 * Enthusiasm/passion baseline is derived server-side from onboarding heat data — not re-asked here.
 * Never blocks matching or onboarding — purely optional.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Flame, Leaf, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useInterestSignal } from "@/hooks/useInterestSignal";
import { useToast } from "@/hooks/use-toast";

// ── Option definitions ──────────────────────────────────────────────────────

const DISCUSSION_STYLE_OPTIONS = [
  { value: "casual_vibes", emoji: "☕", label: "随便聊聊", sub: "轻松氛围优先" },
  { value: "character_people", emoji: "🎭", label: "角色/人物党", sub: "聊角色和人的故事" },
  { value: "plot_worldbuilding", emoji: "📖", label: "剧情/世界观", sub: "挖深度和细节" },
  { value: "meme_humor", emoji: "😂", label: "梗和搞笑", sub: "表情包&抽象笑点" },
  { value: "deeper_analysis", emoji: "🔍", label: "深度讨论", sub: "理性分析与解读" },
];

const DEPTH_OPTIONS = [
  { value: 1, emoji: "🌊", label: "浅聊就好", sub: "轻松快乐最重要" },
  { value: 2, emoji: "🏄", label: "适度深入", sub: "聊出点干货" },
  { value: 3, emoji: "🤿", label: "深挖细节", sub: "越深越带劲" },
];

// Keep reset timing aligned with the sheet close animation so state clears
// after the dismiss transition completes, not while the sheet is still visible.
const SHEET_RESET_DELAY_MS = 400;

// ── Heat level badge helper ────────────────────────────────────────────────

/** Convert onboarding heat value (5/10/25) to a human-readable passion badge. */
function getHeatBadge(heat?: number): { label: string; Icon: typeof Flame } | null {
  if (!heat) return null;
  if (heat >= 25) return { label: "资深玩家 🏆", Icon: Flame };
  if (heat >= 10) return { label: "认真同好 ⭐", Icon: Star };
  return { label: "轻度入坑 🌱", Icon: Leaf };
}

// ── Component ───────────────────────────────────────────────────────────────

export interface InterestSignalBoostSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected interest key for this sheet; this component does not render an interest picker. */
  interestKey?: string;
  interestLabel?: string;
  /**
   * The user's onboarding heat value for this interest (from user_interests table).
   * Heat 5 = casual (level 1), 10 = active (level 2), 25 = passionate (level 3).
   * When provided, shown as a read-only "已知热情" badge to reassure the user
   * they are not being re-profiled.
   */
  onboardingHeatLevel?: number;
}

export default function InterestSignalBoostSheet({
  open,
  onOpenChange,
  interestKey,
  interestLabel,
  onboardingHeatLevel,
}: InterestSignalBoostSheetProps) {
  const { upsertSignal, isSubmitting } = useInterestSignal();
  const { toast } = useToast();
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasOpenedRef = useRef(false);

  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [style, setStyle] = useState<string>("");
  const [depth, setDepth] = useState<number>(0);

  const resolvedKey = interestKey ?? "";
  const resolvedLabel = interestLabel ?? "兴趣";
  const heatBadge = getHeatBadge(onboardingHeatLevel);

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      return;
    }

    if (!hasOpenedRef.current) {
      return;
    }

    resetTimeoutRef.current = setTimeout(() => {
      setStep(1);
      setStyle("");
      setDepth(0);
      resetTimeoutRef.current = null;
    }, SHEET_RESET_DELAY_MS);

    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [open]);

  const handleSheetOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const handleSubmit = async () => {
    if (!style || !depth || !resolvedKey) return;
    try {
      await upsertSignal({
        interestKey: resolvedKey,
        discussionStyle: style,
        conversationDepth: depth,
      });
      setStep("done");
    } catch (error) {
      console.error("Failed to save interest signal:", error);
      toast({ title: "保存失败，请重试", variant: "destructive" });
    }
  };

  const canProceedStep1 = style !== "";
  const canSubmit = style !== "" && depth > 0;

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto rounded-t-2xl pb-8">
        {/* Header */}
        <SheetHeader className="mb-5 text-left">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
            <SheetTitle className="text-base font-semibold">同频聊天设置</SheetTitle>
            {heatBadge && (
              <Badge variant="secondary" className="ml-auto text-xs px-2 py-0.5 font-normal">
                {heatBadge.label}
              </Badge>
            )}
          </div>
          <SheetDescription className="text-sm leading-relaxed">
            告诉我们你聊「{resolvedLabel}」时的风格，帮我们把你和真正同频的人分到一组。
            <span className="text-primary font-medium"> 2步完成，随时可跳过。</span>
          </SheetDescription>
        </SheetHeader>

        {/* Progress dots */}
        {step !== "done" && (
          <div className="flex justify-center gap-2 mb-5">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/40" : "w-4 bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <p className="font-semibold text-sm text-foreground">
                聊到「{resolvedLabel}」时，你更喜欢哪种方式？
              </p>
              <div className="grid grid-cols-1 gap-2">
                {DISCUSSION_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStyle(opt.value)}
                    className={`flex items-center gap-3 rounded-xl py-3 px-4 border-2 text-left transition-colors ${
                      style === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <span className="text-xl flex-none">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block">{opt.label}</span>
                      <span className="text-[11px] text-muted-foreground">{opt.sub}</span>
                    </div>
                    {style === opt.value && (
                      <Check className="flex-none h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              <Button
                className="w-full mt-2"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
              >
                下一步 →
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <p className="font-semibold text-sm text-foreground">
                你希望「{resolvedLabel}」聊到什么深度？
              </p>
              <div className="grid grid-cols-3 gap-3">
                {DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDepth(opt.value)}
                    className={`flex flex-col items-center gap-2 rounded-xl py-4 border-2 transition-colors ${
                      depth === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted/60"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-xs font-medium text-center">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {opt.sub}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  上一步
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-primary to-purple-600"
                  disabled={!canSubmit || isSubmitting}
                  onClick={handleSubmit}
                >
                  {isSubmitting ? "保存中…" : "完成 ✨"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col items-center gap-4 py-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-lg">同频偏好已保存！</p>
                <p className="text-muted-foreground text-sm max-w-[260px] mx-auto leading-relaxed">
                  匹配算法会用这个信号帮你找到更投的聊友。
                </p>
              </div>
              {heatBadge && (
                <Badge variant="secondary" className="text-sm px-4 py-1">
                  {heatBadge.label}
                </Badge>
              )}
              <Button className="w-full max-w-xs mt-2" onClick={() => onOpenChange(false)}>
                好的，期待活动！
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
