---
name: mini-program-frontend-excellence
description: >
  Deliver premium, JoyJoin-native UI in apps/mini-program using Taro-native primitives,
  brand-aligned hierarchy, complete state design, and mini-program-safe performance discipline.
  Use when implementing or refining Taro pages/components, raising a screen above generic
  "cheap mini-program" quality, or reviewing whether a mini-program UI feels native-quality
  and unmistakably JoyJoin. Trigger phrases: "mini-program UI", "Taro page",
  "make this feel premium", "native-quality mini-program", "cheap mini-program feel",
  "improve mini-program empty state".
---

# Mini-Program Frontend Excellence

**Core rule:** JoyJoin mini-program UI must feel unmistakably JoyJoin and operationally native. Do not ship browser ideas squeezed into Taro, and do not ship low-effort mini-program UI that merely "works".

## Taro framework (read first for structural UI work)

For layout constraints, `setData` / list performance, cross-end files, `RichText` vs HTML, WeChat tooling, and **asset size budgets**, follow **[`references/taro-ui-framework.md`](references/taro-ui-framework.md)** in addition to this skill.

- Prefer **Flex** layout and repo Sass/class patterns; avoid browser-only selectors and unsafe HTML (`dangerouslySetInnerHTML`); use **`RichText`** or structured nodes for rich content.
- Treat **VirtualList**, **CustomWrapper**, and subpackage strategy as product decisions when lists or update hot spots are large—see the reference and [`frontend-performance-and-loading`](../frontend-performance-and-loading/SKILL.md).
- Use **`process.env.TARO_ENV`** and **multi-suffix files** (`*.weapp.*`, etc.) for real platform splits.
- **Flag** new or changed assets that exceed the reference thresholds; propose compression, SVG optimization, vector substitution, or route/subpackage moves before merging heavy binaries.

## When to use this skill

- Implementing or refining UI in `apps/mini-program`
- Translating web product intent into Taro-native UI
- Raising the quality bar on a mini-program screen that feels generic, cheap, or off-brand
- Reviewing whether a mini-program interaction feels premium, tactile, and complete
- Deciding how to preserve JoyJoin brand feel without browser-only effects

## Delivery workflow

1. **Classify the scope first**
   Use `platform-coordination-protocol` to decide whether the change is `MINI_PROGRAM_ONLY` or `BOTH_REQUIRED`.

2. **Choose a design direction before coding**
   Name the one visual or emotional idea that should define the screen. Run the anti-generic check from `joyjoin-brand-guidelines` and `wow-elements`. If the design spec conflicts with JoyJoin brand rules, stop and flag the exact conflict.

3. **Translate the intent into Taro-native structure**
   Prefer `View`, `Text`, `Image`, `Button`, `Input`, `ScrollView`, `Swiper`, page config, `Taro.navigateTo`, and lifecycle hooks. Use repo-native styling patterns and WXSS-safe class composition.

4. **Design the full state matrix**
   Default, loading, empty, error, disabled, busy, success, and pressed states should all be explicit. A polished surface with missing states is not finished.

5. **Add premium polish where it survives the platform**
   Use `hoverClass`, pressed states, transform/opacity motion, crisp asset treatment, and readable hierarchy. Reinterpret browser-only effects instead of force-porting them.

6. **Run the quality bar**
   Check brand, quality, and structure explicitly before calling the work complete.

## Premium quality bar

- One clear focal point, not a flat wall of equally weighted cards
- Spacing feels deliberate and breathable
- Assets are crisp: prefer vector or `2x`/`3x` raster sources where the runtime path supports them
- Touch feedback is immediate and visible
- Copy feels warm and product-specific
- No default template look: no generic purple-on-white dashboard feel, no symmetrical filler layouts, no placeholder-looking gradients

## Taro execution rules

- Prefer native Taro primitives and runtime APIs over browser compatibility shims.
- Prefer existing repo styling patterns over introducing CSS-in-JS, new utility systems, or renderer abstractions by default.
- Use `hoverClass` or explicit active-state styling instead of `:hover`-driven UX.
- Keep animations to `transform` and `opacity`; avoid layout work on tap or scroll-heavy surfaces.
- Treat `backdrop-filter`, browser-only DOM measurement, custom cursors, and hover-only reveals as platform constraints to reinterpret.
- Watch launch bundle, subpackage boundaries, image weight, and long-list rendering.
- If a screen needs premium feel, spend the budget on hierarchy, spacing, copy, and tactile feedback before decorative effects.

## Common mistakes to avoid

- Porting the web DOM structure line-by-line into Taro
- Shipping a screen that technically renders but feels like a generic low-effort mini-program
- Assuming web font treatment, hover behavior, or browser-only visual effects will transfer cleanly
- Adding large hero art without checking asset weight or clarity
- Using motion as decoration instead of as feedback or emotional emphasis
- Leaving empty, error, or pressed states undefined
- Introducing a new styling paradigm instead of using the repo's current mini-program patterns

## Quick examples

**User says:** "Polish this mini-program onboarding step - it feels cheap."
**Apply this skill by:** Choosing one emotional focal moment, tightening hierarchy and spacing, using brand-backed colour and copy, adding pressed and loading states, and keeping the interaction Taro-native.
**Result:** The step feels premium without pretending to be a browser screen.

---

**User says:** "Make this Taro page feel more like a top consumer app."
**Apply this skill by:** Upgrading the focal hierarchy, asset sharpness, state completeness, and tactile feedback first; only then add restrained motion that survives WeChat constraints.
**Result:** The page feels native-quality instead of generically decorated.

## Frontend Excellence Notes

### Platform Applicability

- Primary surface: `apps/mini-program`
- Secondary surface: web only when the mini-program work mirrors a browser source of truth or touches coordinated flows

### UI/UX & Aesthetic Guidance

- Brand compliance is mandatory, not a polishing pass.
- Premium quality means the screen should feel engineered: hierarchy, spacing, touch response, and state completeness all support the same visual idea.
- Avoid generic AI aesthetics by giving the screen one clear point of view instead of reusing interchangeable social-app patterns.

### Taro-Specific Considerations

- Prefer `View`, `Text`, `Image`, `Button`, `Input`, `ScrollView`, and page config over browser-first abstractions.
- Use Taro hooks and lifecycle primitives where they improve clarity, but do not add complexity just to "use more Taro."
- Keep the result WXSS-safe, package-aware, and compatible with actual WeChat runtime limitations.
- For long lists or media-heavy routes, co-load `frontend-performance-and-loading`.

### Accessibility & Performance Notes

- Maintain readable contrast, clear status copy, visible active states, and touch targets at or above `44 pt`.
- If polish hurts tap latency, scroll smoothness, or bundle size materially, the polish is not production-ready.
- Prefer crisp restrained motion over busy animation.

## Troubleshooting

- **The screen feels like a cheap template** - reduce repetitive card patterns, create one focal hierarchy, and remove decorative gradients that do not support the flow.
- **The design looks on-brand on web but flat in mini-program** - rework spacing, copy rhythm, and pressed-state feedback using native Taro primitives instead of trying to mimic browser-only effects.
- **A polished interaction janks on device** - cut layout-triggering animation, compress assets, and simplify the effect to `transform` and `opacity` only.
- **The spec asks for something off-brand** - name the exact conflict (colour, font, motion, mascot use, density) and flag it before implementation.
- **The team wants to add CSS-in-JS for dynamic styling** - default to the repo's existing Taro styling patterns unless there is an explicit approved shift in architecture.

## Review checklist

- [ ] Scope was classified as `MINI_PROGRAM_ONLY` or `BOTH_REQUIRED`
- [ ] The screen has a clear JoyJoin visual direction and avoids generic AI aesthetics
- [ ] Brand colours, typography, spacing, and mascot usage follow `joyjoin-brand-guidelines`
- [ ] Taro-native primitives and WXSS-safe patterns are used instead of browser-first assumptions
- [ ] Rich content uses `RichText` or structured Taro nodes—not `dangerouslySetInnerHTML` for cross-end HTML
- [ ] Layout follows Flex-first discipline; cross-end or RN portability considered where selectors matter
- [ ] Hot re-renders or large lists addressed with `CustomWrapper` / `VirtualList` or other profiled approach when thresholds suggest it (`references/taro-ui-framework.md`)
- [ ] Loading, empty, error, disabled, busy, success, and pressed states are explicit
- [ ] Touch targets are at least `44 pt` and active-state feedback is visible
- [ ] Assets are crisp and package/performance costs are reasonable
- [ ] New or changed rasters/icons were checked against size budgets; oversized files flagged and addressed (compression, SVG optimization, vector/CSS substitute, or subpackage—see `references/taro-ui-framework.md` §8)
- [ ] Motion is restrained, `transform`/`opacity`-based, and safe for mini-program performance
- [ ] A screen that still feels cheap but functional has not been signed off as complete

## Related files

- [`references/taro-ui-framework.md`](references/taro-ui-framework.md)
- `apps/mini-program/src/pages/`
- `apps/mini-program/src/components/`
- `apps/mini-program/README.md`
- `.github/agents/taro-mini-program-frontend-engineer.agent.md`
- `.github/skills/joyjoin-brand-guidelines/SKILL.md`
- `.github/skills/design-system-governance/SKILL.md`
- `.github/skills/wow-elements/SKILL.md`
- `.github/skills/frontend-performance-and-loading/SKILL.md`
- `.github/skills/platform-coordination-protocol/SKILL.md`
