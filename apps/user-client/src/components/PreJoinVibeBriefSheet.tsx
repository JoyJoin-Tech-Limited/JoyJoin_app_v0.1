import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
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
  const reduceMotion = useReducedMotion();

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
        style={{ maxHeight: "60vh" }}
      >
        <div className="flex flex-col gap-5 px-1 pt-2 pb-6">
          {/* Header */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">
              AI Vibe 简报
            </p>
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
                <span>正在读取你的 vibe…</span>
              </motion.div>
            ) : (
              <motion.div
                key="content"
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="space-y-3"
              >
                {/* Wave 3: sparkle accent on insight reveal */}
                <div className="relative">
                  {!reduceMotion && (
                    <motion.span
                      className="absolute -top-1 -left-1 text-primary/60 text-sm select-none pointer-events-none"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                      transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
                      aria-hidden="true"
                    >
                      ✦
                    </motion.span>
                  )}
                  <p className="text-base font-medium leading-snug text-foreground pl-2">
                    {brief?.insight ?? "我们的算法已初步读懂你的社交画像"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {brief?.matchingPromise ??
                    "我们会以此为基础，为你匹配更对 vibe 的小组"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA — Wave 3: more story-driven phrasing */}
          <Button
            size="lg"
            className="w-full mt-1 gap-2 transition-all duration-150 active:scale-[0.98]"
            onClick={handleProceed}
            disabled={isLoading}
          >
            帮我找对 vibe 的局
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
