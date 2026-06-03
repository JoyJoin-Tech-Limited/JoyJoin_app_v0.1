# Grill-Me — Completeness Audit (完成度)

> Defend every dimension score. One question per turn.
> Scores ≤ 2 must survive rigorous challenge; scores of 4 must be proven.

## Functional Completeness (Dim 1)

Ask when score < 4:

**Q1:** Walk me through the full happy path. Now break it at every possible failure point. Where does it fail silently?
- Recommended: Every failure path has explicit handling. No swallowed errors.

**Q2:** What's the edge case with the largest blast radius that you know exists but didn't handle? Why?
- Recommended: Named explicitly with rationale for deferral. "Unhandled" is not a strategy.

**Q3:** Does this work after the user force-closes the mini-program and reopens mid-flow? State recovery tested?
- Recommended: Re-entry recovers to correct state. Server state is authoritative; client rebuilds from server response.

## State Completeness (Dim 2)

Ask when score < 4:

**Q4:** You scored state completeness [X]. Show me the loading, empty, error, success, disabled, and busy states. Which ones are missing?
- Recommended: All six present. Missing states are explicitly documented as out-of-scope with rationale.

**Q5:** What happens when the API returns a 500 during this flow? Does the user see a branded error or a white screen?
- Recommended: Branded error state with retry. Error boundaries catch React crashes. No white screen.

## Copy Completeness (Dim 3)

Ask when score < 4:

**Q6:** List every piece of user-facing copy on this screen. Which ones are placeholders? Which feel AI-generated?
- Recommended: All copy is human-crafted. Placeholders explicitly labeled. No "AI feel" in primary copy.

**Q7:** Are tooltips, confirmations, and error messages all present in Chinese? Any raw English strings?
- Recommended: All copy is Chinese. Error messages are user-friendly, not developer-facing.

## Interaction Completeness (Dim 4)

Ask when score < 4:

**Q8:** Show me press feedback on every tappable element. Which interactive elements are silent?
- Recommended: Every tappable element has `hover-class`, haptic, or visible state change. No silent taps.

**Q9:** What happens on double-tap of the primary CTA? Are submissions guarded against duplicate fires?
- Recommended: CTA disabled during submission. `isSubmitting` flag prevents double-fire.

## Delight (Dim 5)

Ask when score < 4:

**Q10:** What's the single most emotionally significant moment in this flow? Is it crafted or functional-only?
- Recommended: Key emotional moment (completion, reveal, first load) has targeted polish. If none exists, run `wow-elements`.

## Flow Completeness (Dim 6)

Ask when score < 4:

**Q11:** Walk me through: entry → action → result → aftermath. Is every stage intentional? Where does the user feel lost?
- Recommended: Full journey mapped. Every stage has clear next action. No dead ends.

## Accessibility (Dim 7)

Ask when score < 4:

**Q12:** Are touch targets ≥ 88rpx on every interactive element? Show me the smallest target on this screen.
- Recommended: All targets ≥ 88rpx. Smallest target identified and justified if smaller.

## Taro Discipline (Dim 8)

Ask when score < 4:

**Q13:** Is this page in the correct subpackage? Any code accidentally in the main package?
- Recommended: Subpackage placement verified. Deep-link pages in subpackages; tab bar pages in main.

## Operational (Dim 11)

Ask when score < 4:

**Q14:** If this feature breaks in production, how do we turn it off? Is there a kill switch?
- Recommended: Feature flag exists. Toggle-able without deploy. Admin audit log tracks the change.
