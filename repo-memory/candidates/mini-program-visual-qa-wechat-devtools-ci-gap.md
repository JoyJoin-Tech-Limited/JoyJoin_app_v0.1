---
id: repo.mini-program.visual-qa-wechat-devtools-ci-gap
title: Mini-program visual QA — WeChat DevTools gate vs automated CI
status: candidate
owner: mini-program-platform
lastValidatedAt: 2026-04-18
tags:
  - mini-program
  - wechat
  - visual-qa
  - ci
  - pixel-precision
triggerTerms:
  - WeChat DevTools
  - pixel precision
  - visual PR
  - rpx spacing
  - mini-program UI review
relatedPaths:
  - .github/skills/mini-program-frontend-excellence/references/pixel-precision.md
  - .github/skills/code-review/SKILL.md
  - .github/copilot-instructions.md
  - apps/mini-program/src/pages/
sources:
  - .github/skills/mini-program-frontend-excellence/references/pixel-precision.md
  - .github/copilot-instructions.md
confidence: high
---

## Summary

Canonical policy now requires **WeChat DevTools** inspection for user-visible `apps/mini-program` layout/typography changes; **CI cannot run DevTools**. This note captures the **gap**, **acceptable automation**, and **next upgrades** so promotion to `repo-memory/promoted/` can retire ad-hoc rediscovery.

## Facts (authoritative links)

- Pixel discipline and DevTools gate: [`.github/skills/mini-program-frontend-excellence/references/pixel-precision.md`](../../.github/skills/mini-program-frontend-excellence/references/pixel-precision.md)
- Reviewer blocking expectations: [`.github/skills/code-review/SKILL.md`](../../.github/skills/code-review/SKILL.md)
- Contributor PR bar: [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md)

## Gap

- **Human verification** remains mandatory for measurement-accurate UI; there is no headless WeChat renderer in GitHub Actions that replaces DevTools for WXSS/computed layout.

## Next upgrades (prioritized)

1. **PR template (optional)** — Add a repo-level `.github/pull_request_template.md` (or extend an existing template) with checkboxes: “WeChat DevTools checked on changed screens” / “screenshots attached if reviewer cannot reproduce” for `apps/mini-program` paths.
2. **Narrow automated guardrails** — Extend targeted style tests (pattern: `apps/mini-program/src/pages/index/index.style.test.ts`) only for **known-unsafe CSS** or **project conventions** (e.g. forbidden `filter` on landing); do not claim pixel-perfect verification.
3. **Documentation pointer** — Keep `pixel-precision.md` as single source; link from `apps/mini-program/README.md` in a short “Visual QA” subsection (small doc PR).

## Non-goals

- Replacing DevTools with screenshots-only for dense layout changes.
- Full rpx lint enforcing “multiples of 8” everywhere (too noisy without spec context).

## Promotion criteria

Promote this candidate when at least **one** of: (a) PR template merged, (b) an additional automated guardrail merged with documented scope, or (c) we explicitly decide to **close** automation and keep human-only — then fold into a short **promoted** note and archive this file.
