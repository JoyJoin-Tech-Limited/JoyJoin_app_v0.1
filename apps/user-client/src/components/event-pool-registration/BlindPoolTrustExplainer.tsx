import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, Eye, EyeOff, Lock, Sparkles } from "lucide-react";

interface BlindPoolTrustExplainerProps {
  poolData: {
    date: string;
    area: string;
    city: string;
    eventType: "饭局" | "酒局";
  };
  selectedBudget?: string;
}

export default function BlindPoolTrustExplainer({
  poolData,
  selectedBudget,
}: BlindPoolTrustExplainerProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const hasLoggedViewRef = useRef(false);

  useEffect(() => {
    if (hasLoggedViewRef.current) return;
    hasLoggedViewRef.current = true;
    console.log("[Analytics] trust_explainer_viewed", {
      poolArea: poolData.area,
      eventType: poolData.eventType,
    });
  }, [poolData.area, poolData.eventType]);

  const knownItems = [
    poolData.date,
    `${poolData.city} · ${poolData.area}`,
    poolData.eventType,
    selectedBudget ? `预算 ${selectedBudget}` : null,
  ].filter(Boolean) as string[];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.28 }}
      className="overflow-hidden rounded-[28px] border border-primary/15 bg-gradient-to-br from-[#1d1331] via-[#271744] to-[#120d24] text-white shadow-[0_20px_70px_rgba(76,29,149,0.22)]"
    >
      <div className="relative overflow-hidden px-5 py-5">
        <div className="absolute right-4 top-3 h-20 w-20 rounded-full bg-fuchsia-400/15 blur-3xl" />
        <div className="absolute left-6 top-12 h-16 w-16 rounded-full bg-amber-300/10 blur-2xl" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Seal the Blind Box</p>
            <h3 className="mt-2 text-xl font-cn-display font-semibold">准备封盒</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/65">
              你现在确认的是硬条件，真正的惊喜会在匹配完成后揭晓。
            </p>
          </div>

          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full bg-white/10 p-2 text-white/70 ring-1 ring-white/10 transition hover:bg-white/15"
            aria-expanded={expanded}
            aria-label={expanded ? "收起盲盒说明" : "展开盲盒说明"}
          >
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            >
              <ChevronDown className="h-4 w-4" />
            </motion.div>
          </button>
        </div>

        <div className="mt-5 rounded-[24px] border border-white/10 bg-white/6 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/15 ring-1 ring-amber-200/20">
              <Lock className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">已封存的，是你的意图</p>
              <p className="text-xs text-white/55">时间、区域、类型和预算会一起装进这只盲盒里。</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {knownItems.map((item) => (
              <span
                key={item}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75 ring-1 ring-white/10"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.24 }}
            className="overflow-hidden border-t border-white/10 bg-black/10"
          >
            <div className="grid gap-3 px-5 py-4 text-sm">
              <div className="flex gap-3">
                <EyeOff className="mt-0.5 h-4 w-4 text-violet-200" />
                <div>
                  <p className="font-medium text-white">暂时保密</p>
                  <p className="text-xs leading-relaxed text-white/55">
                    同伴身份和最终分组会在匹配完成后才向组员揭晓，保证盲盒的惊喜感。
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 text-amber-200" />
                <div>
                  <p className="font-medium text-white">智能匹配</p>
                  <p className="text-xs leading-relaxed text-white/55">
                    小悦会综合人格原型、兴趣热度和你这次填写的社交意图来决定更适合的一桌。
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Eye className="mt-0.5 h-4 w-4 text-sky-200" />
                <div>
                  <p className="font-medium text-white">你仍有掌控感</p>
                  <p className="text-xs leading-relaxed text-white/55">
                    在匹配完成前，你都可以回来修改偏好；展示给他人的信息也会保持脱敏。
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
