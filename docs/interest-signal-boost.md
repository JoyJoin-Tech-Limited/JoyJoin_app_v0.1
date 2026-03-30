# Interest Signal Boost

## Feature Purpose

The **Interest Signal Boost** is an optional pre-match calibration tool that strengthens matching quality and downstream icebreaker generation without adding onboarding friction.

Rather than relying solely on broad interest tags (e.g. "美食"), the feature captures a lightweight "conversation-fit calibration" signal for a selected interest, combining:

- **self-reported enthusiasm level** (how much the user actually cares about this interest)
- **preferred discussion style** (casual, character/people-focused, plot/worldbuilding, meme/humor, deep analysis)
- **desired conversation depth** (light / medium / deep)

This helps distinguish users who casually tagged an interest vs. those who actively want it to matter in matching, and surfaces more targeted icebreaker topics when participants share similar signals.

---

## Why Optional and Pre-Match (Not Onboarding)

- **No onboarding friction**: Adding a required step to onboarding risks conversion drop-off. This feature is surfaced *after* successful pool registration (in the `SuccessCelebration` screen), not during signup or profile setup.
- **No `nextStep` changes**: The server-driven onboarding state is not affected. There is no new `nextStep` value.
- **Never blocks matching**: Users without signal data are matched normally. The signal is a soft bonus enhancer, not a filter.
- **Power-user opt-in**: Users who care about niche matching can improve their signal; casual users can ignore it entirely.

---

## Data Stored

Table: `user_interest_signals`

| Column | Type | Description |
|---|---|---|
| `id` | varchar (UUID) | Primary key |
| `user_id` | varchar | FK → `users.id` (cascade delete) |
| `interest_key` | varchar | Normalized interest ID (topicId from INTEREST_TAXONOMY) |
| `interest_label` | varchar | Human-readable label (e.g. "美食") |
| `enthusiasm_level` | integer | 1 (just tagged it) – 5 (obsessed) |
| `discussion_style` | varchar | One of: `casual_vibes`, `character_people`, `plot_worldbuilding`, `meme_humor`, `deeper_analysis` |
| `conversation_depth` | integer | 1 = light, 2 = medium, 3 = deep |
| `created_at` | timestamp | First recorded |
| `updated_at` | timestamp | Last updated (freshness metadata) |

Unique constraint: `(user_id, interest_key)` — one signal per user per interest, upserted on re-submission.

---

## API Endpoints

### `POST /api/user/interest-signals`
Creates or updates the signal for one interest (upsert by `(userId, interestKey)`).

**Request body:**
```json
{
  "interestKey": "hotpot",
  "interestLabel": "火锅",
  "enthusiasmLevel": 4,
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

## How Matching Uses the Signal (MVP)

Signal data is consumed in two places, both as a **soft enhancer** with no hard-filter behaviour:

### 1. Match Explanation — `findConnectionPoints()` in `matchExplanationService.ts`

When generating pair explanations, the function checks if two members share the same `interestKey` in their signals:

- **Same `discussionStyle`**: generates a connection point like `「美食」同款聊法（随便聊聊）`
- **Similar `conversationDepth`** (diff ≤ 1): generates `「美食」话题深度相近`

These connection points appear in the "桌友分析" section on the event detail page.

### 2. Icebreaker Generation — `generateIceBreakers()` in `matchExplanationService.ts`

When generating group icebreaker topics, the prompt is enriched with aligned signal data:

> 兴趣偏好信号（成员自填）: 美食（随便聊聊，深度2/3）；动漫（剧情/世界观，深度3/3）

This gives the AI more targeted context to generate specific opening questions when participants share interests with similar styles.

### 3. Conversation Topics — `generateConversationTopics()` in `conversationTopicsService.ts`

The `ParticipantProfile` interface is extended with `interestSignals?`. When provided, aligned signals across participants are included in the AI prompt for richer topic suggestions.

---

## MVP Scope

### Included
- Schema migration (`user_interest_signals` table)
- Typed server routes (POST/GET)
- Optional client UI (bottom sheet, 3 questions)
- Integration with match explanation connection points
- Integration with icebreaker topic generation prompt
- Documentation

### Explicitly Excluded (MVP guardrails)
- ❌ Image or audio recognition questions
- ❌ Copyrighted media of any kind (text-first only)
- ❌ Mandatory onboarding step or `nextStep` changes
- ❌ Hard matching filters based on signal
- ❌ Heavyweight question bank or quiz framework
- ❌ Moderation system

---

## UI Entry Point

The boost CTA appears in `SuccessCelebration` (shown after successful event pool registration) as an optional secondary button:

> **提升匹配质量（1分钟）** ✨

Clicking it opens `InterestSignalBoostSheet`, a 3-question flow:
1. 热情程度 (enthusiasm) — emoji scale 1–5
2. 聊天风格 (discussion style) — 5 options
3. 话题深度 (conversation depth) — 3 options

Copy is framed as a fun match-quality boost ("帮我们把你和更同频的人分到一起"), never as a gatekeeping test.

---

## Extending the Feature Later

- Add more discussion styles per interest category (e.g. food-specific vs. anime-specific styles)
- Use `enthusiasmLevel` as a soft scoring bonus in `poolMatchingService.ts` (pair score boost when both users have high enthusiasm for the same interest)
- Add freshness decay (down-weight signals older than 90 days)
- Surface the boost CTA on more pre-match surfaces (profile page, blind-box payment flow)
- Allow multiple interests to be calibrated in one session
