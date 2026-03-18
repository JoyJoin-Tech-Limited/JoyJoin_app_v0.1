# Legacy Interest & Topics Selection System — HISTORICAL BACKUP ONLY

> ⚠️  **DO NOT USE** — These files are NOT active runtime code.  They exist
> purely as a historical reference.  Interest selection is now handled by the
> Interest Carousel inside `ExtendedDataPage`.

## What is this?

This folder contains the **legacy interest selection system** that was replaced
by the Interest Carousel.  These files are kept for historical reference only.

## System Overview

### This folder (HISTORICAL — do not use)
- **20 Interest Options** — Curated list of activity interests
- **Topic Avoidances** — Users could select topics to avoid
- **Status**: ❌ DEPRECATED — Not routed, not imported, not in active use

### Active system (current)
Interest selection is done via the **Interest Carousel** inside
`ExtendedDataPage` at route `/onboarding/extended`:
- **56 topics across 8 categories** with heat levels (0 / 5 / 15 / 25)
- **Component**: `apps/user-client/src/components/interests/InterestCarousel.tsx`
- **Data**: `apps/user-client/src/data/interestCarouselData.ts`
- **Data storage**: `user_interests` table (`selections`, `categoryHeat`, `topPriorities`)
- **Completion flag**: `hasCompletedInterestsCarousel` on the `users` table

The `hasCompletedInterestsTopics` flag on the `users` table is legacy and no
longer gated in the user-client onboarding flow.

## Files in this backup

### Pages (`pages/`)
- `InterestsTopicsPage.tsx` — Original interest selection page
- `InterestsTopicsPage.legacy.tsx` — Earlier backup version
- `EditInterestsPage.tsx` — Profile edit page for legacy interests

### Components (`components/`)
- `InterestMapping.tsx` — Visualization component for 20-interest system

---
*Originally moved to backup: 2026-01-19*
*README updated to reflect current architecture: 2026-03-18*

