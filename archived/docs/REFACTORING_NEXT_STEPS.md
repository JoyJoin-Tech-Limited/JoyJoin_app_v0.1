# Event Theme Title Refactoring - Next Steps

**Status**: Ready to Execute  
**Recommended Approach**: Atomic Bottom-Up Migration  
**Timeline**: 4-6 hours (single developer)

---

## 📋 Quick Decision Summary

### ✅ **What We Decided**

1. **Migration Strategy**: Atomic (all changes in single PR)
2. **Naming Convention**: Align with database schema (`theme`, `subtitle`, `themeEmoji`)
3. **Deployment**: Single atomic deployment (no feature flags needed)
4. **File Renames**: Use `git mv` to preserve history

### ❌ **What We're NOT Doing**

- ❌ Gradual migration with dual codepaths
- ❌ Backward compatibility layer
- ❌ Database schema changes (already aligned!)
- ❌ Incremental backend-first or frontend-first deploys

---

## 🚀 Immediate Next Steps

### **Step 1: Create Feature Branch**
```bash
cd /home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1
git checkout -b refactor/event-theme-title
```

### **Step 2: Execute Migration (In Order)**

#### **2.1 Update WebSocket Events** ⚠️ BREAKING CHANGE
```bash
# File: packages/shared/src/wsEvents.ts
# Changes:
# - Line 11: "TEAM_NAME_REVEALED" → "EVENT_THEME_REVEALED"
# - Lines 122-130: TeamNameRevealedData → EventThemeRevealedData
# - Update fields: teamName → theme, teamTagline → subtitle, teamEmoji → themeEmoji, teamSuperpowers → themeTags
```

**Commit**: `git commit -m "refactor: rename TEAM_NAME_REVEALED to EVENT_THEME_REVEALED"`

---

#### **2.2 Rename & Refactor AI Generator Service**
```bash
# Rename file (preserves git history)
cd apps/server/src
git mv teamNameGenerator.ts eventThemeGenerator.ts

# Edit eventThemeGenerator.ts:
# - Rename TeamNameResult → EventThemeResult
# - Rename TeamNameContext → EventThemeContext
# - Rename generateAndAssignTeamName → generateAndAssignEventTheme
# - Update interface fields to match schema (theme, subtitle, themeEmoji, themeTags)
# - Update database .set() calls (Lines 129-137)
# - Update AI prompt wording (Lines 328-356)
```

**Commit**: `git commit -m "refactor: rename teamNameGenerator to eventThemeGenerator with schema alignment"`

---

#### **2.3 Rename & Refactor Rule-Based Generator Service**
```bash
# Rename file
cd apps/server/src/services
git mv teamNameGenerator.ts eventThemeGenerator.ts

# Edit eventThemeGenerator.ts:
# - Same renames as 2.2
# - Update return object fields (Lines 427-440)
```

**Commit**: `git commit -m "refactor: rename services/teamNameGenerator to eventThemeGenerator"`

---

#### **2.4 Update Pool Matching Service Integration**
```bash
# File: apps/server/src/poolMatchingService.ts
# Changes:
# - Line 1000: import './teamNameGenerator' → './eventThemeGenerator'
# - Line 1000: generateAndAssignTeamName → generateAndAssignEventTheme
# - Line 1019: Update function call
# - Lines 1031-1039: Update WebSocket broadcast (type, data fields)
# - Line 1045: Update console log
```

**Commit**: `git commit -m "refactor: update poolMatchingService to use eventThemeGenerator"`

---

#### **2.5 Update Client - EventsPage**
```bash
# File: apps/user-client/src/pages/EventsPage.tsx
# Changes:
# - Line 19: Import EventThemeRevealedData instead of TeamNameRevealedData
# - Line 79: Rename state teamData → themeData
# - Line 133: subscribe('EVENT_THEME_REVEALED', ...)
# - Line 136: Type cast to EventThemeRevealedData
# - Update all references to use new field names
```

**Commit**: `git commit -m "refactor(client): update EventsPage to use EVENT_THEME_REVEALED"`

---

#### **2.6 Rename & Refactor Client - TeamNameReveal Component**
```bash
# Rename file
cd apps/user-client/src/components
git mv TeamNameReveal.tsx EventThemeReveal.tsx

# Edit EventThemeReveal.tsx:
# - Rename component: TeamNameReveal → EventThemeReveal
# - Rename props interface: TeamNameRevealProps → EventThemeRevealProps
# - Update prop fields: teamName → theme, teamTagline → subtitle, teamEmoji → themeEmoji, teamSuperpowers → themeTags
# - Update all prop destructuring (Line 45-53)
# - Update all JSX references
# - Update Chinese copy (Line 132): "队伍" → "活动"
```

**Commit**: `git commit -m "refactor(client): rename TeamNameReveal to EventThemeReveal"`

---

#### **2.7 Update Other Client Components**
```bash
# Files to update (same pattern as 2.6):
# - PoolStatusSection.tsx
# - EventPoolDetailDrawer.tsx
# - PoolRegistrationCard.tsx
# - InteractiveTeamBubbles.tsx
# - FloatingTeamTags.tsx
# - AmbientFloatingTags.tsx

# For each file:
# 1. Update imports to use EventThemeRevealedData
# 2. Update field references (teamName → theme, etc.)
# 3. Update component props if they accept theme data
```

**Commit**: `git commit -m "refactor(client): update remaining components for event theme terminology"`

---

#### **2.8 Update Tests**
```bash
# Rename test file
cd apps/server/src/__tests__
git mv teamNameGenerator.test.ts eventThemeGenerator.test.ts

# Edit eventThemeGenerator.test.ts:
# - Lines 7-8: Update import paths
# - Update all test descriptions
# - Update assertion field names to match new schema
```

**Commit**: `git commit -m "test: rename and update teamNameGenerator tests"`

---

#### **2.9 Update Documentation**
```bash
# Rename documentation file
git mv TEAM_NAME_GENERATOR_IMPLEMENTATION.md EVENT_THEME_GENERATOR_IMPLEMENTATION.md

# Update references in:
# - DEVELOPER_QUICK_REFERENCE.md
# - PRODUCT_REQUIREMENTS.md
# - Any other files with "team name" → "event theme"

# Use global search:
grep -r "team name" --include="*.md" .
grep -r "TeamName" --include="*.md" .
```

**Commit**: `git commit -m "docs: update terminology from team name to event theme"`

---

### **Step 3: Validation**

#### **3.1 TypeScript Compilation**
```bash
# Build all workspaces
npm run build --workspaces

# Expected: ✅ Zero TypeScript errors
# If errors: Review and fix, repeat until clean
```

#### **3.2 Run Tests**
```bash
# Run all tests
npm run test --workspaces

# Expected: ✅ All tests pass
# Focus on: eventThemeGenerator.test.ts
```

#### **3.3 Linter Check**
```bash
npm run lint --workspaces

# Fix any linter warnings
```

---

### **Step 4: Manual Testing (Critical!)**

#### **4.1 Start Development Server**
```bash
# Terminal 1: Start backend
cd apps/server
npm run dev

# Terminal 2: Start frontend
cd apps/user-client
npm run dev
```

#### **4.2 E2E Test Scenario**
```
1. Navigate to event pools page
2. Register for an active event pool
3. Wait for pool matching to complete (or trigger manually if admin)
4. ✅ Verify: WebSocket event "EVENT_THEME_REVEALED" received (check browser console)
5. ✅ Verify: EventThemeReveal modal appears
6. ✅ Verify: theme, subtitle, themeEmoji display correctly
7. ✅ Verify: themeTags render as badges
8. ✅ Verify: vibe styling applied correctly
9. ✅ Verify: Database shows populated theme fields (check Prisma Studio or pgAdmin)
```

#### **4.3 WebSocket Event Inspection**
```javascript
// In browser console, subscribe to all WebSocket events:
window.wsDebug = true;

// Should see:
// ← EVENT_THEME_REVEALED {
//     poolId: "...",
//     groupId: "...",
//     theme: "高能充电站联盟",
//     subtitle: "咖啡×创业的周末探险",
//     themeEmoji: "⚡",
//     themeTags: ["氛围担当", "破冰高手"],
//     vibe: "playful"
//   }
```

---

### **Step 5: Create Pull Request**

#### **5.1 Push Branch**
```bash
git push origin refactor/event-theme-title
```

#### **5.2 PR Description Template**
```markdown
## 🎯 Objective
Refactor "team name" terminology to "event theme title" (盲盒主题) to align with product direction and database schema.

## 📊 Changes Summary
- **Files Changed**: 18+
- **Lines Changed**: ~555
- **Breaking Changes**: WebSocket event renamed (TEAM_NAME_REVEALED → EVENT_THEME_REVEALED)

## 🏗️ Architecture
- ✅ Database schema already aligned (no migration needed)
- ✅ Service layer refactored to match schema naming
- ✅ Client-server WebSocket contract updated atomically

## 🔄 Migration Strategy
Atomic bottom-up approach:
1. Shared types (breaking change)
2. Server services
3. Server integration
4. Client components
5. Tests
6. Documentation

## ✅ Validation
- [x] TypeScript compilation passes (all workspaces)
- [x] All tests pass
- [x] Linter clean
- [x] Manual E2E test on local dev
- [ ] Staging environment test (before merge)

## �� Screenshots
[Attach before/after screenshots of EventThemeReveal modal]

## 🚀 Deployment Plan
1. Deploy to staging
2. Run E2E tests
3. Monitor for 1 hour
4. Deploy to production (atomic backend + frontend)
5. Monitor WebSocket events for 24 hours

## 📚 Documentation
See:
- REFACTORING_PLAN_EVENT_THEME_TITLE.md
- REFACTORING_DEPENDENCY_MAP.md
- REFACTORING_NEXT_STEPS.md (this file)

## ⚠️ Rollback Plan
If issues detected:
1. `git revert <commit-sha>`
2. Redeploy previous version
3. Root cause analysis
```

---

## 🎯 Definition of Done

- [ ] All 7 phases completed
- [ ] Zero TypeScript compilation errors
- [ ] All automated tests passing
- [ ] Manual E2E test confirms:
  - [ ] WebSocket event received
  - [ ] UI displays theme correctly
  - [ ] Database fields populated
- [ ] Code review completed
- [ ] PR approved and merged
- [ ] Deployed to staging successfully
- [ ] Deployed to production successfully
- [ ] No production errors >24 hours post-deploy
- [ ] Documentation updated

---

## 📞 Support & Questions

If you encounter issues during migration:

1. **TypeScript Errors**: Review the dependency map for circular imports
2. **WebSocket Not Received**: Check server logs for broadcast calls
3. **Database Write Failures**: Verify field names match schema exactly
4. **Client UI Not Updating**: Check React DevTools for state updates

**Escalation**: Create GitHub issue with:
- Error message
- Steps to reproduce
- Expected vs actual behavior
- Relevant code snippets

---

## 🎓 Learning Opportunities

This refactoring demonstrates:

1. **Bottom-Up Migration**: Starting from database schema and working upward
2. **Breaking Change Management**: Atomic deployment to maintain contract integrity
3. **Type Safety**: Using TypeScript compiler to catch all references
4. **Git Best Practices**: Using `git mv` to preserve history
5. **Testing Strategy**: Comprehensive validation at each layer

**Key Takeaway**: When refactoring across layers, always align with the most stable layer (database schema) first.

---

**Good luck with the migration! You've got a solid plan.** 🚀

_Generated by Principal Software Engineer - Martin Fowler Mode_
