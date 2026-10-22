# Lovart Brief — Milestone Badge Batch D2 (5/10/20 场 tiers)

- **Date:** 2026-10-22
- **Status:** Ready to commission — code shipped behind `badge: null` in `MILESTONES` (`apps/mini-program/src/pages/profile/profileConstants.ts`); wiring = set the three CDN paths once assets are uploaded.
- **Context:** The profile 「成就徽章」 wall grew from 2 tiers (初次见面 1场, 三场连击 3场) to a 5-tier ladder: **1 / 3 / 5 / 10 / 20 场**. The two existing medallions are Batch D (`docs/design/lovart-brief-achievement-milestone-batch-d-20260604.md`, assets `src/assets/badges/*-20260604-v1.webp`). Batch D2 completes the ladder in the SAME pixel-art medallion family.
- **Canon:** PM memo `docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md` §3. Badge names (locked copy): 渐入佳境 (5场) · 悦聚常客 (10场) · 城市传说 (20场).

## Style inheritance (from Batch D)

- Pixel-art medallion, circular composition, warm JoyJoin palette (primary purple #8B5CF6, landed-gold accents, cream/pink tints).
- Flat pastel background disc + centered mascot-adjacent motif (Xiaoyue silhouette cues allowed, no face required).
- 600px max width, WebP q=55, transparent outside the medallion circle.
- Escalating grandeur along the ladder: 5场 = small flame/spark motif; 10场 = ribbon/star cluster; 20场 = crown/city-skyline crest (城市传说 = city legend — a skyline silhouette inside the medallion reads literally).

## Deliverables (3 files)

| Tier | Name | File | Motif |
|---|---|---|---|
| 5 场 | 渐入佳境 | `badge-5-events-20261022-v1.webp` | spark/flame medallion |
| 10 场 | 悦聚常客 | `badge-10-events-20261022-v1.webp` | ribbon + star cluster |
| 20 场 | 城市传说 | `badge-20-events-20261022-v1.webp` | city skyline crest + crown |

## Landing checklist (when art arrives)

1. Drop files into `apps/mini-program/src/assets/badges/` (they are CDN-deployed, NOT bundled — same as Batch D).
2. Add manifest entries to `apps/mini-program/scripts/cdn-asset-manifest.json` (`assets/badges/<file>`).
3. Upload: trigger the **Upload CDN Assets** workflow.
4. Add keys to `MILESTONE_BADGES` (`apps/mini-program/src/lib/milestoneBadges.ts`): `regular5` / `veteran10` / `legend20`.
5. Set `badge: MILESTONE_BADGES.regular5` (etc.) in `MILESTONES`.
6. `npm run guardrails` + `npx vitest run src/pages/profile` — the 5-tier tests already cover the wall.

## Data note (PM memo §3)

20场 cap is provisional: verify p95 成行 distribution before generating. If p95 < 10场, re-scope tier 5→15场 (rename 城市传说 threshold 20→15 in the same PR as the asset wiring).
