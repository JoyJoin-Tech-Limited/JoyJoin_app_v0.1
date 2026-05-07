import emptyStateHeroUrl from '@/assets/empty state transition/gift box + animals 插画.svg';
import emptyStateBgUrl from '@/assets/empty state transition/purple gradient background.svg';

let prefetched = false;

/**
 * Background-prefetch the empty-state illustration assets for the centre tab.
 * Safe to call multiple times — executes at most once per page lifecycle.
 * Skips on data-saver mode or very slow (2g / slow-2g) connections.
 */
export function prefetchEmptyStateAssets(): void {
  if (typeof window === 'undefined') return;
  if (prefetched) return;
  prefetched = true;

  // Network Information API is not yet standardised — `any` cast is the
  // established pattern in this codebase (see BottomNav.tsx, resourceCaching.ts).
  const connection = (navigator as any).connection;
  if (
    connection?.saveData ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  ) {
    return;
  }

  [emptyStateHeroUrl, emptyStateBgUrl].forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}
