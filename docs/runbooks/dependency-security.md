# Dependency security runbook

> **Status:** v1 (2026-10-21) — created with batch `DEP-SEC-1`.
> **Audience:** any engineer touching `package.json` / `package-lock.json`, plus whoever triages Dependabot PRs.
> **Plan + background:** [`docs/design/dependency-security-batch-20261021.md`](../design/dependency-security-batch-20261021.md)
> **Risk register:** [`docs/launch-risks.md`](../launch-risks.md)

---

## 1. Auditing

### The two numbers, and why they differ

| Command | What it tells you | Speed |
|---|---|---|
| `npm run check:deps` | Critical/high advisories **reachable from a workspace runtime dependency** — what can actually ship and run | ~3–5 min (full registry round-trip) |
| `npm audit` | Every affected node in the whole dev + build + prod graph | ~3–5 min |
| `npm audit -w @joyjoin/server` | One workspace's view (use the **full** package name; `-w server` returns "No workspaces found") | ~20–40 s |

On 2026-10-21 the full graph was 185 affected nodes / 197 unique advisories,
while only 11 nodes were runtime-reachable. **Never quote the raw alert count
as the risk** — separate "ships and runs" from "runs on a laptop during build".

### Commands

```bash
npm run check:deps                 # the gate (what CI runs)
npm run check:deps:baseline        # regenerate the ratchet baseline
npm audit                          # full graph, for context
npm audit -w @joyjoin/server --json  # per-workspace, machine readable (full package name required)
```

### `ERESOLVE` on `@tarojs/helper`

Any `npm install` / `npm audit fix` used to fail with:

```
peer @tarojs/helper@"4.3.0" from @tarojs/plugin-framework-react@4.3.0
```

because `@tarojs/plugin-framework-react` and `@tarojs/router` floated on
`^4.2.0` while every other `@tarojs/*` dependency was pinned to the exact
`4.2.0`. Both are now pinned to `4.2.0` (`apps/mini-program/package.json`),
which matches what the lockfile already had — no version changed.

**Never** work around this with `--force` or `--legacy-peer-deps`: that produces
a tree that differs from what CI installs, and `--force` is how `npm audit`
"fixes" `@tarojs` by downgrading it to 3.2.16.

### Where it runs in CI

`.github/workflows/quality-gates.yml` → job **Dependency Audit**
(`npm run check:deps -- --strict`). It installs nothing: `npm audit` reads the
lockfile. It is intentionally **not** part of `npm run guardrails` — that script
runs on every local pre-push and must stay fast.

A registry outage prints `⚠ npm audit unavailable` and exits 0 locally; CI runs
`--strict` and fails instead. `DEP_VULN_CHECK_SKIP=1` skips the guard for an
offline emergency (never in CI).

---

## 2. Maintaining the baseline

File: `scripts/check/dependency-vuln-baseline.json`
Script: `scripts/check/check-dependency-vulns.mjs`

Keys are `<severity>:<package>`, and each entry carries `reason`, `reviewBy`
and the advisory URLs. The gate fails **only** on a finding that is not in the
baseline, so the baseline must shrink, never grow by accident.

### How "runtime reachable" is computed

The gate never gates the whole `npm audit` graph. It walks `package-lock.json`
from the **declared, non-dev `dependencies`** of `apps/server`,
`packages/shared`, `apps/admin-client` and `apps/mini-program`, and compares
each advisory's concrete affected **node paths** against that surface. A
dev-only nested copy of a package whose name also exists in the runtime tree
(e.g. `miniprogram-ci/node_modules/lodash`) is reported as `build-tool`, not
gated — otherwise the baseline becomes a list of findings no upgrade can clear.

Resolution follows Node semantics: a workspace (`apps/server`) owns its own
`node_modules`, so a copy npm nested there (a second `drizzle-orm`, a
workspace-local `form-data`) is shipping surface. This was broken until
2026-10-22 — `dirOf()` returned the repo root for workspace entries, so nested
copies were invisible and the AC3 negative test (inject a known-critical runtime
dependency) did **not** fail. `scripts/check/check-dependency-vulns.test.mjs`
locks the resolution now; if you touch the walker, run it.

### Adding an entry (accepted risk)

1. Confirm the package is genuinely unreachable on a request path, or that the
   vulnerable code path is not used. Write that down — "low risk" alone is not a reason.
2. `npm run check:deps:baseline` regenerates the file and preserves existing reasons.
3. Edit the new entry: real `reason` + a `reviewBy` date (default 90 days out).
4. Commit the baseline change **with** the reasoning, in the same PR.

### Removing an entry (burn-down)

`npm run check:deps` prints `✨ N baseline entries are no longer present` with
the keys. Run `npm run check:deps:baseline` and commit the shrink. Shrinking is
always welcome, never blocked.

### Never do this

```bash
npm audit fix --force   # ❌ forbidden in this repo
```

npm's resolution for the `@tarojs/*` advisories is a **downgrade** to Taro
3.2.16 / `@tarojs/cli@1.3.8`, which destroys the mini-program build. Plain
`npm audit fix` (no `--force`) is fine. If a fix needs a major bump, do it
deliberately in its own commit (W2 style) with typecheck + tests + build.

---

## 3. Judging an accepted risk

Answer these in order; stop at the first "no":

1. **Does it ship?** Is the package in the uploaded mini-program package, the
   server bundle, or the admin bundle? Build-time only → the risk is a supply-chain
   compromise during CI, not a runtime exploit.
2. **Is the vulnerable code path reached?** An H5-only implementation in a
   package we compile to a native WeChat component is not reachable
   (that is exactly the `swiper` / `@tarojs/components` case).
3. **Is the input attacker-controlled?** Prototype pollution in a config parser
   fed by our own `tsconfig` is a different risk class from SQL identifier
   escaping fed by request data (`drizzle-orm` — the one we actually had to fix).
4. **Is there a non-breaking upgrade?** If yes, take it now; don't baseline.

Record the answers in the baseline `reason`. Review dates are checked by the
`reviewBy` field when the batch is revisited.

---

## 4. Handling a Dependabot PR

Config: `.github/dependabot.yml` (weekly, Monday 09:00 Asia/Shanghai, max 5 open PRs).

| PR shape | Do this |
|---|---|
| **Grouped security PR** | Treat as urgent. Read the advisory, confirm the fix version is the one we want, run `npm run check:deps` after merge. |
| **Grouped routine patch/minor** | Glance at the diff; let CI decide. Merge if green. |
| **Individual `drizzle-orm` / `drizzle-kit` PR** | Not routine. These are 0.x, "minor" bumps are breaking in practice. Read the release notes, run `npm run test -w @joyjoin/server`, and check `db:verify` against staging before merging. **Do not bump `drizzle-zod` past 0.7.x** while the repo is on zod 3 classic — 0.8.x types are declared against zod v4's `ZodType` (`{out, in}`) and every `createSelectSchema` in `packages/shared/src/schema/` fails with `_zod missing` (measured 2026-10-22). Bump zod to 4 first, as its own task. |
| **`@tarojs/*` (any update type)** | Ignored entirely. The package set is pinned in lockstep to one exact version; a partial bot bump makes every `npm install` fail with ERESOLVE (PR #642, closed 2026-10-22). A coordinated bump is maintenance-only — it clears **no** advisory (see §5). |
| **`three`, `lucide-react`, `vitest`, `@types/cookie` major** | Ignored by config on purpose. `three` is pinned for the avatar3d renderer; `lucide-react` 1.x renames icons across 135 files; `vitest` 5 is a runner major; `@types/cookie` 1.x would describe cookie@1 while the tree still resolves 0.7.2. Each is a planned migration, and PRs #639/#640/#641/#643 were closed with that reason on 2026-10-22. |

If a Dependabot PR fails because the lockfile it produces conflicts with
in-flight work, close it and re-open after the other branch lands — never
resolve a lockfile conflict by hand-merging `package-lock.json`.

---

## 5. Known-good state

| Date | Runtime critical | Runtime high | Note |
|---|---|---|---|
| 2026-10-21 (W0) | 3 (`@babel/traverse`, `@tarojs/components`, `swiper` — all Taro chain) | 8 | Baseline landed; `drizzle-orm` is the only true server-side item |
| 2026-10-21 (after W1) | 2 (`@tarojs/components`, `swiper`) | 6 | `npm audit fix` swept `@babel/traverse`, `browserslist`, `json5`; root graph 185 → 137 nodes |
| 2026-10-22 (after W2) | 3 (`@tarojs/components`, `swiper`, `@tarojs/taro`) | 6 | `drizzle-orm` 0.39.1 → 0.45.4 and `sharp` 0.34.5 → 0.35.5 landed. Two new upstream advisories arrived mid-batch (`lodash` high + its `@tarojs/taro` critical propagation), so the gated count is 9, not 7. `swiper` override attempted and reverted — see W2 note in `docs/launch-risks.md`. Root graph 137 → 134 nodes. |
| target after W3 | 0 | 0 | **Struck 2026-10-22: a Taro upgrade clears nothing.** `@tarojs/components@4.3.0` (the newest 4.x) still pins `swiper` to `11.1.15`, and `@tarojs/helper@4.3.0` still depends on `lodash@^4.17.21`, whose advisories have no released fix (`fixAvailable: false`). The remaining entries disappear when upstream ships, not when we upgrade. W3 is now maintenance-only — do not schedule it for security numbers. |
