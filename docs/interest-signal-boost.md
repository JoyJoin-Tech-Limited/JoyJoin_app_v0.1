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

Signal data is consumed in three places, all as **soft enhancers** with no hard-filter behaviour:

### 1. Pair Scoring — `calculateSignalAlignmentBonus()` in `poolMatchingService.ts` ✅ NEW

When two users share a common interest AND both have completed the boost for that interest:

```
+5 if discussionStyle matches exactly
+3 if |conversationDepth₁ - conversationDepth₂| ≤ 1
Total signal bonus capped at +10, applied on top of the heat bonus
```

This is the **primary matching-quality path**: users who complete the boost flow receive a small but real pair-score improvement when their conversation style/depth preferences align with a potential match. This is measurable by comparing average interest-dimension pair-scores between (both users have signals) vs. (neither has signals) for the same shared interest.

### 2. Match Explanation — `findConnectionPoints()` in `matchExplanationService.ts`

When generating pair explanations:
- **Same `discussionStyle`**: generates a connection point like `「美食」同款聊法（随便聊聊）`
- **Similar `conversationDepth`** (diff ≤ 1): generates `「美食」话题深度相近`

### 3. Icebreaker / Conversation Topics Generation

`ParticipantProfile.interestSignals` is passed to AI prompt for richer, more targeted topic suggestions.

---

## Measurement Plan

### Primary metric: does the boost drive better matching outcomes?

Compare the interest-dimension pair-score for user pairs where:
- **A**: both users have a signal for the shared interest
- **B**: neither user has a signal for the shared interest

If the feature is working: group A should show higher interest-dimension scores and, when post-event feedback is available, higher satisfaction ratings.

### Secondary metrics

| Metric | How to measure |
|---|---|
| Opt-in rate | Count `[InterestSignalBoost] completed` log lines / pool registration events |
| Completion rate | Same log — all completions are full 2-step (no partial save) |
| Avg signal alignment bonus at match time | Log `signalBonus > 0` in `calculateSignalAlignmentBonus()` |
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
- Signal alignment bonus in `calculateInterestScoreAsync()` (+5 style match, +3 depth match, cap +10)
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
