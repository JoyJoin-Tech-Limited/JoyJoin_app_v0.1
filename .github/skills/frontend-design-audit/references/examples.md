# Worked audit examples

Two fully-scored examples showing how the 5 dimensions combine into a health score and rating band. See [`audit-framework.md`](./audit-framework.md) for the scoring rubrics behind each dimension.

## Auditing a mini-program profile screen (Poor)

1. Dimension 1 (Brand Fidelity): Mascot placement feels random → Score 2
2. Dimension 2 (State Completeness): Missing error state for photo upload failure → Score 2
3. Dimension 3 (Theming & Token Discipline): Four hard-coded colors instead of tokens → Score 2
4. Dimension 4 (Responsive & Platform Safety): Touch targets below 44×44 rpx on action row → Score 2
5. Dimension 5 (Performance & Motion Hygiene): Heavy blur filter on scroll → Score 1

**Health Score: 9/20 (Poor)** → P0: fix touch targets and upload error state before merge.

## Auditing a web onboarding step (Excellent)

1. Dimension 1 (Brand Fidelity): Warm beige background, mascot present, copy is conversational → Score 4
2. Dimension 2 (State Completeness): Loading, empty, and error states all handled → Score 4
3. Dimension 3 (Theming & Token Discipline): All colors from tokens, no hard-coded values → Score 4
4. Dimension 4 (Responsive & Platform Safety): Works down to 320 px without horizontal scroll → Score 3
5. Dimension 5 (Performance & Motion Hygiene): No layout thrashing, modest entrance animation → Score 4

**Health Score: 19/20 (Excellent)** → Minor polish only; safe to ship.
