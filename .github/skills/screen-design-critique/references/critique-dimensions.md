# Critique Dimensions — the seven-lens rubric

Adapted from the seven-dimension visual-critique doctrine (owl-listener/designer-skills, MIT) to JoyJoin's surfaces. Each dimension: what to examine, pass criteria, common failure patterns, and the JoyJoin-specific checks that make the critique ours rather than generic.

Format per finding: **Observation** (neutral, from the render) → **Problem** (why it breaks the user job) → **Fix** (one specific change). Rate the dimension `pass` / `minor issue` / `major issue`.

---

## 1. Visual hierarchy

Whether attention lands where the user's goal needs it, then flows deliberately to the action.

- **Entry point** — is there a single dominant element, and is it the most important thing on screen for this user job? Do size, contrast, and position establish it, or does attention scatter?
- **Eye flow** — does the layout follow an intentional reading order (F/Z or a deliberate vertical scan) with no dead ends? Does flow terminate at the primary CTA?
- **Weight distribution** — are hierarchy levels differentiated by ≥1.5× in size/weight/contrast? Is bold type sparse enough to keep signal value?
- **Emphasis** — exactly one primary emphasis zone per view? Is the highest-emphasis element the user's priority or a decoration's?

**Failure patterns:** competing primaries (nothing reads as most important); hierarchy flattening (everything same size/weight/colour); false emphasis (decorative art outweighs functional content); buried CTA (the action is visually quieter than surrounding content).

**JoyJoin checks:** the solid brand-purple CTA (`$color-primary` #8B5CF6, no gradient) should be the loudest interactive element; bottom action-bar CTAs must dominate their bar; illustration never outshines the primary action; the icebreaker material system caps scrim/accent alphas so overlays don't hijack hierarchy.

## 2. Brand consistency

Whether the screen could only be JoyJoin — not a generic template.

- **Voice and copy posture** — does visible copy obey the brand copy strategy (🔴 hard rules in `docs/copy/brand-copy-strategy.md`)? Warm, light, playful-but-sincere — never corporate, never cringe, zero emoji on primary copy.
- **Visual language** — rounded, soft, breathable, lively; Lovart illustration style for artwork; mascot expressions where a face carries emotion.
- **Token fidelity** — colours, radii, and type from the governed set (`design-system-governance`), not ad-hoc values.
- **Anti-AI-slop** — no gradient CTAs, no generic purple-on-purple template feel, no stock-photo aesthetic, no overdesigned decoration. The 2026-05-23 gradient purge stays purged.

**Failure patterns:** "designed by committee" neutrality; copying a competitor's pattern wholesale; emoji or meme register leaking into primary surfaces; brand colour used decoratively until it stops meaning "action".

**JoyJoin checks:** WeChat-review copy posture — 排桌中/合拍度/活动画像 vocabulary, never 匹配/社交/灵魂/AI in visible copy; AIGC 角标 fail-closed (rendered only when content was actually AI-generated); event-booking register, not dating-app register.

## 3. Composition

Whether the layout breathes, groups, and balances — judged with the render, not the SCSS.

- **Balance** — visual weight distributed without a lopsided top/bottom or left/right; no orphaned elements.
- **Whitespace rhythm** — spacing on the 8rpx rhythm, with the multiplier rule: if related elements sit `g` apart, the gap to the next group is ≥ `2g`. Uniform gaps flatten hierarchy.
- **Gestalt grouping** — proximity, similarity, common region, closure. Cards group by surface + shadow, not borders; related controls cluster; unrelated content is separated by ≥2× the intra-group gap.
- **Viewport fit** — content fits the 100dvh shell without document scroll (zero-scroll policy); ScrollView states centre their content (`scroll-view-centered-state`).

**Failure patterns:** card stacks with identical gaps so sections blur together; centred-everything; equal-weight columns fighting for primacy; cramped hero + generous footer (inverted priorities).

**JoyJoin checks:** no `min()` / `max()` / `clamp()` in WXSS (rpx + media queries only); subpackage-owned components keep styles in their page WXSS (subpackage style-splitting gate); `ResponsiveSpacer` never mixed redundantly with flex `gap` on the same section pair.

## 4. Typography

Whether type carries a clear scale and reads like a treat.

- **Scale levels** — exactly three visible levels on a typical screen: display/hero, title/section, body/meta. More levels = flattening; fewer = monotone.
- **Readability** — comfortable line-height (≈1.4–1.6 for body CJK), measure that doesn't strain (avoid full-width long paragraphs), size hierarchy legible on a 6.1" device.
- **Weight discipline** — bold reserved for titles and key numbers; body stays regular; semibold for emphasis only.
- **Consistency** — same semantic level renders the same size/weight across the screen and across sibling screens.

**Failure patterns:** type so uniform the page has no landmarks; body text below comfortable size to "fit content"; centre-aligned paragraphs; bold used as a crutch for hierarchy that spacing should carry.

**JoyJoin checks:** AlimamaFangYuanTiVF for brand/display moments, system stack for body; the icebreaker off-scale ratchet bans new `font-size: 18|26|30rpx` literals in `pages/icebreaker-session/**` — don't propose them; "read like a treat" is the bar (`ui-layout-audit`).

## 5. Colour

Whether colour is semantic, legal, and quiet.

- **Contrast** — body text on its surface ≥ 4.5:1; large display text ≥ 3:1; meta/caption text on tinted chips still ≥ 4.5:1 against the chip fill.
- **Semantic roles** — brand purple means primary action; semantic reds/greens mean their states; greys mean disabled/meta. Decoration must not borrow semantic hues.
- **Palette coherence** — screen uses the governed palette; no one-off hues; tints derived from the base hues.
- **State colour** — disabled, pressed, loading, and selected states remain perceivable (disabled is *visibly* disabled, not vanished).

**Failure patterns:** colour overload (five+ hues competing); decorative use of action purple until CTAs stop standing out; grey-on-grey meta text below contrast; disabled controls invisible against the surface (see the Affordance trap below).

**JoyJoin checks:** icebreaker material system caps scrims at 0.45 (sheet) / 0.55 (ritual) and accent alphas at 0.08 fill / 0.12 shadow / 0.32 border; the 2026-10-16 incident — WeChat/Taro inject disabled colours that outrank single-class overrides, so a "done" CTA rendered white-on-white until colour was re-asserted from an ancestor selector. Critique disabled states on a real render, never from the stylesheet.

## 6. Affordance

Whether users can tell what is tappable, draggable, or purely informational — in every state.

- **Clickability signals** — buttons look like buttons (fill, radius, label); chips/cards that navigate have chevrors, ripple feedback, or other signifiers; plain text links are discoverable but not masquerading as body copy.
- **State visibility** — default / pressed / disabled / loading / selected all visibly distinct; the current selection is identifiable at a glance.
- **CTA clarity** — the primary action names its outcome (订座/确认报名/评价本局), one primary per view; destructive actions are visually distinct and never adjacent-primary.
- **Hit targets** — tappable areas ≥ 88rpx tall (≈44pt) with adequate spacing; no 40rpx icons doing 88rpx jobs.

**Failure patterns:** dead-looking CTAs (flat text, no fill); everything tappable-looking so nothing does; icon-only actions with no label and no a11y text; loading state indistinguishable from disabled.

**JoyJoin checks:** bottom action bar = solid white surface + shadow, single solid-purple primary (`mini-program-frontend-excellence`); `useResetOnShow` for swipe-back flag recovery is behaviour, but its symptom is a stuck dead CTA — if a render shows a stuck state after navigation, flag it; platform disabled-colour trap (§5) belongs here too.

## 7. Information density

Whether one screen does one job at one glance.

- **Single job** — the screen's primary purpose is identifiable in 3 seconds; secondary content is visibly secondary.
- **Cognitive load** — choice counts at each decision point stay small (a handful, not a dozen); options are grouped, not listed raw; defaults do the work where possible.
- **Scanning** — headings, numbers, and CTAs scan before body copy; the F-pattern finds the essentials in order.
- **Progressive disclosure** — rarely-needed detail is one tap away, not on the first surface; empty and collapsed states are informative, not blank.

**Failure patterns:** settings-page syndrome (everything exposed); equal-weight list of 8+ options; modal-on-modal stacking; information duplicated between hero, card, and footer.

**JoyJoin checks:** `FormStepper` max 4 inputs per step; the Quiet Concierge pattern — collapsed approximate activity guide on event-detail, single authoritative `guidanceLine` in session (never fake next/total); zero-count clusters open rescue dialogs instead of dead selections (`frontend-hook-engine` owns the sin diagnosis).

---

## Scoring bands

| Verdict | Meaning |
|---|---|
| All 7 pass | Ship; note strongest/weakest in one line and move on |
| 1–2 minor | Fix-then-ship; minors land in the same PR |
| Any major | No-ship until majors are fixed and re-rendered |
| Any P0 (usability / brand / platform law / Class A render defect) | Block merge regardless of dimension averages |
