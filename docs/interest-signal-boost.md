# Interest Signal Boost

## Feature Purpose

The **Interest Signal Boost** is an optional pre-match calibration tool that deepens matching quality and icebreaker generation without adding onboarding friction.

Rather than relying solely on broad interest tags (e.g. "美食"), the feature captures an incremental "conversation-fit calibration" signal for a selected interest:

- **preferred discussion style** — how the user likes to engage with this topic (casual, character-focused, lore/plot, meme/humor, or deep analysis)
- **desired conversation depth** — light / medium / deep

### What is NOT re-asked here

Enthusiasm/passion level is **derived server-side** from the user's onboarding interest data (`user_interests.heat`), so the user is never asked to re-declare what they already told us during onboarding. This eliminates the duplicated self-report issue from the original MVP.

Heat → enthusiasm mapping (server-side only):

| Onboarding heat value | Enthusiasm stored |
|---|---|
| 25 (level 3 / passionate) | 5 |
| 10 (level 2 / active) | 3 |
| 5 (level 1 / casual) | 2 |
| no data | 3 (neutral default) |

---

## Why Optional and Pre-Match (Not Onboarding)

- **No onboarding friction**: surfaced *after* successful pool registration (in the `SuccessCelebration` screen), not during signup or profile setup.
- **No `nextStep` changes**: the server-driven onboarding state is not affected.
- **Never blocks matching**: users without signal data are matched normally.
- **Power-user opt-in**: 2-step flow (down from original 3), clearly framed as optional and quick.

---

## UX Flow (Refined)

Entry: `SuccessCelebration` → "精调同频设置（2步完成）" CTA

The interest is pre-selected from the user's highest-heat onboarding interest (no picker step).
The user's existing passion level is shown as a read-only badge ("认真同好 ⭐") so they know we already know it.

1. **Step 1** — Discussion style (5 options, single-select)
2. **Step 2** — Conversation depth (3 options, single-select)
3. **Done** — confirmation state with passion badge

Copy is framed around "同频" and refinement, not testing or re-profiling.

---

## Data Stored

Table: `user_interest_signals`

| Column | Type | Source | Description |
|---|---|---|---|
| `id` | varchar (UUID) | server-generated | Primary key |
| `user_id` | varchar | session | FK → `users.id` (cascade delete) |
| `interest_key` | varchar | client | Normalized interest ID (topicId from INTEREST_TAXONOMY) |
| `interest_label` | varchar | server (taxonomy) | Human-readable label (e.g. "美食") |
| `enthusiasm_level` | integer | **server-derived** | Derived from `user_interests.heat` — not sent by client |
| `discussion_style` | varchar | client | One of: `casual_vibes`, `character_people`, `plot_worldbuilding`, `meme_humor`, `deeper_analysis` |
| `conversation_depth` | integer | client | 1 = light, 2 = medium, 3 = deep |
| `created_at` | timestamp | server | First recorded |
| `updated_at` | timestamp | server | Last updated (freshness metadata) |

Unique constraint: `(user_id, interest_key)` — one signal per user per interest, upserted on re-submission.

---

## API Endpoints

### `POST /api/user/interest-signals`
Creates or updates the signal for one interest.
`enthusiasmLevel` is **not accepted from the client** — it is derived server-side from `user_interests.heat`.

**Request body:**
```json
{
  "interestKey": "hotpot",
  "discussionStyle": "casual_vibes",
  "conversationDepth": 2
}
```

**Response:**
```json
{ "success": true, "data": { ...UserInterestSignal } }
```

### `GET /api/user/interest-signals`
Returns all stored signals for the authenticated user.

**Response:**
```json
{ "signals": [ ...UserInterestSignal[] ] }
```

---

## How Matching Uses the Signal

Signal data is documented below in three sections, but only the last two are **active AI prompt enrichment** paths. The first is retained here as an explicit removal notice so the deterministic pair-score boundary stays visible and auditable:

### 1. ~~Pair Scoring — `calculateSignalAlignmentBonus()` in `poolMatchingService.ts`~~ ❌ REMOVED

> **Architectural boundary (enforced):** `user_interest_signals` are NOT used in deterministic
> pair-score computation. The `calculateSignalAlignmentBonus()` function and
> `loadInterestSignalLookup()` have been removed from `poolMatchingService.ts`.
>
> The deterministic interest score (`calculateInterestScoreAsync`) reads **only** from
> `user_interests` (topic overlaps + heat levels). Changing or omitting
> `user_interest_signals` data does not affect pair scores or group formation.
>
> This invariant is verified by the tests in
> `apps/server/src/__tests__/interestSignalBoundary.test.ts`.

### 2. Match Explanation — `findConnectionPoints()` in `matchExplanationService.ts`

When generating pair explanations:
- **Same `discussionStyle`**: generates a connection point like `「美食」同款聊法（随便聊聊）`
- **Similar `conversationDepth`** (diff ≤ 1): generates `「美食」话题深度相近`

### 3. Icebreaker / Conversation Topics Generation

`ParticipantProfile.interestSignals` is passed to AI prompt for richer, more targeted topic suggestions.

---

## Measurement Plan

### Primary metric: does the boost drive richer AI explanation and icebreaker quality?

Since signals are no longer used in deterministic pair scoring, the measurement focus shifts
to AI enrichment quality:

- **Connection point richness**: compare explanation connection points for users with vs. without signals
- **Icebreaker relevance**: evaluate topic relevance via post-event feedback for signal vs. no-signal cohorts

### Secondary metrics

| Metric | How to measure |
|---|---|
| Opt-in rate | Count `[InterestSignalBoost] completed` log lines / pool registration events |
| Completion rate | Same log — all completions are full 2-step (no partial save) |
| Post-event satisfaction | Existing `EventFeedbackFlow` — compare signal vs. no-signal cohorts |

Server-side log format (emitted on each POST /api/user/interest-signals):
```
[InterestSignalBoost] completed userId=<id> interestKey=<key> style=<style> depth=<n> derivedEnthusiasm=<n>
```

---

## MVP Scope

### Included
- Schema: `user_interest_signals` table (unchanged from PR #371)
- Typed server routes (POST/GET), with `enthusiasmLevel` derived from onboarding data
- Optional client UI: 2-step bottom sheet (discussion style + depth)
- Read-only heat badge shown in sheet header from onboarding data
- Integration with match explanation connection points
- Integration with icebreaker topic generation prompt
- Server-side instrumentation logging
- Documentation

### Explicitly Excluded (MVP guardrails)
- ❌ Image or audio recognition questions
- ❌ Copyrighted media of any kind (text-first only)
- ❌ Mandatory onboarding step or `nextStep` changes
- ❌ Hard matching filters based on signal
- ❌ Heavyweight question bank or quiz framework

---

## Extending the Feature Later

- Add freshness decay: down-weight signals older than 90 days (`updatedAt` is stored)
- Surface the boost CTA on profile page or before-event reminder
- Allow multiple interests to be calibrated in one session
- Add interest-category-specific discussion style options (e.g. food-specific vs. anime-specific)
- Add A/B test flag to compare matched groups with/without signal alignment bonus
