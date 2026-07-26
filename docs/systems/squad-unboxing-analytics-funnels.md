# Squad Unboxing — Analytics Funnels

> Canonical funnel reference for `pages/squad-unboxing` (盲盒开桌 / tap-to-reveal).
> Event union: `apps/mini-program/src/lib/analytics/squadUnboxingAnalytics.ts`.
> Server whitelist: `apps/server/src/routes/domains/analytics.ts`
> (`squadUnboxingAnalyticsRoutes.test.ts` locks the accepted set).
> Last updated: 2026-07-24 (table-card poster events added, wow pass).

## 1. Primary funnel (first visit)

```
box/ribbon open            squad_unboxing_box_tap (source=box) | squad_unboxing_reveal(_drag/_tap)
        │
        ▼
reveal milestone           squad_unboxing_box_open_milestone
        │
        ▼
face-down fan game         squad_unboxing_card_flip { method, index, isBestPartner, groupId, screen }
        │                     • method=auto_me   — 我 card auto-flip ~300ms after deal settle (arrival guard)
        │                     • method=tap       — one-step flip+focus+narration
        │                     • method=reveal_all — burst from the hint chip
        │
        ├── per focus swap    squad_unboxing_card_focus { source: 'deck_tap', cardIndex,
        │                       focusedUserId, previousIndex, groupId, screen }
        │
        ├── reveal-all chip   squad_unboxing_reveal_all_tap { remainingCount, groupId, screen }
        │
        ▼
completion (single-fire)   squad_unboxing_all_revealed { flippedByTap, flippedByRevealAll, durationMs }
        │
        ▼
attendance CTA             squad_unboxing_confirm_attendance_tap
                           → squad_unboxing_confirm_attendance_success | _error
```

`squad_unboxing_all_revealed` fires **exactly once per session** — on whichever
path completes the face-up set (manual taps, reveal-all burst, or the auto-me
flip completing the set). It **never fires on re-entry** sessions (persisted
reveal flag present at arrival → all-up render, no game). `durationMs` is
wall-clock from deal-settle to completion, not animation time.

## 2. Secondary / diagnostic events

| Event | When |
| --- | --- |
| `squad_unboxing_bubble_reveal_complete` | TypewriterText finishes a narration beat |
| `squad_unboxing_scroll_depth` | Scroll-depth buckets (reset per groupId) |
| `squad_unboxing_tonights_table_view` | Event-brief chapter impression |
| `squad_unboxing_connection_story_expand` / `_collapse` | Connection-story chips in the analysis chapter |
| `squad_unboxing_share_poster_tap` | 截图保存记忆 CTA (toast-based; superseded by the 桌卡 poster pipeline below) |
| `squad_unboxing_analysis_retry_tap` | Group-analysis fetch retry |
| `squad_unboxing_ready_hero_fallback` | Composed-hero image fell back (CDN → bundled → gradient) |
| `squad_unboxing_ready_dwell` | `{ dwellMs, groupId, screen }` | Dwell time (ms) the user spent in `ready` state before opening the box — measures anticipation time. Fired on `box_tap`/`reveal`/`drag`; source field in payload. |

## 2c. 桌卡 poster events (2026-07-24, wow pass P2)

The 「这桌的桌卡」 collectible banner (visible once every card is face-up,
persists on re-entry) generates a 750×1100 canvas poster into the photo
album via `squadTableCardPoster.ts`.

| Event | Payload | When |
| --- | --- | --- |
| `squad_unboxing_table_card_tap` | `{ groupId, screen }` | User tapped 保存桌卡 |
| `squad_unboxing_table_card_saved` | `{ groupId, screen }` | Poster drawn + `saveImageToPhotosAlbum` succeeded |
| `squad_unboxing_table_card_save_failed` | `{ groupId, screen, message }` | Draw/export/save threw (incl. album-permission denial) |

## 2b. Pocket-the-deck events (2026-07-15)

Two-phase reveal: the fan ⇄ pocketed-pill collapse interaction
(`sprint-contract.squad-unboxing-pocket-deck-20260715.md`).

| Event | Payload | When |
| --- | --- | --- |
| `squad_unboxing_deck_collapse` | `{ groupId, screen, firstCollapse, memberCount, faceDownCount }` | User taps the 收起卡组 trigger (fan → folding). `firstCollapse` is `true` only for the group's first-ever collapse (gated by the `jj_deck_collapse_hint_${groupId}` storage flag — the same flag that arms the one-time hint bubble). `faceDownCount` is the unrevealed-card count at collapse time (spoiler-gating sanity signal). |
| `squad_unboxing_deck_reopen` | `{ groupId, screen, reopenCount }` | Pill pull-down drag or tap re-fans the deck (pocketed → unfolding). `reopenCount` is in-memory per groupId — resets on group change / cold start, not persisted. |

> **Server whitelist:** both events are in the client union and are accepted
> by the server whitelist (`apps/server/src/routes/domains/analytics.ts`),
> locked by `apps/server/src/__tests__/squadUnboxingAnalyticsRoutes.test.ts`
> (whitelisted 2026-07-15, follow-up to the pocket-deck sprint contract §4).
> Events emitted before the whitelist follow-up landed were dropped
> server-side (fail-open) and are not backfilled.

## 3. Reinstated event (upstream `a6ea57284`, 2026-07-14)

| Event | Status | Semantics |
| --- | --- | --- |
| `squad_unboxing_card_detail_dismiss` | **Active** | Fires only from the `resolveCardFocusInteraction` **dismiss** action: a deliberate second tap on the focused card unfocuses it and returns the dock bubble to the resting voice. Never emitted from the flip path or the reveal-all burst path. |

History: the tap-to-reveal revamp originally discontinued this event
(unfocus was deliberately analytics-free). Upstream commit `a6ea57284`
("Make card narration reveals consistent") reinstated it as the resolver's
dismiss action — with the fast-forward (`complete`) action in between, a
second tap no longer means immediate unfocus, so a true dismiss is once again
an independent product signal. Dashboards joining pre/post-revamp data should
treat pre-revamp `card_detail_dismiss` rows (panel-close) and post-`a6ea57284`
rows (focus-dismiss) as distinct semantics.

## 4. Invariants locked by tests

- Client union contains all events above including `card_detail_dismiss`
  (`lib/analytics/squadUnboxingAnalytics.ts`).
- Server whitelist accepts the three tap-to-reveal events
  (`reveal_all_tap`, `card_flip`, `all_revealed`) plus `card_detail_dismiss`,
  the two pocket-deck events (`deck_collapse`, `deck_reopen`), and the three
  table-card poster events (`table_card_tap`, `table_card_saved`,
  `table_card_save_failed`), and rejects unknown types
  (`apps/server/src/__tests__/squadUnboxingAnalyticsRoutes.test.ts`).
- `all_revealed` single-fire semantics (both completion paths, no re-entry
  fire) are unit-tested in `squadFlipState.test.ts`.
- `card_detail_dismiss` is emitted exactly once in page source — inside the
  resolver's `dismiss` branch (`composition.test.ts` lock).
- Deck-phase timing budgets (fold ≤600ms cascade, 最佳拍档 last; unfold ≤480ms),
  storage key shapes (`jj_deck_collapsed_`, `jj_deck_collapse_hint_`), and the
  fan/folding/pocketed/unfolding phase machine are unit-tested in
  `squadDeckCollapseState.test.ts`; pill view-model gating (strip cap,
  spoiler-safe face-down chips, chemistry class) in
  `squadUnboxingViewModels.test.ts`.
