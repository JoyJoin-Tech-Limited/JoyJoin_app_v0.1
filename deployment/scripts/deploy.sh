#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deployment"
ENV_FILE="$DEPLOY_DIR/.env.$ENVIRONMENT"

if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "staging" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: ./deployment/scripts/deploy.sh [production|staging]"
    exit 1
fi

cd "$REPO_ROOT"

if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "❌ DATABASE_URL is required via environment or $ENV_FILE"
    exit 1
fi

echo "🚀 Deploying JoyJoin via self-managed Docker Compose ($ENVIRONMENT)..."
echo "📦 Repo root: $REPO_ROOT"
echo "🗄️  Database target: external PostgreSQL from DATABASE_URL"

echo "🐳 Step 1: Rebuild and restart containers..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.caddy.yml up -d --build --remove-orphans

echo "🗄️  Step 2: Run idempotent migrations and schema push..."
cd "$REPO_ROOT"

echo "  Running column rename migration..."
if node scripts/migrate-rename-role-to-archetype.js; then
    echo "  ✅ Column rename migration completed"
else
    EXIT_CODE=$?
    echo "  ⚠️ Column rename migration returned exit code $EXIT_CODE"
    if [[ $EXIT_CODE -ne 1 ]]; then
        echo "  ❌ Unexpected migration failure"
        exit "$EXIT_CODE"
    fi
    echo "  ⚠️ Exit code 1 usually means the migration was already applied or the legacy column shape no longer matches; continuing"
fi

echo "  Running assessment constraint migration..."
if node scripts/migrate-fix-assessment-constraint.js; then
    echo "  ✅ Assessment constraint migration completed"
else
    EXIT_CODE=$?
    echo "  ❌ Assessment constraint migration failed with exit code $EXIT_CODE"
    exit "$EXIT_CODE"
fi

echo "  Running schema push..."
npx drizzle-kit push --config=apps/server/drizzle.config.ts

echo "🏥 Step 3: Verify runtime health..."
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${PORT:-5000}"
HEALTH_URL="http://$API_HOST:$API_PORT/api/health"
MAX_HEALTH_CHECK_ATTEMPTS="${MAX_HEALTH_CHECK_ATTEMPTS:-10}"
HEALTH_CHECK_RETRY_DELAY_SECONDS="${HEALTH_CHECK_RETRY_DELAY_SECONDS:-5}"
for ((health_check_attempt=1; health_check_attempt<=MAX_HEALTH_CHECK_ATTEMPTS; health_check_attempt++)); do
    if curl -fsS "$HEALTH_URL" > /dev/null; then
        break
    fi

    if [[ $health_check_attempt -eq $MAX_HEALTH_CHECK_ATTEMPTS ]]; then
        echo "❌ Deployment verification failed: API health check did not respond at $HEALTH_URL"
        echo "   The service may still be starting up, or the runtime/configuration may be unhealthy"
        exit 1
    fi

    sleep "$HEALTH_CHECK_RETRY_DELAY_SECONDS"
done

echo "✅ Deployment completed"
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "  User Portal:  https://yuejuapp.com"
    echo "  Admin Portal: https://admin.yuejuapp.com"
    echo "  API Server:   https://api.yuejuapp.com"
else
    echo "  Staging uses the same self-managed flow, but requires staging-specific env and routing to be prepared first."
fi
