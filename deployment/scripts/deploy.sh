#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deployment"
ENV_FILE="$DEPLOY_DIR/.env.production"

if [[ "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "Usage: ./deployment/scripts/deploy.sh production"
    echo "   The current Docker Compose + Nginx stack is production-only; staging needs its own compose/env/domain setup."
    exit 1
fi

cd "$REPO_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Missing required runtime env file: $ENV_FILE"
    exit 1
fi

if ! grep -Eq '^DATABASE_URL=' "$ENV_FILE"; then
    echo "❌ $ENV_FILE must define DATABASE_URL so Docker Compose and migrations target the same database"
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

retry_command() {
    local max_attempts=$1
    local delay_seconds=$2
    shift 2
    local attempt=1
    local exit_code=0

    while true; do
        if "$@"; then
            return 0
        fi

        exit_code=$?
        if [[ $attempt -ge $max_attempts ]]; then
            echo "❌ Command failed after ${max_attempts} attempts: $*"
            return "$exit_code"
        fi

        echo "⚠️ Command failed with exit code ${exit_code}. Retrying in ${delay_seconds}s (${attempt}/${max_attempts})..."
        sleep "$delay_seconds"
        attempt=$((attempt + 1))
    done
}

echo "🚀 Deploying JoyJoin via self-managed Docker Compose + Nginx ($ENVIRONMENT)..."
echo "📦 Repo root: $REPO_ROOT"
echo "🗄️  Database target: external PostgreSQL from $ENV_FILE"

REQUIRED_TLS_FILES=(
    "/etc/letsencrypt/live/yuejuapp.com/fullchain.pem"
    "/etc/letsencrypt/live/yuejuapp.com/privkey.pem"
    "/etc/letsencrypt/live/admin.yuejuapp.com/fullchain.pem"
    "/etc/letsencrypt/live/admin.yuejuapp.com/privkey.pem"
    "/etc/letsencrypt/live/api.yuejuapp.com/fullchain.pem"
    "/etc/letsencrypt/live/api.yuejuapp.com/privkey.pem"
)

echo "🔐 Step 0: Verify host TLS certificate files..."
MISSING_TLS_FILES=()
for tls_file in "${REQUIRED_TLS_FILES[@]}"; do
    if ! sudo test -r "$tls_file"; then
        MISSING_TLS_FILES+=("$tls_file")
    fi
done

if [[ ${#MISSING_TLS_FILES[@]} -gt 0 ]]; then
    echo "❌ Missing required TLS certificate files for host Nginx:"
    printf '   - %s\n' "${MISSING_TLS_FILES[@]}"
    echo "   Provision the Let's Encrypt certificates on the deployment host before re-running deploy."
    echo "   Expected domains: yuejuapp.com, admin.yuejuapp.com, api.yuejuapp.com"
    echo "                  + joyjoinapp.com, admin.joyjoinapp.com, api.joyjoinapp.com"
    echo "   Cert renewal example:"
    echo "     sudo certbot certonly --nginx"
    echo "       -d yuejuapp.com -d www.yuejuapp.com -d joyjoinapp.com -d www.joyjoinapp.com"
    echo "     sudo certbot certonly --nginx -d admin.yuejuapp.com -d admin.joyjoinapp.com"
    echo "     sudo certbot certonly --nginx -d api.yuejuapp.com -d api.joyjoinapp.com"
    exit 1
fi

echo "🐳 Step 1: Rebuild and restart containers..."
cd "$DEPLOY_DIR"
echo "🧹 Removing stale joyjoin-api container if present..."
docker rm -f joyjoin-api || true
retry_command 3 15 docker compose -f docker-compose.nginx.yml up -d --build --remove-orphans

echo "🌐 Step 1.5: Sync and reload host Nginx config..."
if [[ ! -f "$DEPLOY_DIR/nginx/joyjoin.conf" ]]; then
    echo "❌ Missing Nginx config template: $DEPLOY_DIR/nginx/joyjoin.conf"
    exit 1
fi
sudo cp "$DEPLOY_DIR/nginx/joyjoin.conf" /etc/nginx/conf.d/joyjoin.conf
sudo nginx -t
sudo systemctl reload nginx
echo "🔎 Active Nginx joyjoin.conf markers:"
sudo awk 'NR<=120{print}' /etc/nginx/conf.d/joyjoin.conf | sed -n '/X-JoyJoin-Edge/p;/X-JoyJoin-Proxy/p;/upstream joyjoin_api/,/}/p'

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
npx drizzle-kit push --config=apps/server/drizzle.config.cjs

echo "🏥 Step 3: Verify runtime health..."
API_HOST="127.0.0.1"
API_PORTS=("5000")
MAX_HEALTH_CHECK_ATTEMPTS="${MAX_HEALTH_CHECK_ATTEMPTS:-10}"
HEALTH_CHECK_RETRY_DELAY_SECONDS="${HEALTH_CHECK_RETRY_DELAY_SECONDS:-5}"
API_HEALTH_OK="false"
for ((health_check_attempt=1; health_check_attempt<=MAX_HEALTH_CHECK_ATTEMPTS; health_check_attempt++)); do
    for API_PORT in "${API_PORTS[@]}"; do
        HEALTH_URL="http://$API_HOST:$API_PORT/api/health"
        if curl -fsS "$HEALTH_URL" > /dev/null; then
            API_HEALTH_OK="true"
            break 2
        fi
    done

    if [[ "$API_HEALTH_OK" == "true" ]]; then
        break
    fi

    if [[ $health_check_attempt -eq $MAX_HEALTH_CHECK_ATTEMPTS ]]; then
        echo "❌ Deployment verification failed: API health check did not respond on ports ${API_PORTS[*]}"
        echo "   The service may still be starting up, or the runtime/configuration may be unhealthy"
        exit 1
    fi

    sleep "$HEALTH_CHECK_RETRY_DELAY_SECONDS"
done

echo "🌐 Step 4: Verify Nginx route /api/health..."
if ! curl -fsS -H "Host: yuejuapp.com" "http://127.0.0.1/api/health" > /dev/null; then
    echo "❌ Nginx route check failed at http://127.0.0.1/api/health"
    echo "📋 Debug info:"
    echo "📋 Socket listeners (80/443/5000):"
    ss -ltnp | rg ':80|:443|:5000' || true
    echo "📋 Container status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo "📋 API port bindings:"
    docker inspect joyjoin-api --format '{{json .NetworkSettings.Ports}}' || true
    echo "📋 Local direct probes:"
    curl -sSI "http://127.0.0.1:5000/api/health" || true
    echo "📋 Container logs:"
    docker logs joyjoin-api --tail 120 || true
    exit 1
fi
echo "✅ Nginx route response headers:"
curl -sSI -H "Host: yuejuapp.com" "http://127.0.0.1/api/health" || true

echo "✅ Deployment completed"
if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "  User Portal:  https://yuejuapp.com | https://joyjoinapp.com"
    echo "  Admin Portal: https://admin.yuejuapp.com | https://admin.joyjoinapp.com"
    echo "  API Server:   https://api.yuejuapp.com | https://api.joyjoinapp.com"
else
    echo "  Staging uses the same self-managed flow, but requires staging-specific env and routing to be prepared first."
fi
