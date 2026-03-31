import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, EyeOff, Eye, Sparkles, ArrowRight, Lock } from "lucide-react";

interface BlindPoolTrustExplainerProps {
  poolData: {
    date: string;
    area: string;
    city: string;
    eventType: "饭局" | "酒局";
  };
  selectedBudget?: string;
}

interface TrustPillar {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  title: string;
  summary: string;
  detail: string;
}

export default function BlindPoolTrustExplainer({
  poolData,
  selectedBudget,
}: BlindPoolTrustExplainerProps) {
  const [expanded, setExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const hasLoggedViewRef = useRef(false);

  // Log "viewed" once on mount
  useEffect(() => {
    if (!hasLoggedViewRef.current) {
      hasLoggedViewRef.current = true;
      console.log("[Analytics] trust_explainer_viewed", {
        poolArea: poolData.area,
        eventType: poolData.eventType,
      });
    }
  }, [poolData.area, poolData.eventType]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    console.log("[Analytics] trust_explainer_toggled", {
      expanded: next,
      poolArea: poolData.area,
    });
  };

  const knownItems = [
    poolData.date,
    poolData.city ? `${poolData.city} · ${poolData.area}` : poolData.area,
    poolData.eventType,
    selectedBudget ? `预算 ${selectedBudget}` : null,
  ].filter(Boolean) as string[];

  const pillars: TrustPillar[] = [
    {
      icon: EyeOff,
      iconBg: "from-violet-500/20 to-purple-500/20",
      title: "暂时保密",
      summary: "同伴身份 · 最终分组",
      detail:
        "具体参与者的姓名与个人资料、以及最终分组方案，会在匹配完成后才向小组成员揭晓。这是盲盒玩法的核心：让初次见面自然又有趣。",
    },
    {
      icon: Eye,
      iconBg: "from-sky-500/20 to-blue-500/20",
      title: "已确认",
      summary: knownItems.join(" · "),
      detail:
        "你现在已知晓的信息：活动时间、区域、类型和你选择的预算区间。这些都是硬条件，不会在匹配后改变。",
    },
    {
      icon: Sparkles,
      iconBg: "from-amber-500/20 to-yellow-500/20",
      title: "智能匹配",
      summary: "性格 · 兴趣 · 社交偏好",
      detail:
        "小悦会综合你的性格原型、兴趣热度和本次填写的社交偏好来计算兼容度，尽量让同桌的人有聊不完的话题——但不保证百分百契合，毕竟人生在于意外惊喜。",
    },
    {
      icon: ArrowRight,
      iconBg: "from-emerald-500/20 to-green-500/20",
      title: "接下来",
      summary: "等待匹配 → 组队确认 → 见面",
      detail:
        "提交后进入候补池，截止日期前小悦完成分组。你会收到通知，查看组员基本信息（性格原型 + 社交标签），然后就是期待见面啦！",
    },
    {
      icon: Lock,
      iconBg: "from-rose-500/20 to-pink-500/20",
      title: "你的掌控",
      summary: "可修改偏好 · 隐私保护",
      detail:
        "匹配完成前，你可以回到报名页修改本次偏好设置。你的个人资料仅会以脱敏形式（性格原型 + 标签）展示给组内成员，不会对外公开详细个人信息。",
    },
  ];

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.35 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-background to-primary/5 overflow-hidden"
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base select-none" aria-hidden role="presentation">🔍</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">
              盲盒规则 · 一目了然
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              什么保密 · 怎么匹配 · 你有哪些掌控权
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25 }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      {/* Quick-scan pill row — always visible */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {pillars.map((p) => (
          <span
            key={p.title}
            aria-label={p.title}
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/60"
          >
            <p.icon className="h-2.5 w-2.5" aria-hidden />
            {p.title}
          </span>
        ))}
      </div>

      {/* Expanded detail section */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              {pillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="flex items-start gap-3"
                >
                  <div
                    className={`shrink-0 mt-0.5 w-7 h-7 rounded-lg bg-gradient-to-br ${pillar.iconBg} flex items-center justify-center`}
                    aria-hidden
                  >
                    <pillar.icon className="h-3.5 w-3.5 text-foreground/70" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground leading-tight">
                      {pillar.title}
                      <span className="font-normal text-muted-foreground ml-1.5">
                        {pillar.summary}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {pillar.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
