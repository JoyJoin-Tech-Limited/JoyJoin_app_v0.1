# Skill: Cross-Platform Parity

Ensure changes in one client surface are reflected correctly in sibling platforms.

## When to Use

- Adding a UI flow to `apps/user-client` that must also exist in `apps/mini-program`
- Changing API contracts consumed by both web and mini-program
- Modifying auth, payment, or onboarding logic that spans platforms
- Auditing whether a feature gap exists between web and WeChat Mini Program

## Core Principles

1. **Mini-program is launch-primary**: Per `PLATFORM_COORDINATION.md`, the mini-program is the primary launch surface. Web is the sandbox/testbed.
2. **Shared contracts first**: API changes must use shared types in `packages/shared/src/api.ts`.
3. **Platform-idiomatic UI**: Do not blindly copy web components to Taro. Adapt to mini-program constraints (rpx, ScrollView, page lifecycle).
4. **Explicit parity decisions**: It is OK for platforms to differ, but the difference must be documented and intentional.
5. **Test both surfaces**: If you add a test for one platform, consider if the other needs an equivalent.

## Protocol

### Step 1: Map the Feature Surface
- Identify which platforms are affected:
  - Web (`apps/user-client`)
  - Mini-program (`apps/mini-program`)
  - Admin (`apps/admin-client`)
  - Shared (`packages/shared`)
- Load `docs/PLATFORM_COORDINATION.md` for platform-specific constraints.

### Step 2: Apply Changes Platform-By-Platform
- **Shared layer first**: Update types, constants, and utilities in `packages/shared`.
- **Mini-program second** (launch-primary): Implement the feature using Taro-native patterns.
- **Web third**: Port or adapt the feature. Web can be more experimental.
- **Admin if applicable**: Update admin surfaces that expose or manage the feature.

### Step 3: Check for Parity Gaps
- Auth flows: Are login, session refresh, and logout consistent?
- API layer: Do both platforms use the same base URL, headers, and error handling?
- Payment: Is WeChat Pay integration present on both platforms where applicable?
- Onboarding: Do both platforms respect `nextStep` from `/api/auth/user`?
- UI copy: Is user-facing text identical (Chinese) across platforms?

### Step 4: Validate
- Run typecheck for both clients: `npm run check:clients`
- Run mini-program build: `cd apps/mini-program && npm run build:weapp`
- Run web build: `cd apps/user-client && npm run build`
- If the change touches shared types, run server typecheck too.

## Anti-Patterns to Avoid

- **Web-first, mini-program-never**: Do not build a web-only feature without an explicit product decision to exclude the mini-program.
- **Blind porting**: Do not copy React DOM components directly to Taro. Use Taro components, rpx units, and mini-program-safe APIs.
- **Divergent API contracts**: Do not create platform-specific DTOs for the same concept. Use shared types.
- **Ignoring platform lifecycle**: Mini-program pages have `onLoad`, `onShow`, `onHide` — not React router transitions. Handle accordingly.
- **Feature parity by accident**: Do not rely on "it should work on both" — verify explicitly.

## Output Format

End your turn with:
- Platforms affected
- Shared changes made
- Platform-specific adaptations
- Parity gaps identified (if any) and whether they are intentional
- Validation results

## Related Files

- `docs/PLATFORM_COORDINATION.md` — canonical cross-platform coordination rules
- `.github/skills/platform-coordination-protocol/SKILL.md` — sibling-platform review triggers
- `.github/skills/mini-program-frontend-excellence/SKILL.md` — Taro-specific UI quality
- `.github/skills/frontend-component-architecture/SKILL.md` — shared UI primitives
