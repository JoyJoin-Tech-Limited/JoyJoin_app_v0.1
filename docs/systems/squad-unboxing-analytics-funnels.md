# Squad Unboxing — Analytics Funnels

> Canonical funnel reference for `pages/squad-unboxing` (盲盒开桌 / tap-to-reveal).
> Event union: `apps/mini-program/src/lib/analytics/squadUnboxingAnalytics.ts`.
> Server whitelist: `apps/server/src/routes/domains/analytics.ts`
> (`squadUnboxingAnalyticsRoutes.test.ts` locks the accepted set).
> Last updated: 2026-07-14 (tap-to-reveal revamp).

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
| `squad_unboxing_share_poster_tap` | 截图保存记忆 CTA (toast-based; no poster pipeline yet) |
| `squad_unboxing_analysis_retry_tap` | Group-analysis fetch retry |
| `squad_unboxing_ready_hero_fallback` | Composed-hero image fell back (CDN → bundled → gradient) |

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
  and rejects unknown types
  (`apps/server/src/__tests__/squadUnboxingAnalyticsRoutes.test.ts`).
- `all_revealed` single-fire semantics (both completion paths, no re-entry
  fire) are unit-tested in `squadFlipState.test.ts`.
- `card_detail_dismiss` is emitted exactly once in page source — inside the
  resolver's `dismiss` branch (`composition.test.ts` lock).
