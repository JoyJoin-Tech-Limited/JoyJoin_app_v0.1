/**
 * SquadVibePanel
 *
 * Group-level chemistry summary shown below the card deck in SquadUnboxingFlow.
 * Displays the overall chemistry label, group-dynamics prose, and ice-breaker
 * cards (via IceBreakerScrollCards).
 *
 * Visual hierarchy: this panel is deliberately *secondary* to the member card
 * reveal — it slides in after the cards have settled and acts as a reward.
 *
 * Usage:
 *   <SquadVibePanel
 *     overallChemistry="warm"
 *     groupDynamics="有人带动气氛，有人倾听回应…"
 *     iceBreakers={["你们最近发现的宝藏地方？", "如果可以拥有一项超能力…"]}
 *     isLoading={isLoadingAnalysis}
 *   />
 */

import { motion } from "framer-motion";
import IceBreakerScrollCards from "./IceBreakerScrollCards";
import { getVibeTokens } from "@/lib/vibeTokens";
import type { OverallChemistry } from "@shared/types/groupAnalysis";

interface SquadVibePanelProps {
  overallChemistry?: OverallChemistry;
  groupDynamics?: string;
  iceBreakers?: string[];
  /** While true, render loading skeletons instead of real content */
  isLoading?: boolean;
}

export default function SquadVibePanel({
  overallChemistry,
  groupDynamics,
  iceBreakers,
  isLoading = false,
}: SquadVibePanelProps) {
  const tokens = getVibeTokens(overallChemistry);

  return (
    <motion.div
      className="w-full rounded-2xl overflow-hidden"
      style={{ border: "1px solid rgba(0,0,0,0.08)" }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* Chemistry header */}
      <div
        style={{
          background: tokens.panelGradient,
          padding: "16px 20px 12px",
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.75)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          这个组合的氛围
        </p>
        {isLoading ? (
          <div
            style={{
              height: 24,
              width: 160,
              borderRadius: 6,
              background: "rgba(255,255,255,0.25)",
              animation: "squad-vibe-pulse 1.4s ease-in-out infinite",
            }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }} aria-hidden="true">
              {tokens.emoji}
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: tokens.panelTextColor,
                lineHeight: 1.2,
              }}
            >
              {tokens.fullLabel}
            </span>
          </div>
        )}
      </div>

      {/* Group dynamics prose */}
      <div
        style={{
          background: "var(--card, #fff)",
          padding: "12px 20px",
        }}
      >
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                height: 14,
                borderRadius: 4,
                background: "rgba(0,0,0,0.07)",
                animation: "squad-vibe-pulse 1.4s ease-in-out infinite",
              }}
            />
            <div
              style={{
                height: 14,
                width: "80%",
                borderRadius: 4,
                background: "rgba(0,0,0,0.07)",
                animation: "squad-vibe-pulse 1.4s ease-in-out infinite",
                animationDelay: "0.15s",
              }}
            />
          </div>
        ) : groupDynamics ? (
          <p
            style={{
              fontSize: 13,
              color: "var(--muted-foreground, #6B7280)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {groupDynamics}
          </p>
        ) : null}
      </div>

      {/* Ice-breaker section */}
      {(isLoading || (iceBreakers && iceBreakers.length > 0)) && (
        <div
          style={{
            background: "var(--card, #fff)",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            padding: "12px 0 16px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground, #6B7280)",
              paddingInline: 20,
              marginBottom: 10,
            }}
          >
            小悦为你们准备的破冰话题 💬
          </p>
          <IceBreakerScrollCards
            topics={iceBreakers ?? []}
            accentColor={tokens.panelGradient}
            isLoading={isLoading}
          />
        </div>
      )}

      <style>{`
        @keyframes squad-vibe-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="squad-vibe-pulse"] { animation: none !important; }
        }
      `}</style>
    </motion.div>
  );
}
