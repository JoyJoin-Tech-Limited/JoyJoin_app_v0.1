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

: "${DATABASE_URL:?DATABASE_URL is required via environment or $ENV_FILE}"

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
    echo "  ⚠️ Migration may already be applied, continuing"
fi

echo "  Running assessment constraint migration..."
node scripts/migrate-fix-assessment-constraint.js

echo "  Running schema push..."
npx drizzle-kit push --config=apps/server/drizzle.config.ts

echo "🏥 Step 3: Verify runtime health..."
sleep 10
curl -fsS http://127.0.0.1:5000/api/health > /dev/null

echo "✅ Deployment completed"
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "  User Portal:  https://yuejuapp.com"
    echo "  Admin Portal: https://admin.yuejuapp.com"
    echo "  API Server:   https://api.yuejuapp.com"
else
    echo "  Staging uses the same self-managed flow, but requires staging-specific env and routing to be prepared first."
fi
