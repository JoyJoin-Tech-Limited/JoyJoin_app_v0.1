# Auction — API and session state

## Env

| Variable | Effect |
| --- | --- |
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Inserts `auction` before `personality_dice` in server enabled phases. |
| `SOCIAL_AUCTION_LLM_ENABLED` | When `true`, `generateAuctionLots` calls the model; otherwise curated fallback lots. |

## Routes (`apps/server/src/routes/socialIcebreaker.ts`)

| Method | Path | Who |
| --- | --- | --- |
| POST | `/:socialSessionId/auction/generate-lots` | Host |
| POST | `/:socialSessionId/auction/bid` | Player (`{ amount }`) |
| POST | `/:socialSessionId/auction/close-lot` | Host |

## Session fields

- `auctionLots`, `auctionLotsMeta`, `auctionBalances`, `auctionCurrentLotIndex`, `auctionHighBid`, `auctionAllLotsClosed`, `auctionRecapLines`
- Shared Zod: `auctionLotsLlmPayloadSchema` in `packages/shared/src/socialIcebreaker.ts`

## AI

- `generateAuctionLots`
- `promptVersion`: `social-auction-lots-v1`
- Trace feature: `generateAuctionLots`, domain `icebreaker`
