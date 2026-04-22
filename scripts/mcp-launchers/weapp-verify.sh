#!/bin/bash
# Mini-program verification launcher using WeChat DevTools MCP
# Usage: scripts/mcp-launchers/weapp-verify.sh [page_path]
# Example: scripts/mcp-launchers/weapp-verify.sh /pages/discover/discover
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEAPP_PATH="${PROJECT_ROOT}/apps/mini-program"
PAGE_PATH="${1:-/pages/index/index}"

echo "=== JoyJoin Mini-Program Verification ==="
echo "Project: ${WEAPP_PATH}"
echo "Page: ${PAGE_PATH}"
echo ""

# Check if WeChat DevTools is running
if ! curl -s http://127.0.0.1:9420/json > /dev/null 2>&1; then
  echo "⚠️  WeChat DevTools is not running or service port is disabled."
  echo "   Please open WeChat DevTools → Settings → Security → Enable Service Port"
  exit 1
fi

# Note: Full automation via MCP requires an MCP client. This script documents
# the verification steps that should be performed via the wechat-devtools MCP server.
# In an AI session, prompt: "Use the wechat-devtools MCP server to launch the
# mini-program at ${WEAPP_PATH}, navigate to ${PAGE_PATH}, and take a screenshot."

echo "✅ WeChat DevTools service port is responding"
echo ""
echo "Next steps (run via AI agent with wechat-devtools MCP):"
echo "  1. launch projectPath=${WEAPP_PATH}"
echo "  2. navigate_to ${PAGE_PATH}"
echo "  3. get_page_data (verify data loading)"
echo "  4. Screenshot for visual validation"
echo ""
echo "Or run this verification prompt in your AI client:"
echo ""
echo "  'Launch the JoyJoin mini-program, navigate to ${PAGE_PATH},"
echo "   and verify the page renders correctly with a screenshot.'"
