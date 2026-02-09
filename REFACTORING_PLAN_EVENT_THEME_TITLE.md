# Event Theme Title Refactoring Plan

**Author**: Principal Software Engineer  
**Date**: 2024  
**Status**: READY FOR REVIEW  
**Risk Level**: MEDIUM (Breaking WebSocket contract)

---

## Executive Summary

**Objective**: Rename "team name" terminology to "event theme title" (盲盒主题) across the entire JoyJoin codebase to align product direction with existing database schema.

**Scope**: 
- 2 server service files (rename + refactor)
- 1 shared WebSocket events file (breaking change)
- 8+ client component files
- 1 test file
- Multiple documentation files

**Migration Strategy**: **Atomic Bottom-Up** (Single PR, comprehensive TypeScript compilation validation)

**Estimated Effort**: 4-6 hours

**Rollback Strategy**: Single git revert of the atomic commit

---

## 📊 Current State Analysis

### ✅ Database Schema (ALREADY ALIGNED)
```typescript
// packages/shared/src/schema.ts (Lines 443-449)
export const eventPoolGroups = pgTable("event_pool_groups", {
  theme: varchar("theme", { length: 50 }),          // ✅ Already using new naming
  subtitle: varchar("subtitle", { length: 80 }),    // ✅
  themeEmoji: varchar("theme_emoji", { length: 10 }), // ✅
  vibe: varchar("vibe", { length: 30 }),           // ✅
  themeReasoning: text("theme_reasoning"),         // ✅
  themeGeneratedAt: timestamp("theme_generated_at"), // ✅
});
```

### ❌ Service Layer (INCONSISTENT)

**File 1**: `/apps/server/src/teamNameGenerator.ts` (AI-powered)
- **Interface**: `TeamNameResult` with `teamName`, `teamTagline`, `teamEmoji`
- **Function**: `generateAndAssignTeamName()`
- **Database Update**: Uses OLD field names but writes to NEW schema fields
- **Impedance Mismatch**: HIGH

**File 2**: `/apps/server/src/services/teamNameGenerator.ts` (Rule-based)
- **Interface**: `TeamNameResult` with `teamName`, `teamTagline`, `emoji`
- **Function**: `generateTeamName()`
- **Usage**: Test file only (dead code in production)
- **Impedance Mismatch**: HIGH

### ❌ WebSocket Events (CLIENT-SERVER CONTRACT)

```typescript
// packages/shared/src/wsEvents.ts (Lines 11, 121-130)
export type WSEventType = 
  | "TEAM_NAME_REVEALED"  // ❌ Legacy naming
  // ...

export interface TeamNameRevealedData {  // ❌ Legacy naming
  poolId: string;
  groupId: string;
  teamName: string;      // ❌
  teamTagline: string;   // ❌
  teamEmoji: string;     // ❌
  teamSuperpowers: string[];
  teamVibe: 'playful' | 'professional' | 'creative' | 'adventurous';
}
```

**Impact**: Breaking change - must update both client AND server atomically

### ❌ Client Components (8 FILES)

| File | Uses TeamName | Priority |
|------|---------------|----------|
| `EventsPage.tsx` | ✅ (imports, state) | HIGH |
| `TeamNameReveal.tsx` | ✅ (props, UI) | HIGH |
| `PoolStatusSection.tsx` | ✅ (display) | MEDIUM |
| `EventPoolDetailDrawer.tsx` | ✅ (display) | MEDIUM |
| `PoolRegistrationCard.tsx` | ✅ (display) | LOW |
| `InteractiveTeamBubbles.tsx` | ✅ (display) | LOW |
| `FloatingTeamTags.tsx` | ✅ (display) | LOW |
| `AmbientFloatingTags.tsx` | ✅ (display) | LOW |

---

## 🎯 Naming Convention Decision

### **CHOICE: Option A - Schema Alignment** ✅

**Rationale**:
1. **Single Source of Truth**: Database schema is authoritative
2. **No Impedance Mismatch**: Direct ORM field mapping
3. **Cognitive Load**: No mental translation needed
4. **Maintainability**: Future developers see consistent naming
5. **Performance**: Cleaner Drizzle ORM queries

### **Mapping Table**

| Legacy Name | New Name | DB Column | Notes |
|-------------|----------|-----------|-------|
| `teamName` | `theme` | `theme` | Main event theme title |
| `teamTagline` | `subtitle` | `subtitle` | Secondary descriptor |
| `teamEmoji` | `themeEmoji` | `theme_emoji` | Single emoji character |
| `teamSuperpowers` | `themeTags` | *(not stored)* | Runtime-only array |
| `teamVibe` | `vibe` | `vibe` | Enum: playful/professional/creative/adventurous |
| `TEAM_NAME_REVEALED` | `EVENT_THEME_REVEALED` | N/A | WebSocket event type |
| `TeamNameRevealedData` | `EventThemeRevealedData` | N/A | WebSocket payload interface |

---

## 📋 Implementation Plan (7 Phases)

### **Phase 1: WebSocket Events & Shared Types** ⚠️ BREAKING CHANGE

**Files**:
- `packages/shared/src/wsEvents.ts`

**Changes**:
1. Rename event type: `TEAM_NAME_REVEALED` → `EVENT_THEME_REVEALED`
2. Rename interface: `TeamNameRevealedData` → `EventThemeRevealedData`
3. Update interface fields:
   ```typescript
   export interface EventThemeRevealedData {
     poolId: string;
     groupId: string;
     theme: string;           // was: teamName
     subtitle: string;        // was: teamTagline
     themeEmoji: string;      // was: teamEmoji
     themeTags: string[];     // was: teamSuperpowers
     vibe: 'playful' | 'professional' | 'creative' | 'adventurous';
   }
   ```

**Risk**: HIGH - Breaks client-server contract if deployed incrementally  
**Mitigation**: Atomic deployment with feature flag

---

### **Phase 2: Server Services - AI Generator**

**Files**:
- `apps/server/src/teamNameGenerator.ts` → `apps/server/src/eventThemeGenerator.ts`

**Changes**:
1. **Rename file** (preserves git history with `git mv`)
2. **Rename exports**:
   - `TeamNameResult` → `EventThemeResult`
   - `TeamNameContext` → `EventThemeContext`
   - `generateAndAssignTeamName()` → `generateAndAssignEventTheme()`
   - `generateTeamNameWithAI()` → `generateEventThemeWithAI()`
   - `generateFallbackTeamName()` → `generateFallbackEventTheme()`
3. **Update interface fields** to match schema:
   ```typescript
   export interface EventThemeResult {
     theme: string;
     subtitle: string;
     themeEmoji: string;
     themeTags: string[];
     vibe: 'playful' | 'professional' | 'creative' | 'adventurous';
   }
   ```
4. **Update database writes** (Lines 129-137):
   ```typescript
   await db.update(eventPoolGroups)
     .set({
       theme: result.theme,           // was: teamName
       subtitle: result.subtitle,     // was: teamTagline (WRONG!)
       themeEmoji: result.themeEmoji, // was: teamEmoji (WRONG!)
       // themeTags not stored in DB
       vibe: result.vibe,
       updatedAt: new Date()
     })
     .where(eq(eventPoolGroups.id, groupId));
   ```
5. **Update AI prompt** (Lines 328-356) to reflect new terminology
6. **Update content validation** logic
7. **Update environment variable naming**: 
   - `ENABLE_TEAM_NAME_GENERATION` → `ENABLE_EVENT_THEME_GENERATION`

**Risk**: MEDIUM  
**Testing**: Unit tests + integration tests

---

### **Phase 3: Server Services - Rule-Based Generator**

**Files**:
- `apps/server/src/services/teamNameGenerator.ts` → `apps/server/src/services/eventThemeGenerator.ts`

**Changes**:
1. **Rename file**
2. **Rename exports**:
   - `TeamNameResult` → `EventThemeResult`
   - `generateTeamName()` → `generateEventTheme()`
3. **Update interface fields** (Lines 100-113)
4. **Update return object** (Lines 427-440)
5. **Update comments and documentation**

**Risk**: LOW (Only used in tests)

---

### **Phase 4: Server Integration Layer**

**Files**:
- `apps/server/src/poolMatchingService.ts`

**Changes**:
1. **Update import** (Line 1000):
   ```typescript
   const { generateAndAssignEventTheme } = await import('./eventThemeGenerator');
   ```
2. **Rename function call** (Line 1019):
   ```typescript
   const themeResult = await generateAndAssignEventTheme(
     groupId,
     group,
     pool?.eventType || "饭局"
   );
   ```
3. **Update WebSocket broadcast** (Lines 1026-1043):
   ```typescript
   wsService.broadcastToUser(userId, {
     type: "EVENT_THEME_REVEALED",
     data: {
       poolId,
       groupId,
       theme: themeResult.theme,
       subtitle: themeResult.subtitle,
       themeEmoji: themeResult.themeEmoji,
       themeTags: themeResult.themeTags,
       vibe: themeResult.vibe
     },
     timestamp: new Date().toISOString()
   });
   ```
4. **Update console logs** (Line 1045)

**Risk**: MEDIUM  
**Dependencies**: Phase 1, 2

---

### **Phase 5: Client Components**

**Priority Order**: EventsPage → TeamNameReveal → Others

#### **5.1 EventsPage.tsx** (HIGH PRIORITY)

**Lines to update**:
- Line 19: Import `EventThemeRevealedData` instead of `TeamNameRevealedData`
- Line 79: State type `const [themeData, setThemeData] = useState<EventThemeRevealedData | null>(null);`
- Line 133: Event subscription `subscribe('EVENT_THEME_REVEALED', ...)`
- Line 136: Type cast `const themeData = message.data as EventThemeRevealedData;`
- All references to `teamData` → `themeData`
- All references to `teamNameData` → `themeData`

#### **5.2 TeamNameReveal.tsx → EventThemeReveal.tsx** (HIGH PRIORITY)

**Changes**:
1. **Rename file** and **component**
2. **Rename props interface**:
   ```typescript
   interface EventThemeRevealProps {
     isVisible: boolean;
     theme: string;
     subtitle: string;
     themeEmoji: string;
     themeTags: string[];
     vibe: 'playful' | 'professional' | 'creative' | 'adventurous';
     onClose: () => void;
   }
   ```
3. **Update all prop destructuring** (Line 45-53)
4. **Update all JSX references** (Lines 206, 217, 227, 239-249)
5. **Update Chinese copy** (Line 132): "小悦正在为你们的活动创造专属主题..."

#### **5.3 Other Client Components** (MEDIUM/LOW PRIORITY)

Apply similar renaming pattern to:
- `PoolStatusSection.tsx`
- `EventPoolDetailDrawer.tsx`
- `PoolRegistrationCard.tsx`
- `InteractiveTeamBubbles.tsx`
- `FloatingTeamTags.tsx`
- `AmbientFloatingTags.tsx`

**Risk**: LOW (UI-only changes)

---

### **Phase 6: Tests**

**Files**:
- `apps/server/src/__tests__/teamNameGenerator.test.ts` → `eventThemeGenerator.test.ts`

**Changes**:
1. **Rename file**
2. **Update imports** (Lines 7-8):
   ```typescript
   import { calculateGroupStats } from '../services/eventThemeGenerator';
   import type { EnrichedMemberProfile } from '../services/eventThemeGenerator';
   ```
3. **Update test descriptions**
4. **Update assertion field names**

**Risk**: LOW  
**Validation**: Run `npm test` after changes

---

### **Phase 7: Documentation**

**Files to update**:
- `TEAM_NAME_GENERATOR_IMPLEMENTATION.md` → `EVENT_THEME_GENERATOR_IMPLEMENTATION.md`
- `DEVELOPER_QUICK_REFERENCE.md`
- `PRODUCT_REQUIREMENTS.md`
- Any other doc references

**Changes**:
- Global find-replace of "team name" → "event theme"
- Update terminology to "盲盒主题" where appropriate
- Update code examples

---

## ⚠️ Risk Assessment & Mitigation

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **WebSocket contract break** | HIGH | HIGH | Atomic deployment, feature flag, rollback plan |
| **Database field mismatch** | MEDIUM | LOW | Schema already aligned; validate with migration |
| **Client-server desync** | HIGH | MEDIUM | Comprehensive E2E testing before deploy |
| **Type compilation errors** | LOW | LOW | TypeScript catches all references |
| **Missed references in comments** | LOW | MEDIUM | Manual code review + grep validation |

---

## 🧪 Testing Strategy

### **Pre-Deployment Validation**

1. **TypeScript Compilation**: `npm run build` (all workspaces)
2. **Unit Tests**: `npm test` (focus on service layer)
3. **Integration Tests**: Test WebSocket event flow
4. **E2E Tests**: 
   - User registers for event pool
   - Match completes
   - Verify EVENT_THEME_REVEALED received
   - Verify UI displays new theme correctly
5. **Manual QA**: Test on staging with real DeepSeek API

### **Post-Deployment Monitoring**

1. **WebSocket Event Logs**: Monitor for `EVENT_THEME_REVEALED` events
2. **Error Tracking**: Watch for client-side errors related to undefined fields
3. **Database Queries**: Verify `theme`, `subtitle`, `themeEmoji` populated correctly
4. **Rollback Trigger**: >5% error rate on theme-related features

---

## 🚀 Deployment Strategy

### **Option A: Atomic Single-PR Deployment** ✅ RECOMMENDED

**Steps**:
1. Create feature branch: `refactor/event-theme-title`
2. Apply ALL 7 phases in sequential commits
3. Run full test suite
4. Single PR review
5. Deploy to staging → production (atomic)
6. Monitor for 24 hours

**Pros**:
- No intermediate broken state
- Single rollback point
- TypeScript enforces completeness

**Cons**:
- Large PR (harder to review)
- Requires coordination for deployment

### **Option B: Feature Flag + Gradual Migration** (NOT RECOMMENDED)

**Why not recommended**:
- Complexity: Dual codepaths for old/new naming
- Technical Debt: Temporary abstraction layer
- Risk: Leaky abstraction, missed cleanup

---

## 📝 Implementation Checklist

- [ ] **Phase 1**: Update WebSocket events in `wsEvents.ts`
- [ ] **Phase 2**: Rename and refactor `teamNameGenerator.ts` → `eventThemeGenerator.ts`
- [ ] **Phase 3**: Rename and refactor `services/teamNameGenerator.ts`
- [ ] **Phase 4**: Update `poolMatchingService.ts` integration
- [ ] **Phase 5.1**: Update `EventsPage.tsx`
- [ ] **Phase 5.2**: Rename `TeamNameReveal.tsx` → `EventThemeReveal.tsx`
- [ ] **Phase 5.3**: Update 6 other client components
- [ ] **Phase 6**: Update test files
- [ ] **Phase 7**: Update documentation
- [ ] **Validation**: TypeScript compilation passes
- [ ] **Validation**: All tests pass
- [ ] **Validation**: Manual E2E test on staging
- [ ] **Deployment**: Deploy to production
- [ ] **Monitoring**: 24-hour error rate check

---

## 🔄 Rollback Plan

### **If Issues Detected**:

1. **Immediate**: Revert PR with `git revert <commit-sha>`
2. **Deploy**: Rollback to previous version
3. **Investigate**: Root cause analysis
4. **Fix**: Address issues in new feature branch
5. **Re-deploy**: After validation

### **Rollback Triggers**:

- Client error rate >5% on event pool pages
- WebSocket disconnection rate >10%
- Database write failures on theme fields
- User complaints about missing team names

---

## 💡 Recommendations

### **DO**:
✅ Use `git mv` for file renames (preserves history)  
✅ Run TypeScript compiler after each phase  
✅ Update tests incrementally with service changes  
✅ Keep PR commits logical and sequential  
✅ Add comprehensive PR description with before/after examples  
✅ Test WebSocket events with real client connections  

### **DON'T**:
❌ Deploy backend before frontend (breaks contract)  
❌ Use global find-replace without validation  
❌ Skip E2E testing  
❌ Forget to update environment variables  
❌ Ignore linter warnings  

---

## 📚 Reference Links

- **Database Schema**: `packages/shared/src/schema.ts:425-462`
- **WebSocket Events**: `packages/shared/src/wsEvents.ts:1-320`
- **AI Generator**: `apps/server/src/teamNameGenerator.ts`
- **Rule-based Generator**: `apps/server/src/services/teamNameGenerator.ts`
- **Pool Matching Integration**: `apps/server/src/poolMatchingService.ts:1000-1050`

---

## 🎯 Success Criteria

✅ Zero TypeScript compilation errors  
✅ All tests passing (unit + integration)  
✅ WebSocket events transmitted successfully  
✅ Database writes using correct field names  
✅ Client UI displays event themes correctly  
✅ No production errors >24 hours post-deploy  
✅ Documentation updated and consistent  

---

**End of Refactoring Plan**

_Questions? Contact the principal engineer for architectural guidance._
