# Long lists in the WeChat mini-program

## Threshold

`MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD` in `src/lib/longListThreshold.ts` (default **30** rows) is the point at which **Discover** and **Events** should be re-checked for jank on mid-range devices.

## Why not VirtualList from Taro core?

The JoyJoin mini-program uses `ScrollView` + mapped children for pool and event lists. The stock Taro component set for this app does not include a built-in `VirtualList`. WeChat offers alternatives when lists grow:

- **Pagination or “load more”** at the API layer (simplest).
- **`recycle-view`** / custom recycling patterns in native WeChat docs if you must render hundreds of homogeneous rows.

## Animation budget

Discover applies staggered entrance delays on pool cards (`animationDelay` capped per card). If row counts grow past the threshold, **reduce or disable** per-item entrance animation on low-end devices (see `useMiniRevealMotion` / benchmark fallback patterns).
