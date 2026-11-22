#!/bin/bash
# Pin the images a deploy just produced as the staging delta runtime base.
#
# Why this exists
# ---------------
# Staging ships a ~13 MiB app delta instead of a ~640 MiB image pair when the
# host holds a runtime base whose dependency tree matches the incoming
# package-lock. The base only helps while BOTH the pinned images and
# .staging-runtime-base.json survive: the marker carries the lock hash that
# gates a stale base out, and the pinned tags are what the COPY-only delta
# Dockerfile inherits from.
#
# On 2026-11-22 an out-of-band on-host production rebuild
# (deployment/scripts/deploy.sh) replaced the images without re-pinning, so the
# next staging deploy logged "Remote runtime base is missing or built for a
# different lockfile; shipping the full image bundle this run" and spent over an
# hour uploading a bundle it could not finish inside the 75-minute job limit.
#
# Rule: every path that rebuilds JoyJoin images on the CVM calls this script
# afterwards. Today that is deploy.sh (on-host production rebuild) and
# deploy-staging.sh (after a full bundle delivery).
#
# Fail-open by design: pinning is an optimisation. A missing base costs one slow
# deploy; aborting the caller would leave the host half-deployed. Runtime
# problems therefore exit 0 with a warning, and only bad usage exits non-zero.
#
# Usage
# -----
#   pin-runtime-base.sh --api-image <ref> --admin-image <ref> \
#     [--lock-file <path>] [--marker <path>] \
#     [--api-base <tag>] [--admin-base <tag>] \
#     [--sha <sha>] [--source <label>]
#
# Manual repair example:
#   ./deployment/scripts/pin-runtime-base.sh \
#     --api-image deployment-joyjoin-api:latest \
#     --admin-image deployment-joyjoin-admin:latest \
#     --lock-file package-lock.json \
#     --marker deployment/.staging-runtime-base.json

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deployment"

API_IMAGE=""
ADMIN_IMAGE=""
LOCK_FILE="$REPO_ROOT/package-lock.json"
LOCK12_OVERRIDE=""
MARKER="$DEPLOY_DIR/.staging-runtime-base.json"
API_BASE="joyjoin-api-runtime-base:api"
ADMIN_BASE="joyjoin-admin-runtime-base:admin"
SHA="unknown"
SOURCE="unknown"

usage() {
    cat <<'EOF'
Usage: pin-runtime-base.sh --api-image <ref> --admin-image <ref> [options]

Required:
  --api-image <ref>     Image just built/loaded for the API (tag or sha256 id)
  --admin-image <ref>   Image just built/loaded for the admin portal

Optional:
  --lock-file <path>    package-lock.json to hash (default: <repo>/package-lock.json)
  --lock <hash12>       Use this 12-char lock hash instead of hashing --lock-file
  --marker <path>       Marker file written for the delta deploy gate
                        (default: <repo>/deployment/.staging-runtime-base.json)
  --api-base <tag>      Base tag for the API (default: joyjoin-api-runtime-base:api)
  --admin-base <tag>    Base tag for the admin (default: joyjoin-admin-runtime-base:admin)
  --sha <sha>           Commit recorded in the marker (default: unknown)
  --source <label>      Caller label recorded in logs (default: unknown)
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --api-image) API_IMAGE="${2:-}"; shift 2 ;;
        --admin-image) ADMIN_IMAGE="${2:-}"; shift 2 ;;
        --lock-file) LOCK_FILE="${2:-}"; shift 2 ;;
        --marker) MARKER="${2:-}"; shift 2 ;;
        --api-base) API_BASE="${2:-}"; shift 2 ;;
        --admin-base) ADMIN_BASE="${2:-}"; shift 2 ;;
        --lock) LOCK12_OVERRIDE="${2:-}"; shift 2 ;;
        --sha) SHA="${2:-}"; shift 2 ;;
        --source) SOURCE="${2:-}"; shift 2 ;;
        -h|--help) usage; exit 0 ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ -z "$API_IMAGE" || -z "$ADMIN_IMAGE" ]]; then
    echo "Missing required --api-image / --admin-image." >&2
    usage >&2
    exit 2
fi

skip() {
    echo "  Skipped runtime base pin (${SOURCE}): $*"
    echo "  The next staging deploy uses the full image bundle unless a base is restored."
    exit 0
}

if ! command -v docker >/dev/null 2>&1; then
    skip "docker is not available"
fi

if [[ ! -s "$LOCK_FILE" ]]; then
    skip "lockfile not found at ${LOCK_FILE}"
fi

if ! docker image inspect "$API_IMAGE" >/dev/null 2>&1; then
    skip "image ${API_IMAGE} is not present locally"
fi

if ! docker image inspect "$ADMIN_IMAGE" >/dev/null 2>&1; then
    skip "image ${ADMIN_IMAGE} is not present locally"
fi

if command -v sha256sum >/dev/null 2>&1; then
    lock12="$(sha256sum "$LOCK_FILE" | cut -c1-12)"
else
    lock12="$(shasum -a 256 "$LOCK_FILE" | cut -c1-12)"
fi

# The deploy workflow already computes the lock hash it puts in the delta
# payload; honour it so the marker and the payload can never disagree.
if [[ -n "$LOCK12_OVERRIDE" ]]; then
    lock12="$LOCK12_OVERRIDE"
fi

if [[ -z "$lock12" ]]; then
    skip "could not determine the lock hash for ${LOCK_FILE}"
fi

if ! docker image tag "$API_IMAGE" "$API_BASE" >/dev/null 2>&1; then
    skip "could not tag ${API_IMAGE} as ${API_BASE}"
fi

if ! docker image tag "$ADMIN_IMAGE" "$ADMIN_BASE" >/dev/null 2>&1; then
    skip "could not tag ${ADMIN_IMAGE} as ${ADMIN_BASE}"
fi

marker_dir="$(dirname "$MARKER")"
mkdir -p "$marker_dir"
marker_tmp="${MARKER}.tmp"
if ! printf '{"lock":"%s","sha":"%s","updatedAt":"%s"}\n' \
    "$lock12" "$SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$marker_tmp"; then
    rm -f "$marker_tmp"
    skip "could not write ${MARKER}"
fi
mv -f "$marker_tmp" "$MARKER"

# Anchor each base to a never-started container so the age-filtered
# `docker image prune --filter until=24h` used by the deploy paths cannot delete
# a base that no running container references.
for base_pair in "api:$API_BASE" "admin:$ADMIN_BASE"; do
    keepalive_name="joyjoin-runtime-base-keepalive-${base_pair%%:*}"
    docker rm -f "$keepalive_name" >/dev/null 2>&1 || true
    docker create --name "$keepalive_name" "${base_pair#*:}" true >/dev/null 2>&1 || true
done

echo "  Pinned runtime base images for delta deploys (lock ${lock12}, source ${SOURCE})."
exit 0
