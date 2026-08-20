#!/bin/bash
set -euo pipefail

# Production deployment script for JoyJoin.
# Run this ON the remote server after CI has rsynced the repository to ~/JoyJoin.
# All required environment variables are exported by the caller (GitHub Actions).

# Production and staging share this host-level lock. The descriptor stays open
# for the process lifetime, preventing CI and manual deploys from overlapping.
DEPLOY_LOCK_FILE="${JOYJOIN_CVM_DEPLOY_LOCK_FILE:-/var/lock/joyjoin-cvm-remote.lock}"
if ! command -v flock >/dev/null 2>&1; then
  echo "❌ flock is required to serialize deployments on this host"
  exit 1
fi
exec 9>"$DEPLOY_LOCK_FILE"
if ! flock -n 9; then
  echo "❌ Another JoyJoin deployment is already running; refusing to overlap"
  exit 75
fi

: "${DATABASE_URL:?DATABASE_URL GitHub secret is required}"
: "${SESSION_SECRET:?SESSION_SECRET GitHub secret is required}"
: "${WECHAT_APPID:?WECHAT_APPID GitHub secret is required}"
: "${WECHAT_SECRET:?WECHAT_SECRET GitHub secret is required}"

reclaim_unused_docker_data() {
  echo "🧹 Reclaiming unused Docker images and builder cache (containers/volumes preserved)..."
  if command -v timeout >/dev/null 2>&1; then
    timeout 180s docker builder prune -af || true
    timeout 120s docker image prune -af || true
  else
    docker builder prune -af || true
    docker image prune -af || true
  fi
}

retry_command() {
  local max_attempts=$1
  local delay_seconds=$2
  shift 2
  local attempt=1
  local exit_code=0

  while true; do
    if "$@"; then
      return 0
    else
      exit_code=$?
    fi
    if [ "$attempt" -ge "$max_attempts" ]; then
      echo "❌ Command failed after ${max_attempts} attempts: $*"
      return "$exit_code"
    fi

    echo "⚠️ Command failed with exit code ${exit_code}. Retrying in ${delay_seconds}s (${attempt}/${max_attempts})..."
    sleep "$delay_seconds"
    attempt=$((attempt + 1))
  done
}

disk_guard() {
  local min_bytes=8589934592
  local min_inodes=20000
  local docker_root
  local path
  local available_bytes
  local available_inodes
  local use_percent
  local needs_cleanup=false
  local -a paths=("/")

  docker_root="$(timeout 20s docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
  if [ -n "$docker_root" ] && [ -d "$docker_root" ]; then
    paths+=("$docker_root")
  fi

  for path in "${paths[@]}"; do
    available_bytes="$(df -PB1 "$path" | awk 'NR == 2 { print $4 }')"
    available_inodes="$(df -Pi "$path" | awk 'NR == 2 { print $4 }')"
    use_percent="$(df -P "$path" | awk 'NR == 2 { gsub("%", "", $5); print $5 }')"
    if (( use_percent >= 70 || available_bytes < min_bytes || available_inodes < min_inodes )); then
      needs_cleanup=true
    fi
  done

  if [ "$needs_cleanup" = "true" ]; then
    echo "⚠️ Disk is at least 70% used or below the emergency headroom. Reusing the proven unused-image cleanup before deploy..."
    reclaim_unused_docker_data
  fi

  for path in "${paths[@]}"; do
    available_bytes="$(df -PB1 "$path" | awk 'NR == 2 { print $4 }')"
    available_inodes="$(df -Pi "$path" | awk 'NR == 2 { print $4 }')"
    if (( available_bytes < min_bytes )); then
      echo "❌ Refusing production deploy: $path has less than 8 GiB free."
      echo "   Available: $available_bytes bytes."
      return 75
    fi
    if (( available_inodes < min_inodes )); then
      echo "❌ Refusing production deploy: $path has fewer than 20000 free inodes."
      echo "   Available: $available_inodes inodes."
      return 75
    fi
  done
}

on_fail() {
  local exit_code=$?
  trap - ERR
  echo "❌ Deploy failed. Preserving containers, networks, images, and volumes for diagnosis."
  echo "🧭 Disk diagnostics:"
  df -h / || true
  docker system df || true
  echo "📋 Container diagnostics:"
  docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" || true
  echo "📋 Builder cache diagnostics:"
  docker builder du || true
  exit "$exit_code"
}
trap on_fail ERR

debug_log() {
  local hypothesis_id="$1"
  local message="$2"
  local data="${3:-{}}"
  printf 'AGENT_DEBUG %s\n' "$(printf '{"runId":"deploy-migrate-debug","hypothesisId":"%s","location":"deploy-production.sh","message":"%s","data":%s,"timestamp":%s}' \
    "$hypothesis_id" "$message" "$data" "$(date +%s000)")"
}

echo "🚀 Starting JoyJoin production deployment..."
echo "🧭 Disk before:"
df -h /

disk_guard

# --- 1) Code is already synced from CI via rsync ---
echo "📥 Using code synced from CI rsync upload..."
cd ~/JoyJoin

# Ensure host dependencies are fresh for CLI tools.
# Skip Playwright browser downloads on prod host to avoid lock/contention failures.
echo "📦 Installing host dependencies (skip Playwright browser download)..."
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --no-audit --no-fund

# --- 1.5) Sync GitHub Actions secrets + variables → deployment/.env.production ---
echo "🔐 Syncing GitHub secrets/variables into deployment/.env.production..."
ENV_FILE=~/JoyJoin/deployment/.env.production
touch "$ENV_FILE"

# Remove one KEY= line and append KEY=value (safe for DATABASE_URL & special chars)
upsert_env_var() {
  local key="$1"
  local value="$2"
  local compose_value
  local tmp
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "❌ $key contains a raw newline and cannot be written safely to .env.production"
    return 1
  fi
  # Docker Compose interpolates $VAR-like text from env files; $$ preserves literal $.
  compose_value="${value//\$/\$\$}"
  tmp=$(mktemp)
  if [ -s "$ENV_FILE" ]; then
    grep -v "^${key}=" "$ENV_FILE" > "$tmp" || true
  else
    : > "$tmp"
  fi
  mv "$tmp" "$ENV_FILE"
  printf '%s=%s\n' "$key" "$compose_value" >> "$ENV_FILE"
}

upsert_if_nonempty() {
  local key="$1"
  local value="${2-}"
  [ -n "${value}" ] || return 0
  upsert_env_var "$key" "$value"
}

upsert_private_key_from_base64() {
  local encoded_value="${1-}"
  local decoded_pem
  local single_line_pem
  [ -n "$encoded_value" ] || return 0

  if ! decoded_pem="$(printf '%s' "$encoded_value" | base64 -d)"; then
    echo "❌ WECHAT_PAY_PRIVATE_KEY is not valid base64"
    return 1
  fi
  if [[ "$decoded_pem" != *"-----BEGIN PRIVATE KEY-----"* && \
        "$decoded_pem" != *"-----BEGIN RSA PRIVATE KEY-----"* ]]; then
    echo "❌ WECHAT_PAY_PRIVATE_KEY did not decode to a supported PEM private key"
    return 1
  fi

  single_line_pem="${decoded_pem//$'\r'/}"
  single_line_pem="${single_line_pem//$'\n'/\\n}"
  upsert_env_var "WECHAT_PAY_PRIVATE_KEY" "$single_line_pem"
  unset decoded_pem single_line_pem
}

upsert_env_var "DATABASE_URL" "$DATABASE_URL"

# POSTGRES_PASSWORD → deployment/.env (compose interpolation source; the
# ${POSTGRES_PASSWORD:?} in docker-compose.nginx.yml is resolved from here).
# Written RAW — .env feeds the compose interpolator only, so no $$ escaping.
# Derived from DATABASE_URL so no credential is ever hardcoded in the repo.
COMPOSE_ENV=~/JoyJoin/deployment/.env
POSTGRES_PASSWORD="$(printf '%s' "$DATABASE_URL" | sed -nE 's|^postgres(ql)?://[^:]+:([^@]+)@.*|\2|p')"
if [ -n "$POSTGRES_PASSWORD" ]; then
  compose_tmp=$(mktemp)
  grep -v '^POSTGRES_PASSWORD=' "$COMPOSE_ENV" > "$compose_tmp" || true
  mv "$compose_tmp" "$COMPOSE_ENV"
  printf 'POSTGRES_PASSWORD=%s\n' "$POSTGRES_PASSWORD" >> "$COMPOSE_ENV"
else
  echo "❌ Could not extract POSTGRES_PASSWORD from DATABASE_URL" >&2
  exit 1
fi
upsert_env_var "SESSION_SECRET" "$SESSION_SECRET"
upsert_env_var "WECHAT_APPID" "$WECHAT_APPID"
upsert_env_var "WECHAT_SECRET" "$WECHAT_SECRET"

upsert_if_nonempty "DEEPSEEK_API_KEY" "$DEEPSEEK_API_KEY"
upsert_if_nonempty "JWT_SECRET" "$JWT_SECRET"
upsert_if_nonempty "ADMIN_CREATE_SECRET_KEY" "$ADMIN_CREATE_SECRET_KEY"
upsert_if_nonempty "MINIMAX_API_KEY" "$MINIMAX_API_KEY"
upsert_if_nonempty "WECHAT_PAY_APP_ID" "$WECHAT_PAY_APP_ID"
upsert_if_nonempty "WECHAT_PAY_MCH_ID" "$WECHAT_PAY_MCH_ID"
upsert_if_nonempty "WECHAT_PAY_SERIAL_NO" "$WECHAT_PAY_SERIAL_NO"
upsert_private_key_from_base64 "${WECHAT_PAY_PRIVATE_KEY_B64:-}"
upsert_if_nonempty "WECHAT_PAY_APIV3_KEY" "$WECHAT_PAY_APIV3_KEY"
upsert_if_nonempty "WECHAT_PAY_PLATFORM_CERT" "${WECHAT_PAY_PLATFORM_CERT_B64:-}"

upsert_if_nonempty "NODE_ENV" "$NODE_ENV"
upsert_if_nonempty "PORT" "$PORT"
upsert_if_nonempty "APP_URL" "$APP_URL"
upsert_if_nonempty "COOKIE_DOMAIN" "$COOKIE_DOMAIN"
upsert_if_nonempty "CORS_ORIGINS" "$CORS_ORIGINS"
upsert_if_nonempty "ALLOWED_ORIGINS" "$ALLOWED_ORIGINS"
upsert_if_nonempty "PAYMENTS_ENABLED" "$PAYMENTS_ENABLED"
upsert_if_nonempty "MINIMAX_BASE_URL" "$MINIMAX_BASE_URL"
upsert_if_nonempty "MINIMAX_MODEL" "$MINIMAX_MODEL"
upsert_if_nonempty "MINIMAX_TIMEOUT_MS" "$MINIMAX_TIMEOUT_MS"
upsert_if_nonempty "CREATIVE_AI_PROVIDER" "$CREATIVE_AI_PROVIDER"
upsert_if_nonempty "CREATIVE_AI_TAGS_PROVIDER" "$CREATIVE_AI_TAGS_PROVIDER"
upsert_if_nonempty "CREATIVE_AI_THEME_PROVIDER" "$CREATIVE_AI_THEME_PROVIDER"
upsert_if_nonempty "CREATIVE_AI_TITLE_PROVIDER" "$CREATIVE_AI_TITLE_PROVIDER"
upsert_if_nonempty "AI_TIMEOUT_MS" "$AI_TIMEOUT_MS"

upsert_if_nonempty "TENCENT_MAP_KEY" "$TENCENT_MAP_KEY"
upsert_if_nonempty "TENCENT_MAP_JS_KEY" "$TENCENT_MAP_JS_KEY"
upsert_if_nonempty "SOCIAL_AI_PROVIDER" "$SOCIAL_AI_PROVIDER"
upsert_if_nonempty "SOCIAL_AUCTION_LLM_ENABLED" "$SOCIAL_AUCTION_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_MICRO_CHALLENGE_LLM_ENABLED" "$SOCIAL_MICRO_CHALLENGE_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_MINISCRIPT_LLM_ENABLED" "$SOCIAL_MINISCRIPT_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_WARMUP_LLM_ENABLED" "$SOCIAL_WARMUP_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_LIE_DETECTIVE_LLM_ENABLED" "$SOCIAL_LIE_DETECTIVE_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_PERSONALITY_DICE_LLM_ENABLED" "$SOCIAL_PERSONALITY_DICE_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_GROUP_MIRROR_LLM_ENABLED" "$SOCIAL_GROUP_MIRROR_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_UNDERCOVER_WORD_LLM_ENABLED" "$SOCIAL_UNDERCOVER_WORD_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_QUIP_BATTLE_LLM_ENABLED" "$SOCIAL_QUIP_BATTLE_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_RECAP_LLM_ENABLED" "$SOCIAL_RECAP_LLM_ENABLED"
upsert_if_nonempty "SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT" "$SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT"
upsert_if_nonempty "RUN_PLAN_TEMPLATES_ENABLED" "$RUN_PLAN_TEMPLATES_ENABLED"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_AUCTION" "$SOCIAL_ICEBREAKER_ENABLE_AUCTION"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE" "$SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE"
upsert_if_nonempty "PERSONALITY_DICE_CHOOSE_MODE_ENABLED" "$PERSONALITY_DICE_CHOOSE_MODE_ENABLED"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR" "$SOCIAL_ICEBREAKER_ENABLE_GROUP_MIRROR"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD" "$SOCIAL_ICEBREAKER_ENABLE_UNDERCOVER_WORD"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE" "$SOCIAL_ICEBREAKER_ENABLE_QUIP_BATTLE"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_SPEED_FRIENDING" "$SOCIAL_ICEBREAKER_ENABLE_SPEED_FRIENDING"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT" "$SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT"
upsert_if_nonempty "SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER" "$SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER"
upsert_if_nonempty "MASCOT_DISPLAY_NAME" "$MASCOT_DISPLAY_NAME"
upsert_if_nonempty "MASCOT_BACKSTORY_ENABLED" "$MASCOT_BACKSTORY_ENABLED"
upsert_if_nonempty "MASCOT_ORIGIN_LORE_ENABLED" "$MASCOT_ORIGIN_LORE_ENABLED"
upsert_if_nonempty "DEBUG_AUTH" "$DEBUG_AUTH"
upsert_if_nonempty "ENABLE_MATCHER_V2" "$ENABLE_MATCHER_V2"
upsert_if_nonempty "ENABLE_SEMANTIC_SIMILARITY" "$ENABLE_SEMANTIC_SIMILARITY"
upsert_if_nonempty "EMBEDDING_BASE_URL" "$EMBEDDING_BASE_URL"
upsert_if_nonempty "EMBEDDING_MODEL" "$EMBEDDING_MODEL"
upsert_if_nonempty "ENABLE_ADAPTIVE_WEIGHTS" "$ENABLE_ADAPTIVE_WEIGHTS"
upsert_if_nonempty "LOG_LEVEL" "$LOG_LEVEL"
upsert_if_nonempty "SOCIAL_DEFAULT_REASONING_EFFORT" "$SOCIAL_DEFAULT_REASONING_EFFORT"
upsert_if_nonempty "DEEPSEEK_PRO_DAILY_BUDGET_USD" "$DEEPSEEK_PRO_DAILY_BUDGET_USD"
upsert_if_nonempty "ENABLE_PRO_MATCH_EXPLANATIONS" "$ENABLE_PRO_MATCH_EXPLANATIONS"
upsert_if_nonempty "XIAOYUE_MAX_TURNS" "$XIAOYUE_MAX_TURNS"
upsert_if_nonempty "WECHAT_PAY_NOTIFY_URL" "$WECHAT_PAY_NOTIFY_URL"

chmod 600 "$ENV_FILE" || true

# --- 2) DB Sync (same DATABASE_URL as API) ---
echo "🗄️ Syncing database schema..."
cd ~/JoyJoin

DB_META_JSON=$(node -e 'const u=process.env.DATABASE_URL||"";try{const p=new URL(u);const out={protocol:p.protocol.replace(":",""),host:p.hostname,port:p.port||"default",database:p.pathname.replace(/^\/+/,""),hasPassword:Boolean(p.password),hasUser:Boolean(p.username)};process.stdout.write(JSON.stringify(out));}catch{process.stdout.write(JSON.stringify({parseError:true,length:u.length}));}')
debug_log "H1" "database_url_metadata" "$DB_META_JSON"

# Verify journal integrity before running migrations
echo "   Verifying migration journal..."
node scripts/verify/verify-journal-sync.mjs

MIGRATION_FILES_JSON=$(node - <<'NODE'
const fs = require('fs');
const path = require('path');
const migrationsDir = path.join(process.cwd(), 'apps/server/migrations');
const metaJournal = path.join(migrationsDir, 'meta/_journal.json');
const files = fs.readdirSync(migrationsDir).filter((n) => n.endsWith('.sql'));
const journal = JSON.parse(fs.readFileSync(metaJournal, 'utf8'));
process.stdout.write(JSON.stringify({
  sqlFileCount: files.length,
  latestSqlFile: files.sort().at(-1) ?? null,
  journalEntryCount: Array.isArray(journal?.entries) ? journal.entries.length : null,
}));
NODE
)
debug_log "H5" "migration_files_and_journal_snapshot" "$MIGRATION_FILES_JSON"

PG_PROBE_JSON=$(node - <<'NODE'
const { Client } = require('pg');
(async () => {
  const started = Date.now();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const r = await client.query('select now() as now');
    process.stdout.write(JSON.stringify({ ok: true, latencyMs: Date.now() - started, now: r.rows?.[0]?.now ?? null }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      latencyMs: Date.now() - started,
      name: error?.name ?? null,
      code: error?.code ?? null,
      message: error?.message ?? null,
    }));
  } finally {
    try { await client.end(); } catch {}
  }
})();
NODE
)
debug_log "H2" "postgres_connectivity_probe" "$PG_PROBE_JSON"

DB_IDENTITY_JSON=$(node - <<'NODE'
const { Client } = require('pg');
(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const identity = await client.query(`
      select current_database() as database,
             current_user as db_user,
             current_schema() as schema
    `);
    const mig = await client.query(`
      select to_regclass('__drizzle_migrations') as migration_table
    `);
    process.stdout.write(JSON.stringify({
      ok: true,
      database: identity.rows?.[0]?.database ?? null,
      dbUser: identity.rows?.[0]?.db_user ?? null,
      schema: identity.rows?.[0]?.schema ?? null,
      migrationTable: mig.rows?.[0]?.migration_table ?? null,
    }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      code: error?.code ?? null,
      message: error?.message ?? null,
    }));
  } finally {
    try { await client.end(); } catch {}
  }
})();
NODE
)
debug_log "H4" "database_identity_and_migration_table_probe" "$DB_IDENTITY_JSON"

# Production DDL is deliberately outside the application deployment. Migration
# SQL must be reviewed, backed up, and applied manually before this workflow.
# The deploy only proves that the configured database is reachable and that the
# checked-in SQL/journal inventory is internally consistent.
echo "   Verifying read-only production database connectivity..."
docker exec postgres \
  psql -U joyjoin -d joyjoin -v ON_ERROR_STOP=1 -Atc 'SELECT 1;' >/dev/null
echo "   ✓ Database reachable; no DDL, migration, or seed was executed"

# --- 3) Sync and reload Nginx BEFORE restarting containers ---
echo "🌐 Syncing and reloading host Nginx config..."
REQUIRED_TLS_FILES=(
  /etc/letsencrypt/live/joyjoinapp.com/fullchain.pem
  /etc/letsencrypt/live/joyjoinapp.com/privkey.pem
  /etc/letsencrypt/live/admin.joyjoinapp.com/fullchain.pem
  /etc/letsencrypt/live/admin.joyjoinapp.com/privkey.pem
)
OPTIONAL_TLS_DOMAINS=(api.joyjoinapp.com)
missing_tls=0
for tls_file in "${REQUIRED_TLS_FILES[@]}"; do
  if ! sudo test -r "$tls_file"; then
    echo "❌ Missing required TLS certificate file: $tls_file"
    missing_tls=1
  fi
done
if [ "$missing_tls" -ne 0 ]; then
  echo "⚠️ Provisioning missing Let's Encrypt certificates..."
  MISSING_DOMAINS=$(for f in "${REQUIRED_TLS_FILES[@]}"; do
    if ! sudo test -r "$f"; then
      echo "$f" | sed -n 's|/etc/letsencrypt/live/\(.*\)/.*|\1|p'
    fi
  done | sort -u)
  for domain in $MISSING_DOMAINS; do
    echo "   Provisioning cert for: $domain"
    sudo certbot --nginx -d "$domain" --non-interactive --agree-tos --email ops@joyjoin.com --no-redirect || \
      sudo certbot certonly --standalone -d "$domain" --non-interactive --agree-tos --email ops@joyjoin.com || \
      { echo "❌ Failed to provision cert for $domain"; exit 1; }
  done
  for tls_file in "${REQUIRED_TLS_FILES[@]}"; do
    if ! sudo test -r "$tls_file"; then
      echo "❌ Still missing after provisioning: $tls_file"
      exit 1
    fi
  done
  echo "✅ All required TLS certificates provisioned successfully"
fi
for domain in "${OPTIONAL_TLS_DOMAINS[@]}"; do
  cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
  if sudo test -r "$cert_path"; then
    echo "   ✓ Optional cert already exists for: $domain"
  else
    echo "   ⚠️ Attempting cert for optional domain: $domain (non-fatal)"
    sudo certbot --nginx -d "$domain" --non-interactive --agree-tos --email ops@joyjoin.com --no-redirect || \
    sudo certbot certonly --standalone -d "$domain" --non-interactive --agree-tos --email ops@joyjoin.com --preferred-challenges http || \
    echo "   ⚠️ Skipping $domain — DNS may not resolve to this server"
  fi
done
sudo cp ~/JoyJoin/deployment/nginx/joyjoin.conf /etc/nginx/conf.d/joyjoin.conf
sudo nginx -t
sudo systemctl reload nginx
echo "🔎 Active Nginx joyjoin.conf markers..."
sudo awk 'NR<=120{print}' /etc/nginx/conf.d/joyjoin.conf | sed -n '/X-JoyJoin-Edge/p;/X-JoyJoin-Proxy/p;/upstream joyjoin_api/,/}/p'

# --- 4) Restart containers (database remains untouched) ---
echo "🐳 Restarting application containers (database remains untouched)..."
cd ~/JoyJoin/deployment
disk_guard

# 2026-08-20: registry-image delivery — production API/Admin images are built
# and pushed to GHCR on the GitHub runner (deploy-production.yml build-images),
# pulled here, and retagged to the compose refs. The CVM never compiles.
# Falls back to the legacy on-box `--build` when the workflow did not supply
# registry refs/token (e.g. GHCR_TOKEN unavailable for the prod environment).
if [[ "${PROD_IMAGES_READY:-false}" == "true" \
      && -n "${PROD_API_IMAGE:-}" && -n "${PROD_ADMIN_IMAGE:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "📦 Registry delivery: pulling production images from GHCR..."
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-x-access-token}" --password-stdin

  # Resolve the exact compose image refs (implicit <project>-<service> tags)
  # instead of hardcoding them, so a compose rename cannot silently diverge.
  mapfile -t COMPOSE_IMAGES < <(docker compose -f docker-compose.nginx.yml config --images)
  PROD_API_REF="$(printf '%s\n' "${COMPOSE_IMAGES[@]}" | rg 'joyjoin-api$' | head -1)"
  PROD_ADMIN_REF="$(printf '%s\n' "${COMPOSE_IMAGES[@]}" | rg 'joyjoin-admin$' | head -1)"
  if [[ -z "${PROD_API_REF:-}" || -z "${PROD_ADMIN_REF:-}" ]]; then
    echo "❌ Could not resolve compose image refs for registry delivery."
    exit 1
  fi
  echo "   API image   → $PROD_API_REF ($PROD_API_IMAGE)"
  echo "   Admin image → $PROD_ADMIN_REF ($PROD_ADMIN_IMAGE)"

  retry_command 5 15 timeout --signal=TERM --kill-after=30s 12m docker pull "$PROD_API_IMAGE"
  retry_command 5 15 timeout --signal=TERM --kill-after=30s 12m docker pull "$PROD_ADMIN_IMAGE"
  if [[ "$PROD_API_IMAGE" != "$PROD_API_REF" ]]; then
    docker image tag "$PROD_API_IMAGE" "$PROD_API_REF"
  fi
  if [[ "$PROD_ADMIN_IMAGE" != "$PROD_ADMIN_REF" ]]; then
    docker image tag "$PROD_ADMIN_IMAGE" "$PROD_ADMIN_REF"
  fi
  retry_command 3 15 docker compose -f docker-compose.nginx.yml up -d --no-deps joyjoin-api joyjoin-admin
else
  echo "🏗️ Legacy delivery: building production images on-box..."
  retry_command 3 15 docker compose -f docker-compose.nginx.yml up -d --build --no-deps joyjoin-api joyjoin-admin
fi

echo "🐳 Starting granite-embedding (built locally from deploy/granite-embedding, non-blocking)..."
if docker compose -f docker-compose.nginx.yml up -d --build --no-deps granite-embedding; then
  echo "   ✅ granite-embedding started"
else
  echo "   ⚠️ granite-embedding failed to build/start — semantic matching stays at 6D until next deploy"
fi

# --- 5) Health checks ---
echo "🏥 Verifying service status..."
sleep 10

echo "   Checking internal API..."
curl -s --retry 5 --retry-delay 3 http://127.0.0.1:5000/api/health > /dev/null \
  || (echo "❌ API failed on 5000" && docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" && docker logs joyjoin-api --tail 120 && exit 1)

echo "   Checking Nginx-routed health endpoint..."
if ! curl -s --retry 5 --retry-delay 3 -H "Host: joyjoinapp.com" http://127.0.0.1/api/health > /dev/null; then
  echo "❌ Nginx route check failed: http://127.0.0.1/api/health"
  echo "📋 Socket listeners (80/443/5000):"
  ss -ltnp | rg ':80|:443|:5000' || true
  echo "📋 Container status:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo "📋 API port bindings:"
  docker inspect joyjoin-api --format '{{json .NetworkSettings.Ports}}' || true
  echo "📋 Local direct probes:"
  curl -sSI http://127.0.0.1:5000/api/health || true
  echo "📋 Container logs:"
  docker logs joyjoin-api --tail 120 || true
  exit 1
fi
echo "   Nginx route response headers:"
curl -sSI -H "Host: joyjoinapp.com" http://127.0.0.1/api/health || true

# --- 6) Post-deploy cleanup ---
reclaim_unused_docker_data

echo "🧭 Disk after:"
df -h /
echo "✅ Production deployment successful!"
