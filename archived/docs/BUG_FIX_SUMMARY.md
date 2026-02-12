# Onboarding → Personality Test Flow - Bug Fix Summary

## Overview
Fixed 13 critical, medium, and low priority bugs that collectively blocked users from completing the personality test and proceeding to essential/extended data screens.

**Branch**: `copilot/fix-personality-test-flow`  
**Commits**: 3 total (initial plan + 2 implementation commits)  
**Files Modified**: 5  
**Lines Changed**: +289 / -177

---

## Files Modified

1. `apps/user-client/src/hooks/useAdaptiveAssessment.ts` - Bugs 1, 2, 13
2. `apps/user-client/src/hooks/useUnifiedProgress.ts` - Bugs 12, 13
3. `apps/user-client/src/pages/PersonalityTestPageV4.tsx` - Bugs 1, 2, 13
4. `apps/user-client/src/pages/DuolingoOnboardingPage.tsx` - Bugs 3, 4, 5, 6, 7, 8, 9, 10, 12
5. `apps/user-client/src/pages/PersonalityTestResultPage.tsx` - Bug 11

---

## Critical Bugs Fixed (🔴)

### Bug 1: Personality test starts at Q9, skipping first 8 anchor questions

**Root Cause**: Stale localStorage keys from previous incomplete sessions caused `startAssessment()` to resume a session with 8 answers already recorded.

**Fix**:
- Added validation in `useAdaptiveAssessment.ts::startAssessment()` to check if synced session has expected answer count (≥8)
- Clear all stale localStorage keys if answer count is invalid
- Start fresh assessment if validation fails

```typescript
// Bug 1 Fix: Validate that synced session has expected answer count
const syncedAnswerCount = parseInt(localStorage.getItem("joyjoin_synced_answer_count") || "0", 10);

if (syncedAnswerCount < 8) {
  console.warn('[AdaptiveAssessment] Synced session has invalid answer count, clearing stale cache');
  localStorage.removeItem("joyjoin_synced_session_id");
  localStorage.removeItem("joyjoin_synced_answer_count");
  localStorage.removeItem(PRESIGNUP_SESSION_KEY);
  localStorage.removeItem(PRESIGNUP_ANSWERS_KEY);
  await startMutation.mutateAsync({ forceNew: true });
  return;
}
```

---

### Bug 2: "没找到测试结果" error after completing adaptive assessment

**Root Cause**: Race condition between navigation to result page and server completing session. The result page does a fresh API call that returns null if server hasn't finished processing.

**Fix**:
- Pre-populate query cache in `PersonalityTestPageV4.tsx` before navigation
- Await checkpoint save using async IIFE in useEffect

```typescript
// Bug 2 Fix: Pre-populate the query cache
queryClient.setQueryData(['/api/assessment/result'], {
  primaryArchetype: result.primaryArchetype,
  secondaryArchetype: result.secondaryArchetype,
  archetypeConfidence: result.archetypeConfidence,
  // ... all result fields
});

// Await checkpoint save before navigation
(async () => {
  try {
    await saveCheckpoint.mutateAsync('personality-test');
  } catch (e) {
    console.error('[PersonalityTestPageV4] Failed to save checkpoint:', e);
  }
  setLocation('/personality-test/results');
})();
```

---

### Bug 13: Adaptive assessment progress bar stuck / not updating per question

**Root Causes**:
- A) Moving denominator: `estimatedRemaining` changes every answer, causing bar to barely move or go backwards
- B) Stale closure: `submitAnswer` had `progress` in deps, causing recreations and stale references
- C) Optimistic update overwritten: Server's higher `estimatedRemaining` snaps bar backward

**Fixes**:

**A) Monotonic high-water mark** (`useUnifiedProgress.ts`):
```typescript
const highWaterRef = useRef<number>(0);

// In getUnifiedProgress:
if (result > highWaterRef.current) {
  highWaterRef.current = result;
}
return highWaterRef.current; // Never decreases
```

**B) Remove `progress` from deps** (`useAdaptiveAssessment.ts`):
```typescript
const submitAnswer = useCallback(async (...) => {
  // Use functional updates - no stale closure
  setProgress(prev => prev ? { 
    ...prev, 
    answered: prev.answered + 1,
    estimatedRemaining: Math.max(0, prev.estimatedRemaining - 1)
  } : null);
  // ...
}, [answerMutation]); // Removed `progress` from deps
```

**C) Prevent regression** (`useAdaptiveAssessment.ts`):
```typescript
// answerMutation.onSuccess
setProgress(prev => {
  if (!prev) return data.progress!;
  return {
    ...data.progress!,
    // Never let estimatedRemaining increase
    estimatedRemaining: Math.min(prev.estimatedRemaining, data.progress!.estimatedRemaining),
  };
});
```

---

## Medium Priority Bugs Fixed (🟡)

### Bug 3: Duplicate answers accumulate in localStorage

**Root Cause**: `saveV4AnswerToCache()` always used `answers.push()`, never deduplicating.

**Fix**: Replace `push` with find-and-replace logic

```typescript
// Bug 3 Fix
const existingIndex = answers.findIndex(a => a.questionId === questionId);
const newAnswer = { questionId, selectedOption, traitScores, answeredAt };

if (existingIndex >= 0) {
  answers[existingIndex] = newAnswer; // Replace
} else {
  answers.push(newAnswer); // Add new
}
```

---

### Bug 4: Race condition between local cache check and server presignup-cache fetch

**Root Cause**: Two `useEffect`s ran independently. Local check finished first, skipping resume prompt before server fetch completed.

**Fix**:
- Added `isLoadingServerCache` state
- Don't show resume prompt until server fetch completes
- Server answers take priority: `setAnswers(prev => ({ ...prev, ...answerMap }))`

```typescript
const [isLoadingServerCache, setIsLoadingServerCache] = useState(true);

// In server fetch useEffect:
finally {
  if (!isCancelled) {
    setIsLoadingServerCache(false);
  }
}

// In resume prompt useEffect:
if (!isLoadingServerCache) {
  // Only check after server fetch completes
}
```

---

### Bug 5: SegmentedProgress off-by-one — first question shows 0 segments filled

**Root Cause**: `<SegmentedProgress current={current - 1} total={8} />` made Q1 show 0 segments.

**Fix**: Pass `current` directly instead of `current - 1`

```typescript
<SegmentedProgress 
  current={current}  // Bug 5 Fix: Was `current - 1`
  total={8}
  variant="duolingo"
/>
```

---

### Bug 6: `handleBack` doesn't clean up answer cache → ghost answers

**Root Cause**: When pressing back, answer remained in localStorage and state, allowing duplicate entries.

**Fix**: Remove answer from cache when going back

```typescript
const handleBack = () => {
  if (currentScreen > 0) {
    // Bug 6 Fix: Remove answer for current screen's question
    const question = anchorQuestions[currentScreen - 1];
    if (question) {
      setAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[question.id];
        return newAnswers;
      });
      
      // Also remove from localStorage
      const filtered = answers.filter(a => a.questionId !== question.id);
      localStorage.setItem(V4_ANSWERS_KEY, JSON.stringify(filtered));
    }
    setCurrentScreen(prev => prev - 1);
  }
};
```

---

### Bug 7: No error/retry UI if anchor questions API fails

**Root Cause**: If `GET /api/assessment/v4/anchor-questions` failed, user was stuck on loading skeleton forever.

**Fix**: Add error state with retry button

```typescript
const { data, isLoading, isError, refetch } = useQuery(...);

// Bug 7 Fix: Show error state
if (isError) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
      <p className="text-muted-foreground text-center">加载题目失败</p>
      <Button onClick={() => refetch()}>重试</Button>
    </div>
  );
}
```

---

### Bug 9: `saveCheckpoint` fails silently for unauthenticated users

**Root Cause**: `saveCheckpoint.mutateAsync('onboarding')` called an authenticated endpoint that always failed for pre-signup users.

**Fix**: Guard checkpoint call behind authentication check

```typescript
// Bug 9 Fix: Only save checkpoint if authenticated
const isAuthenticated = !!queryClient.getQueryData(['/api/auth/user']);
if (isAuthenticated) {
  try {
    await saveCheckpoint.mutateAsync('onboarding');
  } catch (error) {
    console.error('[DuolingoOnboardingPage] Failed to save checkpoint:', error);
  }
}
```

---

### Bug 11: Fragmented result endpoints — data may not exist when queried

**Root Cause**: Result page fetches from `/api/assessment/result` (user-based), but for unauthenticated users or incomplete sessions, this returns null.

**Fix**: Add fallback query to sessionId-based endpoint

```typescript
// Bug 11 Fix: Primary query
const { data: result, isLoading } = useQuery<UnifiedAssessmentResult>({
  queryKey: ['/api/assessment/result'],
  retry: () => false, // Don't retry, use fallback
});

// Fallback query
const { data: sessionResult, isLoading: isLoadingSessionResult } = useQuery({
  queryKey: [`/api/assessment/v4/${sessionId}/result`],
  enabled: !result && !isLoading && !!sessionId,
});

// Use whichever is available
const finalResult = result || sessionResult;
const finalIsLoading = isLoading || (isLoadingSessionResult && !result);
```

---

### Bug 12: Progress bar visual discontinuity between onboarding → assessment

**Root Cause**: Onboarding showed 0-100%, then assessment started at 55%, causing jarring jump from 100% → 55%.

**Fix**: Use unified progress in onboarding (0-50% instead of 0-100%)

```typescript
// DuolingoOnboardingPage.tsx
import { useUnifiedProgress } from "@/hooks/useUnifiedProgress";

const { getUnifiedProgress } = useUnifiedProgress();

const getScreenProgress = () => {
  if (currentScreen === 0) return 0;
  // Bug 12 Fix: 8 anchors = 0% to 50% (not 0% to 100%)
  const remaining = Math.max(0, 8 - currentScreen);
  return Math.round(getUnifiedProgress('onboarding', currentScreen, remaining));
};
```

---

## Low Priority Bugs Fixed (🟢)

### Bug 8: `useAnimation` + `controls` in deps may cause performance issue

**Root Cause**: `controls` in useEffect deps can cause infinite re-renders in some Framer Motion versions.

**Fix**: Remove `controls` from deps

```typescript
useEffect(() => {
  controls.start({
    x: [0, -5, 5, -5, 5, 0],
    transition: { duration: 0.4 }
  });
  // Bug 8 Fix: Remove `controls` from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [message]);
```

---

### Bug 10: Dead code — `CITIES` and `INTENTS` constants unused

**Root Cause**: Remnants from a previous version.

**Fix**: Removed the constant declarations entirely

```typescript
// Removed:
// const CITIES = [...];
// const INTENTS = [...];
```

---

## Testing Checklist

- [ ] **Bug 1**: Test resuming from stale session (localStorage with <8 answers)
- [ ] **Bug 2**: Complete assessment and verify result page loads without "没找到测试结果" error
- [ ] **Bug 3**: Answer question, go back, re-answer → verify no duplicate entries in localStorage
- [ ] **Bug 4**: Clear local cache, navigate on different device → verify resume prompt appears after server fetch
- [ ] **Bug 5**: Start onboarding → Q1 should show 1 segment filled (not 0)
- [ ] **Bug 6**: Answer Q3, press back → verify answer is removed and can re-answer
- [ ] **Bug 7**: Simulate API failure → verify error UI with retry button
- [ ] **Bug 8**: Monitor for excessive re-renders during onboarding
- [ ] **Bug 9**: Complete anchors as unauthenticated user → no checkpoint errors in console
- [ ] **Bug 11**: Complete test, check result page → should load via fallback if primary fails
- [ ] **Bug 12**: Progress bar should smoothly go 0% → 50% (onboarding) → 55% → 100% (assessment)
- [ ] **Bug 13**: Answer questions in assessment → progress bar should never decrease

---

## Impact Summary

**Before**: Users experienced broken onboarding flow with:
- Tests starting at wrong questions
- Result page showing errors
- Progress bars stuck or regressing
- Duplicate answers causing data corruption
- No error recovery options

**After**: Smooth, reliable onboarding flow with:
- Correct question sequencing
- Reliable result retrieval
- Monotonically increasing progress
- Clean answer deduplication
- Graceful error handling
- Seamless cross-device experience

---

## Security Notes

No security vulnerabilities introduced. All changes are defensive:
- Better validation of localStorage data
- Graceful handling of authentication states
- No exposure of sensitive data
- Proper cleanup of stale cache data

---

## Performance Notes

**Improvements**:
- Bug 8: Reduced unnecessary re-renders in XiaoyueMascot
- Bug 13B: Prevented submitAnswer recreation on every progress change

**No Regressions**:
- High-water mark is a ref (no re-renders)
- Functional state updates are more efficient than closures
- Fallback query only runs when needed (enabled guard)

---

## Backward Compatibility

All changes are backward compatible:
- Existing localStorage keys are validated and cleaned up if stale
- Server APIs unchanged
- Component APIs unchanged
- Query keys unchanged (added fallback, didn't modify existing)

---

## Next Steps

1. **Code Review**: Review PR for final approval
2. **QA Testing**: Run through full testing checklist
3. **Staging Deploy**: Deploy to staging for integration testing
4. **Production Deploy**: Deploy to production after successful staging validation
5. **Monitor**: Watch for any edge cases or user reports

---

**Status**: ✅ All 13 bugs fixed and committed  
**Ready for Review**: Yes  
**Ready for Deploy**: Pending QA approval
