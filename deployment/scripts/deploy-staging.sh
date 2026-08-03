#!/bin/bash
set -Eeuo pipefail

# Staging same-server deploy helper.
# Run this ON the remote server, not from your local machine. The normal GitHub
# workflow builds images on the hosted runner, pushes them to GHCR, and passes
# STAGING_API_IMAGE / STAGING_ADMIN_IMAGE (+ GHCR_TOKEN) so this script pulls
# them. It intentionally never compiles on the shared CVM.
#
# Backward-compatible fallback: if STAGING_API_IMAGE is unset, the script looks
# for a prebuilt bundle at deployment/.staging-images.tar.gz (override with
# STAGING_IMAGE_BUNDLE=/path/to/images.tar.gz).
#
# SSH in first (adjust key path if yours is different):
#   ssh -i "~/Desktop/Business idea/JoyJoin/SSH/OpenCode.pem" root@1.12.243.104

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env.staging"
ENV_CANDIDATE="${STAGING_ENV_CANDIDATE:-}"
ENV_SOURCE_FILE="$ENV_FILE"

if [[ -n "$ENV_CANDIDATE" ]]; then
    if [[ "$ENV_CANDIDATE" != "$DEPLOY_DIR/.env.staging.candidate" ]]; then
        echo "❌ STAGING_ENV_CANDIDATE must be $DEPLOY_DIR/.env.staging.candidate"
        exit 1
    fi
    ENV_SOURCE_FILE="$ENV_CANDIDATE"
fi

cd "$REPO_ROOT"

if ! command -v flock >/dev/null 2>&1; then
    echo "❌ flock is required to serialize operations on the shared CVM."
    exit 1
fi
exec 9>/var/lock/joyjoin-cvm-remote.lock
if ! flock -n 9; then
    echo "❌ Another JoyJoin deployment or maintenance operation is already running."
    exit 75
fi

if [[ ! -s "$ENV_SOURCE_FILE" ]]; then
    echo "❌ Missing required staging env input: $ENV_SOURCE_FILE"
    echo "   Copy from deployment/.env.staging.example and fill in real values first."
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_SOURCE_FILE"
set +a

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    echo "❌ POSTGRES_PASSWORD must be defined in $ENV_SOURCE_FILE"
    exit 1
fi

# Pass the password through libpq's dedicated environment variable instead of
# interpolating it into a connection URI. URI-reserved characters in rotated
# staging passwords must not change how psql parses the connection target.
run_staging_psql() {
    docker exec -i \
        -e PGPASSWORD="$POSTGRES_PASSWORD" \
        postgres-staging \
        psql -h 127.0.0.1 -U joyjoin -d joyjoin_staging "$@"
}

PAYMENTS_ENABLED_NORMALIZED="${PAYMENTS_ENABLED:-false}"
MOCK_PAYMENTS_NORMALIZED="$(printf '%s' "${MOCK_PAYMENTS:-false}" | tr '[:upper:]' '[:lower:]')"
PROFILE_PIXEL_AVATAR_ENABLED_NORMALIZED="$(printf '%s' "${PROFILE_PIXEL_AVATAR_ENABLED:-false}" | tr '[:upper:]' '[:lower:]')"
EQUIPMENT_REWARDS_ENABLED_NORMALIZED="$(printf '%s' "${EQUIPMENT_REWARDS_ENABLED:-false}" | tr '[:upper:]' '[:lower:]')"

case "$PAYMENTS_ENABLED_NORMALIZED" in
    true|false)
        ;;
    *)
        echo "PAYMENTS_ENABLED must be exactly 'true' or 'false'."
        exit 1
        ;;
esac

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

# Safety guard: the API runs inside Docker, so localhost:5433 would point back
# at the API container rather than the staging database. Validate the effective
# host/port/database exactly without ever printing credentials.
DATABASE_TARGET="${DATABASE_URL:-}"
DATABASE_TARGET="${DATABASE_TARGET#*://}"
DATABASE_TARGET="${DATABASE_TARGET##*@}"
DATABASE_TARGET="${DATABASE_TARGET%%\?*}"
if [[ "$DATABASE_TARGET" != "postgres-staging:5432/joyjoin_staging" ]]; then
    echo "❌ STAGING_DATABASE_URL must target postgres-staging:5432/joyjoin_staging from inside Docker."
    echo "   Refusing to continue; the supplied database URL was not logged."
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

echo "🐳 Step 1: Ensure the staging database is running without recreating it..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.staging.yml up \
    -d --no-deps --no-recreate postgres-staging

echo "🗄️  Step 2: Wait for postgres-staging readiness..."
MAX_PG_WAIT_ATTEMPTS=30
PG_WAIT_DELAY=2
pg_ready=false
for ((i=1; i<=MAX_PG_WAIT_ATTEMPTS; i++)); do
    if run_staging_psql -c "SELECT 1;" > /dev/null 2>&1; then
        pg_ready=true
        break
    fi
    echo "  ⏳ postgres-staging not ready (attempt $i/$MAX_PG_WAIT_ATTEMPTS)..."
    sleep "$PG_WAIT_DELAY"
done

if [[ "$pg_ready" != "true" ]]; then
    echo "❌ postgres-staging did not become ready in time"
    echo "   Container state (no environment values):"
    docker inspect \
        --format 'status={{.State.Status}} running={{.State.Running}} exitCode={{.State.ExitCode}} oomKilled={{.State.OOMKilled}}{{if .State.Health}} health={{.State.Health.Status}}{{end}} error={{json .State.Error}}' \
        postgres-staging 2>&1 || true
    echo "   Container process/resource snapshot:"
    docker ps -a \
        --filter 'name=^/postgres-staging$' \
        --format 'container={{.Names}} status={{.Status}} image={{.Image}}' 2>&1 || true
    docker stats --no-stream \
        --format 'container={{.Name}} cpu={{.CPUPerc}} memory={{.MemUsage}} memoryPercent={{.MemPerc}} pids={{.PIDs}}' \
        postgres-staging 2>&1 || true
    echo "   Host filesystem and memory snapshot:"
    df -h "$DEPLOY_DIR" 2>&1 || true
    df -i "$DEPLOY_DIR" 2>&1 || true
    if [[ -d /var/lib/docker ]]; then
        df -h /var/lib/docker 2>&1 || true
        df -i /var/lib/docker 2>&1 || true
    fi
    free -h 2>&1 || true
    echo "   Docker disk usage snapshot:"
    docker system df 2>&1 || true
    echo "   Recent postgres-staging logs:"
    docker logs --tail 120 postgres-staging 2>&1 || true
    exit 1
fi

echo "🔎 Step 3: Verify required schema without changing the database..."
missing_schema_tables="$(
    run_staging_psql -v ON_ERROR_STOP=1 -At <<'SQL'
WITH required_tables(table_name) AS (
  VALUES
    ('equipment_items'),
    ('user_equipment_outfits'),
    ('feature_flags')
)
SELECT coalesce(string_agg(table_name, ', ' ORDER BY table_name), '')
FROM required_tables
WHERE to_regclass('public.' || table_name) IS NULL;
SQL
)"

if [[ -n "$missing_schema_tables" ]]; then
    echo "❌ Staging schema is not ready; missing table(s): $missing_schema_tables"
    echo "   Apply the checked-in migrations manually before deploying the application."
    echo "   This deploy script intentionally never runs DDL, migrations, or seeds."
    exit 1
fi

# Runtime feature flags are DB-authoritative and fall back to environment
# variables only when their DB row is absent, matching the server resolver.
profile_avatar_db_value="$(
    run_staging_psql -v ON_ERROR_STOP=1 -Atc \
        "SELECT lower(value) FROM public.feature_flags WHERE key = 'profilePixelAvatarEnabled' LIMIT 1;"
)"
equipment_rewards_db_value="$(
    run_staging_psql -v ON_ERROR_STOP=1 -Atc \
        "SELECT lower(value) FROM public.feature_flags WHERE key = 'equipmentRewardsEnabled' LIMIT 1;"
)"

is_effective_flag_enabled() {
    local db_value="$1"
    local env_fallback="$2"

    if [[ -n "$db_value" ]]; then
        [[ "$db_value" == "true" ]]
        return
    fi

    [[ "$env_fallback" == "true" ]]
}

equipment_surface_enabled=false
if is_effective_flag_enabled \
    "$profile_avatar_db_value" \
    "$PROFILE_PIXEL_AVATAR_ENABLED_NORMALIZED" || \
   is_effective_flag_enabled \
    "$equipment_rewards_db_value" \
    "$EQUIPMENT_REWARDS_ENABLED_NORMALIZED"; then
    equipment_surface_enabled=true
fi

if [[ "$equipment_surface_enabled" == "true" ]]; then
    missing_starter_slots="$(
        run_staging_psql -v ON_ERROR_STOP=1 -At <<'SQL'
WITH required_archetypes(archetype_id) AS (
  VALUES
    ('corgi'), ('rooster'), ('hamster_praise'), ('fox'),
    ('dolphin_calm'), ('spider'), ('koala'), ('octopus'),
    ('owl'), ('elephant'), ('turtle'), ('cat')
), required_slots(slot) AS (
  VALUES ('top'), ('bottom'), ('shoes'), ('accessory')
), expected AS (
  SELECT archetype_id, slot
  FROM required_archetypes
  CROSS JOIN required_slots
)
SELECT coalesce(string_agg(
  expected.archetype_id || ':' || expected.slot,
  ', ' ORDER BY expected.archetype_id, expected.slot
), '')
FROM expected
WHERE NOT EXISTS (
  SELECT 1
  FROM public.equipment_items item
  WHERE item.initial_archetype_id = expected.archetype_id
    AND item.slot = expected.slot
    AND item.is_initial IS TRUE
    AND item.is_active IS TRUE
);
SQL
    )"

    if [[ -n "$missing_starter_slots" ]]; then
        echo "❌ Equipment/Profile is enabled, but active starter items are missing: $missing_starter_slots"
        echo "   Apply the equipment catalog seed manually before deploying the application."
        exit 1
    fi

    echo "  All 12 archetypes have four active starter equipment slots."
else
    echo "  Required equipment tables are present; starter catalog check skipped because both rollout flags are disabled."
fi

COMPOSE_FILE="$DEPLOY_DIR/docker-compose.staging.yml"
STAGING_IMAGE_BUNDLE="${STAGING_IMAGE_BUNDLE:-$DEPLOY_DIR/.staging-images.tar.gz}"
API_IMAGE_REF="joyjoin-api-staging:candidate"
ADMIN_IMAGE_REF="joyjoin-admin-staging:candidate"

old_api_image_id="$(docker inspect --format '{{.Image}}' joyjoin-api-staging 2>/dev/null || true)"
old_admin_image_id="$(docker inspect --format '{{.Image}}' joyjoin-admin-staging 2>/dev/null || true)"
ROLLBACK_ARMED=false
ROLLBACK_RUNNING=false
ROLLBACK_DONE=false
ROLLBACK_FAILED=false
DEPLOY_SUCCEEDED=false
FINAL_PAYMENT_PHASE=false
EARLY_IMAGE_TAG_ROLLBACK=false
ENV_FILE_EXISTED=false
ENV_CANDIDATE_INSTALLED=false
ENV_ROLLBACK_BACKUP=""

cleanup_deploy_files() {
    if [[ "$EARLY_IMAGE_TAG_ROLLBACK" == "true" ]]; then
        restore_previous_image_tags || true
    fi
    rm -f -- "$STAGING_IMAGE_BUNDLE"
    if [[ "$ROLLBACK_FAILED" != "true" ]]; then
        if [[ -n "$ENV_CANDIDATE" ]]; then
            rm -f -- "$ENV_CANDIDATE"
        fi
        if [[ -n "$ENV_ROLLBACK_BACKUP" ]]; then
            rm -f -- "$ENV_ROLLBACK_BACKUP"
        fi
    elif [[ -n "$ENV_ROLLBACK_BACKUP" ]]; then
        echo "Rollback did not complete; preserving env backup for manual recovery: $ENV_ROLLBACK_BACKUP"
    fi
    if [[ "$ROLLBACK_FAILED" != "true" && -n "${NGINX_CONFIG_BACKUP:-}" ]]; then
        rm -f -- "$NGINX_CONFIG_BACKUP"
    elif [[ "$ROLLBACK_FAILED" == "true" && -n "${NGINX_CONFIG_BACKUP:-}" ]]; then
        echo "Rollback did not complete; preserving Nginx backup for manual recovery: $NGINX_CONFIG_BACKUP"
    fi
}
trap cleanup_deploy_files EXIT

restore_previous_image_tags() {
    if [[ -n "$old_api_image_id" ]]; then
        docker image tag "$old_api_image_id" "$API_IMAGE_REF" >/dev/null || return 1
    fi
    if [[ -n "$old_admin_image_id" ]]; then
        docker image tag "$old_admin_image_id" "$ADMIN_IMAGE_REF" >/dev/null || return 1
    fi
}

install_candidate_env() {
    local install_temp

    if [[ -z "$ENV_CANDIDATE" ]]; then
        return 0
    fi

    if [[ -f "$ENV_FILE" ]]; then
        ENV_FILE_EXISTED=true
        if ! ENV_ROLLBACK_BACKUP="$(mktemp "$DEPLOY_DIR/.env.staging.rollback.XXXXXX")"; then
            return 1
        fi
        if ! install -m 0600 "$ENV_FILE" "$ENV_ROLLBACK_BACKUP"; then
            rm -f -- "$ENV_ROLLBACK_BACKUP"
            ENV_ROLLBACK_BACKUP=""
            return 1
        fi
    fi

    if ! install_temp="$(mktemp "$DEPLOY_DIR/.env.staging.install.XXXXXX")"; then
        return 1
    fi
    # Mark the env as rollback-owned before the atomic rename. A signal in the
    # tiny rename window will restore the old file; restoring it early is safe.
    ENV_CANDIDATE_INSTALLED=true
    if ! install -m 0600 "$ENV_CANDIDATE" "$install_temp" || \
       ! mv -f -- "$install_temp" "$ENV_FILE"; then
        rm -f -- "$install_temp"
        return 1
    fi
}

restore_previous_env() {
    local restore_temp

    if [[ "$ENV_CANDIDATE_INSTALLED" != "true" ]]; then
        return 0
    fi

    if [[ "$ENV_FILE_EXISTED" == "true" && -s "$ENV_ROLLBACK_BACKUP" ]]; then
        if ! restore_temp="$(mktemp "$DEPLOY_DIR/.env.staging.restore.XXXXXX")"; then
            return 1
        fi
        if ! install -m 0600 "$ENV_ROLLBACK_BACKUP" "$restore_temp" || \
           ! mv -f -- "$restore_temp" "$ENV_FILE"; then
            rm -f -- "$restore_temp"
            return 1
        fi
    else
        rm -f -- "$ENV_FILE" || return 1
    fi
    ENV_CANDIDATE_INSTALLED=false
}

echo "📦 Step 4: Load application images built by GitHub Actions..."
DOCKER_STORAGE_PATH="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
if [[ -z "$DOCKER_STORAGE_PATH" || ! -d "$DOCKER_STORAGE_PATH" ]]; then
    DOCKER_STORAGE_PATH="$DEPLOY_DIR"
fi

USE_GHCR_PULL=false
if [[ -n "${STAGING_API_IMAGE:-}" && -n "${STAGING_ADMIN_IMAGE:-}" ]]; then
    USE_GHCR_PULL=true
fi

if [[ "$USE_GHCR_PULL" == "true" ]]; then
    echo "  Pulling staging images from GHCR (no rsync bundle required)."
    storage_use_percent="$(df -P "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
    available_bytes="$(df -PB1 "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
    available_inodes="$(df -Pi "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
    if (( storage_use_percent >= 70 || available_bytes < 4294967296 || available_inodes < 10000 )); then
        echo "  Disk is at least 70% used or below deployment headroom; pruning unused images and build cache (never containers or volumes)."
        timeout 180s docker builder prune -af || true
        timeout 120s docker image prune -af || true
    fi

    if [[ -z "${GHCR_TOKEN:-}" ]]; then
        echo "❌ GHCR_TOKEN is required to pull staging images from ghcr.io."
        exit 1
    fi
    EARLY_IMAGE_TAG_ROLLBACK=true
    if ! printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u x-access-token --password-stdin; then
        echo "❌ docker login ghcr.io failed."
        restore_previous_image_tags
        exit 1
    fi

    # Cross-Pacific GHCR pulls can stall on a single large layer. docker pull
    # resumes already-downloaded layers, so re-invoking it is a cheap, safe
    # retry that only re-fetches the incomplete layers. Each attempt is
    # time-boxed so one stalled pull cannot consume the whole deploy budget;
    # docker keeps whatever layers completed before the timeout fired.
    pull_with_retry() {
        local image="$1"
        local attempt=1
        local max_attempts=6
        local attempt_timeout=15m
        while (( attempt <= max_attempts )); do
            if timeout --signal=TERM --kill-after=30s "$attempt_timeout" docker pull "$image"; then
                return 0
            fi
            echo "  docker pull $image failed/timed out (attempt $attempt/$max_attempts); retrying in 10s (completed layers are cached)."
            sleep 10
            attempt=$((attempt + 1))
        done
        return 1
    }
    if ! pull_with_retry "$STAGING_API_IMAGE" || ! pull_with_retry "$STAGING_ADMIN_IMAGE"; then
        echo "❌ Failed to pull staging images from GHCR."
        restore_previous_image_tags
        exit 1
    fi
    if ! docker image tag "$STAGING_API_IMAGE" "$API_IMAGE_REF" || \
       ! docker image tag "$STAGING_ADMIN_IMAGE" "$ADMIN_IMAGE_REF"; then
        echo "❌ Failed to tag pulled GHCR images as staging candidates."
        restore_previous_image_tags
        exit 1
    fi
else
    if [[ ! -s "$STAGING_IMAGE_BUNDLE" ]]; then
        echo "❌ Missing prebuilt image bundle: $STAGING_IMAGE_BUNDLE"
        echo "   Run the Deploy Staging workflow; application images must not be built on this shared CVM."
        exit 1
    fi

    gzip -t "$STAGING_IMAGE_BUNDLE"
    bundle_size_bytes="$(stat -c '%s' "$STAGING_IMAGE_BUNDLE")"
    available_bytes="$(df -PB1 "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
    available_inodes="$(df -Pi "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
    storage_use_percent="$(df -P "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
    required_bytes=$((bundle_size_bytes * 5 + 2147483648))
    if (( storage_use_percent >= 70 || available_bytes < required_bytes || available_inodes < 10000 )); then
        echo "  Disk is at least 70% used or below deployment headroom; pruning unused images and build cache (never containers or volumes)."
        timeout 180s docker builder prune -af || true
        timeout 120s docker image prune -af || true
        available_bytes="$(df -PB1 "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
        available_inodes="$(df -Pi "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
    fi
    if (( available_bytes < required_bytes )); then
        echo "❌ Not enough disk headroom to load the staging images safely."
        echo "   Required: $required_bytes bytes; available: $available_bytes bytes."
        docker system df 2>&1 || true
        exit 1
    fi
    if (( available_inodes < 10000 )); then
        echo "❌ Not enough free inodes to load the staging images safely."
        echo "   Free inodes: $available_inodes (minimum: 10000)."
        exit 1
    fi

    EARLY_IMAGE_TAG_ROLLBACK=true
    if ! gzip -dc "$STAGING_IMAGE_BUNDLE" | docker load; then
        restore_previous_image_tags
        exit 1
    fi
    rm -f -- "$STAGING_IMAGE_BUNDLE"
fi

if ! docker image inspect "$API_IMAGE_REF" >/dev/null || \
   ! docker image inspect "$ADMIN_IMAGE_REF" >/dev/null; then
    echo "❌ The staged images did not contain both expected staging image refs."
    restore_previous_image_tags
    exit 1
fi

new_api_image_id="$(docker image inspect --format '{{.Id}}' "$API_IMAGE_REF")"
new_admin_image_id="$(docker image inspect --format '{{.Id}}' "$ADMIN_IMAGE_REF")"
available_bytes="$(df -PB1 "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
available_inodes="$(df -Pi "$DOCKER_STORAGE_PATH" | awk 'NR == 2 { print $4 }')"
if (( available_bytes < 2147483648 || available_inodes < 10000 )); then
    echo "❌ Docker image load left insufficient emergency headroom; refusing to switch containers."
    echo "   Available: $available_bytes bytes and $available_inodes inodes."
    if restore_previous_image_tags; then
        if [[ -z "$old_api_image_id" && "$new_api_image_id" != "$old_api_image_id" ]]; then
            docker image rm "$API_IMAGE_REF" >/dev/null 2>&1 || true
        fi
        if [[ -z "$old_admin_image_id" && "$new_admin_image_id" != "$old_admin_image_id" ]]; then
            docker image rm "$ADMIN_IMAGE_REF" >/dev/null 2>&1 || true
        fi
        if [[ -n "$new_api_image_id" && "$new_api_image_id" != "$old_api_image_id" ]]; then
            docker image rm "$new_api_image_id" >/dev/null 2>&1 || true
        fi
        if [[ -n "$new_admin_image_id" && "$new_admin_image_id" != "$old_admin_image_id" ]]; then
            docker image rm "$new_admin_image_id" >/dev/null 2>&1 || true
        fi
    fi
    exit 1
fi

NGINX_CONFIG_PATH=/etc/nginx/conf.d/joyjoin.conf
NGINX_CONFIG_BACKUP="$(mktemp)"
NGINX_CONFIG_EXISTED=false
if sudo test -f "$NGINX_CONFIG_PATH"; then
    sudo cp "$NGINX_CONFIG_PATH" "$NGINX_CONFIG_BACKUP"
    NGINX_CONFIG_EXISTED=true
fi

restore_nginx_config() {
    if [[ "$NGINX_CONFIG_EXISTED" == "true" ]]; then
        sudo install -m 0644 "$NGINX_CONFIG_BACKUP" "$NGINX_CONFIG_PATH"
    else
        sudo rm -f -- "$NGINX_CONFIG_PATH"
    fi
}

sync_payments_flag() {
    local enabled_value="$1"

    case "$enabled_value" in
        true|false)
            ;;
        *)
            echo "Refusing to write invalid paymentsEnabled value: $enabled_value"
            return 1
            ;;
    esac

    run_staging_psql -v ON_ERROR_STOP=1 <<SQL
INSERT INTO public.feature_flags (key, value, description, updated_at, updated_by)
VALUES (
  'paymentsEnabled',
  '${enabled_value}',
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
}

sync_and_verify_payments_flag() {
    local expected_value="$1"
    local observed_value

    if ! sync_payments_flag "$expected_value"; then
        return 1
    fi
    if ! observed_value="$(
        run_staging_psql -v ON_ERROR_STOP=1 -Atc \
            "SELECT lower(value) FROM public.feature_flags WHERE key = 'paymentsEnabled' LIMIT 1;"
    )"; then
        return 1
    fi
    if [[ "$observed_value" != "$expected_value" ]]; then
        echo "paymentsEnabled verification failed: expected $expected_value, observed ${observed_value:-missing}"
        return 1
    fi
}

stop_staging_api_fail_closed() {
    echo "Stopping staging API because paymentsEnabled could not be confirmed false."
    if ! docker stop -t 20 joyjoin-api-staging >/dev/null 2>&1; then
        docker kill joyjoin-api-staging >/dev/null 2>&1 || true
    fi
}

ensure_payments_fail_closed() {
    if sync_and_verify_payments_flag false; then
        echo "paymentsEnabled=false verified; waiting 6 seconds for the 5-second API cache to expire."
        sleep 6
        return 0
    fi
    ROLLBACK_FAILED=true
    stop_staging_api_fail_closed
    return 1
}

verify_rollback_endpoint() {
    local url="$1"
    local label="$2"
    local attempt

    for attempt in $(seq 1 12); do
        if curl --connect-timeout 3 --max-time 6 -fsS "$url" >/dev/null; then
            echo "✅ Restored $label is reachable"
            return 0
        fi
        if (( attempt < 12 )); then
            sleep 4
        fi
    done
    echo "ROLLBACK FAILED: restored $label did not become reachable: $url"
    return 1
}

restore_previous_release() {
    local rollback_status=0
    echo "↩️  Restoring the previous staging release..."

    # A failed or interrupted release must never leave real payments enabled.
    if ! sync_and_verify_payments_flag false; then
        echo "ROLLBACK FAILED: could not persist and verify paymentsEnabled=false."
        stop_staging_api_fail_closed
        return 1
    fi

    if ! restore_previous_env; then
        echo "ROLLBACK FAILED: could not restore the previous .env.staging; old containers were not recreated with the candidate config."
        return 1
    fi
    if ! restore_previous_image_tags; then
        echo "ROLLBACK FAILED: could not restore the previous image tags."
        return 1
    fi
    if [[ -n "$old_api_image_id" ]]; then
        if ! docker compose -f "$COMPOSE_FILE" up \
            -d --no-deps --no-build --force-recreate joyjoin-api-staging; then
            rollback_status=1
        fi
    else
        docker compose -f "$COMPOSE_FILE" stop joyjoin-api-staging || rollback_status=1
    fi

    if [[ -n "$old_admin_image_id" ]]; then
        if ! docker compose -f "$COMPOSE_FILE" up \
            -d --no-deps --no-build --force-recreate joyjoin-admin-staging; then
            rollback_status=1
        fi
    else
        docker compose -f "$COMPOSE_FILE" stop joyjoin-admin-staging || rollback_status=1
    fi

    restore_nginx_config || rollback_status=1
    if sudo nginx -t; then
        sudo systemctl reload-or-restart nginx || rollback_status=1
    else
        rollback_status=1
    fi
    docker ps -a \
        --filter 'name=joyjoin-api-staging' \
        --filter 'name=joyjoin-admin-staging' \
        --format 'container={{.Names}} status={{.Status}} image={{.Image}}' 2>&1 || true
    docker logs --tail 80 joyjoin-api-staging 2>&1 || true
    docker logs --tail 40 joyjoin-admin-staging 2>&1 || true
    if [[ -n "$old_api_image_id" ]] && \
       ! verify_rollback_endpoint "http://127.0.0.1:5001/api/readyz" "staging API"; then
        rollback_status=1
    fi
    if [[ -n "$old_admin_image_id" ]] && \
       ! verify_rollback_endpoint "http://127.0.0.1:3002/" "staging Admin"; then
        rollback_status=1
    fi
    return "$rollback_status"
}

rollback_if_needed() {
    local reason="${1:-deployment did not complete}"
    local rollback_status=0

    if [[ "$ROLLBACK_ARMED" != "true" || "$ROLLBACK_RUNNING" == "true" || "$ROLLBACK_DONE" == "true" ]]; then
        return 0
    fi

    # Disarm before doing any work so ERR + EXIT (or repeated signals) cannot
    # start overlapping rollback attempts.
    ROLLBACK_RUNNING=true
    ROLLBACK_ARMED=false
    echo "Rollback triggered: $reason"
    if (
        trap - ERR EXIT
        trap '' INT TERM HUP
        set +e
        restore_previous_release
        exit $?
    ); then
        ROLLBACK_DONE=true
    else
        rollback_status=$?
        ROLLBACK_FAILED=true
        echo "ROLLBACK FAILED with exit code $rollback_status; preserving the env backup for manual recovery."
    fi
    ROLLBACK_RUNNING=false
    return 0
}

handle_deploy_error() {
    local status="$1"
    trap - ERR
    if [[ "$FINAL_PAYMENT_PHASE" == "true" ]]; then
        ensure_payments_fail_closed || true
    else
        rollback_if_needed "command failed with exit code $status"
    fi
    exit "$status"
}

handle_deploy_signal() {
    local signal_name="$1"
    local exit_code="$2"
    trap '' INT TERM HUP
    if [[ "$FINAL_PAYMENT_PHASE" == "true" ]]; then
        ensure_payments_fail_closed || true
    else
        rollback_if_needed "received $signal_name"
    fi
    exit "$exit_code"
}

handle_deploy_exit() {
    local status="$1"
    trap - ERR INT TERM HUP EXIT
    if [[ "$DEPLOY_SUCCEEDED" != "true" ]]; then
        rollback_if_needed "shell exited with status $status"
    fi
    cleanup_deploy_files
    exit "$status"
}

# Replace the early cleanup-only EXIT trap now that every prerequisite needed
# for release rollback has been captured.
trap 'handle_deploy_error "$?"' ERR
trap 'handle_deploy_signal INT 130' INT
trap 'handle_deploy_signal TERM 143' TERM
trap 'handle_deploy_signal HUP 129' HUP
trap 'handle_deploy_exit "$?"' EXIT
ROLLBACK_ARMED=true
EARLY_IMAGE_TAG_ROLLBACK=false

if [[ -n "$ENV_CANDIDATE" ]]; then
    echo "🔐 Installing the rollback-protected staging env candidate..."
    if ! install_candidate_env; then
        echo "Failed to install the staging env candidate atomically."
        exit 1
    fi
fi

echo "💳 Step 5: Force staging payments off before switching traffic..."
if ! sync_and_verify_payments_flag false; then
    echo "Failed to engage the staging payment kill switch; refusing to switch the release."
    exit 1
fi
echo "  paymentsEnabled=false persisted; waiting 6 seconds for the 5-second server cache to expire."
sleep 6

# From this point onward every abnormal shell exit or signal restores the old
# env, containers, and Nginx config. The payment kill switch remains fail-closed.
ROLLBACK_ARMED=true

echo "🌐 Step 6: Install and validate the host Nginx candidate config..."
sudo install -m 0644 "$DEPLOY_DIR/nginx/joyjoin.conf" "$NGINX_CONFIG_PATH"
if ! sudo nginx -t; then
    echo "❌ Nginx candidate config is invalid; restoring the previous file."
    exit 1
fi

echo "🚀 Step 7: Switch staging containers to the prebuilt images..."
if ! docker compose -f "$COMPOSE_FILE" up \
    -d --no-deps --no-build --force-recreate joyjoin-api-staging; then
    exit 1
fi
if ! docker compose -f "$COMPOSE_FILE" up \
    -d --no-deps --no-build --force-recreate joyjoin-admin-staging; then
    exit 1
fi
# 2026-07-31: staging's own granite-embedding (local build from
# deploy/granite-embedding). Non-blocking — embeddings degrade gracefully.
# Service name is granite-embedding-staging: it shares the compose project with
# production's docker-compose.nginx.yml, so a plain `granite-embedding` name
# would make this `up` recreate the production container.
if ! docker compose -f "$COMPOSE_FILE" up \
    -d --no-deps --build granite-embedding-staging; then
    echo "   ⚠️ granite-embedding-staging failed to build/start — semantic embeddings stay degraded until next deploy"
fi
if ! sudo systemctl reload-or-restart nginx; then
    exit 1
fi

echo "🏥 Step 8: Verify database readiness, Admin content, and public routing..."
MAX_HEALTH_CHECK_ATTEMPTS="${MAX_HEALTH_CHECK_ATTEMPTS:-10}"
HEALTH_CHECK_RETRY_DELAY_SECONDS="${HEALTH_CHECK_RETRY_DELAY_SECONDS:-5}"
HEALTH_CHECK_CONNECT_TIMEOUT_SECONDS="${HEALTH_CHECK_CONNECT_TIMEOUT_SECONDS:-4}"
HEALTH_CHECK_MAX_TIME_SECONDS="${HEALTH_CHECK_MAX_TIME_SECONDS:-12}"

retry_health_check() {
    local url=$1
    local label=$2
    local attempt=1

    while (( attempt <= MAX_HEALTH_CHECK_ATTEMPTS )); do
        if curl \
            --connect-timeout "$HEALTH_CHECK_CONNECT_TIMEOUT_SECONDS" \
            --max-time "$HEALTH_CHECK_MAX_TIME_SECONDS" \
            -fsS "$url" > /dev/null; then
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

if ! retry_health_check "http://127.0.0.1:5001/api/readyz" "Staging API readiness (local)" || \
   ! retry_health_check "https://staging.joyjoinapp.com/api/readyz" "Staging API readiness (public)" || \
   ! retry_health_check "http://127.0.0.1:3002/" "Staging Admin content (local)" || \
   ! retry_health_check "https://staging.admin.joyjoinapp.com/" "Staging Admin content (public)"; then
    exit 1
fi

echo "🗺️  Step 9: Attempt the optional four-location Flash catalog bootstrap..."
if docker exec \
    -e FLASH_STAGING_APPROVED_LOCATION_CODES="NS-SEAWORLD-ART,NS-NANTOU,FT-UPPERHILLS,FT-BOOK-CITY" \
    joyjoin-api-staging \
    node dist/scripts/seed-flash-catalog.js; then
    echo "✅ Core Flash public spaces imported and approved"
else
    echo "::warning::Core Flash location bootstrap was skipped because Tencent server-side place search is unavailable."
    echo "   The healthy application release remains active; operators must select, approve, and enable locations through the audited Admin Tencent Map picker."
fi

echo "💳 Step 10: Apply the requested staging payment state after the release is healthy..."
ROLLBACK_ARMED=false
FINAL_PAYMENT_PHASE=true
if ! sync_and_verify_payments_flag "$PAYMENTS_ENABLED_NORMALIZED"; then
    echo "Failed to persist and verify the requested payment state; keeping the healthy release but forcing payments off."
    ensure_payments_fail_closed || true
    exit 1
fi
FINAL_PAYMENT_PHASE=false

if [[ "$PAYMENTS_ENABLED_NORMALIZED" == "true" ]]; then
    echo "✅ Staging paymentsEnabled feature flag set to true"
else
    echo "⚠️  Staging paymentsEnabled feature flag set to false"
fi

# The release and its requested payment state are now complete. Disarm every
# rollback trap before removing temporary files so a later shell exit cannot
# revert a successful deployment.
DEPLOY_SUCCEEDED=true
trap - ERR INT TERM HUP EXIT
cleanup_deploy_files
NGINX_CONFIG_BACKUP=""

# Keep the host from accumulating superseded staging layers. This is the same
# unused-image cleanup that recovered the host; it never removes containers,
# networks, volumes, or images referenced by a container.
timeout 180s docker builder prune -af || true
timeout 120s docker image prune -af || true

echo ""
echo "✅ Staging deployment completed"
echo "  Staging API:   https://staging.joyjoinapp.com"
echo "  Staging Admin: https://staging.admin.joyjoinapp.com"
