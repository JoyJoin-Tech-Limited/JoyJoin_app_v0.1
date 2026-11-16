# Weekly practice retro + docs sync — 2026-11-04 → 2026-11-10

> Scope: 23 commits on `main` (`470708dc1` … `4267a381a`). Purpose: align docs with the code, and turn this week's mistakes into rules that survive the session that made them.
> Read this before starting event-card, matching-timing, or docs work. The durable rules also live in `AGENTS.md` §12.

---

## 1. What shipped this week

| Area | Commits | Canonical doc |
|---|---|---|
| Profile review completion / welcome gift | `470708dc1` | `docs/agent-context/mini-program-profile.md` |
| Editorial empty-state system | `8a02e0e6b` | `docs/design/empty-state-visual-strategy-20261109.md` |
| Center Hub three-bucket IA | `6e1a348f4`, `889890671` | `docs/agent-context/tab-bar.md`, events context |
| Notifications deep links + per-item read | `df929e26b`, `226f846bc` | `.github/skills/notification-system/SKILL.md` |
| Gathering-room compact layout | `c24985962` | `docs/agent-context/gathering-room.md` |
| Icebreaker acknowledgment beat + pre-generation coverage | `599275f36`, `98ba8329f` | `docs/agent-context/social-icebreaker.md` |
| Icebreaker G0 safety + 24h mutual selection | `5abe6256c`, `8831a165e` | `docs/agent-context/social-icebreaker.md` |
| Discover + Footprint card redesign | `6605cbe7a`, `4267a381a` | `docs/mini-program/mini-program-product-reference.md`, `apps/mini-program/AGENTS.md` §14, `docs/agent-context/mini-program-events.md` |
| 排桌 timing guard (threshold curve, early gate, deadline sweep) | `6605cbe7a` | `docs/agent-context/matching-domain.md` |
| 47-route visual consistency audit | `9235ff4e2` | `docs/design/mini-program-visual-consistency-audit-20261110.md` |

Doc coverage was verified commit by commit: every behaviour-changing commit either carried its own `docs/` update or was closed by a later explicit `docs: sync …` commit. The only real gap was the **Footprint card's Phase 1/2/3 geometry**, where `docs/agent-context/mini-program-events.md` still described the pre-rail right-column countdown — fixed in this pass.

---

## 2. What we did well — keep doing it

1. **Verify the mechanism before writing the copy.** Asked to add 「截止后即排桌」 to the Discover card, we read `poolRealtimeMatchingService`, `poolRegistrationRules`, `matchPersistence`, `poolCompletionSweep` first, found that matching is event-driven and can complete *before* the deadline, and refused the wording. The card kept only facts it could prove.
2. **Render before claiming done.** The H5 + mock-API screenshot loop caught two defects no unit test could: an empty white countdown pill on ended cards (`dateTime` present, clock `enabled` false) and a price-only facts row on cancelled cards (band rendered without its left cluster). Both were fixed by gating on the condition the *content* needs, not the condition that happened to be nearby.
3. **Design review as a loop with a verdict.** `uiux-design-reviewer` ran three rounds on the Footprint card: 8 P1s → 4 terminal-state P1s → SHIP. Every P1 got a fix + evidence, and the reviewer explicitly withdrew one item (C3 bottom-anchoring) when the reasoning was wrong.
4. **One fact, one home.** The duplicated district (title suffix `· 区域` + geography line `城市 区域`) was fixed *centrally* — `主题 · 区域` is parsed for every layout in `EventSummaryCard`, and Discover splits the title into theme + area — instead of patching each page.
5. **Shared primitives over per-page styling.** `@mixin card-pill` made the Discover and Footprint rails the same object; the Footprint counts/price/faces live in slot props rather than forks of the card.
6. **Batch, don't N+1.** Tablemate archetypes load in a single query keyed by the assigned group ids, capped at 6 — no per-card lookup on a list screen.
7. **Explicit bypass lists, tested.** `evaluateEarlyMatchGate` documents and tests every escape hatch (`admin_manual`, `isTestPool`, no deadline, ≤48h window, ≥80% fill) so a future change cannot silently narrow or widen it.
8. **Docs in the same commit, with supersede notes.** Old statements are marked `(Superseded 2026-11-10: …)` instead of being silently deleted, so a reader with an older mental model learns *why* it changed.
9. **Honesty under fixture pressure.** When the mock served 10 archetypes with `5/8`, we fixed the component (`Math.min(MAX_VISIBLE_COINS, totalPresence)`) instead of dressing the screenshot, and corrected the fixture instead of the label.

---

## 3. What went wrong — and the rule that prevents a repeat

| # | Mistake (evidence) | Why it happened | Recurrence lock |
|---|---|---|---|
| M1 | **Threshold curve ran backwards.** `calculateDecayedThreshold` computed `base - dayIndex*rate`, so the further from the event, the *lower* the bar — the opposite of the comment's intent. Pools could match early on thin compatibility. | A directional policy was encoded as arithmetic nobody re-derived. | Any formula that claims a direction needs a **table-driven test** of (distance → value). Locked in `poolRealtimeMatchingService.test.ts` (≥7d 85 · 72h 70 · 48h 60 · 23.9h 55 · 0h 50). |
| M2 | **A comment stated policy that the code no longer had.** `poolCompletionSweep.ts` claimed matching runs at `preference_lock_at`; it never did. A later reader would have trusted it. | Comments were treated as prose, not as assertions. | Comments that name a trigger, schedule, or owner are **part of the contract** — change them in the same edit. Formalised by the new `lib/poolDeadlineMatchScheduler.ts`. |
| M3 | **Copy asserted something the data could not support.** 「这场局的氛围，已经有点像你了」 attributed a whole room to one person; 「N 位高默契」 exposed an algorithm term. | Copy was written from the model's impression, not from the fields. | Before shipping copy, answer *"who is the subject, and which field proves it?"* Locked by `discoverNarrativeCopy.test.ts` (`never claims the whole pool resembles the viewer`). |
| M4 | **Compound titles were not parsed**, so the area printed twice (title + geography line) on three surfaces. | Rendering adjacent fields without inspecting their overlap. | Parse `主题 · 区域` once in the shared card; `EventSummaryCard.test.tsx` covers stacked + split + no-suffix. |
| M5 | **A primary fact was absolutely positioned.** The Discover corner count floated out of flow and read as a sticker next to a bare deadline. | The badge was added as decoration, then grew into a fact. | Primary facts never get `position: absolute`; if they must overlay art, they join a rail. |
| M6 | **A sampled array was sliced by cap, not by truth.** 10 sample archetypes rendered 10 faces beside `5/8`. | `slice(0, CAP)` looked complete. | Every sampled list is capped by its authoritative count (`Math.min(cap, total)`), and the test reads the guard, not just the cap. |
| M7 | **Fixture edits silently did nothing.** `MOCK_POOL` counts were overwritten by `buildDiscoverPools(...)`, so the screenshot kept showing the old shape. | Trusting the file you edited over the response the app receives. | After any fixture change, `curl` the real endpoint before capturing. |
| M8 | **Edge states were shipped unrendered** (ended card, cancelled card). | Happy-path screenshots were treated as coverage. | Every card state that branches in JSX needs at least one render (`events-footprint-oracle-card` sealed, `events-footprint-revealed`, `events-footprint-terminal` generators). |
| M9 | **Low-contrast text inside translucent pills** (`$color-text-muted` ≈2.48:1; the 22rpx theme label at 0.45 alpha ≈2.5:1). | "Looks grey" was accepted as a design decision. | Any text on a tinted or translucent surface must measure ≥4.5:1; body tokens, not muted tokens, inside pills. |
| M10 | **Hand-tuned off-grid values** (`210rpx`, `2rpx` nudges). | Local fixes felt smaller than token changes. | Layout snaps to the 8rpx grid; a 1rpx hairline and typographic line-height are the only exceptions. |
| M11 | **Two identical hairlines turned a four-band card into five.** | Each band was added independently. | One rule per card; the closing line closes, it does not open a band. |
| M12 | **Stale source-lock assertions after refactors** (`corner-stat`, side clock, old copy) failed focused runs. | Structure and its locks were edited in separate passes. | Change the test in the same edit as the structure; run the focused file before moving on. |
| M13 | **Docs described deleted geometry** (`--has-corner-stat` 120rpx clearance) until a grep found it. | The removal commit updated code and its immediate neighbours only. | When deleting a class, mixin, or variable, grep the whole repo (code + docs + skills) for its name in the same commit. |

---

## 4. Anti-patterns to refuse on sight

- Adding a fourth capsule to a header that already has three. Capsule chrome is for **state** only.
- Explaining a mechanism in copy because the mechanism is weak. Fix the mechanism or say less.
- `space-between` in a column narrower than the card. Either span the full content width or cluster the group.
- Rendering a value because a neighbouring field exists (`dateTime` present ≠ clock enabled).
- "It's just a comment/doc" — in this repo, both are read as truth by the next agent.

---

## 5. Open items carried forward (not fixed this week)

- Footprint `去评价` footer state (`feedbackPending` replacing the closing line) has no capture; two footers must read as one grammar.
- `3 faces / 5 人桌` on completed cards is the accepted honesty case (label is authority, faces are what is known).
- Discover card states never captured: terminal, urgent ≤6h, long title truncation, empty sample, 5-char label + 6-char countdown.
- Staging still does not auto-run migrations and boots fail-fast on schema drift (`validateDbSchema`) — apply `.sql` before deploying, per the 2026-10-26 recurrence lock.
- The `--terminal` dim comment and the `$spacing-sm` value note (16rpx, not 24rpx) were corrected in code/docs; keep an eye on similar "comment drift".

---

## 6. How to use this document

- Starting card or matching work → read §3, then the relevant `docs/agent-context/*.md`.
- Reviewing a PR → check M1 (direction), M6 (sampling), M8 (edge states), M9 (contrast), M13 (deleted identifiers).
- Writing copy → check M3 and the copy rules in `docs/copy/brand-copy-strategy.md`.
- This is a dated record, not a living doc: add a new weekly file rather than rewriting history here.
