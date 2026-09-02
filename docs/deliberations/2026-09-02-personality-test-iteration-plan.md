# 氛围测试 Iteration Plan — 2026-09-02 (Founder-Approved)

> Converged plan: PM PRD × design-focused planner spec, all conflicts resolved via grill-me.
> Scope: `apps/mini-program` onboarding subpackage personality test (question page + results page).
> Presentation-layer only — no scoring/matching/MatcherV2 changes, no WebGL revival, no runtime LLM, no raw emoji.

## Locked decisions (grill-me outcomes)

1. **WS-1 Idle mascot whisper** — bubble speaks a per-question line on question entry, replaced by per-option commentary after answer. Copy lives in a **client module** (`personality-test/idleWhispers.ts`: category pools + per-question overrides + generic fallback), NOT the shared question bank (shared field deferred to phase 2). Whisper state is separate from `postAnswerCommentary` (reusing it breaks the echo-overlay guard at `PersonalityTestQuestion.tsx:248`, `COMMENTARY_MIN_DISPLAY_MS` bookkeeping, and read-through analytics at `index.tsx:582-598`). Typewriter delayed 360ms (banner reads first). Suppressed in back-review. ≤28 CJK chars, copy-governance 🔴 rules.
2. **WS-2 Kill celebrate bridge** — delete `celebrateBridge` state + `?celebrate=1` param + exit/ceiling effect (`results/index.tsx:105-111, 252-269, 620-630`) + bridge SCSS (`results/index.scss:63-89`) + the **`verify-subpackage-styles.mjs:262-273` guard entry (CI blocker — same PR)**. Completing shell hold raised **600→1100ms** (`COMPLETING_CELEBRATE_MIN_MS`, `index.tsx:101-106` — was shortened *because* the bridge continued the beat; restore self-sufficiency). Results page: LoadingStage → 200ms keyed crossfade → SlotStage anticipation. `'holding'` phase covers slow network.
3. **WS-3 Slider endpoint icons** — reuse existing Lovart CDN assets `solo-rest` / `party-ready` (already in `PERSONALITY_EMOJI_ASSETS`, `emojiAssets.ts`), promoted to semantic keys; **hardcoded** in the slider branch (one slider question exists — no shared-type change). 48rpx icons above anchor labels, lean-reactive (scale 1.15 + label color at 35/65 via `resolveSliderLean`), text-only graceful fallback on CDN error, reduced-motion/low-end: no scale.
4. **WS-4 Slot sprite blank window** — root cause: `useSpriteReadiness` is a **no-op on real devices** (no DOM `Image` in JSCore → instant return, `useSpriteReadiness.ts:45-50`); slot always starts before decode. Fix: decode during quiz via `PersonalityTestPreloadLayer` hidden `<Image>` + native `getImageInfo` prime at question-page mount + GPU-safe **opacity-pulse shimmer** placeholder (never `background-position`) on `ArchetypeSpritesheet` while `!imgLoaded`. Shimmer styles in `results/index.scss` (subpackage trap) + new selector in `verify-subpackage-styles.mjs`.
5. **WS-5 Fake-3D drum** (WebGL stays quarantined — measured delta was only +1 composite, never passed device FPS gate) — per-card `rotateX/scale/opacity` curvature (±3 window, clamp ±2.5, 14deg/step, scale −0.07/step, opacity −0.28/step), viewport `perspective: 900px`, track `preserve-3d` (**WeChat risk → pre-designed 2.5D fallback**: scale+opacity only), 480ms land flip overshoot, ±8rpx parallax on rail/highlight. Track's inline translateY stays sole transform authority on the track. Card CSS transitions phase-matched to track durations (lockstep interpolation). `SlotCard` memo comparator partially reverted (≤7/24 cards re-render per tick). Tier matrix: full = everything; reduced = curvature+flip, half parallax; minimal/emergency/low-end/reduced-motion = flat. Ride-along fix: white flash fires under reduced-motion (`SlotStage.tsx:213` — pre-existing a11y gap).
6. **WS-3 icon wiring**: hardcoded keys (not shared SliderConfig fields).

## Phasing

- **PR-0** — baseline analytics pull (M1–M4, read-only, 0.5d).
- **PR-1** — WS-1 + WS-2 + WS-3 (~3–4d). One QA device walkthrough covers all three.
- **PR-2** — WS-4 + WS-5 (~4–5d, device lab). Shimmer lands before/with fake-3D. `performance-audit` is a hard gate for WS-5.

## Metrics (baselines in PR-0)

| # | Metric | Target |
|---|--------|--------|
| M1 | commentary_read_complete rate | +10% relative |
| M2 | result_stage_dwell anticipation <300ms bucket | −50% |
| M3 | test completion rate | +3pp |
| M4 | share-poster generation rate | +15% relative |
| M5 | user-satisfaction-audit Angle 6 (share-worthiness) | ≥4/4, no other angle drops |

## Risks

- Package size: slider icons CDN-only; shimmer pure CSS; any new bundled asset needs `packOptions.include` same PR.
- Copy governance: whisper copy is the highest WeChat-review exposure — 🔴 rules, no 匹配/社交/灵魂/AI, zero emoji.
- Fake-3D perf regression on low-end (killed WebGL) — tier gate + real-device FPS verification before merge, 2.5D fallback pre-designed.
- Swipe-back state leaks — `useResetOnShow` audit after bridge deletion.
- Whisper/commentary race — single slot mechanism, delayed-commentary simulation test.

## Verification (all PRs)

`npm run typecheck -w mini-program` · `npm run guardrails` · `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` · `check-class-coverage` · `design:audit:changed` · device walkthrough (8q + 16q paths, 3G throttle, reduced-motion, low-end tier).

Full design specs (per-workstream choreography, implementation maps with file:line, effort S/M/L, model routing) live in this session's planner output; PM PRD sections (user stories, AC-ids, phasing rationale) likewise. This doc records the locked outcomes.

---

## Appendix A — PR-0 baseline (PULLED 2026-09-02, production, 30-day window)

**Caveat: pre-launch tester traffic only (n≈3 sessions) — directional, not statistical. Re-run post-launch for real baselines.**

| # | Baseline value | Note |
|---|---------------|------|
| M1 | commentary read-complete rate = **1.00** (12/12, zero cut_short) | tiny sample; target becomes "hold ≥0.85" rather than +10% |
| M2 | loading-stage dwell <300ms share = **1.00** (3/3) | confirms the pre-WS-2 flicker window; post-release target −50% |
| M3 | completion rate = **33%** (1/3 step_enter → step_completed) | tester sessions only |
| M4 | share-poster events = **0** | no baseline exists; first real numbers come post-launch |

Storage: `onboarding_analytics`; granular events fire as `event_type='interaction'` with the name in `metadata->>'action'` (NOT in `event_type`). Corrected queries:

```sql
-- M1: commentary read-complete rate
SELECT metadata->>'action', count(*) FROM onboarding_analytics
WHERE step='personality-test' AND event_type='interaction'
  AND metadata->>'action' IN ('commentary_read_complete','commentary_cut_short')
  AND timestamp > now() - interval '14 days' GROUP BY 1;

-- M2: anticipation<300ms dwell bucket share
SELECT metadata->>'stage', count(*),
  round(count(*) FILTER (WHERE (metadata->>'dwellMs')::int < 300)::numeric/NULLIF(count(*),0), 3)
FROM onboarding_analytics
WHERE step='personality-test-results' AND event_type='interaction'
  AND metadata->>'action'='result_stage_dwell'
  AND timestamp > now() - interval '14 days' GROUP BY 1;

-- M3: completion rate (step_completed ÷ step_enter, distinct sessions)
SELECT count(DISTINCT session_id) FILTER (WHERE event_type='step_completed'),
       count(DISTINCT session_id) FILTER (WHERE event_type='step_enter')
FROM onboarding_analytics
WHERE step='personality-test' AND timestamp > now() - interval '14 days';

-- M4: share-poster generation
SELECT metadata->>'action', count(*) FROM onboarding_analytics
WHERE step='personality-test-results' AND event_type='interaction'
  AND metadata->>'action' ILIKE '%poster%'
  AND timestamp > now() - interval '14 days' GROUP BY 1;
```

Prod access pattern: `ssh -i <OpenCode.pem> root@1.12.243.104 "docker exec postgres psql -U joyjoin -d joyjoin -At -c \"...\""` (read-only).

## Appendix B — Device-lab checklist (WS-5 hard gate, pre-release)

1. Mid-tier Android (Xiaomi 13/Redmi K60 class): spin with curvature on — `preserve-3d` must not flatten; FPS ≥55 during spin (WeChat DevTools Performance). If flattened or janky → `SLOT_CURVATURE_ENABLE_3D = false` (slotCurvature.ts:37), ship 2.5D.
2. iPhone baseline: same spin/land walkthrough; land flip single-overshoot, no flicker with the flash/particle stack.
3. Tier matrix: force `celebrationTier` full/reduced/minimal — curvature+flip+parallax / curvature+flip+half-parallax / flat.
4. OS reduced-motion ON: reel pixel-identical to pre-iteration, no white flash (ride-along fix), no shimmer pulse.
5. 8-question and 16-question adaptive paths end-to-end; 3G throttle: anticipation → holding → resolve with no dead window.
6. Swipe-back into results page: clean replay, no stranded transient state.

## Appendix C — Post-merge ops

- Trigger **"Upload CDN Assets"** workflow from `main` — re-encoded `xiaoyue-intro-animated.webp` is CDN-only at runtime; devices fetch the stale 671KiB copy until upload.
- Mini-program 开发版 upload follows the normal staging-first CI path.
