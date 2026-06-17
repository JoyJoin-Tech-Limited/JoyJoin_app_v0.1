# CI/CD Branch Promotion Runbook

> How JoyJoin code moves from `main` to staging and from `release` to production.

## Branch Strategy

| Branch | Target environment | Trigger | Pipeline |
|--------|-------------------|---------|----------|
| `main` | Staging | Push | `.github/workflows/deploy-staging.yml` |
| `release` | Production | Push | `.github/workflows/deploy-production.yml` |

## Shared Quality Gates

Both deploy workflows call `.github/workflows/quality-gates.yml`, which runs:

1. Guardrails (env/secret/legacy/import checks, migration journal sync)
2. Type checks for `@joyjoin/shared`, `@joyjoin/admin-client`, `@joyjoin/server`, `mini-program`
3. Tests for server, shared, admin-client, mini-program
4. Harness 5-pillar completion gate
5. AI simulation test (requires `DEEPSEEK_API_KEY`)

Deploy only proceeds after all gates pass.

## Production Deploy

- Pushing to `release` triggers `deploy-production.yml`.
- The deploy job has `environment: production`, so it can be gated by GitHub required reviewers.
- The workflow rsyncs code to `~/JoyJoin` on the server and runs `deployment/scripts/deploy-production.sh`.
- The script writes `deployment/.env.production` from GitHub secrets/vars, applies migrations, reloads Nginx, restarts containers, and health-checks.

## Staging Deploy

- Pushing to `main` triggers `deploy-staging.yml`.
- The workflow rsyncs code to the same server and runs `deployment/scripts/deploy-staging.sh`.
- The workflow writes `deployment/.env.staging` from GitHub secrets/vars before running the script.
- Staging uses its own database (`joyjoin_staging` on `postgres-staging`) and `APP_MODE=staging`.

### Required GitHub Secrets for Staging

```text
STAGING_DATABASE_URL          # postgresql://joyjoin:<password>@postgres-staging:5432/joyjoin_staging
STAGING_SESSION_SECRET        # strong random secret
STAGING_ADMIN_CREATE_SECRET_KEY
STAGING_POSTGRES_PASSWORD     # password for postgres-staging container
```

Staging reuses production secrets for WeChat (`WECHAT_APPID`, `WECHAT_SECRET`), AI (`DEEPSEEK_API_KEY`, `MINIMAX_API_KEY`), WeChat Pay, and AMap unless isolation is required.

## Manual Deploy (Bypass CI)

If CI is unavailable, run the same scripts on the server:

```bash
ssh -i "~/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem" root@1.12.243.104
cd ~/JoyJoin

# Staging
./deployment/scripts/deploy-staging.sh

# Production
./deployment/scripts/deploy-production.sh
```

> Manual edits to `deployment/.env.staging` will be overwritten on the next CI staging deploy.

## Rollback

1. Identify the last known-good commit on the target branch.
2. Revert the bad commit or reset the branch to the good commit.
3. Push the branch — CI will redeploy.
4. For production, you can also run `deploy-production.sh` manually on the server after checking out the good commit.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Deploy not triggered | Confirm the push was to `main` or `release`; check Actions tab. |
| Staging deploy targets production DB | Verify `STAGING_DATABASE_URL` contains `joyjoin_staging`. `deploy-staging.sh` asserts this. |
| Quality gates fail | Fix guardrails/tests locally before pushing. |
| Production approval pending | A repo admin must approve the `production` environment deployment. |
