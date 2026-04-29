---
id: repo.frontend.design-audit-integration
title: Frontend Design Audit Skill + CLI — Integration of taste-skill + impeccable patterns
status: active
owner: design-system
lastValidatedAt: 2026-04-29
tags:
  - frontend
  - design-system
  - quality-gate
  - skill-framework
  - mini-program
  - audit
triggerTerms:
  - design audit
  - frontend quality
  - AI slop detection
  - anti-pattern scanner
  - taste-skill integration
  - impeccable integration
  - design guardrails
relatedPaths:
  - .agents/skills/frontend-design-audit/SKILL.md
  - .agents/skills/stitch-design-workflow/SKILL.md
  - scripts/design-audit.mjs
  - apps/mini-program/src/styles/_variables.scss
  - package.json
sources:
  - repo-memory/candidates/frontend-design-audit-integration.md
  - .agents/skills/frontend-design-audit/SKILL.md
  - .agents/skills/stitch-design-workflow/SKILL.md
confidence: high
---

# Frontend Design Audit Integration

## Problem Statement

JoyJoin had strong implementation-time frontend skills (`mini-program-frontend-excellence`, `wow-elements`, `design-system-governance`) but **no retroactive audit capability**. `npm run guardrails` checked code boundaries (env, secrets, imports) but **not design quality** (token drift, anti-patterns, missing states, AI slop).

## Solution

Created a **JoyJoin-native design audit system** synthesizing patterns from `taste-skill` (Leonxlnx) and `impeccable` (Paul Bakaus), adapted for Taro/WeChat Mini Program constraints.

## Deliverables

### 1. `frontend-design-audit` Skill (`.agents/skills/frontend-design-audit/SKILL.md`)
- 5-dimension audit scoring: Brand Fidelity, State Completeness, Theming, Responsive, Performance
- JoyJoin Anti-Slop Checklist (20+ checks across color, typography, layout, content, imagery, states, motion)
- The Eight States matrix (default, hover, focus, active, disabled, loading, error, success)
- Mini-program and web-specific addenda
- Fix Priority Matrix (P0/P1/P2)

### 2. `design-audit.mjs` CLI Scanner
- Heuristic regex-based detection of anti-patterns
- Platform-aware (mini-program vs web rules)
- Supports `design-audit:intentional` suppression comments
- Exit code 1 on errors, 0 on warnings
- Single-path mode: `npm run design:audit <path>`
- Default mode: audits all surfaces with grand total

### 3. CI Integration
- Added to `npm run guardrails` alongside existing checks
- Runs automatically with: env check + tests + brand colors + design audit

### 4. Configurable Dials for Stitch
- DESIGN_VARIANCE (1-10): predictable → offset → editorial
- MOTION_INTENSITY (1-10): static → fluid → cinematic
- VISUAL_DENSITY (1-10): airy → balanced → dense
- Default settings for 9 screen types
- Added to `.agents/skills/stitch-design-workflow/SKILL.md`

## Fix Results

| Surface | Initial Errors | Final State |
|---------|---------------|-------------|
| mini-program | 33 | ✅ Clean |
| user-client | 99 | ✅ Clean |
| admin-client | 120 | ✅ Clean |
| **Total** | **252** | **0** |

## What was borrowed vs skipped

**From taste-skill:**
- ✅ AI Tells ban list, redesign diagnostic structure, configurable dials concept
- ❌ Framer Motion / GSAP rules (incompatible with WeChat runtime)
- ❌ Tailwind-first conventions (JoyJoin uses Taro + Sass)
- ❌ Direct installation (web-first, conflicts with Taro)

**From impeccable:**
- ✅ 5-dimension audit structure, anti-pattern taxonomy, motion hygiene rules
- ❌ Full 23-command surface (overkill; agents use skill directly)
- ❌ PRODUCT.md / DESIGN.md setup gates (JoyJoin uses existing brand guidelines)
- ❌ Direct installation (web-first)

## Key files changed

- `.agents/skills/frontend-design-audit/SKILL.md`
- `.agents/skills/stitch-design-workflow/SKILL.md`
- `scripts/design-audit.mjs`
- `package.json`
- `apps/mini-program/src/styles/_variables.scss`
- 24+ mini-program SCSS files (`100vh` → `100dvh`)
- `apps/user-client/src/**/*` (`min-h-screen` → `min-h-[100dvh]`)
- `apps/admin-client/src/**/*` (`min-h-screen`/`h-screen` → `min-h-[100dvh]`)
