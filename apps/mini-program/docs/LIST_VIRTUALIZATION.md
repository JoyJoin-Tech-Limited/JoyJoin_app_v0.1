# Long lists in the WeChat mini-program

## Threshold

`MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD` in `src/lib/longListThreshold.ts` (default **30** rows) is the **conservative review threshold** at which Discover and Events lists should be audited for scroll performance.

**Tiered guidance:**
- **Primary tier (8GB+ RAM, 120Hz):** Lists up to 50–60 rows typically run smoothly without virtualization. Review at 30 rows as a sanity check; virtualization often unnecessary.
- **Degradation tier (4–6GB RAM, 60Hz):** The 30-row threshold remains the point where jank becomes likely. Enable `VirtualList` fallback or pagination.
- **Universal rule:** If a list exceeds **100 rows**, always use pagination or `VirtualList` regardless of tier.

## Why not VirtualList from Taro core?

The JoyJoin mini-program uses `ScrollView` + mapped children for pool and event lists. The stock Taro component set for this app does not include a built-in `VirtualList`. WeChat offers alternatives when lists grow:

- **Pagination or “load more”** at the API layer (simplest).
- **`recycle-view`** / custom recycling patterns in native WeChat docs if you must render hundreds of homogeneous rows.

## Animation budget

Discover applies staggered entrance delays on pool cards (`animationDelay` capped per card).

**Tiered animation budget:**
- **Primary tier:** Full staggered entrance up to the threshold; cap delays to maintain 120Hz fluidity.
- **Degradation tier:** Reduce stagger count (e.g., animate only first 6 items) or disable per-item entrance entirely; use `useMiniRevealMotion` benchmark fallback.
- **Gating:** Use `getSystemInfoSync().benchmarkLevel` or RAM heuristics to select tier at runtime. Do not uniformly disable motion for all users.
