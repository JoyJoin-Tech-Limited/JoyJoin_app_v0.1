# User Client Workspace

This workspace contains JoyJoin's web reference user experience built with React + Vite.

> **Archived — read the code here as history, not as a buildable app.** One
> import no longer resolves: `@joyjoin/shared/personality/resultViewModel` was
> deleted on 2026-11-19, because `apps/server/src/xiaoyueAnalysisService.ts`
> owns the personality reading now and the shared copy had drifted into
> superseded wording. `PersonalityTestResultPage.tsx`, `RevealStage.tsx` and
> `ResultStage.tsx` still reference it.

> **Manifest:** `package.json` is stored as `package.json.archived` (renamed
> 2026-11-20) so GitHub's dependency scanner does not treat a manifest that is
> never installed and has no lockfile as a live workspace. Rename it back
> before reviving this workspace.

## Source-of-truth entry points

- `apps/user-client/src/main.tsx` — Vite bootstrap
- `apps/user-client/src/App.tsx` — route composition and top-level providers
- `apps/user-client/src/hooks/useAuth.ts` — web auth/session reader
- `apps/user-client/src/features/onboarding/README.md` — active onboarding ownership map
- `apps/user-client/src/pages/BlindBoxPaymentPage.tsx` — coordinated payment surface that must be reviewed against the mini-program sibling when payment behavior changes

## Where new files go

- **New route/page for the user app:** `apps/user-client/src/pages/`
- **App-local reusable UI:** `apps/user-client/src/components/`
- **Active onboarding-specific code:** `apps/user-client/src/features/onboarding/active/`
- **Browser-only hooks or utilities:** `apps/user-client/src/hooks/` or `apps/user-client/src/lib/`
- **Cross-app contracts or truly shared UI primitives:** `packages/shared/src/`

## Coordination notes

- For auth, API, or payment changes that may affect the mini-program, read [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md) before deciding the change is web-only.
- Keep browser-only implementation details here, but move duplicated business rules or contracts toward `packages/shared` when they become genuinely shared.

## Common commands

```bash
npm run dev -w @joyjoin/user-client
npm run typecheck -w @joyjoin/user-client
npm run test -w @joyjoin/user-client
```

## Related docs

- [`../../docs/README.md`](../../docs/README.md)
- [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md)
- [`../../docs/MOBILE_UI_IMPLEMENTATION_SUMMARY.md`](../../docs/MOBILE_UI_IMPLEMENTATION_SUMMARY.md)
- [`../../.github/skills/frontend-component-architecture/SKILL.md`](../../.github/skills/frontend-component-architecture/SKILL.md)
