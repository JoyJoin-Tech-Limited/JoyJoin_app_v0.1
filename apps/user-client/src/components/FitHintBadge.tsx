/**
 * FitHintBadge
 * Tiny, icon-led fit micro-signal for the discovery card.
 * Derives a social-energy hint from the pool's sample archetype composition.
 */
import { getFitHintFromArchetypes } from "@/lib/poolVibeUtils";

interface FitHintBadgeProps {
  sampleArchetypes: string[];
  eventType: "饭局" | "酒局";
  isGirlsNight?: boolean;
}

export default function FitHintBadge({ sampleArchetypes, eventType, isGirlsNight }: FitHintBadgeProps) {
  const hint = getFitHintFromArchetypes(sampleArchetypes, eventType, isGirlsNight);
  if (!hint) return null;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/8 border border-primary/15 text-primary/80 select-none"
      aria-label={hint.text}
    >
      <span aria-hidden="true">{hint.icon}</span>
      {hint.text}
    </span>
  );
}
