---
name: process-parity
description: >
  Cross-surface contract parity across the live clients: mini-program
  (launch-primary, only shipping user client), admin-client, and the server.
  Use when changing shared API contracts, auth/payment/onboarding logic that
  spans surfaces, or auditing feature gaps between clients.
---

# Skill: Cross-Surface Parity

Ensure changes in one client surface are reflected correctly in sibling surfaces. **The web client (`apps/user-client`) was archived 2026-05 — never target it.** Live surfaces: `apps/mini-program` (launch-primary), `apps/admin-client`, `apps/server`, `packages/shared`.

## When to Use

- Adding a UI flow to one client that must also exist in another (e.g., admin portal management for a mini-program feature)
- Changing API contracts consumed by more than one client
- Modifying auth, payment, or onboarding logic that spans surfaces
- Auditing whether a feature gap exists between mini-program and admin portal

## Core Principles

1. **Mini-program is launch-primary**: Per `docs/reference/PLATFORM_COORDINATION.md`, the mini-program is the only shipping user-facing client.
2. **Shared contracts first**: API changes must use shared types in `packages/shared/src/api.ts` (barrel) or domain modules under `packages/shared/src/api/*.ts`.
3. **Platform-idiomatic UI**: Do not copy components across frameworks. Adapt to each surface's constraints (Taro rpx/ScrollView for mini-program, shadcn/ui for admin).
4. **Explicit parity decisions**: It is OK for surfaces to differ, but the difference must be documented and intentional.
5. **Test both surfaces**: If you add a test for one surface, consider if the other needs an equivalent.

## Protocol

### Step 1: Map the Feature Surface
- Identify which surfaces are affected:
  - Mini-program (`apps/mini-program`)
  - Admin (`apps/admin-client`)
  - Server (`apps/server`)
  - Shared (`packages/shared`)
- Load `docs/reference/PLATFORM_COORDINATION.md` for surface-specific constraints.

### Step 2: Apply Changes Surface-By-Surface
- **Shared layer first**: Update types, constants, and utilities in `packages/shared`.
- **Server second**: Route + domain + repository per `server-domain-architecture`.
- **Mini-program** (launch-primary): Implement using Taro-native patterns.
- **Admin if applicable**: Update admin surfaces that expose or manage the feature.

### Step 3: Check for Parity Gaps
- Auth flows: Are login, session refresh, and logout consistent?
- API layer: Do all clients use the same base URL conventions, headers, and error handling?
- Payment: Is WeChat Pay integration present where applicable?
- Onboarding: Does the client respect `nextStep` from `/api/auth/user`?
- UI copy: Is user-facing text identical (Chinese) across surfaces?

### Step 4: Validate
- Run mini-program build: `npm run build:weapp -w mini-program`
- Run admin build/typecheck for `apps/admin-client`
- If the change touches shared types, run server typecheck and `npm run guardrails`.

## Anti-Patterns to Avoid

- **Targeting the archived web client**: `apps/user-client` no longer exists in the workspace (archived to `archived/workspaces/user-client/`). Any doc or code referencing it as a live target is stale.
- **Blind porting**: Do not copy components directly between frameworks. Use each surface's native primitives.
- **Divergent API contracts**: Do not create surface-specific DTOs for the same concept. Use shared types.
- **Ignoring platform lifecycle**: Mini-program pages have `onLoad`, `onShow`, `onHide` — not React router transitions. Handle accordingly.
- **Feature parity by accident**: Do not rely on "it should work everywhere" — verify explicitly.

## Output Format

End your turn with:
- Surfaces affected
- Shared changes made
- Surface-specific adaptations
- Parity gaps identified (if any) and whether they are intentional
- Validation results

## Related Files

- `docs/reference/PLATFORM_COORDINATION.md` — canonical cross-surface coordination rules
- `.github/skills/platform-coordination-protocol/SKILL.md` — sibling-surface review triggers
- `.github/skills/mini-program-frontend-excellence/SKILL.md` — Taro-specific UI quality
- `.github/skills/frontend-component-architecture/SKILL.md` — shared UI primitives
