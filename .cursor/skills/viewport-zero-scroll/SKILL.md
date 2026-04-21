---
name: viewport-zero-scroll
description: >
  Zero-scroll viewport policy for web and WeChat mini-program (launch priority): 100dvh shell,
  no document/page scroll, no-scroll containers, ResponsiveSpacer (web + Taro), ScrollSentinel
  (web dev), FormStepper (max 4 inputs per step). Trigger phrases: "zero scroll", "viewport lock",
  "mini-program layout", "Taro ScrollView", "100dvh", "ResponsiveSpacer", "collapseBelow".
---

# Viewport Zero-Scroll

**Core rule:** Prefer a locked viewport (`100dvh`, no document / page-level scroll) and per-surface flex shells. Scrolling is allowed only inside an explicit scroll port (e.g. `ScrollView` for lists or dense onboarding sub-areas) documented in a code comment.

**Launch priority:** Apply the same discipline to **`apps/mini-program`** (Taro / WeChat) as to `user-client` — see **Mini-program (Taro)** below.

## Skill A — `viewport-lockdown.css`

**Location:** `apps/user-client/src/styles/viewport-lockdown.css` (imported from `apps/user-client/src/index.css`).

**Provides:**

- `html` / `body` height chain using **`100dvh`** (with `100%` fallback where needed).
- **`body { overflow: hidden; }`** — document does not scroll.
- **`#root`** — `height: 100%`, `display: flex`, `flex-direction: column`, `min-height: 0`.
- **`.no-scroll-container`** — `display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;` for full-viewport steps.

**App shell:** `App.tsx` mounts `#jj-scroll-chassis` (`flex-1 min-h-0 overflow-y-auto`) so legacy routes remain usable until each adopts `.no-scroll-container` or an inner list scroll region.

## Skill B — `ResponsiveSpacer`

**Location:** `packages/shared/src/ui/ResponsiveSpacer.tsx` — import `@shared/ui/ResponsiveSpacer`.

**API:**

- `height: number | string` — spacer size when not collapsed.
- `collapseBelow?: number` — if `window.innerHeight < collapseBelow`, render **`null`** (no reserved space).

**Onboarding:** Place between dense step content and a fixed bottom CTA so short phones keep the primary button visible without extra dead space.

## Skill C — `ScrollSentinel` (development)

**Location:** `apps/user-client/src/components/dev/ScrollSentinel.tsx`.

**Behaviour (when `import.meta.env.DEV`):** Measures overflow vs `window.innerHeight` (preferring `#jj-scroll-chassis` when present) and draws a **red, semi-transparent band** at the bottom of the viewport with an approximate overflow label.

**Agent rule:** While building or refactoring frontend layout in development, **mount `<ScrollSentinel />` once** in `App.tsx` (already wired next to the router shell).

## Skill D — `FormStepper` / onboarding density

**Hard cap:** Do **not** ship a **single step** that contains **more than four (4) text/numeric inputs** (`<input>`, `<textarea>`, `<select>` not used as a compact control).

**Split rule:** If a user story needs **five or more** distinct data fields, **automatically** split into a multi-step flow (e.g. “Step 2 of 4”) without waiting for explicit product copy — mirror `EssentialDataPage`’s `STEP_CONFIG` pattern.

**Note:** Segmented chips, intent cards, and binary choices are **not** counted as “input fields” for this cap; if a step is still taller than the viewport, use `ResponsiveSpacer` + flex shells before adding document scroll.

## Exceptions (documented comment)

Allowed vertical scroll only when the surface is inherently variable-length (transaction history, search results, Discover-style feeds). The scroll root must include a short comment citing this exception (see `DiscoverPage.tsx`).

## Mini-program (Taro / WeChat) — same policy, renderer-native

There is no shared DOM `body` / `#root` in the WeChat runtime. Enforce the **same intent** with Taro primitives:

| Web skill | Mini-program equivalent |
|-----------|-------------------------|
| `viewport-lockdown.css` | Root **`page`** + page wrapper: use **`@include viewport-min-height`** and **`@include no-scroll-page-shell`** from `apps/mini-program/src/styles/_mixins.scss` where a full-screen step must not grow the native page scroll. |
| `#jj-scroll-chassis` | One explicit **`ScrollView`** (`scrollY`) per screen that needs it — **feeds** (`pages/discover/index.tsx`), or a **bounded** form column (e.g. `pages/onboarding/essential-data`) — not unbounded stacking of marketing + form on one page without a split. |
| `ResponsiveSpacer` (React DOM) | **`ResponsiveSpacer`** in `apps/mini-program/src/components/ResponsiveSpacer.tsx` — **`heightRpx`** + optional **`collapseBelow`** (px, from `Taro.getWindowInfo` / `getSystemInfoSync`). |
| `ScrollSentinel` | **Web-only** today (DOM overlay). On mini-program, use **WeChat DevTools** layout / “responsive” preview and manual checks; do not rely on DOM injection. |

**`100dvh` / `100vh`:** `page-gradient-bg` and **`@mixin viewport-min-height`** use `100vh` with a **`100dvh`** follow-up so dynamic toolbar inset matches the web skill.

**FormStepper / density:** Same **≤4 text/numeric inputs per step** rule as web; align multi-step onboarding with `packages/shared/src/onboarding.ts` + server `nextStep`. Heavy single-page onboarding (many `Input`/`Picker` rows in one `ScrollView`) should be **split into sub-routes or stages** for launch parity with web `EssentialDataPage` / `STEP_CONFIG`.

**Coordination:** When changing viewport or onboarding layout on one platform, check the sibling surface per [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md) (`BOTH_REQUIRED` for duplicated journeys).

## Related files

- `apps/user-client/src/styles/viewport-lockdown.css`
- `apps/user-client/src/App.tsx` — shell + `ScrollSentinel` + `#jj-scroll-chassis`
- `packages/shared/src/ui/ResponsiveSpacer.tsx`
- `apps/user-client/src/components/dev/ScrollSentinel.tsx`
- `apps/mini-program/src/styles/_mixins.scss` — `viewport-min-height`, `no-scroll-page-shell`, `page-gradient-bg`
- `apps/mini-program/src/components/ResponsiveSpacer.tsx`
- `apps/mini-program/src/pages/onboarding/essential-data/` — reference onboarding layout + `ScrollView` + fixed tray
- [`onboarding-state-architecture`](../onboarding-state-architecture/SKILL.md) — server `nextStep` authority + FormStepper density
- [`frontend-component-architecture`](../frontend-component-architecture/SKILL.md) — shared vs app placement
- [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md) — web ↔ mini-program parity

## Review checklist

- [ ] **Web:** full-screen flow uses `.no-scroll-container` or a documented inner scroll port — not ad hoc `100vh` without `dvh`
- [ ] **Mini-program:** full-screen flow uses **`viewport-min-height` / `no-scroll-page-shell`** or a documented **`ScrollView`** — same exception rules as web
- [ ] No step presents **> 4** text/numeric inputs without splitting steps (both clients)
- [ ] Short-viewport gaps use **`ResponsiveSpacer`** / **`ResponsiveSpacer` (Taro)** with **`collapseBelow`** where CTAs risk being pushed off-screen
- [ ] Feed-style pages document the scroll exception at the scroll root (`ScrollView` or web scroll chassis)
- [ ] **Web dev:** `ScrollSentinel` mounted to catch accidental overflow growth
- [ ] **Launch:** sibling onboarding / payment / auth flows reviewed under platform coordination when layout or step count changes
