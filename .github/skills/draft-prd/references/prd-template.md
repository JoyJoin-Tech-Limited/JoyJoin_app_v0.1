# PRD Template

Use this template when a feature draft needs to become a scoped, backlog-ready artifact.

---

## 1. Problem Statement

What user pain or product gap does this address? Keep it to 1–2 sentences.

## 2. Target Users and Scenario

- **Who:** Primary and secondary user segments
- **When:** The context that triggers the need
- **Current workaround:** What users do today without this feature

## 3. Goals and Non-Goals

**Goals:**
- Measurable outcome the feature must deliver

**Non-Goals:**
- What is explicitly out of scope to prevent scope creep

## 4. User Stories / Primary Flows

- As a [user type], I want [action] so that [benefit]
- Primary flow: step-by-step interaction narrative

## 5. Acceptance Criteria

Use the **Given / When / Then** format or an explicit checklist:

- [ ] Given [context], when [action], then [observable result]
- [ ] Edge case: [input] → [expected behavior]
- [ ] Error case: [failure mode] → [user-visible recovery]

**Examples:**
- Given a user with no credits, when they tap "Join Event", then they see the payment flow
- Given a failed payment, when the user retries, then the request is idempotent and no duplicate charge is created

## 6. Constraints, Risks, Dependencies, and Open Questions

| Type | Item | Mitigation or Owner |
|------|------|---------------------|
| Constraint | e.g., must work offline in mini-program | |
| Risk | e.g., WeChat Pay review delay | |
| Dependency | e.g., needs new `pool_matching` schema | |
| Open Question | e.g., should free users see this? | |

## 7. Scope Boundaries

**In scope:**
- Specific surfaces, routes, or user segments covered

**Out of scope (v2+):**
- Future extensions that are noted but not built now

**Examples:**
- In scope: mini-program purchase flow + server credit ledger
- Out of scope: admin dashboard for credit analytics (tracked in JJ-482)

## 8. Success Metrics

Define **observable signals** with a unit, threshold, and comparison window.

| Metric | Unit | Target | Window |
|--------|------|--------|--------|
| Conversion rate | % | ≥ 15% | 2 weeks post-launch |
| Drop-off at step N | % | ≤ 30% | 1 week |
| Error rate | % | ≤ 0.5% | 1 week |
| Task completion time | seconds | ≤ 45s | 2 weeks |

**Formula examples:**
- Conversion rate = (completed_purchases / unique_screen_views) × 100
- Drop-off = (exits_at_step / starts_at_step) × 100

## 9. Engineering Impact Areas (Hypotheses)

If the draft mentions routes, schema, AI, or cross-platform behavior, list them as hypotheses:

- **Hypothesis:** New route `POST /api/credits/deduct` required
- **Impact:** Touching `payments` and `pool_registration` domains
- **Platform:** Both mini-program and web

---

## Rollout Questions

- [ ] Is this behind a feature flag?
- [ ] Can it be shipped as a dark launch?
- [ ] What is the rollback plan if the metric target is missed?
