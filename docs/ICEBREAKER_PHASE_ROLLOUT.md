# Social Icebreaker Phase Rollout Plan

> **Status:** MVP phases (warmup, micro_challenge, lie_detective, recap) are live. Optional phases (auction, personality_dice, mini_script) are feature-flagged.
> **Goal:** Safe, validated rollout of optional phases without breaking the core experience.

---

## Phase Inventory

| Phase | Code Status | Default | Flag | Rollout Stage |
|-------|-------------|---------|------|---------------|
| `warmup` | ✅ Complete | On | — | **Live** |
| `micro_challenge` | ✅ Complete | On | — | **Live** |
| `lie_detective` | ✅ Complete | On | — | **Live** |
| `recap` | ✅ Complete | Always | — | **Live** |
| `personality_dice` | ✅ Complete | On | `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | **Live** (default on) |
| `auction` | ✅ Complete | Off | `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | **Staged** |
| `mini_script` | ✅ Complete | Off | `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | **Staged** |

---

## Staged Rollout Steps

### Stage 1 — Internal Dogfood (team-only events)
**Target:** 1–2 weeks  
**Flags:**
```bash
SOCIAL_ICEBREAKER_ENABLE_AUCTION=true
SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true
SOCIAL_MINISCRIPT_LLM_ENABLED=true
```
**Validation:**
- [ ] Host can advance through all 7 phases without error
- [ ] AI fallbacks work when DeepSeek is unavailable
- [ ] Auction bidding and close-lot logic is intuitive
- [ ] Mini-script content passes content-safety review
- [ ] Recap correctly summarizes all optional phases

### Stage 2 — Beta Pool (select active pools)
**Target:** 2–3 weeks  
**Method:** Enable flags on staging server; invite beta users to flagged pools only.
**Validation:**
- [ ] Beta feedback CSAT ≥ 4.0 for optional phases
- [ ] No increase in session drop-off during auction or mini_script
- [ ] AI token costs per session remain within budget

### Stage 3 — General Availability
**Target:** After Stage 2 validation  
**Method:** Update production env to `SOCIAL_ICEBREAKER_ENABLE_AUCTION=true` and/or `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=true`.

---

## Kill-Switch Procedure

If any optional phase causes issues in production:

```bash
# Immediate (no deploy required if using env-based config reloading)
SOCIAL_ICEBREAKER_ENABLE_AUCTION=false
SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT=false

# Then restart the API container
```

Existing sessions in the affected phase will continue; new sessions will skip the disabled phase.

---

## Asset Dependencies

Before GA, the following proprietary assets should be in place:

| Asset | Status | Blocker? |
|-------|--------|----------|
| Phase header icons (7×) | ❌ Missing — Lovart brief ready | **Soft** — emoji placeholders work |
| Rating face icons (5×) | ❌ Missing — Lovart brief ready | **Soft** — emoji placeholders work |
| Archetype head icons (12×) | ❌ Missing | Soft — initials fallback works |

**Decision:** Optional phases can ship to beta without proprietary icons. GA should include at least phase header icons for brand consistency.

---

## API Changes Log

| Date | Change | File |
|------|--------|------|
| 2026-04-23 | Added `POST /api/social-icebreaker/:id/micro-challenge/generate` for explicit challenge generation (parity with other phases) | `apps/server/src/routes/socialIcebreaker.ts` |
