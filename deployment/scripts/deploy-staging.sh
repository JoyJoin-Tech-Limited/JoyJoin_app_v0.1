#!/bin/bash
set -euo pipefail

# Staging same-server deploy helper.
# Run this ON the remote server, not from your local machine.
#
# SSH in first (adjust key path if yours is different):
#   ssh -i "~/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem" root@1.12.243.104
# Then on the server:
#   ./deployment/scripts/deploy-staging.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env.staging"

cd "$REPO_ROOT"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ Missing required runtime env file: $ENV_FILE"
    echo "   Copy from deployment/.env.staging.example and fill in real values first."
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "❌ POSTGRES_PASSWORD must be defined in $ENV_FILE"
    exit 1
fi

PAYMENTS_ENABLED_NORMALIZED="$(printf '%s' "${PAYMENTS_ENABLED:-false}" | tr '[:upper:]' '[:lower:]')"
MOCK_PAYMENTS_NORMALIZED="$(printf '%s' "${MOCK_PAYMENTS:-false}" | tr '[:upper:]' '[:lower:]')"

if [[ "$PAYMENTS_ENABLED_NORMALIZED" == "true" && "$MOCK_PAYMENTS_NORMALIZED" != "true" ]]; then
    REQUIRED_WECHAT_PAY_VARS=(
        WECHAT_PAY_APP_ID
        WECHAT_PAY_MCH_ID
        WECHAT_PAY_SERIAL_NO
        WECHAT_PAY_PRIVATE_KEY
        WECHAT_PAY_APIV3_KEY
        WECHAT_PAY_PLATFORM_CERT
    )

    MISSING_WECHAT_PAY_VARS=()
    for var_name in "${REQUIRED_WECHAT_PAY_VARS[@]}"; do
        if [[ -z "${!var_name:-}" ]]; then
            MISSING_WECHAT_PAY_VARS+=("$var_name")
        fi
    done

    if [[ ${#MISSING_WECHAT_PAY_VARS[@]} -gt 0 ]]; then
        echo "❌ Real staging payments are enabled but required WeChat Pay env vars are missing:"
        printf '   - %s\n' "${MISSING_WECHAT_PAY_VARS[@]}"
        echo "   Set these GitHub secrets before deploying real ¥0.01 payments, or set MOCK_PAYMENTS=true for mock QA."
        exit 1
    fi

    APIV3_KEY_BYTES="$(printf '%s' "${WECHAT_PAY_APIV3_KEY:-}" | wc -c | tr -d ' ')"
    if [[ "$APIV3_KEY_BYTES" != "32" ]]; then
        echo "❌ WECHAT_PAY_APIV3_KEY must be exactly 32 bytes for WeChat Pay API v3; got ${APIV3_KEY_BYTES} bytes"
        exit 1
    fi

    if [[ "${WECHAT_PAY_APP_ID:-}" != "${WECHAT_APPID:-}" ]]; then
        echo "❌ WECHAT_PAY_APP_ID must match WECHAT_APPID for mini-program JSAPI payments"
        exit 1
    fi

    if ! openssl x509 -in <(printf '%s' "${WECHAT_PAY_PLATFORM_CERT}") -noout >/dev/null 2>&1 && \
       ! openssl rsa -pubin -in <(printf '%s' "${WECHAT_PAY_PLATFORM_CERT}") -noout >/dev/null 2>&1; then
        # Value may be base64-encoded (avoids docker-compose env_file multi-line corruption).
        decoded_cert="$(printf '%s' "${WECHAT_PAY_PLATFORM_CERT}" | base64 -d 2>/dev/null || true)"
        if [[ -n "${decoded_cert}" ]] && \
           (openssl x509 -in <(printf '%s' "${decoded_cert}") -noout >/dev/null 2>&1 || \
            openssl rsa -pubin -in <(printf '%s' "${decoded_cert}") -noout >/dev/null 2>&1); then
            echo "✅ WECHAT_PAY_PLATFORM_CERT is valid (base64-encoded)"
        else
            echo "❌ WECHAT_PAY_PLATFORM_CERT is not a valid X.509 certificate or RSA public key"
            echo "   WeChat Pay now uses 微信支付公钥 (public key) mode. Download the public key from"
            echo "   商户平台 → 账户中心 → API安全 → 微信支付公钥, and paste the PEM contents into the GitHub secret."
            exit 1
        fi
    fi
fi

# Safety guard: ensure a staging deploy never targets the production database.
# CI writes .env.staging from STAGING_* secrets; this assertion catches drift.
if [[ "${DATABASE_URL:-}" != *"joyjoin_staging"* ]] && \
   [[ "${DATABASE_URL:-}" != *"localhost:5433"* ]] && \
   [[ "${DATABASE_URL:-}" != *"postgres-staging"* ]]; then
    echo "❌ DATABASE_URL does not appear to target the staging database: ${DATABASE_URL:-<unset>}"
    echo "   Refusing to continue. Check STAGING_DATABASE_URL in GitHub secrets."
    exit 1
fi

REQUIRED_TLS_FILES=(
    "/etc/letsencrypt/live/staging.joyjoinapp.com/fullchain.pem"
    "/etc/letsencrypt/live/staging.joyjoinapp.com/privkey.pem"
    "/etc/letsencrypt/live/staging.admin.joyjoinapp.com/fullchain.pem"
    "/etc/letsencrypt/live/staging.admin.joyjoinapp.com/privkey.pem"
)

echo "🔐 Step 0: Verify host TLS certificate files..."
MISSING_TLS_FILES=()
for tls_file in "${REQUIRED_TLS_FILES[@]}"; do
    if ! test -r "$tls_file"; then
        MISSING_TLS_FILES+=("$tls_file")
    fi
done

if [[ ${#MISSING_TLS_FILES[@]} -gt 0 ]]; then
    echo "❌ Missing required TLS certificate files for host Nginx:"
    printf '   - %s\n' "${MISSING_TLS_FILES[@]}"
    echo "Provision the Let's Encrypt certificates on the deployment host before re-running deploy."
    echo "   sudo certbot certonly --nginx -d staging.joyjoinapp.com"
    echo "   sudo certbot certonly --nginx -d staging.admin.joyjoinapp.com"
    exit 1
fi

echo "🔗 Step 1: Ensure repo root .env symlink points to staging env..."
if [[ -L "$REPO_ROOT/.env" ]] || [[ -f "$REPO_ROOT/.env" ]]; then
    rm -f "$REPO_ROOT/.env"
fi
ln -s "$ENV_FILE" "$REPO_ROOT/.env"

echo "🌐 Step 2: Sync and reload host Nginx config..."
sudo cp "$DEPLOY_DIR/nginx/joyjoin.conf" /etc/nginx/conf.d/joyjoin.conf
sudo nginx -t
sudo systemctl reload nginx

echo "🐳 Step 3: Rebuild and restart staging containers..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml up -d --build

echo "🗄️  Step 4: Wait for postgres-staging readiness and apply migrations..."
MIGRATIONS_DIR=apps/server/migrations
MAX_PG_WAIT_ATTEMPTS=30
PG_WAIT_DELAY=2
pg_ready=false
for ((i=1; i<=MAX_PG_WAIT_ATTEMPTS; i++)); do
    if docker exec -i postgres-staging \
        psql "postgresql://joyjoin:${POSTGRES_PASSWORD}@localhost:5432/joyjoin_staging" -c "SELECT 1;" > /dev/null 2>&1; then
        pg_ready=true
        break
    fi
    echo "  ⏳ postgres-staging not ready (attempt $i/$MAX_PG_WAIT_ATTEMPTS)..."
    sleep "$PG_WAIT_DELAY"
done

if [[ "$pg_ready" != "true" ]]; then
    echo "❌ postgres-staging did not become ready in time"
    exit 1
fi

for f in "$REPO_ROOT/$MIGRATIONS_DIR"/*.sql; do
    if [[ ! -f "$f" ]]; then
        echo "⚠️  No migration SQL files found in $REPO_ROOT/$MIGRATIONS_DIR"
        break
    fi
    echo "  Applying $(basename "$f")..."
    docker exec -i postgres-staging \
        psql "postgresql://joyjoin:${POSTGRES_PASSWORD}@localhost:5432/joyjoin_staging" < "$f"
done

echo "💳 Step 4.5: Sync staging payment feature flag with runtime env..."
docker exec -i postgres-staging \
    psql "postgresql://joyjoin:${POSTGRES_PASSWORD}@localhost:5432/joyjoin_staging" <<SQL
INSERT INTO feature_flags (key, value, description, updated_at, updated_by)
VALUES (
  'paymentsEnabled',
  '${PAYMENTS_ENABLED_NORMALIZED}',
  'Staging payment kill switch synced from PAYMENTS_ENABLED during deploy',
  now(),
  'deploy-staging'
)
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now(),
  updated_by = 'deploy-staging';
SQL

if [[ "$PAYMENTS_ENABLED_NORMALIZED" == "true" ]]; then
    echo "✅ Staging paymentsEnabled feature flag set to true"
else
    echo "⚠️  Staging paymentsEnabled feature flag set to false"
fi

echo "🏥 Step 5: Verify staging runtime health..."
MAX_HEALTH_CHECK_ATTEMPTS="${MAX_HEALTH_CHECK_ATTEMPTS:-10}"
HEALTH_CHECK_RETRY_DELAY_SECONDS="${HEALTH_CHECK_RETRY_DELAY_SECONDS:-5}"

retry_health_check() {
    local url=$1
    local label=$2
    local attempt=1

    while (( attempt <= MAX_HEALTH_CHECK_ATTEMPTS )); do
        if curl -fsS "$url" > /dev/null; then
            echo "✅ $label reachable"
            return 0
        fi
        echo "⏳ $label not ready (attempt $attempt/$MAX_HEALTH_CHECK_ATTEMPTS)..."
        sleep "$HEALTH_CHECK_RETRY_DELAY_SECONDS"
        attempt=$((attempt + 1))
    done

    echo "❌ $label health check failed: $url"
    return 1
}

retry_health_check "https://staging.joyjoinapp.com/api/health" "Staging API"
retry_health_check "https://staging.admin.joyjoinapp.com/api/health" "Staging Admin Portal"

echo ""
echo "✅ Staging deployment completed"
echo "  Staging API:   https://staging.joyjoinapp.com"
echo "  Staging Admin: https://staging.admin.joyjoinapp.com"
