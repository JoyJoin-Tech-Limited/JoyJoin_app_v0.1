---
name: icebreaker-auction-phase
description: >-
  Social phase `auction`: virtual-coin English auction, `generateAuctionLots` (`social-auction-lots-v1`,
  gated by `SOCIAL_AUCTION_LLM_ENABLED`), REST generate-lots / bid / close-lot, advance guard
  `auctionAllLotsClosed`, recap `auctionRecapLines`. Triggers: auction phase, SOCIAL_ICEBREAKER_ENABLE_AUCTION,
  /auction/generate-lots, virtual coin auction.
---

# icebreaker-auction-phase

## Hard constraints

- **No real money**: balances are ephemeral session integers (`auctionBalances`), not payment entitlements.
- **LLM optional**: default `SOCIAL_AUCTION_LLM_ENABLED` false → curated fallback lots only; still sets `auctionLotsMeta`.
- **Advance guard**: host cannot `POST .../advance` out of `auction` until `auctionAllLotsClosed` is true (every lot closed via `close-lot`).
- **Bidding rule**: each new high bid refunds the previous high bidder’s escrowed coins before deducting the new bidder.

## When to use this skill

- Implementing the `auction` social icebreaker phase in the mini-program or web
- Adding or modifying virtual-coin auction lots, bidding logic, or host advance guards
- Reviewing a PR that touches `auctionBalances`, `auctionLotsMeta`, or `close-lot` routes
- Tuning auction economy parameters like `AUCTION_STARTING_COINS`
- Debugging why host cannot advance out of the `auction` phase

## References

| File | Purpose |
| --- | --- |
| [references/api-state.md](references/api-state.md) | REST paths + session fields + env flags. |

## Cross-links

- [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md)
- [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md)
- [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md)
- [`payment-entitlement-authority`](../payment-entitlement-authority/SKILL.md) — only if a future iteration introduces real value (out of scope for v1)

## Quick examples

- **Ship UI change** → update `AuctionPhase` (web) and `AuctionPhaseView` (Taro) together; hide global mini-program host “下一阶段” bar during `auction` (in-panel flow).
- **Tune economy** → adjust `AUCTION_STARTING_COINS` in `packages/shared/src/socialIcebreaker.ts` + migration notes in recap copy limits.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 400 on advance | `auctionAllLotsClosed` must be true — host must `close-lot` for each index. |
| No LLM calls | Expect when `SOCIAL_AUCTION_LLM_ENABLED` is not `true`. |
| Bid rejected | Amount must exceed current high and fit remaining balance. |

## Review checklist

- [ ] `production-ai-surfaces.md` row for `auction` matches shipped generator + version.
- [ ] Recap receives bounded `auctionRecapLines` only (no huge payloads).
- [ ] Mini-program `supportedPhases` includes `auction` when flag enabled.
