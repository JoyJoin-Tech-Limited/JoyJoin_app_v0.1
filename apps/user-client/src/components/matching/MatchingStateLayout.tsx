import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import matchingBg from "@/assets/matching/shared/matching-bg.svg";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchingStateLayoutProps {
  /**
   * Optional handler — renders a back arrow button in the header when provided.
   */
  onBack?: () => void;
  /** Optional title displayed in the header next to the back button. */
  title?: string;
  /**
   * Hero slot — state-specific illustration or animation.
   * Rendered at the top of the content area.
   */
  hero: ReactNode;
  /**
   * Copy slot — headline, subtext, status badges, progress indicators, etc.
   * Rendered between the hero and the CTA slot.
   */
  copy: ReactNode;
  /**
   * CTA slot — primary / secondary / tertiary action buttons.
   * Rendered below the copy slot.
   */
  cta: ReactNode;
  /**
   * Optional footer content rendered at the bottom of the content area,
   * below the CTA slot (e.g. reassurance text, legal disclaimers).
   */
  footer?: ReactNode;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Full-screen layout shell shared by all matching-state screens
 * (e.g. waiting, no-match, etc.).
 *
 * Provides:
 *  - shared dark background (`matching/shared/matching-bg.svg`) with a
 *    readability scrim
 *  - safe-area-aware header with optional back button and title
 *  - centred content container exposing hero / copy / CTA / footer slots
 *
 * State-specific logic (copy, animations, CTAs) lives in the calling
 * component; this shell only owns layout and background.
 *
 * @example
 * ```tsx
 * <MatchingStateLayout
 *   onBack={handleBack}
 *   title={poolTitle}
 *   hero={<MyHeroIllustration />}
 *   copy={<MyHeadlineAndProgress />}
 *   cta={<MyActionButtons />}
 *   footer={<p className="text-xs text-white/30">…</p>}
 * />
 * ```
 */
export default function MatchingStateLayout({
  onBack,
  title,
  hero,
  copy,
  cta,
  footer,
  className,
}: MatchingStateLayoutProps) {
  return (
    <div className={cn("relative min-h-screen overflow-hidden", className)}>
      {/* ── Shared background ── */}
      <img
        src={matchingBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />
      {/* Dark scrim for readability */}
      <div className="absolute inset-0 bg-[#0D0A1A]/75" />

      {/* ── Header ── */}
      {(onBack || title) && (
        <div className="relative z-20 flex items-center h-14 px-4 pt-safe">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="text-white/70 hover:text-white hover:bg-white/10"
              aria-label="返回"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {title && (
            <h1 className="ml-2 flex-1 text-sm font-semibold text-white/90 line-clamp-1">
              {title}
            </h1>
          )}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center px-5 pb-12 pt-4">
        {/* Hero slot */}
        {hero}

        {/* Copy slot */}
        {copy}

        {/* CTA slot */}
        {cta}

        {/* Footer slot */}
        {footer}
      </div>
    </div>
  );
}
