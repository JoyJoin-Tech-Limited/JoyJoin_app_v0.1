#!/usr/bin/env node
/**
 * Cursor hooks adapter: maps Cursor hook events and JSON to the repo's
 * Copilot-oriented scripts (see `.github/hooks/`).
 * Contract summary: `.cursor/hooks/README.md`
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function runNode(args, inputObj) {
  const input = typeof inputObj === 'string' ? inputObj : JSON.stringify(inputObj ?? {});
  return spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    input,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function parseJsonSafe(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return {};
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return { _parseError: true, _raw: trimmed.slice(0, 500) };
  }
}

function copilotPreToolToCursorPermission(copilotJson) {
  const decision = copilotJson.hookSpecificOutput?.permissionDecision ?? 'allow';
  const msg = copilotJson.systemMessage ?? '';
  if (decision === 'deny') {
    return {
      permission: 'deny',
      user_message: msg,
      agent_message: msg,
    };
  }
  return { permission: 'allow' };
}

function cursorToCopilotPreToolPayload(cursor) {
  const toolName = cursor.tool_name ?? cursor.toolName;
  return {
    toolName,
    tool_name: toolName,
    name: toolName,
    tool: toolName ? { name: toolName } : undefined,
    command: cursor.tool_input?.command ?? cursor.command,
    input: cursor.tool_input,
    toolInput: cursor.tool_input,
    tool_input: cursor.tool_input,
  };
}

function mergePostToolPayload(cursorPayload) {
  const t = cursorPayload.tool_name ?? cursorPayload.toolName;
  return {
    ...cursorPayload,
    toolName: t,
    tool: t ? { name: t } : cursorPayload.tool,
  };
}

const event = process.argv[2] ?? '';
const stdinRaw = readStdin();
let cursorPayload = {};
try {
  cursorPayload = stdinRaw.trim() ? JSON.parse(stdinRaw) : {};
} catch {
  cursorPayload = {};
}

if (event === 'sessionStart') {
  // Default: orchestration only (fast). Auto-eval on session start is optional — it can add
  // tens of seconds on dirty worktrees and is not required for Cursor to function.
  // Set CURSOR_SESSION_AUTO_EVAL=1 to mirror Copilot SessionStart + auto-eval message.
  const includeSessionAutoEval = process.env.CURSOR_SESSION_AUTO_EVAL === '1';
  let aeJson = {};
  if (includeSessionAutoEval) {
    const ae = runNode(['scripts/auto/auto-eval-hook.mjs', 'session-start'], {});
    aeJson = parseJsonSafe(ae.stdout);
  }
  const orch = runNode(['scripts/orchestration/orchestration-supervisor.mjs', 'copilot-hook', 'session-start'], cursorPayload);
  const orchJson = parseJsonSafe(orch.stdout);
  const parts = [];
  if (includeSessionAutoEval && aeJson.systemMessage) {
    parts.push(aeJson.systemMessage);
  }
  if (orchJson.systemMessage) {
    parts.push(orchJson.systemMessage);
  }
  const out = {};
  if (parts.length > 0) {
    out.additional_context = parts.join('\n\n');
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

if (event === 'beforeSubmitPrompt') {
  const orch = runNode(
    ['scripts/orchestration/orchestration-supervisor.mjs', 'copilot-hook', 'user-prompt-submit'],
    cursorPayload,
  );
  const orchJson = parseJsonSafe(orch.stdout);
  const out = { continue: true };
  if (orchJson.systemMessage) {
    out.additional_context = orchJson.systemMessage;
  }
  if (orchJson.continue === false) {
    out.continue = false;
    out.user_message =
      orchJson.user_message ?? orchJson.systemMessage ?? 'Prompt blocked by orchestration hook.';
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

if (event === 'postToolUse') {
  const merged = mergePostToolPayload(cursorPayload);
  const orch = runNode(['scripts/orchestration/orchestration-supervisor.mjs', 'copilot-hook', 'post-tool-use'], merged);
  const orchJson = parseJsonSafe(orch.stdout);
  const out = {};
  if (orchJson.systemMessage) {
    out.additional_context = orchJson.systemMessage;
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

if (event === 'preToolUse') {
  const copilotPayload = cursorToCopilotPreToolPayload(cursorPayload);
  const ae = runNode(['scripts/auto/auto-eval-hook.mjs', 'pre-tool-use'], copilotPayload);
  if (ae.error) {
    process.stdout.write(`${JSON.stringify({ permission: 'allow' })}\n`);
    process.exit(0);
  }
  const aeJson = parseJsonSafe(ae.stdout);
  if (aeJson._parseError) {
    process.stdout.write(`${JSON.stringify({ permission: 'allow' })}\n`);
    process.exit(0);
  }
  const cursorOut = copilotPreToolToCursorPermission(aeJson);
  process.stdout.write(`${JSON.stringify(cursorOut)}\n`);
  process.exit(0);
}

process.stderr.write(`cursor-hook-adapter: unknown event ${JSON.stringify(event)}\n`);
process.stdout.write(`${JSON.stringify({ permission: 'allow', continue: true })}\n`);
process.exit(0);
