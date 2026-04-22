#!/bin/bash
# Launcher for PostgreSQL MCP server that safely reads MCP_DATABASE_URL from .env
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  # Use Node.js to safely extract MCP_DATABASE_URL from .env
  MCP_DATABASE_URL=$(node -e "
    const fs = require('fs');
    const content = fs.readFileSync('$ENV_FILE', 'utf8');
    const match = content.match(/^MCP_DATABASE_URL=(.+)$/m);
    if (match) console.log(match[1].trim());
  ")
  export MCP_DATABASE_URL
fi

if [ -z "$MCP_DATABASE_URL" ]; then
  echo "Error: MCP_DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

exec npx -y @modelcontextprotocol/server-postgres "$MCP_DATABASE_URL"
