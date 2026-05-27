# 完成度 Audit Report Card Template

## 完成度 Audit: [Page/Flow Name]

**Target:** `apps/mini-program/src/pages/[path]`
**Prerequisites:** ui-layout-audit: [X/68] | frontend-design-audit: [X/20]
**Date:** [ISO date]

### Dimension Scores

| # | Dimension | Score | Flags |
|---|---|---|---|
| 1 | Functional completeness | X/4 | [Key finding or — if score 4] |
| 2 | State completeness | X/4 | [Key finding] |
| 3 | Copy completeness | X/4 | [Key finding] |
| 4 | Interaction completeness | X/4 | [Key finding] |
| 5 | Delight completeness | X/4 | [Key finding] |
| 6 | Flow completeness | X/4 | [Key finding] |
| 7 | Accessibility completeness | X/4 | [Key finding] |
| 8 | Taro discipline | X/4 | [Key finding] |
| 9 | Visual finish | X/4 | [Derived from ui-layout-audit: X/68 → X.0] |
| 10 | Brand soul | X/4 | [Derived from frontend-design-audit Dim1: X/4] |
| 11 | Operational completeness | X/4 | [Key finding] |
| **Total** | | **XX/44** | **Band: [完美 39–44 / 坚稳 29–38 / 可行 18–28 / 不足 9–17 / 残缺 0–8]** |

### Gap Register (ranked by ROI quadrant)

| # | Gap | Dim | Impact (1–5) | Effort (1–5) | Quadrant | Fix skill | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| 1 | [Specific gap — what, where] | #N | N | N | Do first | `wow-elements` | [Concrete fix, file path, estimated hours] |
| 2 | ... | | | | Schedule | | |
| 3 | ... | | | | Low-hanging | | |
| 4 | ... | | | | Skip | | |

### Fix Skills Reference

| Flagged dimension | Fix skill |
|---|---|
| #5 Delight completeness | `wow-elements` |
| #1–2 Functional / State gaps | `mini-program-frontend-excellence` |
| #8 Taro discipline | `mini-program-frontend-excellence` |
| #9 Visual finish | `ui-layout-audit` (deep dive) then `mini-program-frontend-excellence` |
| #10 Brand soul | `joyjoin-brand-guidelines` |
| #11 Operational completeness | `admin-audit-and-rbac-governance` |

### ROI Scatter Summary

```
           Impact ↑
           ┌──────────────────┐
  Do first │                  │ Schedule
           │  [Gap 1]         │  [Gap 2]
           │  [Gap 3]         │
           ├──────────────────┤
Low-hanging│                  │ Skip
           │  [Gap 5]         │  [Gap 4]
           └──────────────────┘
                              Effort →
```

### Verdict

[Ship immediately / Fix N items then ship / Major rework needed — do not ship]
