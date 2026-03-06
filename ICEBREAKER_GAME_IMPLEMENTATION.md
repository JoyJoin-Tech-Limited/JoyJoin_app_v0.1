# Revamped In-Event Icebreaker Card Game - Implementation Summary

## PR Title
Implement revamped in-event icebreaker game experience with AI-powered card generation

## Overview

> **Context (2026-03-06):** The IcebreakerCardGame described here is a **supporting deep-dive layer** that complements the Social Icebreaker (primary flow). It is NOT the primary in-event icebreaking experience. The primary flow is `IcebreakerSessionPage` / Social Icebreaker (`/icebreaker/:sessionId`). The Card Game (`/icebreaker-game`) is accessed as an optional deep-dive from within or after the Social Icebreaker warmup phase.
>
> The **IcebreakerToolkit** (pre-event game browser with 13 curated games) referenced in older docs is a **legacy tool** and should not be treated as the main icebreaking CTA.

This PR implements a complete card-based icebreaker game system for matched events, featuring AI-generated personalized cards, round-based progression, and a polished UI with ambient glow effects and bubble progress indicators.

## Key Features

### 🎴 Card Types
1. **Question Cards**: Conversation starters with AI-generated topics
2. **Vote Cards**: Quick polls with oversized tap targets and real-time results
3. **Mission Cards**: Group challenges with unlock conditions

### 🤖 AI-Powered Personalization
- **70% AI-generated cards** using DeepSeek API
- **30% curated fallback** cards from existing topic library
- Personalization inputs:
  - Six-dimension personality scores (A, C, E, O, X, P)
  - User archetypes and chemistry
  - Essential data (age, gender, education, industry, relationship status)
  - Extended data (interests, intent, conversation mode/energy)

### 🎮 Gameplay Mechanics
- **5 rounds** of 20 minutes each (90-120 minute total)
- **3 cards per round** with smart difficulty progression
- **Round-based unlocking**: New cards revealed each round
- **Offline-first conversation**: UI drives flow, actual discussion happens offline

### 🎨 UI/UX Enhancements

#### Phase 1 (MVP)
✅ Card transitions with elastic spring animations
✅ Low information density (topic + 1 hint + 1 action)
✅ Oversized tap targets for voting (min-h-[60px])
✅ AI recommendation reasons shown as chips/tags
✅ Smooth card navigation with indicators

#### Phase 2 (Polish)
✅ Ambient glow on new card unlock (pulsing gradient with blur)
✅ Soft glow + thin border styling
✅ Bubble/liquid-style round progress with checkmarks
✅ Animated vote results with progress bars

### 🔌 Integration Points

#### Entry/Activation
- **BottomNav "去参与" flow**: Accessible via center button
- **Event detail pages**: Button appears when event has started (client-side time check)
- **Supported event types**:
  - Blind box events (`/blind-box-events/:eventId`)
  - Pool group events (`/pool-groups/:groupId`)

#### Routes
```typescript
/icebreaker-game?eventId={eventId}
/icebreaker-game?groupId={groupId}
/icebreaker-game?sessionId={sessionId}
```

## Database Schema

### New Tables

#### `icebreaker_game_cards`
Stores generated cards with metadata:
- Card type, content, hint, category, difficulty
- Vote options and results (JSONB)
- Mission type and unlock conditions
- AI generation metadata (source, personalization data, recommend reason)
- Round number, display order, reveal status
- Interaction metrics (count, skip count)

#### `icebreaker_game_progress`
Tracks game session progress:
- Total rounds, round duration
- Current round, start/end times
- AI generation ratio, cards per round
- Round history (JSONB)

#### `icebreaker_card_interactions`
Records user interactions:
- Interaction type (view, vote, skip, reaction)
- Vote option selection
- Reaction emoji
- Timestamp

## API Endpoints

### Card Generation
```typescript
POST /api/icebreaker/game/generate-cards
Body: {
  sessionId?: string,
  eventId?: string,
  groupId?: string,
  roundNumber?: number,
  cardsCount?: number,
  aiRatio?: number
}
Response: {
  sessionId: string,
  cards: GameCard[],
  roundNumber: number,
  totalCards: number,
  aiGeneratedCount: number,
  curatedCount: number
}
```

### Fetch Cards
```typescript
GET /api/icebreaker/game/cards/:sessionId?roundNumber=1
Response: {
  cards: GameCard[]
}
```

### Record Interaction
```typescript
POST /api/icebreaker/game/interact
Body: {
  cardId: string,
  sessionId: string,
  interactionType: 'view' | 'vote' | 'skip' | 'reaction',
  voteOptionId?: string,
  reaction?: string
}
```

### Get Progress
```typescript
GET /api/icebreaker/game/progress/:sessionId
Response: GameProgress
```

## Frontend Components

### Core Components
- **`IcebreakerCardGame`**: Main game UI with card display and navigation
- **`BubbleProgress`**: Liquid-style round progress indicator
- **`useIcebreakerGame`**: Game state management hook

### Key Features
- **Automatic session creation**: Creates icebreaker session on first load
- **Real-time updates**: Uses React Query for data synchronization
- **Responsive animations**: Framer Motion for smooth transitions
- **Vote result animations**: Live vote counting with progress bars
- **Round progression**: Automatic round advancement with bubble indicators

## Technical Implementation

### Card Generation Service
Location: `apps/server/src/icebreakerCardGenerationService.ts`

Key functions:
- `generateAICards()`: DeepSeek API integration with personality prompts
- `getFallbackCards()`: Curated card selection from topic library
- `generateMixedCards()`: 70/30 AI/curated blend with shuffling

### State Management
Hook: `apps/user-client/src/hooks/useIcebreakerGame.ts`

Capabilities:
- Session initialization
- Card navigation (next, previous, goToCard)
- Interaction recording (vote, skip, reaction)
- Round time calculation
- Progress tracking

## Validation & Quality Checks

### Client-Side Validation
- ✅ Event start time check (only shows when event has started)
- ✅ Session existence check (creates new if needed)
- ✅ Card type validation (question, vote, mission)
- ✅ Vote option validation (prevents duplicate votes)

### Backend Validation
- ✅ User authentication (isPhoneAuthenticated)
- ✅ Card content validation (filters invalid AI responses)
- ✅ Fallback handling (graceful degradation to curated cards)
- ✅ Database constraint enforcement (foreign keys, unique constraints)

## Testing Recommendations

### Manual Testing
1. **New event start**: Verify button appears when event starts
2. **Card generation**: Check AI vs curated ratio
3. **Vote functionality**: Test voting and result display
4. **Round progression**: Verify bubble progress updates correctly
5. **Navigation**: Test card swiping and indicators
6. **Mission cards**: Verify unlock logic (if implemented)

### Automated Testing (Suggested)
- Unit tests for card generation service
- Integration tests for API endpoints
- E2E tests for user flow (TBD based on testing framework)

## Performance Considerations

### Optimization Strategies
- ✅ **Lazy card generation**: Cards generated on-demand per round
- ✅ **React Query caching**: 5-minute stale time for session data
- ✅ **Minimal re-renders**: Memoized callbacks and optimistic updates
- ✅ **Lightweight animations**: CSS transforms over layout changes

### Potential Bottlenecks
- ⚠️ **AI generation latency**: 1-3s per batch (mitigated by fallback)
- ⚠️ **Database writes**: Multiple inserts per round (acceptable for low volume)
- ⚠️ **WebSocket sync**: Not yet implemented (future enhancement)

## Future Enhancements

### Short-term
- [ ] Mission card unlock logic (group achievements)
- [ ] WebSocket real-time sync for group voting
- [ ] Card history view (previous rounds)
- [ ] Export/share favorite cards

### Medium-term
- [ ] AI card quality feedback (thumbs up/down)
- [ ] Custom card creation (user-generated)
- [ ] Multi-language support (EN/ZH)
- [ ] Accessibility improvements (screen readers, keyboard nav)

### Long-term
- [ ] Video/audio integration for remote events
- [ ] Advanced analytics (card engagement, conversation quality)
- [ ] Gamification (XP rewards for participation)
- [ ] AI coaching (real-time conversation prompts)

## Deployment Checklist

- [x] Database migrations applied (new tables created)
- [x] Environment variables verified (DEEPSEEK_API_KEY)
- [x] Frontend build successful
- [x] Backend build successful
- [ ] Manual QA testing completed
- [ ] Performance testing (load testing for AI generation)
- [ ] Security review (input validation, SQL injection prevention)
- [ ] Documentation updated
- [ ] Feature flag enabled (if applicable)

## Breaking Changes
None. This is a new feature with no impact on existing functionality.

## Related Issues
Closes: #[issue-number]

## Screenshots/Demo
[Add screenshots of the card game UI, bubble progress, and entry buttons]

## Contributors
- AI-assisted implementation via GitHub Copilot
- Co-authored-by: vinchanty1128 <241923892+vinchanty1128@users.noreply.github.com>

---

**Ready for Review**: ✅ All Phase 1 and Phase 2 requirements delivered
