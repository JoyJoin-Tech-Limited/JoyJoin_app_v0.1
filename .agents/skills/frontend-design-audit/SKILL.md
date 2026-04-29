---
name: frontend-design-audit
description: >
  Run systematic design-quality audits on JoyJoin frontend surfaces (mini-program
  and web). Scores 5 dimensions, detects AI slop / generic patterns, and produces
  actionable fix lists. Use during PR review, before shipping UI changes, or when
  a screen feels off-brand. Trigger phrases: "audit this screen", "design review",
  "check for AI slop", "why does this look generic", "run design audit",
  "frontend quality check", "does this feel premium".
---

# Frontend Design Audit

**Core rule:** Every shipped JoyJoin surface should pass a design audit before merge. This skill provides the scoring rubric, anti-pattern checklist, and Taro-specific checks to make that review systematic rather than gut-feel.

**Inspiration:** This skill synthesizes patterns from `impeccable` (5-dimension audit scoring, anti-pattern detection) and `taste-skill` (AI Tells ban list, redesign diagnostic) into a JoyJoin-native, mini-program-aware quality gate.

## When to use this skill

- Reviewing a PR that touches UI (mini-program or web)
- A shipped screen feels generic, cheap, or off-brand but you cannot name why
- Before calling a UI task "done" — run this as a final quality pass
- Onboarding a new screen: audit the first implementation against this checklist
- Retroactively auditing existing screens for a quality uplift sprint

## How to run an audit

### Agent-mode (during implementation / PR review)
1. Identify the target: specific page, component, or flow
2. Score all 5 dimensions below (0–4 each)
3. List specific anti-patterns found with file paths and line numbers where possible
4. Generate a ranked fix list (P0 = ship-blocking, P1 = should fix, P2 = polish)
5. Report the health score and rating band

### Human-mode (CLI)
```bash
# Audit a specific page or component directory
npm run design:audit apps/mini-program/src/pages/discover

# Audit the entire mini-program surface
npm run design:audit apps/mini-program/src/pages

# Audit web surfaces
npm run design:audit apps/user-client/src/pages
```

> **Note:** The CLI script is a lightweight wrapper that runs regex + heuristic checks. It catches obvious violations but cannot judge hierarchy, emotional resonance, or copy quality — those require agent-mode visual review.

---

## The 5 Dimensions (scored 0–4 each)

### 1. Brand Fidelity & Anti-Patterns

Does this surface look unmistakably JoyJoin, or could it be any generic mini-program?

**Score 4 (Excellent):** Distinctive JoyJoin voice — warm, playful, premium. No AI tells. Typography, color, spacing, and motion all feel native to the brand.
**Score 3 (Good):** Mostly on-brand; 1 minor AI tell or generic pattern.
**Score 2 (Some issues):** 1–2 noticeable generic patterns or AI tells.
**Score 1 (Poor):** 3–4 AI tells; looks like a template.
**Score 0 (Critical):** 5+ AI tells; indistinguishable from auto-generated slop.

**Check against the JoyJoin Anti-Slop Checklist:**

| Category | Check | Fix |
|----------|-------|-----|
| **Color** | Purple/blue "AI gradient" aesthetic | Use JoyJoin brand palette (warm orange-peach gradient, neutral bases, single accent) |
| **Color** | Pure `#000` or `#fff` backgrounds | Use off-black `#0a0a0a` or warm cream `#faf8f5`; tint neutrals toward brand hue |
| **Color** | More than one accent color fighting for attention | Pick one accent per screen; remove the rest |
| **Color** | Gray text on colored backgrounds | Ensure contrast ≥ 4.5:1; use tinted neutrals |
| **Typography** | System default fonts or generic sans everywhere | Use `--font-cn-display` for Chinese moments, `--font-ui` for functional UI |
| **Typography** | Only Regular (400) and Bold (700) | Introduce Medium (500) and SemiBold (600) for subtle hierarchy |
| **Typography** | Body text too wide | Limit paragraphs to ~65 characters; increase line-height |
| **Layout** | Identical card grids (icon + heading + text, repeated) | Break with asymmetric grids, zig-zag layouts, or varied card sizes |
| **Layout** | Everything centered and symmetrical | Try left-aligned with asymmetric whitespace, or intentional grid breaks |
| **Layout** | Uniform border-radius on everything | Vary radius: tighter on inner elements, softer on containers |
| **Layout** | No overlap or depth | Use negative margins, layering, or z-index to create spatial depth |
| **Layout** | Missing whitespace / cramped | Double the padding; let the design breathe |
| **Content** | Generic names ("张三", "李四", "User123") | Use diverse, realistic-sounding names |
| **Content** | Fake round numbers (99.99%, 50%, ¥100.00) | Use organic data: 47.2%, ¥99.00, +86 138 1234 5678 |
| **Content** | AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen") | Write plain, specific language in JoyJoin's warm voice |
| **Content** | Lorem Ipsum or placeholder Latin | Write real draft copy, even if it gets edited later |
| **Imagery** | Generic SVG egg icons or default avatars | Use branded illustrations, mascot (Xiaoyue), or contextual imagery |
| **Imagery** | Stock photos that don't match the brand mood | Use Lovart-generated brand illustrations or curated photography |
| **States** | Missing hover / active / pressed / disabled / loading / empty / error | Design the full state matrix (see Dimension 2) |
| **Motion** | Bounce or elastic easing | Use exponential ease-out curves; no bounce |
| **Motion** | Motion for decoration, not state communication | Every animation should explain a state change |

**The AI Slop Test:** If someone could look at this interface and say "AI made that" without hesitation, it has failed. The fix is distinctiveness — a visitor should ask "how was this made?", not "which AI made this?"

---

### 2. State Completeness

Does every interactive element and screen have all necessary states designed?

**Score 4:** All 8 states explicit, visually distinct, and accessible.
**Score 3:** 6–7 states present; minor gaps.
**Score 2:** 4–5 states present; noticeable gaps (e.g., no loading state).
**Score 1:** 2–3 states; ship-blocking gaps.
**Score 0:** Only default state; everything else is missing.

**The Eight States (every interactive element):**

| State | Mini-program equivalent | Visual treatment |
|-------|------------------------|------------------|
| **Default** | At rest | Base styling |
| **Hover** | Not applicable on touch | Use `:hover-class` or `hover-class` for desktop web only |
| **Focus** | Keyboard/programmatic focus | Visible ring or highlight |
| **Active / Pressed** | `onTouchStart` / `active` | `scale(0.98)` or `translateY(1px)`; darker shade |
| **Disabled** | `disabled` prop | Reduced opacity (~0.4), no pointer events |
| **Loading** | Async operation in progress | Skeleton loader matching layout shape; NOT a generic spinner |
| **Error** | Validation or API failure | Red border/tint, inline message, retry affordance |
| **Success** | Operation completed | Green check, confirmation, brief celebration |

**Screen-level states:**
- **Default:** Content loaded, user can interact
- **Loading:** Skeleton or branded loading animation (Xiaoyue mascot welcome spin)
- **Empty:** Beautifully composed "getting started" or "no results yet" view
- **Error:** Clear message, retry button, possibly Xiaoyue illustration
- **Success / Completion:** Personality test done, payment confirmed, join successful — a restrained celebration moment

**Taro-specific state notes:**
- Use `hover-class` on `View`, `Button`, `Navigator` for press feedback
- Use `loading` prop on `Button` for async actions
- Skeleton loaders should match the exact layout structure (same heights, spacing, card shapes)
- Empty states should teach, not just inform — suggest the next action

---

### 3. Theming & Token Discipline

Are design tokens used consistently, or are there hard-coded values and token drift?

**Score 4:** Full token system, zero hard-coded colors/spacing, dark mode works.
**Score 3:** Tokens used consistently; 1–2 minor hard-coded values.
**Score 2:** Mixed tokens and hard-coded values; some inconsistency.
**Score 1:** Mostly hard-coded; token system ignored.
**Score 0:** No tokens; everything inline or ad-hoc.

**Checks:**
- [ ] No hex values in component files — all colors via CSS custom properties (`--background`, `--foreground`, `--primary`, `--muted`, etc.)
- [ ] No `style={{ margin: 12 }}` or inline spacing — use `rpx` classes or token-based spacing
- [ ] Spacing follows 8rpx rhythm (multiples of 8: 8, 16, 24, 32, 48, 64); 4rpx only for hairlines
- [ ] Typography uses semantic tokens: `--font-ui`, `--font-cn-display`, `--font-en-brand`
- [ ] Button variants use `buttonVariants.ts` or `cva` — not ad-hoc styling
- [ ] Dark mode variants present if the surface supports dark mode
- [ ] Same token used for the same concept across the screen (e.g., don't use `--muted` in one place and `#f5f5f5` in another)

**Mini-program specific:**
- [ ] WXSS-safe class composition (no browser-only selectors)
- [ ] `rpx` units for responsive sizing, not `px` or `rem`
- [ ] `process.env.TARO_ENV` used correctly for platform splits

---

### 4. Responsive & Platform Safety

Does the layout work across device sizes and respect platform constraints?

**Score 4:** Fluid, safe on all viewports, proper touch targets, no overflow.
**Score 3:** Works on common devices; 1 minor issue on edge cases.
**Score 2:** Works on iPhone but breaks on Android or small screens.
**Score 1:** Major responsive failures; horizontal scroll, clipped content.
**Score 0:** Desktop-only or completely broken on mobile.

**Checks:**
- [ ] Touch targets ≥ 44×44 rpx (WeChat recommendation)
- [ ] No horizontal scroll on any viewport
- [ ] Text scales gracefully (no layout breakage when font size increased)
- [ ] Safe-area respected (`env(safe-area-inset-*)` or Taro safe-area utilities)
- [ ] Zero-scroll viewport policy followed: 100dvh shell, no document/page scroll, `ScrollView` for containers
- [ ] Images have proper aspect ratio constraints; no distortion
- [ ] Modal / popup content fits within viewport; can be dismissed
- [ ] Works on both iOS and Android WeChat runtimes

---

### 5. Performance & Motion Hygiene

Are animations smooth, purposeful, and safe for low-end devices?

**Score 4:** GPU-safe animations, purposeful motion, reduced-motion respected, 60fps.
**Score 3:** Mostly smooth; 1 minor performance concern.
**Score 2:** Some jank or unnecessary repaints; motion occasionally decorative.
**Score 1:** Frequent frame drops; animating layout properties.
**Score 0:** Severe performance issues; ship-blocking.

**Checks:**
- [ ] Animate only `transform` and `opacity` — never `width`, `height`, `top`, `left`, `margin`
- [ ] No `backdrop-filter` or heavy blur in WeChat mini-program (not supported / performance killer)
- [ ] Reduced motion respected: `prefers-reduced-motion` media query or equivalent
- [ ] Stagger animations capped in total duration (10 items × 50ms = 500ms max; reduce per-item delay for longer lists)
- [ ] No continuous `setData` loops or unthrottled scroll listeners
- [ ] Image assets optimized: compressed, appropriately sized, lazy-loaded where possible
- [ ] Subpackage size within budget; heavy assets flagged
- [ ] Canvas operations (e.g., personality card export) capped in resolution (max 3× DPR) to avoid memory kills

**Easing reference for Taro/WXSS:**
```css
/* Smooth, refined (default) */
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);

/* Snappy, confident */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

/* State toggle */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
```

**Avoid:** bounce, elastic, `linear` for UI transitions, `ease` as a default.

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Brand Fidelity & Anti-Patterns | ? | |
| 2 | State Completeness | ? | |
| 3 | Theming & Token Discipline | ? | |
| 4 | Responsive & Platform Safety | ? | |
| 5 | Performance & Motion Hygiene | ? | |
| **Total** | | **??/20** | |

**Rating bands:**
- **18–20 Excellent:** Minor polish only; safe to ship.
- **14–17 Good:** Address weak dimensions before merge.
- **10–13 Acceptable:** Significant work needed; do not ship without fixes.
- **6–9 Poor:** Major overhaul required.
- **0–5 Critical:** Fundamental issues; rebuild recommended.

---

## Fix Priority Matrix

After scoring, generate fixes in this priority order:

**P0 — Ship-blocking (fix before merge)**
- Missing error or loading states on critical flows (payment, join, auth)
- Accessibility violations (missing labels, insufficient contrast, no focus indicators)
- Performance hazards (layout thrashing, unbounded blur, canvas memory bombs)
- Broken responsive behavior (horizontal scroll, clipped CTAs on small screens)
- Hard-coded secrets or PII in UI (not design but caught during audit)

**P1 — Should fix (address in this PR or immediate follow-up)**
- 2+ AI tells or generic patterns
- Missing empty or success states
- Token drift (3+ hard-coded values that should use tokens)
- Touch targets below 44×44 rpx
- Inconsistent component vocabulary across screens

**P2 — Polish (nice to have, backlog if time-constrained)**
- Micro-interactions could be more refined
- Copy could be warmer or more specific
- Spacing could be more rhythmically varied
- One minor anti-pattern (e.g., a single generic avatar)

---

## Mini-Program Specific Audit Addendum

When auditing `apps/mini-program`, add these checks:

### WeChat-native constraints
- [ ] No `dangerouslySetInnerHTML` — use `RichText` or structured nodes
- [ ] No browser-only APIs (`localStorage`, `window.scrollTo`) — use Taro equivalents
- [ ] No `vh` units — use `rpx` or `calc(100vh - constant(safe-area-inset-bottom))` via Taro utils
- [ ] `navigationBar` and `tabBar` configured in `app.config.ts`; colors match brand tokens
- [ ] Page `config` objects define `navigationBarTitleText`, `backgroundColor`, `enablePullDownRefresh` intentionally

### Taro performance
- [ ] Large lists use `VirtualList` or pagination, not unbounded rendering
- [ ] `CustomWrapper` used around update-hot components
- [ ] `lazyCodeLoading` enabled in app config
- [ ] Subpackage strategy documented; no main package bloat

### WeChat DevTools evidence
- [ ] Author has run Wxml + computed styles inspection on touched screens
- [ ] Screenshots captured if deviation from spec suspected
- [ ] No console errors or warnings on affected pages

---

## Web-specific Audit Addendum

When auditing `apps/user-client` (reference/sandbox) or `apps/admin-client`:

- [ ] Tailwind classes use token-based utilities, not arbitrary values (`text-[14px]`)
- [ ] shadcn/ui components customized (radii, colors, shadows) — never generic default
- [ ] Recharts charts use brand colors, not default palette
- [ ] Admin tables have loading skeletons, empty states, and error boundaries
- [ ] Focus rings visible and consistent (`:focus-visible`, not `:focus`)
- [ ] Dark mode tokens tested if the surface supports it

---

## Integration with existing skills

This skill is designed to work alongside, not replace, existing JoyJoin skills:

| Existing Skill | How this skill complements it |
|----------------|------------------------------|
| `mini-program-frontend-excellence` | MPFE is implementation-time guidance; this skill is retroactive audit. Run MPFE while building, run this before shipping. |
| `wow-elements` | Wow-elements says *when* to add polish; this skill checks *whether* the polish is present and high-quality. |
| `design-system-governance` | DSG owns token definitions; this skill audits token *usage* in practice. |
| `frontend-component-architecture` | FCA says where components go; this skill audits how they look and feel. |
| `joyjoin-brand-guidelines` | Brand guidelines set the rules; this skill checks compliance. |
| `viewport-zero-scroll` | VZS sets layout policy; this skill verifies it's followed. |
| `harness-completion-gate` | Harness checks 5 engineering pillars; this skill adds the 6th pillar: **design quality**. |

---

## Audit Report Template

When reporting audit results, use this template:

```
## Design Audit: [Page/Component Name]

**Target:** `apps/mini-program/src/pages/[path]`
**Auditor:** [Agent or human name]
**Date:** [ISO date]

### Health Score: [X]/20 ([Rating Band])

| Dimension | Score | Notes |
|-----------|-------|-------|
| 1. Brand Fidelity | X/4 | [Key finding] |
| 2. State Completeness | X/4 | [Key finding] |
| 3. Theming & Tokens | X/4 | [Key finding] |
| 4. Responsive & Safety | X/4 | [Key finding] |
| 5. Performance & Motion | X/4 | [Key finding] |

### Anti-Patterns Found
- [ ] [Specific violation] → [Suggested fix]
- [ ] ...

### Fix List
**P0:**
- [ ] [Fix]

**P1:**
- [ ] [Fix]

**P2:**
- [ ] [Fix]

### Verdict
[Ship / Fix then ship / Major rework needed]
```

---

## Relationship to external frameworks

This skill is **inspired by** but **not a copy of**:

- **impeccable** (Paul Bakaus): Borrowed the 5-dimension audit structure, scoring rubric, anti-pattern taxonomy, and the concept of brand vs product registers. Adapted for JoyJoin's mini-program-first reality.
- **taste-skill** (Leonxlnx): Borrowed the "AI Tells" ban list, redesign diagnostic checklist, and the philosophy of fighting generic AI output. Adapted for Taro constraints and JoyJoin brand voice.

Neither framework is installed directly because both are web-first (Tailwind, Framer Motion, GSAP). JoyJoin's design audit must be native to Taro, WeChat Mini Program, and our existing token system.
