# Rendered-Truth Visual Gate

> The canonical definition of how JoyJoin audits **rendered** UI — not source code.
> Loaded by `ui-layout-audit`, `frontend-design-audit`, `completeness-audit`, and the
> `post-implementation-review` swarm whenever a change touches a user-facing surface.

## Why this gate exists

Overlap, text overflow, clipping, and cramped spacing are **rendered-output** properties.
They cannot be caught reliably by reading JSX/SCSS, because the actual result depends on
computed layout: line-height, font metrics, image aspect ratios, flex wrapping, and real
content length. A code-reading audit is structurally blind to them.

This gate grounds every visual review in **what is actually rendered**, via two
complementary layers:

| Layer | Mechanism | Catches | Cost |
|-------|-----------|---------|------|
| **1 — Deterministic scanner** | `npm run audit:visual` (Playwright measures the DOM) | Correctness defects, no LLM | Free, CI-able |
| **2 — Vision reviewer** | A vision-capable reviewer inspects the screenshot | Craft + anything the scanner can't see | LLM tokens |

**Run Layer 1 always. Run Layer 2 for any user-facing surface before calling it "done".**

---

## The two-class severity model

The old system made *all* visual findings non-blocking "to prevent over-polishing" — which
also made genuine broken-UI bugs invisible to the fix loop. This gate splits visual
findings into two classes so correctness blocks and craft stays advisory.

### Class A — Visual CORRECTNESS → **BLOCKING**

Broken UI. The user sees a defect. These **must** fail the review and trigger a fix loop.

| Defect | Detected by | Definition |
|--------|-------------|------------|
| Text overflow / truncation (no ellipsis) | Scanner `text-clip-horizontal` (blocking) | Text is cut off and unreadable |
| Vertical clipping (unreachable content) | Scanner `text-clip-vertical` (blocking) | Content hidden by `overflow:hidden`, not a deliberate line-clamp |
| Element overlap | Scanner `text-on-text-overlap`, vision reviewer | Text collides with text; interactive elements obscured |
| Page horizontal overflow | Scanner `page-horizontal-overflow` | Page wider than viewport → horizontal scroll |
| Content past the viewport edge | Scanner `element-off-right-edge` | Element bleeds off the right edge |
| Unreadable contrast | Scanner `low-contrast-text` (blocking band), vision | Body text < 3:1, large text < 2.4:1 |
| Off-screen / unreachable interactive element | Vision reviewer | CTA or control the user cannot reach or tap |
| Broken layout / collapsed section | Vision reviewer | A region renders empty, stacked wrong, or overlapping its container |

### Class B — Visual CRAFT → **ADVISORY (measured, not vibed)**

Polish. Worth fixing, but does not block merge. Every craft finding must still cite a
**measurement** (rpx, ratio, count) — never a bare "feels off".

| Defect | Detected by | Measurement to cite |
|--------|-------------|---------------------|
| Missing breathing room | Vision reviewer + scanner rects | Actual gap in rpx vs the `ui-layout-audit` spacing table |
| Cramped / dense reading | Vision reviewer | Line-height, chars-per-line, paragraph spacing |
| Weak hierarchy | Vision reviewer | Size/weight delta between heading/body/meta (rpx, font-weight) |
| Truncation *with* ellipsis | Scanner `text-clip-horizontal` (advisory) | Confirm the ellipsis truncation is intentional |
| Line-clamp truncation | Scanner `text-clip-vertical` (advisory) | Confirm the clamp count is intentional |
| Borderline contrast | Scanner `low-contrast-text` (advisory band) | Ratio between 3.0–4.5:1 (body) |
| Misalignment | Vision reviewer + scanner rects | Left-edge delta in rpx off the 4rpx grid |
| AI-slop tells / premium feel | Vision reviewer | Specific pattern from the Anti-Slop Checklist |

> **Rule of thumb:** if a first-time user would say *"that's broken"*, it's Class A.
> If they'd say *"that could be nicer"*, it's Class B.

---

## Layer 1 — Deterministic scanner

```bash
npm run audit:visual -- \
  --url "http://localhost:5001/#/pages/<route>/index" \
  --wait "<a stable selector on the page>" \
  --viewport 390x844 \
  --screenshot /tmp/<page>.png \
  --pretty
```

- Exit code **1** = ≥1 blocking defect; **0** = clean or advisory-only; **2** = runtime error.
- Output is a JSON report: `{ verdict, summary: { blocking, advisory, byCheck }, violations: [...] }`.
- Every violation carries `check`, `severity`, `selector`, `message`, `rect`, `details`.
- The `--screenshot` PNG is the artifact the vision reviewer (Layer 2) inspects.

**Serving the page (mini-program H5):** build the H5 bundle and start the mock + static
servers exactly as in `mini-program-screenshot-workflow` (Approach A). Point `--url` at the
running H5 hash route with `TARO_APP_API_BASE_URL=http://localhost:5001`. For a quick local
check you can also point `--url` at any reachable page.

**Scanner checks** (`byCheck` keys): `page-horizontal-overflow`, `element-off-right-edge`,
`text-clip-horizontal`, `text-clip-vertical`, `low-contrast-text`, `text-on-text-overlap`.

The scanner is deliberately **high-precision**: it only flags overlap when two *text*
elements substantially collide, and only flags clipping when content is genuinely cut. It
skips intentional patterns (ellipsis, line-clamp → advisory) and unmeasurable backgrounds
(gradients/images → contrast skipped, not flagged).

---

## Layer 2 — Vision reviewer

The scanner cannot judge breathing room, hierarchy, alignment nuance, or "does this read
like a treat." A vision-capable reviewer inspects the `--screenshot` PNG.

**OpenCode:** spawn the `multimodal-looker` subagent with the screenshot path.
**Other hosts:** give any multimodal model the screenshot plus the rubric below.

### Vision reviewer rubric (paste with the screenshot)

> You are reviewing a rendered mobile UI screenshot (390×844, 2× DPR). Find and cite, by
> pixel region, any of the following. Be specific — name the element and its location.
> 1. **Overlapping elements** — text on text, or a control obscured by another element.
> 2. **Text overflow / truncation** — text cut off, clipped, or running past its container.
> 3. **Unreachable controls** — a CTA or interactive element the user cannot see or tap.
> 4. **Breathing room** — sections that feel cramped; cite the actual gap between blocks.
> 5. **Alignment** — left edges that don't share a common grid; elements floating off-grid.
> 6. **Reading comfort** — walls of text, tight line-height, orphans (孤字) on their own row.
> For each finding state: region (top/middle/bottom + approx x/y), the defect, whether it is
> CORRECTNESS (broken) or CRAFT (could be nicer), and a one-line fix.

### Merging the two layers

- A defect found by **either** layer and classified **correctness** → **BLOCKING**.
- Scanner findings are authoritative for overflow / clipping / contrast / page-overflow.
- Vision findings are authoritative for craft, overlap the scanner's heuristic missed, and
  "does this read well."
- De-duplicate: if both layers flag the same element, keep one finding, cite both sources.

---

## Audit workflow (Step 0, prepended to the audit skills)

1. **Render.** Serve the page and run `npm run audit:visual` with `--screenshot`.
2. **Scan.** Read the JSON. Every `blocking` violation is a Class A defect — record it.
3. **Inspect.** Run the vision reviewer on the PNG with the rubric above.
4. **Merge + classify.** Combine into one list; tag each `correctness` or `craft`.
5. **Proceed** with the rest of the audit (spacing map, typography, states, tokens…), now
   grounded in rendered truth. Label every finding **Seen-in-render** vs **Read-in-code**.

**Verdict rule:** any Class A (correctness) defect → the surface is **not** shippable until
fixed. Class B (craft) findings are reported and ranked, but do not block.

---

## Relationship to existing skills

| Skill | How the gate plugs in |
|-------|------------------------|
| `ui-layout-audit` | Adds Step 0 (Render & Inspect). Spacing/alignment findings must be measured from render, not estimated from code. |
| `frontend-design-audit` | Adds Step 0 (Render & Inspect). Dimension 4 (Responsive & Safety) consumes scanner output directly. |
| `completeness-audit` | Dimension 9 (Visual finish) uses the gate's classified findings as evidence. |
| `post-implementation-review` | The UI review slot runs this gate; correctness → blocking, craft → concern. |
| `mini-program-screenshot-workflow` | Owns *how* to serve/capture the page; this gate owns *what to do with the render*. |
