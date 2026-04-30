# Mini-Program Implementation Guide

## Delivery workflow

1. **Classify the scope first**
   Use `platform-coordination-protocol` to decide whether the change is `MINI_PROGRAM_ONLY` or `BOTH_REQUIRED`.

2. **WeChat DevTools MCP:** Before calling UI work complete, use the **WeChat DevTools MCP server** (`wechat-devtools`) to launch the mini-program, navigate to the affected page, and verify visual state. This is mandatory for pixel-precision checks and pre-merge UI validation. Capture screenshots when deviation from spec is suspected.

3. **Choose a design direction before coding**
   Name the one visual or emotional idea that should define the screen. Run the anti-generic check from `joyjoin-brand-guidelines` and `wow-elements`. If the design spec conflicts with JoyJoin brand rules, stop and flag the exact conflict.

4. **Translate the intent into Taro-native structure**
   Prefer `View`, `Text`, `Image`, `Button`, `Input`, `ScrollView`, `Swiper`, page config, `Taro.navigateTo`, and lifecycle hooks. Use repo-native styling patterns and WXSS-safe class composition.

5. **Design the full state matrix**
   Default, loading, empty, error, disabled, busy, success, and pressed states should all be explicit. A polished surface with missing states is not finished.

6. **Add premium polish where it survives the platform**
   Use `hoverClass`, pressed states, transform/opacity motion, crisp asset treatment, and readable hierarchy. Reinterpret browser-only effects instead of force-porting them.

7. **Run the quality bar**
   Check brand, quality, structure, and **pixel-precision rules** (`references/pixel-precision.md`) explicitly before calling the work complete.

8. **Verify in WeChat DevTools**
   For any non-trivial UI change, confirm key spacing and type in DevTools before PR / merge request.

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

## WeChat DevTools inspection checklist

Before marking a PR ready (or approving), authors and reviewers must:

1. Open the changed page in **WeChat DevTools** (simulator at project target baseline).
2. Use the **Wxml** tree inspector and **computed styles** (or Styles panel) to verify key boxes: container padding, section gaps, CTA height, title and body font sizes vs spec or vs the rhythm rules above.
3. For dense or new layouts, spot-check **one real device** preview (phone) when possible.
4. When the diff is visual and reviewers cannot reproduce locally, the author attaches **screenshots** or a short **DevTools note** (which selectors were checked and values seen).

**Reviewers:** If `apps/mini-program` UI changed and there is no evidence of DevTools or device spot-check, **request changes** or block merge until satisfied.

## Related references

- [`references/pixel-precision.md`](./pixel-precision.md) — spacing rhythm, spec matching, tolerance rules
- [`references/taro-ui-framework.md`](./taro-ui-framework.md) — layout constraints, performance, asset budgets
