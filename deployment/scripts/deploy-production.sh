#!/bin/bash
set -euo pipefail

# Production deployment script for JoyJoin.
# Run this ON the remote server after CI has rsynced the repository to ~/JoyJoin.
# All required environment variables are exported by the caller (GitHub Actions).

: "${DATABASE_URL:?DATABASE_URL GitHub secret is required}"
: "${SESSION_SECRET:?SESSION_SECRET GitHub secret is required}"
: "${WECHAT_APPID:?WECHAT_APPID GitHub secret is required}"
: "${WECHAT_SECRET:?WECHAT_SECRET GitHub secret is required}"

soft_cleanup() {
  echo "🧹 Soft cleanup (keep 7 days)..."
  docker builder prune -af --filter "until=168h" || true
  docker system prune -af --filter "until=168h" || true
}

hard_cleanup() {
  echo "🔥 Hard cleanup (aggressive, no volumes)..."
  docker builder prune -af || true
  docker system prune -af || true
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
    fi

    exit_code=$?
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
  local usep
  usep=$(df -P / | awk 'NR==2{gsub("%","",$5); print $5}')
  if [ "${usep}" -ge 85 ]; then
    echo "⚠️ Disk usage is ${usep}%. Cleanup before deploy..."
    soft_cleanup
  fi
}

on_fail() {
  echo "❌ Deploy failed. Running hard cleanup to prevent builder cache explosion..."
  hard_cleanup
  echo "🧭 Disk after hard cleanup:"
  df -h /
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
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

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

upsert_env_var "DATABASE_URL" "$DATABASE_URL"
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
if [ -n "${WECHAT_PAY_PRIVATE_KEY_B64:-}" ]; then
  upsert_env_var "WECHAT_PAY_PRIVATE_KEY" "$(echo "$WECHAT_PAY_PRIVATE_KEY_B64" | base64 -d)"
fi
upsert_if_nonempty "WECHAT_PAY_APIV3_KEY" "$WECHAT_PAY_APIV3_KEY"
if [ -n "${WECHAT_PAY_PLATFORM_CERT_B64:-}" ]; then
  upsert_env_var "WECHAT_PAY_PLATFORM_CERT" "$(echo "$WECHAT_PAY_PLATFORM_CERT_B64" | base64 -d)"
fi

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
upsert_if_nonempty "SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT" "$SOCIAL_ICEBREAKER_GLOW_TIER_VARIANT"
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

# --- Snapshot DB for safety ---
echo "   Creating pre-deploy database snapshot..."
SNAPSHOT_FILE=~/JoyJoin/deployment/pre-deploy-$(date +%Y%m%d-%H%M%S).sql
pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$SNAPSHOT_FILE" 2>&1 || echo "⚠️ pg_dump failed or not installed (non-fatal — snapshot skipped)"

# ───────────────────────────────────────────────────────────
# Schema management strategy:
#   Schema changes are defined as .sql migration files committed
#   under apps/server/migrations/ and registered in _journal.json.
#
#   On deploy, we apply any un-applied migration SQL files
#   sequentially. This is safe because each file is idempotent
#   (uses IF NOT EXISTS / DO $$ blocks).
# ───────────────────────────────────────────────────────────
echo "   Applying pending migration SQL files..."
MIGRATIONS_DIR=apps/server/migrations
for f in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  fname=$(basename "$f")
  echo "     → $fname"
  psql "$DATABASE_URL" -f "$f" -q 2>&1 || echo "     ⚠️ Migration $fname failed (may already be applied)"
done
echo "   ✓ All migration SQL files applied"

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

# --- 4) Restart containers ---
echo "🐳 Removing stale joyjoin-api container if present..."
docker rm -f joyjoin-api || true
if [ -f docker-compose.postgres.yml ]; then
  POSTGRES_OVERRIDE="-f docker-compose.postgres.yml"
  POSTGRES_SERVICE="postgres"
else
  POSTGRES_OVERRIDE=""
  POSTGRES_SERVICE=""
fi

echo "🐳 Restarting core containers (api, admin, postgres)..."
cd ~/JoyJoin/deployment
retry_command 3 15 docker compose -f docker-compose.nginx.yml $POSTGRES_OVERRIDE up -d --build joyjoin-api joyjoin-admin $POSTGRES_SERVICE

echo "🐳 Starting granite-embedding (non-blocking)..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u x-access-token --password-stdin 2>/dev/null
docker compose -f docker-compose.nginx.yml pull granite-embedding 2>/dev/null && \
  docker compose -f docker-compose.nginx.yml up -d granite-embedding || \
  echo "   ⚠️ granite-embedding skipped (image not available yet — will retry next deploy)"

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
soft_cleanup

echo "🧭 Disk after:"
df -h /
echo "✅ Production deployment successful!"
