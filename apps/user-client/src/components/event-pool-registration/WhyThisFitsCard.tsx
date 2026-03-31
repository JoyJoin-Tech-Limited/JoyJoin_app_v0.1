import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { Sparkles, CheckCircle2 } from "lucide-react";
import type { PreJoinVibeBrief } from "@shared/ai/onboarding";

interface WhyThisFitsCardProps {
  /** Event type used to tailor fit reasons. */
  eventType: "饭局" | "酒局";
  /** Area/district used to tailor fit reasons. */
  area: string;
  /** Whether the join sheet is open (controls query enabling). */
  enabled?: boolean;
}

/**
 * WhyThisFitsCard
 *
 * A concise, premium "Why this pool fits you" card shown at the top of Step 1
 * in the JoinEventPoolSheet. Displays 2–3 pool-specific fit reasons derived from
 * the user's archetype, work mode, and the pool's event type / area.
 *
 * - Renders nothing when there are fewer than 2 reasons (graceful degradation).
 * - Uses deterministic server logic — no LLM latency.
 * - Respects prefers-reduced-motion.
 */
export default function WhyThisFitsCard({
  eventType,
  area,
  enabled = true,
}: WhyThisFitsCardProps) {
  const prefersReducedMotion = useReducedMotion();

  const { data: brief, isLoading } = useQuery<PreJoinVibeBrief | null>({
    queryKey: ["/api/ai/pre-join-vibe-brief", eventType, area],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (eventType) params.set("eventType", eventType);
      if (area) params.set("area", area);
      const res = await fetch(`/api/ai/pre-join-vibe-brief?${params.toString()}`);
      if (!res.ok) return null;
      return res.json() as Promise<PreJoinVibeBrief>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const reasons = brief?.reasons ?? [];

  // Don't render the card if we have fewer than 2 reasons — keeps it premium over generic
  if (!isLoading && reasons.length < 2) return null;

  return (
    <AnimatePresence>
      {(isLoading || reasons.length >= 2) && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mb-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5"
          role="region"
          aria-label="为什么适合你"
          data-testid="why-this-fits-card"
        >
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles
              className="w-3.5 h-3.5 text-primary shrink-0"
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">
              为什么适合你
            </span>
          </div>

          {/* Reasons list */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-4 rounded bg-primary/10 animate-pulse"
                  style={{ width: i === 1 ? "75%" : "60%" }}
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (
            <ul className="space-y-1.5" aria-label="适合理由列表">
              {reasons.slice(0, 3).map((reason, index) => (
                <motion.li
                  key={index}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: prefersReducedMotion ? 0 : index * 0.07 }}
                  className="flex items-start gap-2 text-sm text-foreground/80 leading-snug"
                >
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-primary/70 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{reason}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
