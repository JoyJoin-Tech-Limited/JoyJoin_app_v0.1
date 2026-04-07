/**
 * EventCardSkeleton
 *
 * Wave 3 premium loading skeleton for BlindBoxEventCard.
 * Matches the card's ~240px height and layout structure so the
 * transition from skeleton → card feels composed, not jarring.
 *
 * Uses the existing .animate-shimmer CSS utility from index.css.
 * Gated behind aria-hidden so screen readers skip it entirely.
 */

export function EventCardSkeleton() {
  return (
    <div
      className="relative rounded-xl overflow-hidden border border-border/60 bg-card"
      style={{ height: "240px" }}
      aria-hidden="true"
      role="presentation"
      data-testid="event-card-skeleton"
    >
      {/* Left accent bar placeholder */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-muted animate-shimmer" />

      <div className="p-4 h-full flex flex-col gap-3">
        {/* Title area */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 rounded-md bg-muted animate-shimmer" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-28 rounded-md bg-muted animate-shimmer" />
              <div className="h-5 w-12 rounded-md bg-muted animate-shimmer" />
            </div>
          </div>
          {/* Countdown badge placeholder */}
          <div className="h-6 w-20 rounded-full bg-muted animate-shimmer shrink-0" />
        </div>

        {/* Location row */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-muted animate-shimmer shrink-0" />
          <div className="h-4 w-24 rounded-md bg-muted animate-shimmer" />
        </div>

        {/* Archetype chip row (PoolMomentumVisual placeholder) */}
        <div className="flex items-center gap-1 mt-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-9 rounded-full bg-muted animate-shimmer shrink-0"
              style={{ marginLeft: i === 0 ? 0 : "-8px", zIndex: 5 - i }}
            />
          ))}
          <div className="ml-2 h-9 w-9 rounded-full bg-muted animate-shimmer shrink-0" />
        </div>

        {/* Vibe badges row */}
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-16 rounded-full bg-muted animate-shimmer" />
          <div className="h-5 w-20 rounded-full bg-muted animate-shimmer" />
        </div>

        {/* CTA button row */}
        <div className="flex gap-2 mt-auto">
          <div className="flex-1 h-10 rounded-xl bg-muted animate-shimmer" />
          <div className="h-10 w-10 rounded-xl bg-muted animate-shimmer shrink-0" />
        </div>
      </div>
    </div>
  );
}
