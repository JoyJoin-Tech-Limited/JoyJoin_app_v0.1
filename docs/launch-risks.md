# Launch Risks Register

> Honest, current-state record of the security risks we know about and the
> automated coverage that does or does not exist for them.
>
> **Last reviewed:** 2026-10-21 · **Owner:** engineering · **Review cadence:** with every dependency/security batch, otherwise quarterly.

This file exists because the repo previously had no single place that said
"here is what CI actually checks". Reviews were sometimes written as if a scan
had run when it had not. Rules for keeping it honest:

- Only list automation that is **in CI today** as automation.
- Every accepted risk carries a `reviewBy` date.
- If something is not exploitable in production, say **why**, not just "low risk".

---

## 1. Dependency risk

**Status:** actively burning down (batch `DEP-SEC-1`, started 2026-10-21).
Plan: [`docs/design/dependency-security-batch-20261021.md`](./design/dependency-security-batch-20261021.md).

Baseline measured against the root lockfile at each wave boundary (same
measurement method every time):

| Measure | Before W1 | After W1 | After W2 | Meaning |
|---|---|---|---|---|
| Affected nodes in the full audit graph | 185 | 137 | 134 | Every package instance in the dev+build+prod tree |
| Critical-severity nodes | 47 | 10 | 10 | The babel-6 subtree was the bulk of it |
| Critical/high reachable from a workspace **runtime** dependency | 11 nodes | 8 nodes | 9 findings | What the CI gate watches |
| Build-tool findings reported as context | 104 | 59 | 55 | Never gated, never shipped |

The gap between "134 findings" and "9 gated findings" is the whole point: the
overwhelming majority are reachable only through build tooling (the babel-6
subtree pulled in by `miniprogram-ci`, plus glob/ReDoS family findings via
stylelint/eslint/vite). They never execute on a user request and never ship in
the mini-program package.

The W1 sweep cleared three previously baselined findings outright
(`@babel/traverse`, `browserslist`, `json5`) by upgrading `miniprogram-ci`
2.1.31 → 2.1.48, which dropped the vendored babel-6 subtree. Per-workspace
`npm audit` counts are node-instance counts and move with hoisting, so only the
root-graph and gated numbers above are comparable across runs.

W2 cleared the one entry that was a genuine runtime risk: `drizzle-orm`
0.39.1 → 0.45.4 (SQL identifier escaping) in both `apps/server` and
`packages/shared`, plus `sharp` 0.34.5 → 0.35.5 for the asset build scripts. It
also **increased** the gated count from 8 to 9 for a reason worth naming: two
advisories were published upstream between W1 and W2 (`lodash` code
injection/prototype pollution, which propagates a critical severity onto
`@tarojs/taro`). That is the ratchet working — new advisories surface as new
findings instead of hiding in a stale number.

`swiper` was **not** forced to 12.x. `@tarojs/components@4.2.0` pins
`swiper@11.1.15` exactly (no caret), and an `overrides` entry silently failed to
re-resolve — the lockfile ended up with no `swiper` node at all while the parent
still declared it, which would have broken `npm ci`. A no-op override that looks
like mitigation but isn't is worse than an honest baseline entry, so the override
was reverted and swiper stays baselined until the Taro upgrade (W3) brings a
compatible version.

### What the gate is

`npm run check:deps` → `scripts/check/check-dependency-vulns.mjs`

- BFS-walks `package-lock.json` from each workspace's declared `dependencies`
  (not `devDependencies`) — this is the shipping surface, by construction.
- Fails on **critical/high** advisories reached from that surface when they are
  not in `scripts/check/dependency-vuln-baseline.json`.
- Reports build-tool findings as context, never as a gate.
- Runs as its own CI job (`Dependency Audit` in `quality-gates.yml`) because a
  full `npm audit` takes minutes and `npm run guardrails` must stay fast.

### Accepted risks (baselined, re-issued 2026-10-22 after W2)

| Package | Severity | Why accepted | reviewBy |
|---|---|---|---|
| `swiper` / `@tarojs/components` | critical | Reachable only through the Taro component package's H5 build path. `apps/mini-program/src` has zero `swiper` imports and WeChat renders the native `<Swiper>`. `npm audit fix` would downgrade `@tarojs/*` to 3.2.16 and break the build — permanently rejected. Forcing a 12.x `overrides` pin was attempted and reverted (see W2 note above); the real resolution is the Taro upgrade (W3). | 2027-01-31 |
| `@tarojs/taro` | critical | Not a distinct advisory — npm audit inherits the critical severity from `@tarojs/components` (swiper) and `@tarojs/helper`. The only "fix" offered is a Taro downgrade to 3.6.22. | 2027-01-31 |
| `lodash` | high | **No patched release exists** (affected range `<=4.17.23`, current release is 4.17.21). Reachable only through build-time `@tarojs/helper`; no app code imports lodash. The advisories only fire on `_.template` key names / `_.unset` / `_.omit` with attacker-controlled paths. | 2027-01-31 |
| `braces`, `micromatch`, `chokidar`, `find-yarn-workspace-root`, `@tarojs/helper` | high | Build-time config/glob/watch utilities inside the Taro CLI toolchain. No request path. | 2027-01-31 |

Cleared and no longer in the baseline: `@babel/traverse` (critical),
`browserslist`, `json5` (W1, 2026-10-21), and `drizzle-orm` (W2, 2026-10-22).

**Never run `npm audit fix --force` in this repo.** npm's resolution for the
`@tarojs/*` advisories is a downgrade to Taro 3.2.16 (and `@tarojs/cli@1.3.8`),
which destroys the mini-program build. Plain `npm audit fix` (no `--force`) is
fine and is W1 of the batch.

---

## 2. Auth and debug surfaces

Source of truth: [`apps/server/src/auth/policy.ts`](../apps/server/src/auth/policy.ts).

| Surface | Rule |
|---|---|
| `ENABLE_DEV_AUTH_TOOLS` | Non-production only (`isDevAuthToolsEnabled()` requires `NODE_ENV !== 'production'`) |
| `DEBUG_AUTH` | Non-production only |
| WeChat mock login | Non-production, and the code must carry the `wechat_test_` prefix |
| `ALLOW_PRODUCTION_AUTH_DEBUG=1` | Escape hatch for audited emergency sessions only; `assertProductionAuthDebugSurfaceAllowed()` throws otherwise |

Production fails closed by default. Ban/disable/deletion revoke sessions
immediately (`lib/revokeUserSessions.ts`, HS-12) and per-request middleware
re-checks account status.

**Verify:** grep the route surface for the override flags, and confirm the
production container does not set them (`/api/readyz` is the runtime check).

---

## 3. Secrets

- No `.env` file may be committed — enforced by `scripts/check/check-guardrails.mjs`
  (also checks legacy identifiers and cross-app imports).
- Runtime secrets reach the server through the deployment environment
  (`.env` on the host / GitHub secrets → `deployment/.env.staging`), never
  through source.
- Admin session material and API keys are not logged; `logger` redacts
  authorization headers.

---

## 4. CI security coverage — what actually runs

| Check | Today | Notes |
|---|---|---|
| Env/secret/legacy/import guardrails | ✅ | `guardrails` job, every PR |
| Dependency audit (runtime-reachable) | ✅ | `Dependency Audit` job, added 2026-10-21. Its walker has unit tests in CI. |
| Dependabot version + security PRs | ✅ | `.github/dependabot.yml`. **Dependabot security updates** were switched on at the repo level on 2026-10-22 (they had been `disabled`). Still opens PRs only; it does not block merges. |
| CodeQL **security** code scanning | ✅ | Default setup enabled 2026-10-22 (`code-scanning/default-setup` = `configured`). Free on this public repo; first analysis run triggered on enable. |
| CodeQL **code quality** scanning | ✅ dynamic | GitHub runs `CodeQL - Code Quality` on pushes to `main` (dynamic workflow, not a repo file). Quality only — it does not produce security alerts. |
| GitHub **secret scanning** + push protection | ✅ | Both enabled 2026-10-22 (free for public repos). Non-provider patterns and validity checks remain `disabled` (org-level). |
| Secret scanning in CI (gitleaks/trufflehog) | ❌ | No repo-owned scanner; we rely on GitHub's secret scanning above. `check-guardrails.mjs` still blocks committed `.env` files. |
| `dependency-review-action` on PRs | — | Available (the repo is **public**, so no GHAS needed), deliberately not enabled: work lands as direct pushes to `main`, so a PR-only gate would never fire. Revisit if a PR-based flow becomes the norm. |
| Mini-program build (`build:weapp`) on every shipping commit | ✅ | `Build Mini-Program` job in `quality-gates`, added 2026-10-22. Runs every asset gate, the Taro build, package-size enforcement and upload classification before `main` can deploy. |
| Container image scanning | ❌ | `deploy-staging` builds images without a scanner |
| DAST / external pen test | ❌ | Not scheduled |


**Reading this table:** a green PR does not mean "no vulnerabilities". It means
the guardrails, type checks, tests and the runtime-reachable dependency gate
passed. The ❌ rows are open gaps, not implicit passes.

---

## 5. Change log

| Date | Change |
|---|---|
| 2026-10-21 | Created. Added the dependency gate + Dependabot config; recorded the 11-node accepted-risk baseline and the rejected `npm audit fix --force` path. |
| 2026-10-22 | W1+W2 landed (185 → 134 root nodes; runtime gate 11 → 9 findings after two new upstream advisories arrived). Repaired a profile-pixel WebP that the anonymization commit had left with a broken hash **and** a broken VP8L stream. Added `Build Mini-Program` to `quality-gates` so a broken bundle can no longer reach `main`. Enabled CodeQL default setup, GitHub secret scanning, push protection, and Dependabot security updates. |
