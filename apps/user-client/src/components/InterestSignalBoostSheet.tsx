/**
 * InterestSignalBoostSheet
 *
 * An optional bottom sheet that lets users calibrate a "conversation-fit signal"
 * for one of their interests before matching.
 *
 * MVP: text-first, 3 quick questions, no image/audio dependencies.
 * Never blocks matching or onboarding — purely optional.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, Check } from "lucide-react";
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

const ENTHUSIASM_OPTIONS = [
  { value: 1, emoji: "😐", label: "偶尔关注" },
  { value: 2, emoji: "🙂", label: "有点喜欢" },
  { value: 3, emoji: "😊", label: "挺感兴趣" },
  { value: 4, emoji: "😍", label: "非常喜欢" },
  { value: 5, emoji: "🔥", label: "超级着迷" },
];

const DISCUSSION_STYLE_OPTIONS = [
  { value: "casual_vibes", emoji: "☕", label: "随便聊聊" },
  { value: "character_people", emoji: "🎭", label: "角色/人物党" },
  { value: "plot_worldbuilding", emoji: "📖", label: "剧情/世界观" },
  { value: "meme_humor", emoji: "😂", label: "梗和搞笑" },
  { value: "deeper_analysis", emoji: "🔍", label: "深度讨论" },
];

const DEPTH_OPTIONS = [
  { value: 1, emoji: "🌊", label: "轻松聊" },
  { value: 2, emoji: "🏄", label: "有点深度" },
  { value: 3, emoji: "🤿", label: "深挖细节" },
];

// ── Badge earned copy ───────────────────────────────────────────────────────

function getBadgeLabel(enthusiasm: number): string {
  if (enthusiasm >= 5) return "资深玩家 🏆";
  if (enthusiasm >= 4) return "认真同好 ⭐";
  return "轻度入坑 🌱";
}

// ── Component ───────────────────────────────────────────────────────────────

export interface InterestSignalBoostSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected interest. If absent the user picks from their interest list. */
  interestKey?: string;
  interestLabel?: string;
}

export default function InterestSignalBoostSheet({
  open,
  onOpenChange,
  interestKey,
  interestLabel,
}: InterestSignalBoostSheetProps) {
  const { upsertSignal, isSubmitting } = useInterestSignal();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | "done">(1);
  const [enthusiasm, setEnthusiasm] = useState<number>(0);
  const [style, setStyle] = useState<string>("");
  const [depth, setDepth] = useState<number>(0);

  const resolvedKey = interestKey ?? "";
  const resolvedLabel = interestLabel ?? "兴趣";

  const handleClose = () => {
    onOpenChange(false);
    // Reset for next open
    setTimeout(() => {
      setStep(1);
      setEnthusiasm(0);
      setStyle("");
      setDepth(0);
    }, 400);
  };

  const handleSubmit = async () => {
    if (!enthusiasm || !style || !depth || !resolvedKey) return;
    try {
      await upsertSignal({
        interestKey: resolvedKey,
        interestLabel: resolvedLabel,
        enthusiasmLevel: enthusiasm,
        discussionStyle: style,
        conversationDepth: depth,
      });
      setStep("done");
    } catch (error) {
      console.error("Failed to save interest signal:", error);
      toast({ title: "保存失败，请重试", variant: "destructive" });
    }
  };

  const canProceedStep1 = enthusiasm > 0;
  const canProceedStep2 = style !== "";
  const canSubmit = enthusiasm > 0 && style !== "" && depth > 0;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] overflow-y-auto rounded-t-2xl pb-8">
        {/* Header */}
        <SheetHeader className="mb-4 text-left">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <SheetTitle className="text-base">提升匹配质量</SheetTitle>
          </div>
          <SheetDescription className="text-sm">
            快速标记你对「{resolvedLabel}」的聊天偏好，帮我们把你和更同频的人分到一起。
            <span className="text-primary font-medium">（可随时跳过，不影响参加活动）</span>
          </SheetDescription>
        </SheetHeader>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-4"
            >
              <p className="font-semibold text-sm">
                1 / 3 · 你对「{resolvedLabel}」的热情程度？
              </p>
              <div className="grid grid-cols-5 gap-2">
                {ENTHUSIASM_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEnthusiasm(opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl py-3 px-1 border-2 transition-colors ${
                      enthusiasm === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-[10px] text-center leading-tight text-muted-foreground">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                className="w-full"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
              >
                下一步 <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-4"
            >
              <p className="font-semibold text-sm">
                2 / 3 · 聊到「{resolvedLabel}」时你更喜欢哪种方式？
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
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                    {style === opt.value && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  上一步
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canProceedStep2}
                  onClick={() => setStep(3)}
                >
                  下一步 <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-4"
            >
              <p className="font-semibold text-sm">
                3 / 3 · 你希望「{resolvedLabel}」话题聊到什么深度？
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
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-xs text-center text-muted-foreground">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
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
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                <Check className="w-8 h-8 text-white" strokeWidth={3} />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-lg">信号已记录！</p>
                <p className="text-muted-foreground text-sm">
                  匹配算法会用这个信息帮你找到更同频的人。
                </p>
              </div>
              <Badge variant="secondary" className="text-sm px-4 py-1">
                {getBadgeLabel(enthusiasm)}
              </Badge>
              <Button className="w-full max-w-xs" onClick={handleClose}>
                好的，期待活动！
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
