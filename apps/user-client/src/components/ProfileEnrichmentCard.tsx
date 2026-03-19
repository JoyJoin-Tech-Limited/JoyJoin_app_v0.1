/**
 * ProfileEnrichmentCard
 *
 * A polished "Complete Your Profile" card displayed on the Discover page after
 * onboarding. Collects three high-value profile enrichment fields via focused
 * bottom-sheet mini-flows:
 *  1. Bio         — short one-liner (≤ 100 chars)
 *  2. Languages   — preferred spoken languages
 *  3. Dietary     — dietary restrictions / preferences
 *
 * Display logic:
 *  - Shows when authenticated user has at least one unfilled enrichment field.
 *  - Hides permanently once all three fields are filled.
 *  - User can dismiss early; dismissal is persisted in localStorage.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  ChevronRight,
  CheckCircle2,
  X,
  Utensils,
  Globe,
  MessageSquareText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AuthUser } from "@/hooks/useAuth";

// ── Constants ────────────────────────────────────────────────────────────────

const DISMISS_KEY = "joyjoin_profile_enrichment_dismissed";

const LANGUAGE_OPTIONS = [
  { value: "中文（国语）", label: "普通话" },
  { value: "中文（粤语）", label: "粤语" },
  { value: "英语", label: "English" },
  { value: "日语", label: "日語" },
  { value: "韩语", label: "한국어" },
  { value: "法语", label: "Français" },
];

const DIETARY_OPTIONS = [
  { value: "素食", label: "🥦 素食", displayLabel: "素食" },
  { value: "清真", label: "🌙 清真", displayLabel: "清真" },
  { value: "不吃辣", label: "🚫 不吃辣", displayLabel: "不吃辣" },
  { value: "海鲜过敏", label: "🦐 海鲜过敏", displayLabel: "海鲜过敏" },
  { value: "花生/坚果过敏", label: "🥜 花生/坚果过敏", displayLabel: "花生/坚果过敏" },
  { value: "乳糖不耐", label: "🥛 乳糖不耐", displayLabel: "乳糖不耐" },
  { value: "无特殊要求", label: "✅ 无特殊要求", displayLabel: "无特殊要求" },
] as const;

/** When this value is selected all other dietary options are cleared (mutual exclusion). */
const DIETARY_NO_REQUIREMENT = "无特殊要求";

const BIO_MAX_LENGTH = 100;

/** Strip trailing emoji character from a suggestion-chip string (e.g. "爱探索小众餐厅 🍜" → "爱探索小众餐厅") */
function removeTrailingEmoji(text: string): string {
  return text.replace(/\s\S+$/, "").trim();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type MiniFlowField = "bio" | "languages" | "dietary" | null;

interface EnrichmentItem {
  id: MiniFlowField;
  label: string;
  sublabel: string;
  icon: typeof Globe;
  filled: boolean;
  value: string;
}

interface ProfileEnrichmentCardProps {
  user: AuthUser;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {}
}

function toggleChip(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileEnrichmentCard({ user }: ProfileEnrichmentCardProps) {
  const { toast } = useToast();
  const [dismissed, setDismissedState] = useState(isDismissed);
  const [activeFlow, setActiveFlow] = useState<MiniFlowField>(null);

  // Local draft state for each mini-flow
  const [draftBio, setDraftBio] = useState(user.bio ?? "");
  const [draftLanguages, setDraftLanguages] = useState<string[]>(
    user.preferredLanguages ?? []
  );
  const [draftDietary, setDraftDietary] = useState<string[]>(
    user.dietaryRestrictions ?? []
  );

  // ── Enrichment items definition ──────────────────────────────────────────

  const items: EnrichmentItem[] = [
    {
      id: "bio",
      label: "自我介绍",
      sublabel: "一句话让桌友先认识你",
      icon: MessageSquareText,
      filled: !!(user.bio?.trim()),
      value: user.bio ?? "",
    },
    {
      id: "languages",
      label: "语言习惯",
      sublabel: "帮助匹配最顺畅的聊天氛围",
      icon: Globe,
      filled: (user.preferredLanguages?.length ?? 0) > 0,
      value:
        (user.preferredLanguages ?? [])
          .map((l) => LANGUAGE_OPTIONS.find((o) => o.value === l)?.label ?? l)
          .join("、") || "",
    },
    {
      id: "dietary",
      label: "饮食偏好",
      sublabel: "省去每次报名时重复填写",
      icon: Utensils,
      filled: (user.dietaryRestrictions?.length ?? 0) > 0,
      value: (user.dietaryRestrictions ?? [])
        .map((d) => DIETARY_OPTIONS.find((o) => o.value === d)?.displayLabel ?? d)
        .join("、"),
    },
  ];

  const filledCount = items.filter((i) => i.filled).length;
  const totalCount = items.length;
  const progressPercent = (filledCount / totalCount) * 100;

  // ── Mutation ─────────────────────────────────────────────────────────────

  const { mutate: saveField, isPending } = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", "/api/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setActiveFlow(null);
    },
    onError: () => {
      toast({
        title: "保存失败",
        description: "请稍后再试",
        variant: "destructive",
      });
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDismiss = useCallback(() => {
    setDismissed();
    setDismissedState(true);
  }, []);

  const handleSaveBio = () => {
    const trimmed = draftBio.trim().slice(0, BIO_MAX_LENGTH);
    saveField({ bio: trimmed || null });
  };

  const handleSaveLanguages = () => {
    saveField({ preferredLanguages: draftLanguages });
  };

  const handleSaveDietary = () => {
    saveField({ dietaryRestrictions: draftDietary });
  };

  const openFlow = (field: MiniFlowField) => {
    // Sync drafts with latest user data when opening
    if (field === "bio") setDraftBio(user.bio ?? "");
    if (field === "languages") setDraftLanguages(user.preferredLanguages ?? []);
    if (field === "dietary") setDraftDietary(user.dietaryRestrictions ?? []);
    setActiveFlow(field);
  };

  // ── Visibility guard ──────────────────────────────────────────────────────

  if (dismissed || filledCount === totalCount) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="enrichment-card"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mx-4"
        >
          <Card className="border-0 bg-gradient-to-br from-violet-50 via-fuchsia-50/60 to-background dark:from-violet-950/20 dark:via-fuchsia-950/15 dark:to-background shadow-sm overflow-hidden">
            <CardContent className="p-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30">
                    <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      让小悦更了解你
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      优化推荐 · 省时报名 · 更好的第一印象
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {filledCount}/{totalCount}
                  </span>
                  <button
                    onClick={handleDismiss}
                    className="p-0.5 rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    aria-label="暂时忽略"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <Progress value={progressPercent} className="h-1 mb-3" />

              {/* Items list */}
              <div className="space-y-1.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => !item.filled && openFlow(item.id)}
                      disabled={item.filled}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                        item.filled
                          ? "bg-primary/5 cursor-default"
                          : "bg-muted/40 hover:bg-muted/70 active:scale-[0.98]"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex-shrink-0 p-1.5 rounded-lg",
                          item.filled
                            ? "bg-primary/10"
                            : "bg-background shadow-sm"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            item.filled
                              ? "text-primary"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              item.filled && "text-muted-foreground"
                            )}
                          >
                            {item.label}
                          </span>
                          {item.filled && item.value && (
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                              · {item.value}
                            </span>
                          )}
                        </div>
                        {!item.filled && (
                          <p className="text-xs text-muted-foreground">
                            {item.sublabel}
                          </p>
                        )}
                      </div>

                      {/* Trailing icon */}
                      {item.filled ? (
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* ── Bio mini-flow sheet ─────────────────────────────────────────────── */}
      <Sheet open={activeFlow === "bio"} onOpenChange={(o) => !o && setActiveFlow(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-lg font-bold">自我介绍</SheetTitle>
            <p className="text-sm text-muted-foreground">
              一句话让同桌提前认识你，让聊天更自然地开始
            </p>
          </SheetHeader>

          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={draftBio}
                onChange={(e) =>
                  setDraftBio(e.target.value.slice(0, BIO_MAX_LENGTH))
                }
                placeholder="例如：热爱探索小众餐厅，喜欢聊天文化差异 ☕"
                className="resize-none text-base min-h-[90px] pr-14"
                autoFocus
              />
              <span
                className={cn(
                  "absolute bottom-2.5 right-3 text-xs",
                  draftBio.length >= BIO_MAX_LENGTH
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {draftBio.length}/{BIO_MAX_LENGTH}
              </span>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "爱探索小众餐厅 🍜",
                "职场故事一箩筐 💼",
                "热爱旅行与文化 ✈️",
                "深度聊天爱好者 💬",
                "宝藏推荐机器人 🗺️",
              ].map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-muted transition-colors py-1 px-2"
                  onClick={() => setDraftBio(removeTrailingEmoji(s))}
                >
                  {s}
                </Badge>
              ))}
            </div>

            <Button
              className="w-full mt-1"
              onClick={handleSaveBio}
              disabled={isPending || !draftBio.trim()}
            >
              {isPending ? "保存中…" : "保存"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Languages mini-flow sheet ───────────────────────────────────────── */}
      <Sheet
        open={activeFlow === "languages"}
        onOpenChange={(o) => !o && setActiveFlow(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-lg font-bold">语言习惯</SheetTitle>
            <p className="text-sm text-muted-foreground">
              选择你最顺畅的沟通语言，小悦会优先为你匹配语言契合的桌友
            </p>
          </SheetHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const selected = draftLanguages.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setDraftLanguages(toggleChip(draftLanguages, opt.value))
                    }
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              这些偏好会作为默认值预填到未来的报名表，随时可以修改
            </p>

            <Button
              className="w-full"
              onClick={handleSaveLanguages}
              disabled={isPending || draftLanguages.length === 0}
            >
              {isPending ? "保存中…" : "保存"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Dietary mini-flow sheet ─────────────────────────────────────────── */}
      <Sheet
        open={activeFlow === "dietary"}
        onOpenChange={(o) => !o && setActiveFlow(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-lg font-bold">饮食偏好</SheetTitle>
            <p className="text-sm text-muted-foreground">
              省去每次报名时重复填写，主办方也能提前为你做好安排
            </p>
          </SheetHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((opt) => {
                const selected = draftDietary.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.value === DIETARY_NO_REQUIREMENT) {
                        // Toggle "no requirement" exclusively: selecting it clears all others
                        setDraftDietary(
                          selected ? [] : [DIETARY_NO_REQUIREMENT]
                        );
                      } else {
                        // Selecting any specific restriction clears "no requirement"
                        setDraftDietary(
                          toggleChip(
                            draftDietary.filter((v) => v !== DIETARY_NO_REQUIREMENT),
                            opt.value
                          )
                        );
                      }
                    }}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-all",
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              可多选；选"无特殊要求"时会清除其他选项
            </p>

            <Button
              className="w-full"
              onClick={handleSaveDietary}
              disabled={isPending || draftDietary.length === 0}
            >
              {isPending ? "保存中…" : "保存"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
