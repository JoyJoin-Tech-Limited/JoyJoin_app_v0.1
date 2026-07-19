# Pre-Ship Pipeline Report — Slot Machine Slices 0–6

**Date:** 2026-07-19 (fixes + gate 2026-07-20) · **Scope:** slot-machine reveal slices 0–6 (`apps/mini-program/src/pages/onboarding/personality-test/results/*`, `lib/utils/mingCardImage.ts`, `packages/shared/src/ui/mingCard.ts` + export, 11 new tests)

## Step verdicts

| # | Step | Verdict |
|---|---|---|
| 1+2 | Code review + review swarm | **FAIL → PASS after fix** — 1 blocking issue (below) |
| 3 | Design chain (ui-layout → frontend-design → completeness) | **SHIP** — completeness **37/44 坚稳**, no Class A defects, all new copy 🔴-compliant (1 🟡 borderline: guest next-horizon line, accepted) |
| 4 | Performance audit | **PASS (48/60, borderline)** — no blocking perf issues; 3 WARN |
| 5 | Fix loop | **1 blocking + 4 dual-flagged concerns fixed** (below); C3/C6/C7 logged as follow-ups |
| 6 | Polish (`wow-elements`) | **Skipped** — completeness dim 5 not ≤2; the landed celebration IS the polished moment |
| 7 | `npm run harness:gate` | **CONCERN 91/100 (≥85 threshold)** — after the trivial serve.mjs fix (Security back to 100). Remaining Maintainability 55/100 items are pre-existing/other-workstream except results/index.tsx 1793/1800 lines, which was already over the warn threshold before slices 0–6 (+112 lines ours). **Deferred refactor (PM-approved 2026-07-20): extract, don't append, on the next change to this file.** |

## Blocking issue found & fixed

**B1 — reduce-motion guard was dead code (accessibility hard constraint).** The new `.personality-results--reduce-motion` SCSS guards (slot flash, letter-by-letter) — and a pre-existing block from June — were gated on a class no TSX ever applied. **All three auditors caught it independently.** Fix: root View now appends the class from `Taro.getSystemInfoSync().reduceMotion` (sibling pattern), which also activates the dormant June guards.

## Concerns fixed in-loop (each flagged by ≥2 auditors, 1–2 lines)

- **C1** phantom `result_stage_dwell` on replay fast-path → `prevStageRef` initialized from the same expression as `flowStage`.
- **C2** silent `No.01/12` on ARCHETYPE_SEQUENCE miss → explicit `-1` check + `logWarn`.
- **C4** ungated 744×1039 hidden canvas (~3MB native bitmap on low-end) → gated on `!deviceTier.isDegradation` like its sibling (poster fails open to raw art).
- **C5 + design Q1** unreachable/mis-framed spin caption → `正在比对你的选择…` (analysis framing for authenticated users without whispers).

**Logged, non-blocking follow-ups:** C3 (legacy drawImage silent-failure can shadow raw-art fallback — low probability, suggest pixel-probe or timeout logWarn), C6 (badge pill fixed 150px geometry vs future longer prefixes), C7 (min-chars filter branch untestable with real bank data).

## Consolidated grill-me (one cross-domain stress-test)

1. **Correctness** — *what breaks the happy path?* Missing secondary (blend→random fallback chain), no local answers (empty whispers→analysis caption), malformed storage (tested), ming-card failure (fail-open null→raw art), sequence drift (now logged). Honest gap: the blend near-miss path is inline in `runResultFlow` with no unit test — covered by fallback logic + review, flagged for extraction next refactor.
2. **Visual truth** — *rendered?* **No.** No H5 route exists for this page; June rendered audits are the baseline; this diff is additive. WeChat DevTools render check is the outstanding truth-gap (bundled with the device-FPS visit).
3. **Completeness** — *any dim ≤2?* 37/44 坚稳; top ROI gap was the spin caption (fixed in-loop as C5/Q1).
4. **Performance** — *any dim <8?* None (memory 8/10 lowest; composite 48/60). Evidence is static analysis vs primary-tier baselines; real-device evidence pending.
5. **Polish** — *right moment, reduce-motion safe?* Yes — the landed flash+burst+letter reveal; reduce-motion now genuinely suppressed (B1 fix) and ParticleBurst self-handles.
6. **Ship decision** — *what would roll this back?* Skip-rate spike on `slot_animation_start` cohorts, or user confusion reports about the blend near-miss ("showed me the wrong animal"). Instant rollbacks, no deploy: `slotNearMissMode: 'random'` and the `personalitySlotAnimationEnabled` kill switch.

## Final gate

Typecheck clean · **1019/1019 tests green** (11 new) · harness:gate **CONCERN 88/100** · **SHIP verdict.** Two human-dependent follow-ups: (1) WeChat DevTools render + real-device FPS (`http://<mac-ip>:8787/?hud=1` for the WebGL gate, plus a visual pass on the new celebration), (2) baseline metrics read ~2 weeks post-deploy.
