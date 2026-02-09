# Event Theme Refactoring - Quick Reference Card

**📌 Pin this! Copy-paste ready commands for execution**

---

## ⚡ TL;DR

- **Strategy**: Atomic bottom-up migration
- **Naming**: Align with DB schema (`theme`, `subtitle`, `themeEmoji`)
- **Timeline**: 4-6 hours
- **Risk**: MEDIUM (breaking WebSocket contract, but TypeScript catches everything)

---

## 🚀 Quick Start (Copy-Paste Ready)

```bash
# 1. Create branch
cd /home/runner/work/JoyJoin_app_v0.1/JoyJoin_app_v0.1
git checkout -b refactor/event-theme-title

# 2. Verify current state
grep -n "TEAM_NAME_REVEALED" packages/shared/src/wsEvents.ts
grep -n "teamName:" apps/server/src/teamNameGenerator.ts

# 3. Start editing (see phases below)
```

---

## 📝 7-Phase Checklist

### Phase 1: WebSocket Events ⚠️ BREAKING
```bash
# Edit: packages/shared/src/wsEvents.ts
# Line 11:  "TEAM_NAME_REVEALED" → "EVENT_THEME_REVEALED"
# Lines 122-130: TeamNameRevealedData → EventThemeRevealedData
# Fields: teamName→theme, teamTagline→subtitle, teamEmoji→themeEmoji, teamSuperpowers→themeTags

git add packages/shared/src/wsEvents.ts
git commit -m "refactor: rename TEAM_NAME_REVEALED to EVENT_THEME_REVEALED"
```

### Phase 2: Server AI Generator
```bash
# Rename file
cd apps/server/src
git mv teamNameGenerator.ts eventThemeGenerator.ts

# Edit eventThemeGenerator.ts:
# - TeamNameResult → EventThemeResult
# - TeamNameContext → EventThemeContext
# - generateAndAssignTeamName → generateAndAssignEventTheme
# - Lines 129-137: Fix DB writes (teamName→theme, etc.)

git add eventThemeGenerator.ts
git commit -m "refactor: rename teamNameGenerator to eventThemeGenerator"
```

### Phase 3: Server Rule-Based Generator
```bash
# Rename file
cd apps/server/src/services
git mv teamNameGenerator.ts eventThemeGenerator.ts

# Edit eventThemeGenerator.ts:
# - Same renames as Phase 2

git add eventThemeGenerator.ts
git commit -m "refactor: rename services/teamNameGenerator"
```

### Phase 4: Pool Matching Integration
```bash
# Edit: apps/server/src/poolMatchingService.ts
# Line 1000: './teamNameGenerator' → './eventThemeGenerator'
# Line 1019: generateAndAssignTeamName → generateAndAssignEventTheme
# Lines 1031-1039: Update broadcast (EVENT_THEME_REVEALED, theme, subtitle)

git add apps/server/src/poolMatchingService.ts
git commit -m "refactor: update poolMatchingService integration"
```

### Phase 5: Client Components
```bash
# EventsPage.tsx
# - Import EventThemeRevealedData
# - teamData → themeData
# - subscribe('EVENT_THEME_REVEALED')

# Rename TeamNameReveal.tsx
cd apps/user-client/src/components
git mv TeamNameReveal.tsx EventThemeReveal.tsx

# Edit EventThemeReveal.tsx:
# - Component name: TeamNameReveal → EventThemeReveal
# - Props: teamName→theme, teamTagline→subtitle, etc.

# Update 6 other components (same pattern)

git add .
git commit -m "refactor(client): update components for event theme"
```

### Phase 6: Tests
```bash
cd apps/server/src/__tests__
git mv teamNameGenerator.test.ts eventThemeGenerator.test.ts

# Edit eventThemeGenerator.test.ts:
# - Update import paths
# - Update field names in assertions

git add .
git commit -m "test: update eventThemeGenerator tests"
```

### Phase 7: Documentation
```bash
git mv TEAM_NAME_GENERATOR_IMPLEMENTATION.md EVENT_THEME_GENERATOR_IMPLEMENTATION.md

# Global search and update
grep -r "team name" --include="*.md" . | grep -v REFACTORING

git add .
git commit -m "docs: update terminology to event theme"
```

---

## ✅ Validation Commands

```bash
# TypeScript compilation
npm run build --workspaces
# Expected: Zero errors

# Run tests
npm run test --workspaces
# Expected: All pass

# Lint
npm run lint --workspaces
# Expected: Clean

# Search for missed references
grep -r "teamName\|TeamName" apps/server/src --include="*.ts" | grep -v node_modules | grep -v eventThemeGenerator
grep -r "TEAM_NAME_REVEALED" apps --include="*.ts" --include="*.tsx"
```

---

## 🐛 Critical Bug Being Fixed

**Current bug in `teamNameGenerator.ts` lines 129-137**:
```typescript
// ❌ WRONG (silently fails to write to DB)
await db.update(eventPoolGroups).set({
  teamName: result.teamName,  // Field doesn't exist!
});

// ✅ CORRECT (after refactoring)
await db.update(eventPoolGroups).set({
  theme: result.theme,  // Matches schema ✅
});
```

---

## 📊 Field Mapping Reference

| Old Name | New Name | DB Column | Type |
|----------|----------|-----------|------|
| `teamName` | `theme` | `theme` | varchar(50) |
| `teamTagline` | `subtitle` | `subtitle` | varchar(80) |
| `teamEmoji` | `themeEmoji` | `theme_emoji` | varchar(10) |
| `teamSuperpowers` | `themeTags` | *(not stored)* | string[] |
| `teamVibe` | `vibe` | `vibe` | varchar(30) |
| `TEAM_NAME_REVEALED` | `EVENT_THEME_REVEALED` | N/A | WebSocket event |

---

## 🧪 Manual Test Checklist

```
[ ] Start dev servers (backend + frontend)
[ ] Register for event pool
[ ] Trigger pool matching
[ ] Verify WebSocket event received (check console)
[ ] Verify modal appears with theme
[ ] Verify database updated (psql or Prisma Studio)
[ ] Check for console errors
```

---

## 🚨 Common Issues & Fixes

### Issue: TypeScript errors after Phase 1
**Fix**: Expected! Continue to Phase 2-5 to fix all references.

### Issue: WebSocket event not received
**Fix**: Check server logs, verify broadcast code updated in poolMatchingService.

### Issue: Database write fails
**Fix**: Verify field names match schema exactly (theme, subtitle, themeEmoji).

### Issue: Old component still appears
**Fix**: Clear browser cache, restart dev server.

---

## 📚 Full Documentation

For detailed explanations, see:
- `REFACTORING_PLAN_EVENT_THEME_TITLE.md` - Comprehensive plan
- `REFACTORING_DEPENDENCY_MAP.md` - Architecture diagrams
- `REFACTORING_NEXT_STEPS.md` - Step-by-step guide
- `ARCHITECTURAL_GUIDANCE_SUMMARY.md` - Executive summary

---

## 🎯 Your Questions Answered

**Q1: Gradual or atomic?**  
**A**: Atomic ✅ (4-6 hours, single PR)

**Q2: What naming convention?**  
**A**: Align with DB schema ✅ (`theme`, `subtitle`, `themeEmoji`)

**Q3: What order to minimize risk?**  
**A**: Bottom-up ✅ (Schema → Shared → Server → Client → Tests → Docs)

---

**Next Action**: Start Phase 1 (WebSocket Events)

**Confidence**: HIGH (well-planned, TypeScript validates everything)

---

_Quick Reference Card - Event Theme Refactoring_
_Principal Software Engineer - Martin Fowler Mode_
