/**
 * ProfileEnrichmentCard
 *
 * A polished two-layer "Complete Your Profile" card displayed on the Discover
 * page after onboarding. Collects high-value, non-redundant profile enrichment
 * fields via focused bottom-sheet mini-flows.
 *
 * Layer 1 – Vibe (primary enrichment):
 *   tableVibePreference   — preferred table/group atmosphere (NEW)
 *
 * Layer 2 – Planning context (optional, only shown when missing):
 *   hometownRegionCity    — hometown (optional, was removed from required onboarding in PR #311)
 *   hometownAffinityOptin — opt-in to hometown matching
 *   relationshipStatus    — private planning context (removed from essential onboarding in PR #311)
 *
 * Expression bonus (optional):
 *   bio / tagline         — short one-liner intro
 *
 * Display logic:
 *  - Shows when authenticated user has at least one unfilled enrichment field.
 *  - Vibe section is shown until tableVibePreference is set.
 *  - Planning context section collapses when all planning fields are filled.
 *  - Expression section shown only once vibe is set (progressive disclosure).
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
  MapPin,
  Heart,
  MessageSquareText,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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

const DISMISS_KEY = "joyjoin_profile_enrichment_v2_dismissed";

const TAGLINE_MAX_LENGTH = 100;

// Table vibe preference options
const VIBE_OPTIONS = [
  {
    value: "light_fun",
    label: "轻松欢乐型",
    description: "聊聊日常、笑着喝酒，不用太严肃",
    emoji: "😄",
  },
  {
    value: "natural_chat",
    label: "自然随性型",
    description: "顺其自然，聊到哪里算哪里",
    emoji: "☕",
  },
  {
    value: "deep_talk",
    label: "深度交流型",
    description: "有深度的话题更让我投入",
    emoji: "💬",
  },
] as const;

type TableVibeValue = typeof VIBE_OPTIONS[number]["value"];

// Relationship status options (private, planning context)
const RELATIONSHIP_OPTIONS = [
  { value: "单身", label: "单身" },
  { value: "恋爱中", label: "恋爱中" },
  { value: "已婚/伴侣", label: "已婚/伴侣" },
  { value: "不透露", label: "不透露" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type MiniFlowField =
  | "tableVibe"
  | "hometown"
  | "relationshipStatus"
  | "tagline"
  | null;

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

function persistDismiss(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_KEY, "true");
  } catch {}
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface EnrichmentRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value?: string;
  filled: boolean;
  onClick: () => void;
}

function EnrichmentRow({
  icon,
  label,
  sublabel,
  value,
  filled,
  onClick,
}: EnrichmentRowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]",
        filled
          ? "bg-primary/5 hover:bg-primary/10"
          : "bg-muted/40 hover:bg-muted/70"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 p-1.5 rounded-lg",
          filled ? "bg-primary/10" : "bg-background shadow-sm"
        )}
      >
        <span className={filled ? "text-primary" : "text-muted-foreground"}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-sm font-medium",
              filled && "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {filled && value && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              · {value}
            </span>
          )}
        </div>
        {!filled && (
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
      {filled ? (
        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
      )}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProfileEnrichmentCard({ user }: ProfileEnrichmentCardProps) {
  const { toast } = useToast();
  const [dismissed, setDismissedState] = useState(isDismissed);
  const [activeFlow, setActiveFlow] = useState<MiniFlowField>(null);
  const [showPlanningSection, setShowPlanningSection] = useState(false);

  // Draft state
  const [draftVibe, setDraftVibe] = useState<TableVibeValue | "">(
    (user.tableVibePreference as TableVibeValue) ?? ""
  );
  const [draftHometown, setDraftHometown] = useState(
    user.hometownRegionCity ?? ""
  );
  const [draftHometownOptin, setDraftHometownOptin] = useState<boolean>(
    user.hometownAffinityOptin ?? true
  );
  const [draftRelationship, setDraftRelationship] = useState(
    user.relationshipStatus ?? ""
  );
  const [draftTagline, setDraftTagline] = useState(user.bio ?? "");

  // ── Computed state ──────────────────────────────────────────────────────
  const vibeSet = !!user.tableVibePreference;
  const hometownSet = !!user.hometownRegionCity;
  const relationshipSet = !!user.relationshipStatus;
  const taglineSet = !!(user.bio?.trim());

  // Planning context: show when any planning field is missing
  const hasMissingPlanningFields = !hometownSet || !relationshipSet;

  // The card is complete when vibe is set, planning context is set, and tagline is set
  const allComplete = vibeSet && !hasMissingPlanningFields && taglineSet;

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
    persistDismiss();
    setDismissedState(true);
  }, []);

  const handleSaveVibe = () => {
    if (!draftVibe) return;
    saveField({ tableVibePreference: draftVibe });
  };

  const handleSaveHometown = () => {
    saveField({
      hometownRegionCity: draftHometown.trim() || null,
      hometownAffinityOptin: draftHometownOptin,
    });
  };

  const handleSaveRelationship = () => {
    saveField({ relationshipStatus: draftRelationship || null });
  };

  const handleSaveTagline = () => {
    saveField({ bio: draftTagline.trim().slice(0, TAGLINE_MAX_LENGTH) || null });
  };

  const openFlow = (field: MiniFlowField) => {
    // Sync draft from latest user data on open
    if (field === "tableVibe")
      setDraftVibe((user.tableVibePreference as TableVibeValue) ?? "");
    if (field === "hometown") {
      setDraftHometown(user.hometownRegionCity ?? "");
      setDraftHometownOptin(user.hometownAffinityOptin ?? true);
    }
    if (field === "relationshipStatus")
      setDraftRelationship(user.relationshipStatus ?? "");
    if (field === "tagline") setDraftTagline(user.bio ?? "");
    setActiveFlow(field);
  };

  // ── Visibility guard ──────────────────────────────────────────────────────
  if (dismissed || allComplete) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <AnimatePresence>
        <motion.div
          key="enrichment-card-v2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mx-4"
        >
          <Card className="border-0 bg-gradient-to-br from-violet-50 via-fuchsia-50/60 to-background dark:from-violet-950/20 dark:via-fuchsia-950/15 dark:to-background shadow-sm overflow-hidden">
            <CardContent className="p-4">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30">
                    <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      让我们更懂你的社交风格
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      完善后活动体验更对味
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-0.5 rounded-full text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  aria-label="暂时忽略"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* ── Vibe section (always shown until filled) ── */}
              <div className="space-y-1.5">
                {!vibeSet ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-2">
                      饭桌氛围偏好
                    </p>
                    {VIBE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setDraftVibe(opt.value);
                          setActiveFlow("tableVibe");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left bg-muted/40 hover:bg-muted/70 active:scale-[0.98] transition-all"
                      >
                        <span className="text-xl flex-shrink-0">{opt.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {opt.description}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <EnrichmentRow
                    icon={<Sparkles className="h-4 w-4" />}
                    label="饭桌氛围偏好"
                    sublabel="你喜欢什么风格的聚餐氛围？"
                    filled
                    value={
                      VIBE_OPTIONS.find(
                        (o) => o.value === user.tableVibePreference
                      )?.label
                    }
                    onClick={() => openFlow("tableVibe")}
                  />
                )}

                {/* ── Planning context section (shown when vibe is set and there are missing fields) ── */}
                {vibeSet && hasMissingPlanningFields && (
                  <div className="mt-3 space-y-1.5">
                    <button
                      onClick={() => setShowPlanningSection((p) => !p)}
                      className="w-full flex items-center justify-between px-1 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
                    >
                      <span>活动规划参考 · 选填</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          showPlanningSection && "rotate-180"
                        )}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {showPlanningSection && (
                        <motion.div
                          key="planning-section"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-1.5"
                        >
                          {!hometownSet && (
                            <EnrichmentRow
                              icon={<MapPin className="h-4 w-4" />}
                              label="家乡"
                              sublabel="有时能遇到同城老乡"
                              filled={hometownSet}
                              onClick={() => openFlow("hometown")}
                            />
                          )}
                          {hometownSet && (
                            <EnrichmentRow
                              icon={<MapPin className="h-4 w-4" />}
                              label="家乡"
                              sublabel=""
                              filled
                              value={user.hometownRegionCity ?? ""}
                              onClick={() => openFlow("hometown")}
                            />
                          )}
                          {!relationshipSet && (
                            <EnrichmentRow
                              icon={<Heart className="h-4 w-4" />}
                              label="感情状态"
                              sublabel="仅用于活动规划参考，不公开显示"
                              filled={false}
                              onClick={() => openFlow("relationshipStatus")}
                            />
                          )}
                          {relationshipSet && (
                            <EnrichmentRow
                              icon={<Heart className="h-4 w-4" />}
                              label="感情状态"
                              sublabel=""
                              filled
                              value={user.relationshipStatus ?? ""}
                              onClick={() => openFlow("relationshipStatus")}
                            />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ── Tagline (shown once vibe is set) ── */}
                {vibeSet && !taglineSet && (
                  <div className="mt-3">
                    <EnrichmentRow
                      icon={<MessageSquareText className="h-4 w-4" />}
                      label="一句话介绍自己"
                      sublabel="让同桌先认识你，让聊天自然开始"
                      filled={taglineSet}
                      onClick={() => openFlow("tagline")}
                    />
                  </div>
                )}
                {vibeSet && taglineSet && (
                  <div className="mt-1.5">
                    <EnrichmentRow
                      icon={<MessageSquareText className="h-4 w-4" />}
                      label="一句话介绍"
                      sublabel=""
                      filled
                      value={user.bio ?? ""}
                      onClick={() => openFlow("tagline")}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* ── Table vibe mini-flow sheet ──────────────────────────────────────── */}
      <Sheet
        open={activeFlow === "tableVibe"}
        onOpenChange={(o) => !o && setActiveFlow(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-lg font-bold">
              你喜欢什么样的饭桌氛围？
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              帮助小悦给你安排更对味的同桌组合
            </p>
          </SheetHeader>

          <div className="space-y-3">
            {VIBE_OPTIONS.map((opt) => {
              const isSelected = draftVibe === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDraftVibe(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/40"
                  )}
                >
                  <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        isSelected ? "text-primary" : "text-foreground"
                      )}
                    >
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}

            <Button
              className="w-full mt-2"
              onClick={handleSaveVibe}
              disabled={isPending || !draftVibe}
            >
              {isPending ? "保存中…" : "确认"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Hometown mini-flow sheet ──────────────────────────────────────────── */}
      <Sheet
        open={activeFlow === "hometown"}
        onOpenChange={(o) => !o && setActiveFlow(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-lg font-bold">家乡</SheetTitle>
            <p className="text-sm text-muted-foreground">
              选填 · 活动规划参考，有时能遇到同城老乡
            </p>
          </SheetHeader>

          <div className="space-y-4">
            <Input
              value={draftHometown}
              onChange={(e) => setDraftHometown(e.target.value)}
              placeholder="例如：湖南长沙"
              className="h-12 text-base rounded-xl"
            />

            <button
              type="button"
              onClick={() => setDraftHometownOptin((v) => !v)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all",
                draftHometownOptin
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background"
              )}
            >
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                  draftHometownOptin
                    ? "border-primary bg-primary"
                    : "border-muted-foreground"
                )}
              >
                {draftHometownOptin && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">开启同乡匹配</p>
                <p className="text-xs text-muted-foreground">
                  遇到老乡时优先安排同桌
                </p>
              </div>
            </button>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setActiveFlow(null)}
                disabled={isPending}
              >
                跳过
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveHometown}
                disabled={isPending}
              >
                {isPending ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Relationship status mini-flow sheet ────────────────────────────────── */}
      <Sheet
        open={activeFlow === "relationshipStatus"}
        onOpenChange={(o) => !o && setActiveFlow(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-lg font-bold">感情状态</SheetTitle>
            <p className="text-sm text-muted-foreground">
              选填 · 仅用于活动规划参考，不会公开显示给其他人
            </p>
          </SheetHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIP_OPTIONS.map((opt) => {
                const isSelected = draftRelationship === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraftRelationship(
                        isSelected ? "" : opt.value
                      )
                    }
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setActiveFlow(null)}
                disabled={isPending}
              >
                跳过
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveRelationship}
                disabled={isPending}
              >
                {isPending ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Tagline mini-flow sheet ─────────────────────────────────────────── */}
      <Sheet
        open={activeFlow === "tagline"}
        onOpenChange={(o) => !o && setActiveFlow(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-lg font-bold">
              用一句话介绍你自己
            </SheetTitle>
            <p className="text-sm text-muted-foreground">
              让同桌提前认识你，让聊天更自然地开始
            </p>
          </SheetHeader>

          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={draftTagline}
                onChange={(e) =>
                  setDraftTagline(e.target.value.slice(0, TAGLINE_MAX_LENGTH))
                }
                placeholder="例如：热爱探索小众餐厅，喜欢聊天文化差异 ☕"
                className="resize-none text-base min-h-[90px] pr-14"
                autoFocus
              />
              <span
                className={cn(
                  "absolute bottom-2.5 right-3 text-xs",
                  draftTagline.length >= TAGLINE_MAX_LENGTH
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {draftTagline.length}/{TAGLINE_MAX_LENGTH}
              </span>
            </div>

            {/* Quick-fill suggestion chips */}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="快速填写示例">
              {[
                "爱探索小众餐厅 🍜",
                "职场故事一箩筐 💼",
                "热爱旅行与文化 ✈️",
                "深度聊天爱好者 💬",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setDraftTagline(s.replace(/\s\S+$/, "").trim())
                  }
                  className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <Button
              className="w-full mt-1"
              onClick={handleSaveTagline}
              disabled={isPending}
            >
              {isPending ? "保存中…" : "保存"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
