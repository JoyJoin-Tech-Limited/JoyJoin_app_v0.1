# Layout Patterns

## ResponsiveSpacer Usage

### Web
```tsx
import { ResponsiveSpacer } from "@shared/ui/ResponsiveSpacer";

<ResponsiveSpacer height={80} collapseBelow={640} />
```

- `height` — spacer size when not collapsed
- `collapseBelow` — if `window.innerHeight < collapseBelow`, render `null`
- Place between dense step content and a fixed bottom CTA so short phones keep the primary button visible

### Mini-program (Taro)
```tsx
import { ResponsiveSpacer } from "@/components/ResponsiveSpacer";

<ResponsiveSpacer heightRpx={160} collapseBelow={640} />
```

- `heightRpx` — spacer size in rpx
- `collapseBelow` — px value from `Taro.getWindowInfo()` / `getSystemInfoSync()`

## ScrollSentinel Setup

**Location:** `apps/user-client/src/components/dev/ScrollSentinel.tsx`

**Behaviour (dev only):**
- Measures overflow vs `window.innerHeight` (preferring `#jj-scroll-chassis` when present)
- Draws a red, semi-transparent band at the bottom of the viewport with an approximate overflow label

**Agent rule:** Mount `<ScrollSentinel />` once in `App.tsx` during development (already wired next to the router shell).

**Mini-program:** ScrollSentinel is web-only today. Use WeChat DevTools layout / responsive preview and manual checks.

## FormStepper Max-4 Rule

**Hard cap:** Do not ship a single step that contains more than four (4) text/numeric inputs (`<input>`, `<textarea>`, `<select>` not used as a compact control).

**Split rule:** If a user story needs five or more distinct data fields, automatically split into a multi-step flow (e.g., "Step 2 of 4") without waiting for explicit product copy. Mirror `EssentialDataPage`'s `STEP_CONFIG` pattern.

**Note:** Segmented chips, intent cards, and binary choices are **not** counted as input fields. If a step is still taller than the viewport, use `ResponsiveSpacer` + flex shells before adding document scroll.

## Taro ScrollView Patterns

```tsx
import { ScrollView, View } from "@tarojs/components";

// Explicit scroll port for feeds or dense onboarding sub-areas
<ScrollView scrollY style={{ height: "100%" }}>
  <View>Content</View>
</ScrollView>
```

Rules:
- One explicit `ScrollView` per screen that needs it
- `scrollY` must be set
- The `ScrollView` itself must have bounded height (not `height: auto` inside an unbounded flex parent)
- Use for: feeds (`pages/discover/index.tsx`), bounded form columns (e.g., `pages/onboarding/essential-data`)
- Do not stack marketing + form on one page without a split

## SCSS Mixins

In `apps/mini-program/src/styles/_mixins.scss`:

- `@mixin viewport-min-height` — sets `min-height: 100vh` with `100dvh` follow-up
- `@mixin no-scroll-page-shell` — flex column, `overflow: hidden`, `height: 100%`
- `@mixin page-gradient-bg` — brand gradient background

## Web Shell Breakdown

**`apps/user-client/src/styles/viewport-lockdown.css`** (imported from `index.css`):

- `html` / `body` height chain using `100dvh` (with `100%` fallback)
- `body { overflow: hidden; }` — document does not scroll
- `#root` — `height: 100%`, `display: flex`, `flex-direction: column`, `min-height: 0`
- `.no-scroll-container` — `display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;`

**App shell:** `App.tsx` mounts `#jj-scroll-chassis` (`flex-1 min-h-0 overflow-y-auto`) so legacy routes remain usable until each adopts `.no-scroll-container` or an inner list scroll region.

## Exception Rules

Allowed vertical scroll only when the surface is inherently variable-length (transaction history, search results, Discover-style feeds). The scroll root must include a short comment citing this exception.

Example from `DiscoverPage.tsx`:
```tsx
{/* Scroll exception: feed-style discover page — inherently variable-length */}
<ScrollView scrollY>...</ScrollView>
```
