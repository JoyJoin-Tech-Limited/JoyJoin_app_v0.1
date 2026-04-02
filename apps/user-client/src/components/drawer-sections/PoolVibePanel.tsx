/**
 * PoolVibePanel
 * Drawer-level pool vibe/chemistry summary.
 * Shows the overall chemistry level with gradient header + description.
 */
import { motion } from "framer-motion";
import { getVibeTokens } from "@/lib/vibeTokens";
import { deriveChemistryFromArchetypes, deriveChemistryFromScore } from "@/lib/poolVibeUtils";
import type { OverallChemistry } from "@shared/types/groupAnalysis";

interface PoolVibePanelProps {
  avgMatchScore: number;
  archetypeBreakdown?: Record<string, number>;
}

const CHEMISTRY_DESCRIPTIONS: Record<OverallChemistry, string> = {
  fire: "这个活动池能量超高，参与者相性极佳，预计对话从一开始就会迸发火花。",
  warm: "这个活动池聚集了默契感强的伙伴，氛围温暖而有活力，很适合深聊。",
  mild: "这个活动池组合平衡，各有特色，轻松相聊，找到共鸣的机会很多。",
  cold: "这个活动池风格沉静，适合慢热的深度交流，不追求表面热闹。",
};

export default function PoolVibePanel({
  avgMatchScore,
  archetypeBreakdown = {},
}: PoolVibePanelProps) {
  const archetypes = Object.keys(archetypeBreakdown);
  const chemistry =
    deriveChemistryFromScore(avgMatchScore)
    ?? (archetypes.length > 0 ? deriveChemistryFromArchetypes(archetypes) : null);

  if (!chemistry) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 mb-5 bg-gradient-to-br from-primary/6 via-background to-primary/10"
      >
        <div className="px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/60 mb-1">
            活动池 Vibe
          </p>
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none" aria-hidden="true">✨</span>
            <div>
              <p className="text-sm font-semibold text-foreground">正在形成中</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                暂无匹配分组数据，随着更多人加入，这里的社交能量和聊天感觉会逐步显现。
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const tokens = getVibeTokens(chemistry);
  const description = CHEMISTRY_DESCRIPTIONS[chemistry];
  const scoreLabel = avgMatchScore > 0 ? `平均适配度 ${avgMatchScore}%` : "根据当前参与者风格预测";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 mb-5"
    >
      {/* Gradient header */}
      <div
        style={{
          background: tokens.panelGradient,
          padding: "14px 18px 12px",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 4,
          }}
        >
          活动池 Vibe
        </p>
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden="true">{tokens.emoji}</span>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: tokens.panelTextColor, lineHeight: 1.2 }}>
              {tokens.fullLabel}
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              {scoreLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900">
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
