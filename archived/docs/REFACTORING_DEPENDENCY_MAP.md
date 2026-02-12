# Event Theme Title Refactoring - Dependency Map

## 🏗️ Layered Architecture View

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│                         (Client React)                          │
├─────────────────────────────────────────────────────────────────┤
│  EventsPage.tsx              TeamNameReveal.tsx                 │
│    ↓ subscribes to              ↓ renders                       │
│  EVENT_THEME_REVEALED        theme UI component                 │
│                                                                  │
│  Other Components:                                              │
│  - PoolStatusSection.tsx                                        │
│  - EventPoolDetailDrawer.tsx                                    │
│  - PoolRegistrationCard.tsx                                     │
│  - InteractiveTeamBubbles.tsx                                   │
│  - FloatingTeamTags.tsx                                         │
│  - AmbientFloatingTags.tsx                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ WebSocket
                              │ (EVENT_THEME_REVEALED)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         CONTRACT LAYER                          │
│                    (Shared Type Definitions)                    │
├─────────────────────────────────────────────────────────────────┤
│  packages/shared/src/wsEvents.ts                                │
│                                                                  │
│  export type WSEventType = "EVENT_THEME_REVEALED" | ...         │
│                                                                  │
│  export interface EventThemeRevealedData {                      │
│    poolId: string;                                              │
│    groupId: string;                                             │
│    theme: string;              // Main title                    │
│    subtitle: string;           // Tagline                       │
│    themeEmoji: string;         // Single emoji                  │
│    themeTags: string[];        // Superpowers/tags              │
│    vibe: 'playful' | ...;      // Vibe enum                     │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ imports
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                        │
│                         (Server Logic)                          │
├─────────────────────────────────────────────────────────────────┤
│  apps/server/src/poolMatchingService.ts                         │
│    │                                                             │
│    ├─> import { generateAndAssignEventTheme }                   │
│    │    from './eventThemeGenerator'                            │
│    │                                                             │
│    └─> wsService.broadcastToUser(userId, {                      │
│         type: "EVENT_THEME_REVEALED",                           │
│         data: {                                                 │
│           theme: result.theme,                                  │
│           subtitle: result.subtitle,                            │
│           ...                                                   │
│         }                                                       │
│       })                                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ calls
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         SERVICE LAYER                           │
│                    (Business Logic / AI)                        │
├─────────────────────────────────────────────────────────────────┤
│  apps/server/src/eventThemeGenerator.ts (AI-powered)            │
│    │                                                             │
│    ├─> export interface EventThemeResult {                      │
│    │     theme: string;                                         │
│    │     subtitle: string;                                      │
│    │     themeEmoji: string;                                    │
│    │     themeTags: string[];                                   │
│    │     vibe: 'playful' | ...;                                 │
│    │   }                                                         │
│    │                                                             │
│    ├─> generateAndAssignEventTheme()                            │
│    │     ├─> generateEventThemeWithAI() (DeepSeek)              │
│    │     └─> generateFallbackEventTheme() (Templates)           │
│    │                                                             │
│    └─> db.update(eventPoolGroups).set({                         │
│          theme: result.theme,                                   │
│          subtitle: result.subtitle,                             │
│          ...                                                    │
│        })                                                       │
│                                                                  │
│  apps/server/src/services/eventThemeGenerator.ts (Rule-based)   │
│    └─> generateEventTheme() [Used in tests only]               │
└─────────────────────────────────────────────────────────────────┘
                              ↑
                              │ writes to
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│                    (Database Schema - Drizzle ORM)              │
├─────────────────────────────────────────────────────────────────┤
│  packages/shared/src/schema.ts                                  │
│                                                                  │
│  export const eventPoolGroups = pgTable({                       │
│    id: varchar("id").primaryKey(),                              │
│    poolId: varchar("pool_id"),                                  │
│    ...                                                           │
│    // ✅ Event Theme Fields (ALREADY USING NEW NAMING)          │
│    theme: varchar("theme", { length: 50 }),                     │
│    subtitle: varchar("subtitle", { length: 80 }),               │
│    themeEmoji: varchar("theme_emoji", { length: 10 }),          │
│    vibe: varchar("vibe", { length: 30 }),                       │
│    themeReasoning: text("theme_reasoning"),                     │
│    themeGeneratedAt: timestamp("theme_generated_at"),           │
│  });                                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                        │
│                   (event_pool_groups table)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
┌──────────────┐
│ Pool Matching│
│  Algorithm   │
└──────┬───────┘
       │ 1. Group formed
       ↓
┌─────────────────────────────┐
│ poolMatchingService.ts      │
│                             │
│ - Calls:                    │
│   generateAndAssignEvent    │
│   Theme(groupId, group)     │
└──────┬──────────────────────┘
       │ 2. Generate theme
       ↓
┌─────────────────────────────┐
│ eventThemeGenerator.ts      │
│                             │
│ - Try: AI generation        │
│   (DeepSeek API)            │
│ - Fallback: Templates       │
│ - Validate result           │
└──────┬──────────────────────┘
       │ 3. Write to DB
       ↓
┌─────────────────────────────┐
│ PostgreSQL (Drizzle ORM)    │
│                             │
│ UPDATE event_pool_groups    │
│   SET theme = ?             │
│       subtitle = ?          │
│       theme_emoji = ?       │
│       vibe = ?              │
│   WHERE id = ?              │
└──────┬──────────────────────┘
       │ 4. Broadcast event
       ↓
┌─────────────────────────────┐
│ WebSocket Service           │
│                             │
│ wsService.broadcastToUser(  │
│   userId,                   │
│   {                         │
│     type: "EVENT_THEME_     │
│            REVEALED",       │
│     data: {                 │
│       theme: "...",         │
│       subtitle: "...",      │
│       ...                   │
│     }                       │
│   }                         │
│ )                           │
└──────┬──────────────────────┘
       │ 5. Send to client
       ↓
┌─────────────────────────────┐
│ Client WebSocket Handler    │
│ (EventsPage.tsx)            │
│                             │
│ subscribe(                  │
│   'EVENT_THEME_REVEALED',   │
│   (message) => {            │
│     setThemeData(           │
│       message.data          │
│     )                       │
│   }                         │
│ )                           │
└──────┬──────────────────────┘
       │ 6. Update UI state
       ↓
┌─────────────────────────────┐
│ EventThemeReveal.tsx        │
│                             │
│ - Display theme             │
│ - Display subtitle          │
│ - Display themeEmoji        │
│ - Display themeTags         │
│ - Apply vibe styling        │
└─────────────────────────────┘
       │ 7. User sees theme
       ↓
    [User UI]
```

---

## 🎯 Migration Dependency Order

### **Critical Path** (Must be done in order):

```
1. ✅ Database Schema (ALREADY DONE)
   └─> No changes needed

2. WebSocket Events (BREAKING CHANGE)
   └─> packages/shared/src/wsEvents.ts
       ├─> Rename: TEAM_NAME_REVEALED → EVENT_THEME_REVEALED
       └─> Rename: TeamNameRevealedData → EventThemeRevealedData

3. Server Services
   ├─> apps/server/src/eventThemeGenerator.ts (rename from teamNameGenerator.ts)
   │   ├─> Rename: TeamNameResult → EventThemeResult
   │   ├─> Rename: generateAndAssignTeamName → generateAndAssignEventTheme
   │   └─> Update: DB field mapping (teamName → theme, etc.)
   │
   └─> apps/server/src/services/eventThemeGenerator.ts (tests only)
       └─> Same renames as above

4. Server Integration
   └─> apps/server/src/poolMatchingService.ts
       ├─> Update import path
       ├─> Update function call
       └─> Update WebSocket broadcast

5. Client Components (Can be done in parallel)
   ├─> EventsPage.tsx (HIGH priority - event handler)
   ├─> EventThemeReveal.tsx (HIGH priority - UI component)
   └─> Other components (MEDIUM/LOW priority - display only)

6. Tests
   └─> apps/server/src/__tests__/eventThemeGenerator.test.ts

7. Documentation
   └─> All .md files with "team name" references
```

### **Parallel Branches** (Can be done simultaneously after Phase 2):

```
Branch A: Server Layer
├─> Phase 3: Service files
├─> Phase 4: poolMatchingService
└─> Phase 6: Tests

Branch B: Client Layer
├─> Phase 5.1: EventsPage
├─> Phase 5.2: EventThemeReveal
└─> Phase 5.3: Other components

Branch C: Documentation
└─> Phase 7: All docs

⚠️ MUST MERGE: Before deployment, all branches must be merged
```

---

## ⚠️ Breaking Change Impact Analysis

### **WebSocket Event Rename**

| Component | Impact | Mitigation |
|-----------|--------|------------|
| **Server sends**: `TEAM_NAME_REVEALED` | OLD clients won't recognize event | Feature flag during transition |
| **Client subscribes**: `TEAM_NAME_REVEALED` | NEW server won't send old event | Atomic deployment required |
| **Data fields**: `teamName`, `teamTagline` | Field mismatch causes undefined errors | TypeScript catches at compile time |

### **Deployment Scenarios**

❌ **UNSAFE: Deploy server first**
```
Server sends: EVENT_THEME_REVEALED
Client expects: TEAM_NAME_REVEALED
Result: ❌ Event not handled, UI broken
```

❌ **UNSAFE: Deploy client first**
```
Server sends: TEAM_NAME_REVEALED
Client expects: EVENT_THEME_REVEALED
Result: ❌ Event not handled, UI broken
```

✅ **SAFE: Atomic deployment**
```
Deploy server + client simultaneously
Result: ✅ Contract maintained
```

---

## 🧪 Testing Checkpoints

### **Phase 1 Validation** (After wsEvents.ts)
```bash
# TypeScript compilation
cd packages/shared && npm run build

# Expected: ✅ Compiles successfully
# Expected: ❌ Server/client show type errors (expected, proceed to next phase)
```

### **Phase 2-4 Validation** (After server changes)
```bash
# Server compilation
cd apps/server && npm run build

# Unit tests
npm test teamNameGenerator  # Should fail (file renamed)
npm test eventThemeGenerator  # Should pass after Phase 6

# Integration test (manual)
# 1. Start server
# 2. Trigger pool matching
# 3. Check console logs for "EVENT_THEME_REVEALED"
# 4. Check database for populated theme fields
```

### **Phase 5 Validation** (After client changes)
```bash
# Client compilation
cd apps/user-client && npm run build

# E2E test (manual)
# 1. Register for event pool
# 2. Wait for match
# 3. Verify EventThemeReveal modal appears
# 4. Verify theme/subtitle/emoji display correctly
```

### **Full System Validation**
```bash
# Run all tests
npm run test --workspaces

# Build all packages
npm run build --workspaces

# Expected: ✅ Zero TypeScript errors
# Expected: ✅ All tests pass
```

---

## 📊 File Impact Summary

| Layer | Files Changed | Lines Changed | Risk |
|-------|---------------|---------------|------|
| Shared Types | 1 | ~30 | HIGH (breaking) |
| Server Services | 2 | ~150 | MEDIUM |
| Server Integration | 1 | ~25 | MEDIUM |
| Client Components | 8 | ~200 | LOW-MEDIUM |
| Tests | 1 | ~50 | LOW |
| Documentation | 5+ | ~100 | LOW |
| **TOTAL** | **18+** | **~555** | **MEDIUM** |

---

## 🚀 Recommended Workflow

### **Single Developer** (You)
1. Create branch: `refactor/event-theme-title`
2. Execute phases 1-7 sequentially
3. Commit after each phase with clear messages
4. Run full test suite
5. Create PR with this plan as description
6. Self-review or peer review
7. Deploy to staging → production

### **Team of Developers** (Parallel)
1. **Dev A**: Phases 1-4 (Backend)
2. **Dev B**: Phase 5 (Frontend)
3. **Dev C**: Phases 6-7 (Tests + Docs)
4. Sync point: All devs merge to feature branch
5. Final validation together
6. Deploy atomically

---

**End of Dependency Map**
