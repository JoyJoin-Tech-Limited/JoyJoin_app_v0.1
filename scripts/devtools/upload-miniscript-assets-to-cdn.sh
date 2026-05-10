#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MiniScript Hero Asset CDN Upload Script
# Uploads hero WebP files to Tencent Cloud COS (or compatible S3-like storage)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Prerequisites:
#   1. Install coscmd: pip install coscmd
#   2. Configure credentials: coscmd config -a <SECRET_ID> -s <SECRET_KEY> \
#      -b <BUCKET_NAME> -r <REGION>
#   Or set environment variables:
#      COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION
#
# Usage:
#   ./scripts/upload-miniscript-assets-to-cdn.sh
#
# After upload, verify:
#   curl -I https://cdn.joyjoinapp.com/miniscript/medieval-hero.webp

set -euo pipefail

HERO_DIR="apps/mini-program/src/assets/miniscript"
CDN_BASE="https://cdn.joyjoinapp.com/miniscript"

# Check if coscmd is available
if command -v coscmd &> /dev/null; then
  UPLOADER="coscmd"
  echo "📦 Using Tencent Cloud COS (coscmd)"
elif command -v coscli &> /dev/null; then
  UPLOADER="coscli"
  echo "📦 Using Tencent Cloud COS (coscli)"
elif command -v aws &> /dev/null; then
  UPLOADER="aws"
  echo "📦 Using AWS CLI (S3-compatible)"
else
  echo "⚠️  No CDN uploader found. Install one of:"
  echo "   - pip install coscmd        (Tencent COS)"
  echo "   - brew install tencent-cloud/tcos/coscli  (Tencent COS CLI)"
  echo "   - pip install awscli        (S3-compatible)"
  echo ""
  echo "   Then configure with your bucket credentials."
  exit 1
fi

echo ""
echo "🎨 Uploading MiniScript hero assets to CDN..."
echo "   Source: $HERO_DIR"
echo "   Target: $CDN_BASE/"
echo ""

for hero in "$HERO_DIR"/*-hero.webp; do
  [ -e "$hero" ] || continue
  filename=$(basename "$hero")
  echo "  Uploading: $filename"

  case $UPLOADER in
    coscmd)
      coscmd upload "$hero" "miniscript/$filename"
      ;;
    coscli)
      coscli cp "$hero" "cos://$COS_BUCKET/miniscript/$filename"
      ;;
    aws)
      aws s3 cp "$hero" "s3://$S3_BUCKET/miniscript/$filename" --acl public-read
      ;;
  esac

done

echo ""
echo "✅ Upload complete. Verifying URLs..."
echo ""

for hero in "$HERO_DIR"/*-hero.webp; do
  filename=$(basename "$hero")
  url="$CDN_BASE/$filename"
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [ "$status" = "200" ] || [ "$status" = "304" ]; then
    echo "  ✅ $filename ($status)"
  else
    echo "  ❌ $filename (HTTP $status) — $url"
  fi
done

echo ""
echo "🚀 Next: Update DNS / CDN cache if needed"
echo "   If using Tencent Cloud CDN, purge cache for: /miniscript/*"
