import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Loader2, Shield, Lock } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { buildPreJoinVibeBriefUrl } from "@/lib/preJoinVibeBrief";
import { getQueryFn } from "@/lib/queryClient";
import type { PreJoinVibeBrief } from "@shared/ai/onboarding";

interface PreJoinVibeBriefSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceedToJoin: () => void;
  eventType: "饭局" | "酒局";
  area?: string;
}

export default function PreJoinVibeBriefSheet({
  open,
  onOpenChange,
  onProceedToJoin,
  eventType,
  area,
}: PreJoinVibeBriefSheetProps) {
  const url = useMemo(
    () => buildPreJoinVibeBriefUrl({ eventType, area }),
    [eventType, area],
  );

  const { data: brief, isLoading } = useQuery<PreJoinVibeBrief | null>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const handleProceed = () => {
    onOpenChange(false);
    onProceedToJoin();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-safe"
        style={{ maxHeight: "65vh" }}
      >
        <div className="flex flex-col gap-4 px-1 pt-2 pb-6">
          {/* Header — branded identity, not generic AI label */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground/80 leading-none">
                你的 JoyJoin 画像
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                基于你的性格 &amp; 偏好，AI 为你读了一段
              </p>
            </div>
          </div>

          {/* Brief content */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-muted-foreground text-sm py-4"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在解读你的社交画像…</span>
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <p className="text-base font-medium leading-snug text-foreground">
                  {brief?.insight ?? "我们的算法已初步读懂你的社交画像"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {brief?.matchingPromise ??
                    "我们会以此为基础，为你匹配更对 vibe 的小组"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compact continuity trust row — bridges vibe brief → join flow */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3 text-primary/60" aria-hidden="true" />
              桌友匿名到线下
            </span>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3 text-primary/60" aria-hidden="true" />
              实名认证已核实
            </span>
          </div>

          {/* CTA — branded handoff to join flow */}
          <Button
            size="lg"
            className="w-full mt-1 gap-2"
            onClick={handleProceed}
            disabled={isLoading}
          >
            进入这个圈子
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
