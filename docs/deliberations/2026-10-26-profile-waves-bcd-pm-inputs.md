# Profile Waves B/C/D — PM Decisions

- **Date:** 2026-10-26
- **Scope:** PR #649 (`feat/profile-tab-polish-20261022`), 33 commits, green; satisfaction re-audit 24/24. Decisions only; no application-code change is made by this memo.
- **Decision sources:** `2026-10-23-profile-full-marks-pm-plan.md`, `2026-10-23-profile-full-marks-convergence.md`, the 2026-10-26 read-only production/staging gate results supplied with this review, and the 24/24 acceptance record in `.sisyphus/plans/profile-tab-polish-20261022.progress.md`.
- **Canon:** `PRODUCT_REQUIREMENTS.md` §52 — Profile growth facts remain real server data; no fabricated progress or placeholder values.
- **Observed gate data:** production has 9 users; `xp_transactions` has 0 rows ever and 0 gain weeks in the trailing 12 ISO weeks. Both D-4 variants return `eventsJoined` p50/p95/max = 0 and zero users at ≥15/≥20. Staging has 1 XP row ever and D-4 p95/max = 2/4.

## 1. Wave B / D-2 — **DELETE A5-4**

- Do not build `weeklyXp`, its aggregate, DTO change, or the 「本周 +N 潮流值」 line. The pre-agreed p50≈0 deletion condition is met; there is no honest zero-state or cumulative-value substitute to add. The existing total 潮流值 and streak surfaces stay unchanged.
- **Reopen only with new evidence:** the XP-integrity check below is closed and a later trailing-12-week production query shows active-user weekly XP p50 ≥ 50.
- **Separate XP-economy investigation: YES — P1, not a PR #649 merge blocker.** Production emptiness is not yet proof of a defect because production also has no recorded joined events; staging's single row is not enough to prove the whole economy.
  - **Owner/timebox:** backend engineer + QA, ≤0.5 engineer-day.
  - **Minimum proof:** read-only reconciliation of eligible reward actions vs ledger rows/balances, plus one controlled staging award that must produce the expected ledger row and displayed totals.
  - **Escalation:** promote to P0 if any eligible completed production action has a missing ledger row or balances disagree. If no eligible production action exists, close as expected pre-launch emptiness.

## 2. Wave C / D-4 — **SHIP 城市传说 AT 15场**

- **Rationale:** the agreed p95<12 rule fires, there is no evidence supporting a higher launch threshold, and the numeral-free art makes 15场 the lower-risk reversible configuration rather than a claim about mature usage.
- **Execution boundary:** retain the accepted Batch-D2 art; no regeneration or redesign. Only the threshold and corresponding 20→15 identifiers/copy need the already-authorized Wave-C closure.
- **Revisit:** after ≥8 weeks of live attendance **and** ≥30 users with a completed event, rerun the same D-4 variants. Keep 15场 unless p95 ≥ 12; only then consider restoring 20场.

## 3. A6-3 poster v2 — **NO-GO NOW**

- The current poster already holds share angle 4/4, while production has no unlocked badge population to make a badge-count improvement meaningful. Keep the existing artifact and spend the remaining effort proving its native canvas path in Wave D.
- **Reopen only on poster-specific user/audit evidence.** If reopened, cap the minimum scope at one existing-data line, 「已点亮 N 枚徽章」, rendered only when N>0. Exclude the latest medallion, layout/typography changes, new fetches, new assets, and any second poster concept.

## 4. Wave D human device pass — **REQUIRED; TARGETED, NOT A FULL CARTESIAN MATRIX**

Timebox one **1–2 hour** session against the exact merge candidate after the D-4 threshold-only closure. H5 screenshots alone do not sign off native behavior.

- [ ] **Build and assets:** correct PR #649 commit and launch flags; V1.7 plus one compact-fallback happy path; CDN badge art loads without broken images.
- [ ] **Width/geometry:** WeChat DevTools at 320/375/414px. At 320px run the dense case (multi-event + claim-pending + near-milestone streak + next-event + fresh-badge/poster-glow) and a 0-event case. Confirm the identity-card/avatar zone, two-line streak capsule, badge row, equipment strip, first-viewport hierarchy, and condensing nav have no overlap, clipping, or horizontal overflow.
- [ ] **States and motion:** at one representative width verify loading / empty / error+retry / happy; reduced-motion and degradation render static end states; first entry vs return preserves the intended one-shot entrance, badge ring, and haptic behavior; normal entrance remains within 600ms.
- [ ] **One physical 8GB+ baseline device:** cold start and tab return work; all five badge visuals render; native poster generate → preview → save → share succeeds; avatar/name/copy/QR render without clipping; private fields remain absent.
- [ ] **Exit evidence:** attach a screenshot for each required case plus the saved poster. Zero open P0/P1 or Class-A render/native-poster defects; any lower-severity finding has an owner and does not silently expand this pass.

Wave B, A6-3, and D-1 are **not** acceptance dependencies. After the D-4 closure, Wave D is the only remaining human 验收 gate.

## 5. D-1 greeting 5→7 — **REMAIN DEFERRED; CLOSE FOR PR #649**

The five-line pool plus event-day variant already supports the 24/24 result; adding 24 more lines has no current evidence-backed loss to recover and would reopen copy review. Revisit only if users report repetition or a future audit drops either emotional resonance or return hooks below 4/4.

## Branch boundary

This decision set retires A5-4 and A6-3 from the active plan and keeps D-1 out. It adds no endpoint, flag, fetch, asset, poster layout, or replacement growth mechanic. Rollback for deleted/unbuilt items is simply keeping them unbuilt; D-4 remains threshold/key-only because the accepted art is numeral-free.
