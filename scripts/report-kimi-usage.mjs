#!/usr/bin/env node
/**
 * report-kimi-usage.mjs
 *
 * Monthly Kimi token usage across every local client that keeps usage logs:
 *
 *   1. Kimi CLI          ~/.kimi/sessions/**\/wire.jsonl
 *   2. Kimi Code CLI     ~/.kimi-code/sessions/**\/wire.jsonl
 *   3. OpenCode          ~/.local/share/opencode/opencode.db
 *
 * The report is read-only. It never uploads anything and never calls a
 * provider API. CLI JSONL files are cached by size + mtime so the first run
 * pays the scan cost and later runs are fast.
 *
 * Usage:
 *   npm run report:kimi-usage
 *   npm run report:kimi-usage -- --month 2026-10
 *   npm run report:kimi-usage -- --months 3 --json
 *
 * Notes:
 * - Months are bucketed in the machine's local timezone (CST/UTC+8 here).
 * - Kimi CLI writes a top-level StatusUpdate for every message, including
 *   subagent messages. SubagentEvent lines duplicate those same message ids.
 *   We therefore treat top-level records as authoritative and use nested
 *   records only to flag which ids came from a subagent.
 * - OpenCode's legacy `message` table overlaps `session_message`; only rows
 *   whose id does not exist in `session_message` are appended.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';

const CACHE_VERSION = 2;

const KIMI_HOME = process.env.KIMI_HOME || path.join(os.homedir(), '.kimi');
const KIMI_CODE_HOME =
  process.env.KIMI_CODE_HOME || path.join(os.homedir(), '.kimi-code');
const OPENCODE_DB =
  process.env.OPENCODE_DB ||
  path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
const CACHE_PATH =
  process.env.KIMI_USAGE_CACHE ||
  path.join(
    process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'),
    'joyjoin',
    'kimi-usage-cache.json',
  );

const KIMI_CLI_SESSIONS = path.join(KIMI_HOME, 'sessions');
const KIMI_CODE_SESSIONS = path.join(KIMI_CODE_HOME, 'sessions');

const SOURCE_LABELS = {
  kimiCli: 'Kimi CLI',
  kimiCode: 'Kimi Code',
  opencode: 'OpenCode',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function recordTotal(rec) {
  return rec.input + rec.output + rec.reasoning + rec.cacheRead + rec.cacheWrite;
}

function newBucket() {
  return {
    input: 0,
    output: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
    messages: 0,
  };
}

function addBucket(target, rec) {
  target.input += rec.input;
  target.output += rec.output;
  target.reasoning += rec.reasoning;
  target.cacheRead += rec.cacheRead;
  target.cacheWrite += rec.cacheWrite;
  target.messages += 1;
}

function addBuckets(target, source) {
  target.input += source.input;
  target.output += source.output;
  target.reasoning += source.reasoning;
  target.cacheRead += source.cacheRead;
  target.cacheWrite += source.cacheWrite;
  target.messages += source.messages;
}

function bucketTotal(bucket) {
  return (
    bucket.input +
    bucket.output +
    bucket.reasoning +
    bucket.cacheRead +
    bucket.cacheWrite
  );
}

function monthKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function isoWeekKey(ms) {
  const d = new Date(ms);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function lastMonths(count, now = new Date()) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
  }
  return months;
}

function fmt(value) {
  const n = Math.abs(value);
  if (n >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

function fmtPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtInt(value) {
  return Math.round(value).toLocaleString('en-US');
}

function warn(message) {
  process.stderr.write(`[kimi-usage] ${message}\n`);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    json: false,
    help: false,
    month: null,
    months: null,
    sessions: 10,
    showSessions: true,
    cache: true,
  };

  function takeValue(index, arg, name) {
    if (arg.includes('=')) return { value: arg.slice(arg.indexOf('=') + 1), index };
    const value = argv[index + 1];
    if (value == null) throw new Error(`${name} requires a value`);
    return { value, index: index + 1 };
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--no-sessions') {
      opts.showSessions = false;
    } else if (arg === '--no-cache') {
      opts.cache = false;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--month' || arg.startsWith('--month=')) {
      const taken = takeValue(i, arg, '--month');
      opts.month = taken.value;
      i = taken.index;
    } else if (arg === '--months' || arg.startsWith('--months=')) {
      const taken = takeValue(i, arg, '--months');
      opts.months = Number(taken.value);
      i = taken.index;
    } else if (arg === '--sessions' || arg.startsWith('--sessions=')) {
      const taken = takeValue(i, arg, '--sessions');
      opts.sessions = Number(taken.value);
      i = taken.index;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (opts.help) return opts;
  if (opts.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(opts.month)) {
    throw new Error('--month must look like YYYY-MM');
  }
  if (opts.month && opts.months != null) {
    throw new Error('Use either --month or --months, not both');
  }
  if (opts.months != null && (!Number.isInteger(opts.months) || opts.months < 1)) {
    throw new Error('--months must be a positive integer');
  }
  if (!Number.isInteger(opts.sessions) || opts.sessions < 0) {
    throw new Error('--sessions must be a non-negative integer');
  }
  return opts;
}

function printHelp() {
  console.log(`Kimi token usage report

Usage:
  npm run report:kimi-usage -- [options]

Options:
  --month YYYY-MM   Only include one local-time calendar month
  --months N        Include the last N calendar months, including this one
  --sessions N      Top OpenCode root sessions to show (default: 10)
  --no-sessions     Hide the session table
  --json            Machine-readable JSON output
  --no-cache        Re-parse every CLI wire log (ignore the cache)
  --help, -h        Show this help

JSON piping:
  npm run --silent report:kimi-usage -- --json
  (plain npm run prints its script banner to stdout, which breaks JSON parsing)

Environment:
  KIMI_HOME          Default: ~/.kimi
  KIMI_CODE_HOME     Default: ~/.kimi-code
  OPENCODE_DB        Default: ~/.local/share/opencode/opencode.db
  KIMI_USAGE_CACHE   Default: ~/.cache/joyjoin/kimi-usage-cache.json

Data sources:
  Kimi CLI           ~/.kimi/sessions/**/wire.jsonl
  Kimi Code CLI      ~/.kimi-code/sessions/**/wire.jsonl
  OpenCode           ~/.local/share/opencode/opencode.db

Totals are input + output + reasoning + cache read + cache write.
Cache reads usually dominate; they are still billed as input tokens.`);
}

// ---------------------------------------------------------------------------
// JSONL scanning + cache
// ---------------------------------------------------------------------------

function walkWireFiles(root) {
  const files = [];
  if (!fs.existsSync(root)) return files;

  function visit(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.isFile() && entry.name === 'wire.jsonl') {
        files.push(full);
      }
    }
  }

  visit(root);
  return files;
}

function loadCache(enabled) {
  if (!enabled) return { version: CACHE_VERSION, files: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (
      parsed &&
      parsed.version === CACHE_VERSION &&
      parsed.files &&
      typeof parsed.files === 'object'
    ) {
      return parsed;
    }
  } catch {
    // A missing or corrupt cache is not an error.
  }
  return { version: CACHE_VERSION, files: {} };
}

function saveCache(cache, enabled) {
  if (!enabled) return;
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache));
    fs.renameSync(tmp, CACHE_PATH);
  } catch (error) {
    warn(`could not write cache: ${error.message}`);
  }
}

async function cachedRecords(cache, file, stat, parser, state) {
  const entry = cache.files[file];
  if (
    entry &&
    entry.size === stat.size &&
    entry.mtimeMs === stat.mtimeMs &&
    Array.isArray(entry.records)
  ) {
    return entry.records;
  }

  if (!state.announced) {
    state.announced = true;
    warn('scanning CLI wire logs (first run can take a minute; results are cached)');
  }

  const records = await parser(file);
  cache.files[file] = {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    records,
  };
  state.dirty = true;
  return records;
}

/**
 * Old Kimi CLI.
 *
 * Every wire line is either a top-level StatusUpdate (the message's usage) or
 * a SubagentEvent wrapping another StatusUpdate. A subagent's own session
 * wire carries the authoritative top-level copy; the parent wire carries the
 * nested duplicate. Dedupe must therefore happen globally, not per file.
 *
 * Cached record shape:
 *   [tsMs, model, input, output, cacheRead, cacheWrite, subagent, messageId, level]
 * level 0 = top-level StatusUpdate, 1 = nested SubagentEvent StatusUpdate.
 */
async function parseOldKimiCli(file) {
  const records = [];

  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.includes('token_usage')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }

    const message = obj?.message;
    if (!message) continue;
    const ts = num(obj.timestamp) * 1000;
    if (!ts) continue;

    if (message.type === 'StatusUpdate') {
      const payload = message.payload || {};
      const usage = payload.token_usage;
      if (!usage || !payload.message_id) continue;
      records.push([
        ts,
        'kimi-cli',
        num(usage.input_other),
        num(usage.output),
        num(usage.input_cache_read),
        num(usage.input_cache_creation),
        0,
        payload.message_id,
        0,
      ]);
    } else if (message.type === 'SubagentEvent') {
      const event = message.payload?.event;
      if (event?.type !== 'StatusUpdate') continue;
      const payload = event.payload || {};
      const usage = payload.token_usage;
      if (!usage || !payload.message_id) continue;
      records.push([
        ts,
        'kimi-cli',
        num(usage.input_other),
        num(usage.output),
        num(usage.input_cache_read),
        num(usage.input_cache_creation),
        1,
        payload.message_id,
        1,
      ]);
    }
  }

  return records;
}

/**
 * New Kimi Code CLI.
 *
 * usage.record is the only authoritative record. `context.append_loop_event`
 * step.end rows repeat the same usage and are intentionally ignored. Agent
 * wires (agents/agent-N/wire.jsonl) are real additional usage and must be
 * summed; their records do not overlap the main wire.
 *
 * Cached record shape: [tsMs, model, input, output, cacheRead, cacheWrite, subagent]
 */
async function parseKimiCodeCli(file) {
  const records = [];
  const parts = path.relative(KIMI_CODE_SESSIONS, file).split(path.sep);
  const agentsIndex = parts.lastIndexOf('agents');
  const isSubagent =
    agentsIndex >= 0 && parts[agentsIndex + 1] && parts[agentsIndex + 1] !== 'main';

  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.includes('"usage.record"')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj?.type !== 'usage.record') continue;
    const ts = num(obj.time);
    if (!ts) continue;
    const usage = obj.usage || {};
    records.push([
      ts,
      obj.model || 'kimi-code/unknown',
      num(usage.inputOther),
      num(usage.output),
      num(usage.input_cache_read ?? usage.inputCacheRead),
      num(usage.input_cache_creation ?? usage.inputCacheCreation),
      isSubagent ? 1 : 0,
    ]);
  }

  return records;
}

function recordFromCache(entry) {
  return {
    ts: num(entry[0]),
    model: String(entry[1] || 'unknown'),
    provider: '',
    input: num(entry[2]),
    output: num(entry[3]),
    reasoning: 0,
    cacheRead: num(entry[4]),
    cacheWrite: num(entry[5]),
    subagent: Boolean(entry[6]),
  };
}

function kimiCodeSessionId(file) {
  const parts = path.relative(KIMI_CODE_SESSIONS, file).split(path.sep);
  const agentsIndex = parts.lastIndexOf('agents');
  if (agentsIndex > 0) return parts.slice(0, agentsIndex).join('/');
  return path.dirname(path.relative(KIMI_CODE_SESSIONS, file));
}

// ---------------------------------------------------------------------------
// Aggregation context
// ---------------------------------------------------------------------------

function createContext(opts) {
  let selectedMonths = null;
  if (opts.month) selectedMonths = new Set([opts.month]);
  else if (opts.months != null) selectedMonths = new Set(lastMonths(opts.months));

  return {
    opts,
    selectedMonths,
    totals: newBucket(),
    monthly: new Map(),
    models: new Map(),
    weekly: new Map(),
    sources: {
      kimiCli: newSource(),
      kimiCode: newSource(),
      opencode: newSource(),
    },
    // OpenCode filtered root/subagent split
    ocRoot: newBucket(),
    ocSub: newBucket(),
    // OpenCode all-time root/subagent split
    ocAllRoot: newBucket(),
    ocAllSub: newBucket(),
    rootSessions: new Map(),
    subagentSessionIds: new Set(),
    ocAllRootSessionIds: new Set(),
    ocAllSubSessionIds: new Set(),
    compactions: 0,
    compactionsAll: 0,
  };
}

function newSource() {
  return {
    available: false,
    records: 0,
    subagentRecords: 0,
    sessionIds: new Set(),
    start: null,
    end: null,
    bucket: newBucket(),
  };
}

function monthIncluded(ctx, month) {
  return !ctx.selectedMonths || ctx.selectedMonths.has(month);
}

function ingest(ctx, sourceKey, rec) {
  const source = ctx.sources[sourceKey];

  addBucket(source.bucket, rec);
  source.records += 1;
  if (rec.subagent) source.subagentRecords += 1;
  source.start = source.start == null ? rec.ts : Math.min(source.start, rec.ts);
  source.end = source.end == null ? rec.ts : Math.max(source.end, rec.ts);

  const month = monthKey(rec.ts);
  if (!monthIncluded(ctx, month)) return;

  addBucket(ctx.totals, rec);

  let monthRow = ctx.monthly.get(month);
  if (!monthRow) {
    monthRow = {
      month,
      kimiCli: 0,
      kimiCode: 0,
      opencode: 0,
      ...newBucket(),
    };
    ctx.monthly.set(month, monthRow);
  }
  monthRow[sourceKey] += recordTotal(rec);
  addBucket(monthRow, rec);

  const modelKey = `${sourceKey}\u0000${rec.provider}\u0000${rec.model}`;
  let model = ctx.models.get(modelKey);
  if (!model) {
    model = {
      sourceKey,
      source: SOURCE_LABELS[sourceKey],
      provider: rec.provider,
      model: rec.model,
      ...newBucket(),
    };
    ctx.models.set(modelKey, model);
  }
  addBucket(model, rec);

  const week = isoWeekKey(rec.ts);
  let weekBucket = ctx.weekly.get(week);
  if (!weekBucket) {
    weekBucket = { week, ...newBucket() };
    ctx.weekly.set(week, weekBucket);
  }
  addBucket(weekBucket, rec);
}

// ---------------------------------------------------------------------------
// Source scanners
// ---------------------------------------------------------------------------

async function scanOldKimiCli(ctx, cache, cacheState) {
  const source = ctx.sources.kimiCli;
  if (!fs.existsSync(KIMI_CLI_SESSIONS)) {
    warn(`Kimi CLI logs not found at ${KIMI_CLI_SESSIONS}`);
    return;
  }

  const files = walkWireFiles(KIMI_CLI_SESSIONS);
  if (!files.length) {
    warn(`no Kimi CLI wire logs under ${KIMI_CLI_SESSIONS}`);
    return;
  }

  source.available = true;

  const entries = [];
  for (const file of files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    const sessionId = path.dirname(path.relative(KIMI_CLI_SESSIONS, file));
    source.sessionIds.add(sessionId);

    const resolved = await cachedRecords(
      cache,
      file,
      stat,
      () => parseOldKimiCli(file),
      cacheState,
    );
    entries.push(...resolved);
  }

  // Global dedupe: a subagent's top-level record lives in its own session
  // wire, while the parent session wire carries a nested copy of the same
  // message id. Keep the top-level copy and use nested only for attribution.
  const topLevel = new Map();
  const nested = new Map();
  for (const entry of entries) {
    const messageId = entry[7];
    if (!messageId) continue;
    if (entry[8] === 0) topLevel.set(messageId, entry);
    else nested.set(messageId, entry);
  }
  for (const [messageId, entry] of nested) {
    if (!topLevel.has(messageId)) topLevel.set(messageId, entry);
  }
  for (const [messageId, entry] of topLevel) {
    entry[6] = nested.has(messageId) ? 1 : 0;
    ingest(ctx, 'kimiCli', recordFromCache(entry));
  }
}

async function scanKimiCodeCli(ctx, cache, cacheState) {
  const source = ctx.sources.kimiCode;
  if (!fs.existsSync(KIMI_CODE_SESSIONS)) {
    warn(`Kimi Code CLI logs not found at ${KIMI_CODE_SESSIONS}`);
    return;
  }

  const files = walkWireFiles(KIMI_CODE_SESSIONS);
  if (!files.length) {
    warn(`no Kimi Code CLI wire logs under ${KIMI_CODE_SESSIONS}`);
    return;
  }

  source.available = true;

  for (const file of files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    source.sessionIds.add(kimiCodeSessionId(file));

    const resolved = await cachedRecords(
      cache,
      file,
      stat,
      () => parseKimiCodeCli(file),
      cacheState,
    );

    for (const entry of resolved) {
      ingest(ctx, 'kimiCode', recordFromCache(entry));
    }
  }
}

function tableExists(db, name) {
  try {
    return Boolean(
      db
        .prepare("SELECT 1 AS found FROM sqlite_master WHERE type='table' AND name=?")
        .get(name),
    );
  } catch {
    return false;
  }
}

function readOpenCode(ctx) {
  const source = ctx.sources.opencode;
  if (!fs.existsSync(OPENCODE_DB)) {
    warn(`OpenCode database not found at ${OPENCODE_DB}`);
    return;
  }

  let db;
  try {
    db = new DatabaseSync(OPENCODE_DB, { readOnly: true });
  } catch (error) {
    warn(`could not open OpenCode database: ${error.message}`);
    return;
  }

  try {
    const hasSessionMessage = tableExists(db, 'session_message');
    const hasLegacyMessage = tableExists(db, 'message');

    if (!hasSessionMessage && !hasLegacyMessage) {
      warn('OpenCode database has no message tables');
      return;
    }

    const sessions = new Map();
    if (tableExists(db, 'session_v2')) {
      const rows = db
        .prepare('SELECT id, parent_id AS parentId, title FROM session_v2')
        .all();
      for (const row of rows) {
        sessions.set(row.id, {
          parentId: row.parentId || null,
          title: row.title || null,
        });
      }
    }

    source.available = true;

    const rows = [];

    if (hasSessionMessage) {
      const v2Rows = db
        .prepare(
          `SELECT
             sm.session_id AS sessionId,
             sm.time_created AS timeCreated,
             json_extract(sm.data, '$.model.providerID') AS providerID,
             json_extract(sm.data, '$.model.id') AS modelID,
             COALESCE(json_extract(sm.data, '$.tokens.input'), 0) AS input,
             COALESCE(json_extract(sm.data, '$.tokens.output'), 0) AS output,
             COALESCE(json_extract(sm.data, '$.tokens.reasoning'), 0) AS reasoning,
             COALESCE(json_extract(sm.data, '$.tokens.cache.read'), 0) AS cacheRead,
             COALESCE(json_extract(sm.data, '$.tokens.cache.write'), 0) AS cacheWrite
           FROM session_message sm
           WHERE sm.type = 'assistant'
             AND (
               lower(COALESCE(json_extract(sm.data, '$.model.providerID'), '')) LIKE '%kimi%'
               OR lower(COALESCE(json_extract(sm.data, '$.model.id'), '')) LIKE '%kimi%'
               OR lower(COALESCE(json_extract(sm.data, '$.model.id'), '')) LIKE 'k3%'
               OR lower(COALESCE(json_extract(sm.data, '$.model.id'), '')) LIKE 'k2p%'
               OR lower(COALESCE(json_extract(sm.data, '$.modelID'), '')) LIKE '%kimi%'
             )`,
        )
        .all();
      rows.push(...v2Rows);

      if (hasLegacyMessage) {
        // Legacy rows that were never copied into session_message.
        const legacyRows = db
          .prepare(
            `SELECT session_id AS sessionId, time_created AS timeCreated, data
             FROM message
             WHERE json_extract(data, '$.role') = 'assistant'
               AND id NOT IN (SELECT id FROM session_message)`,
          )
          .all();

        for (const row of legacyRows) {
          let data;
          try {
            data = JSON.parse(row.data);
          } catch {
            continue;
          }
          const providerID = data?.providerID || data?.model?.providerID || '';
          const modelID = data?.modelID || data?.model?.id || '';
          if (!isKimiModel(providerID, modelID)) continue;
          rows.push({
            sessionId: row.sessionId,
            timeCreated: row.timeCreated,
            providerID,
            modelID,
            input: num(data?.tokens?.input),
            output: num(data?.tokens?.output),
            reasoning: num(data?.tokens?.reasoning),
            cacheRead: num(data?.tokens?.cache?.read),
            cacheWrite: num(data?.tokens?.cache?.write),
          });
        }
      }

      try {
        const compactionRows = db
          .prepare(
            "SELECT time_created AS timeCreated FROM session_message WHERE type = 'compaction'",
          )
          .all();
        ctx.compactionsAll = compactionRows.length;
        for (const row of compactionRows) {
          const ts = num(row.timeCreated);
          if (ts && monthIncluded(ctx, monthKey(ts))) ctx.compactions += 1;
        }
      } catch {
        // Older OpenCode builds may not have compaction rows.
      }
    } else if (hasLegacyMessage) {
      const legacyRows = db
        .prepare(
          `SELECT session_id AS sessionId, time_created AS timeCreated, data
           FROM message
           WHERE json_extract(data, '$.role') = 'assistant'`,
        )
        .all();

      for (const row of legacyRows) {
        let data;
        try {
          data = JSON.parse(row.data);
        } catch {
          continue;
        }
        const providerID = data?.providerID || data?.model?.providerID || '';
        const modelID = data?.modelID || data?.model?.id || '';
        if (!isKimiModel(providerID, modelID)) continue;
        rows.push({
          sessionId: row.sessionId,
          timeCreated: row.timeCreated,
          providerID,
          modelID,
          input: num(data?.tokens?.input),
          output: num(data?.tokens?.output),
          reasoning: num(data?.tokens?.reasoning),
          cacheRead: num(data?.tokens?.cache?.read),
          cacheWrite: num(data?.tokens?.cache?.write),
        });
      }
    }

    for (const row of rows) {
      const ts = num(row.timeCreated);
      if (!ts) continue;
      const meta = sessions.get(row.sessionId) || {};
      const parentId = meta.parentId || null;
      const rec = {
        ts,
        model: row.modelID || 'unknown',
        provider: row.providerID || '',
        input: num(row.input),
        output: num(row.output),
        reasoning: num(row.reasoning),
        cacheRead: num(row.cacheRead),
        cacheWrite: num(row.cacheWrite),
        subagent: Boolean(parentId),
      };

      ingest(ctx, 'opencode', rec);

      const sessionId = row.sessionId || '(unknown)';
      if (rec.subagent) {
        addBucket(ctx.ocAllSub, rec);
        ctx.ocAllSubSessionIds.add(sessionId);
      } else {
        addBucket(ctx.ocAllRoot, rec);
        ctx.ocAllRootSessionIds.add(sessionId);
      }

      const month = monthKey(ts);
      if (!monthIncluded(ctx, month)) continue;

      if (rec.subagent) {
        addBucket(ctx.ocSub, rec);
        ctx.subagentSessionIds.add(sessionId);
        continue;
      }

      addBucket(ctx.ocRoot, rec);
      let session = ctx.rootSessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          title: meta.title || '(untitled)',
          firstTs: ts,
          lastTs: ts,
          ...newBucket(),
        };
        ctx.rootSessions.set(sessionId, session);
      }
      addBucket(session, rec);
      session.firstTs = Math.min(session.firstTs, ts);
      session.lastTs = Math.max(session.lastTs, ts);
    }
  } catch (error) {
    warn(`OpenCode query failed: ${error.message}`);
  } finally {
    try {
      db.close();
    } catch {
      // ignore
    }
  }
}

function isKimiModel(providerID, modelID) {
  const provider = String(providerID || '').toLowerCase();
  const model = String(modelID || '').toLowerCase();
  return (
    provider.includes('kimi') ||
    model.includes('kimi') ||
    model.startsWith('k3') ||
    model.startsWith('k2p')
  );
}

function finalizeSources(ctx) {
  const cli = ctx.sources.kimiCli;
  cli.sessions = cli.sessionIds.size;
  delete cli.sessionIds;

  const code = ctx.sources.kimiCode;
  code.sessions = code.sessionIds.size;
  delete code.sessionIds;

  const oc = ctx.sources.opencode;
  oc.sessions = ctx.ocAllRootSessionIds.size + ctx.ocAllSubSessionIds.size;
  oc.rootSessions = ctx.ocAllRootSessionIds.size;
  oc.subagentSessions = ctx.ocAllSubSessionIds.size;
}

// ---------------------------------------------------------------------------
// Report building
// ---------------------------------------------------------------------------

function buildReport(ctx) {
  finalizeSources(ctx);

  const totals = {
    ...ctx.totals,
    total: bucketTotal(ctx.totals),
    cachePct: bucketTotal(ctx.totals)
      ? ctx.totals.cacheRead / bucketTotal(ctx.totals)
      : 0,
  };

  const byMonth = [...ctx.monthly.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      ...row,
      total: bucketTotal(row),
      cachePct: bucketTotal(row) ? row.cacheRead / bucketTotal(row) : 0,
    }));

  const byModel = [...ctx.models.values()]
    .map((model) => ({
      ...model,
      total: bucketTotal(model),
      cachePct: bucketTotal(model) ? model.cacheRead / bucketTotal(model) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const byWeek = [...ctx.weekly.values()]
    .map((week) => ({ ...week, total: bucketTotal(week) }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const rootSessions = [...ctx.rootSessions.values()]
    .map((session) => ({
      id: session.id,
      title: session.title,
      date: localDate(session.firstTs),
      lastDate: localDate(session.lastTs),
      msgs: session.messages,
      total: bucketTotal(session),
      input: session.input,
      output: session.output,
      reasoning: session.reasoning,
      cacheRead: session.cacheRead,
      cacheWrite: session.cacheWrite,
      cachePerFresh: session.input > 0 ? session.cacheRead / session.input : null,
    }))
    .sort((a, b) => b.total - a.total);

  const rootTotal = bucketTotal(ctx.ocRoot);
  const subTotal = bucketTotal(ctx.ocSub);
  const rootTotals = rootSessions.map((session) => session.total).sort((a, b) => b - a);
  const top10Total = rootTotals.slice(0, 10).reduce((sum, value) => sum + value, 0);
  const top5Count = Math.max(1, Math.ceil(rootTotals.length * 0.05));
  const top5Total = rootTotals.slice(0, top5Count).reduce((sum, value) => sum + value, 0);
  const over100 = rootTotals.filter((value) => value >= 1e8);
  const over100Total = over100.reduce((sum, value) => sum + value, 0);

  const peakWeeks = [...byWeek]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((week) => ({ week: week.week, total: week.total }));

  const efficiency = {
    cacheShare: totals.total ? totals.cacheRead / totals.total : 0,
    freshShare: totals.total ? totals.input / totals.total : 0,
    outputShare: totals.total ? totals.output / totals.total : 0,
    reasoningShare: totals.total ? totals.reasoning / totals.total : 0,
    avgRootCachePerTurn: ctx.ocRoot.messages
      ? ctx.ocRoot.cacheRead / ctx.ocRoot.messages
      : 0,
    avgSubagentCachePerTurn: ctx.ocSub.messages
      ? ctx.ocSub.cacheRead / ctx.ocSub.messages
      : 0,
    subagentTokenShare: rootTotal + subTotal ? subTotal / (rootTotal + subTotal) : 0,
    subagentSessions: ctx.subagentSessionIds.size,
    rootSessions: rootSessions.length,
    compactions: ctx.compactions,
    top10Share: rootTotal ? top10Total / rootTotal : 0,
    top5PctShare: rootTotal ? top5Total / rootTotal : 0,
    sessionsOver100M: {
      count: over100.length,
      total: over100Total,
      share: rootTotal ? over100Total / rootTotal : 0,
    },
    peakWeeks,
  };

  const sources = {};
  for (const [key, source] of Object.entries(ctx.sources)) {
    sources[key] = {
      available: source.available,
      sessions: source.sessions || 0,
      records: source.records,
      subagentRecords: source.subagentRecords,
      start: source.start ? new Date(source.start).toISOString() : null,
      end: source.end ? new Date(source.end).toISOString() : null,
      total: bucketTotal(source.bucket),
      input: source.bucket.input,
      output: source.bucket.output,
      reasoning: source.bucket.reasoning,
      cacheRead: source.bucket.cacheRead,
      cacheWrite: source.bucket.cacheWrite,
      messages: source.bucket.messages,
    };
    if (key === 'opencode') {
      sources[key].rootSessions = source.rootSessions || 0;
      sources[key].subagentSessions = source.subagentSessions || 0;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    filters: {
      month: ctx.opts.month,
      months: ctx.opts.months,
      selectedMonths: ctx.selectedMonths ? [...ctx.selectedMonths] : null,
    },
    totals,
    sources,
    byMonth,
    byModel,
    byWeek,
    topSessions: rootSessions.slice(0, ctx.opts.sessions),
    efficiency,
  };
}

// ---------------------------------------------------------------------------
// Human output
// ---------------------------------------------------------------------------

function displayWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    const cp = char.codePointAt(0);
    const wide =
      cp >= 0x1100 &&
      (cp <= 0x115f ||
        cp === 0x2329 ||
        cp === 0x232a ||
        (cp >= 0x2e80 && cp <= 0xa4cf) ||
        (cp >= 0xac00 && cp <= 0xd7a3) ||
        (cp >= 0xf900 && cp <= 0xfaff) ||
        (cp >= 0xfe10 && cp <= 0xfe19) ||
        (cp >= 0xfe30 && cp <= 0xfe6f) ||
        (cp >= 0xff00 && cp <= 0xff60) ||
        (cp >= 0xffe0 && cp <= 0xffe6) ||
        (cp >= 0x1f300 && cp <= 0x1f64f) ||
        (cp >= 0x1f900 && cp <= 0x1f9ff));
    width += wide ? 2 : 1;
  }
  return width;
}

function truncate(text, maxWidth) {
  const value = String(text);
  if (displayWidth(value) <= maxWidth) return value;
  let result = '';
  for (const char of value) {
    if (displayWidth(result + char) > maxWidth - 1) break;
    result += char;
  }
  return `${result}…`;
}

function renderTable(headers, rows, aligns) {
  const widths = headers.map((header, index) =>
    Math.max(
      displayWidth(header),
      ...rows.map((row) => displayWidth(row[index] ?? '')),
    ),
  );

  const formatRow = (cells) =>
    cells
      .map((cell, index) => {
        const value = String(cell ?? '');
        const gap = widths[index] - displayWidth(value);
        if (gap <= 0) return value;
        return aligns[index] === 'right'
          ? `${' '.repeat(gap)}${value}`
          : `${value}${' '.repeat(gap)}`;
      })
      .join('  ')
      .trimEnd();

  return [
    formatRow(headers),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map(formatRow),
  ].join('\n');
}

function printHuman(report) {
  const lines = [];
  const scope = report.filters.month
    ? report.filters.month
    : report.filters.months
      ? `last ${report.filters.months} months`
      : 'all months';

  const generated = new Date(report.generatedAt);
  const generatedText = `${generated.getFullYear()}-${String(
    generated.getMonth() + 1,
  ).padStart(2, '0')}-${String(generated.getDate()).padStart(2, '0')} ${String(
    generated.getHours(),
  ).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}`;

  lines.push(`Kimi token usage · ${generatedText} (${report.timezone})`);
  lines.push(`Scope: ${scope}`);
  lines.push('');

  const sourceRows = [];
  for (const [key, source] of Object.entries(report.sources)) {
    const label = SOURCE_LABELS[key];
    if (!source.available) {
      sourceRows.push([label, 'not found', '—', '—', '—']);
      continue;
    }
    const sessions =
      key === 'opencode'
        ? `${fmtInt(source.rootSessions)} root + ${fmtInt(source.subagentSessions)} subagent`
        : `${fmtInt(source.sessions)} sessions`;
    const coverage =
      source.start && source.end
        ? `${localDate(Date.parse(source.start))} → ${localDate(Date.parse(source.end))}`
        : '—';
    sourceRows.push([label, fmt(source.total), sessions, fmtInt(source.records), coverage]);
  }

  lines.push(
    renderTable(
      ['Source', 'All-time', 'Sessions', 'Records', 'Coverage'],
      sourceRows,
      ['left', 'right', 'left', 'right', 'left'],
    ),
  );
  lines.push('');

  const monthRows = report.byMonth.map((row) => [
    row.month,
    fmt(row.kimiCli),
    fmt(row.kimiCode),
    fmt(row.opencode),
    fmt(row.total),
    fmt(row.input),
    fmt(row.output),
    fmt(row.cacheRead),
    fmtPct(row.cachePct),
  ]);
  if (monthRows.length) {
    monthRows.push([
      'TOTAL',
      fmt(report.byMonth.reduce((sum, row) => sum + row.kimiCli, 0)),
      fmt(report.byMonth.reduce((sum, row) => sum + row.kimiCode, 0)),
      fmt(report.byMonth.reduce((sum, row) => sum + row.opencode, 0)),
      fmt(report.totals.total),
      fmt(report.totals.input),
      fmt(report.totals.output),
      fmt(report.totals.cacheRead),
      fmtPct(report.totals.cachePct),
    ]);
  }

  lines.push('Monthly usage');
  lines.push(
    monthRows.length
      ? renderTable(
          [
            'Month',
            'Kimi CLI',
            'Kimi Code',
            'OpenCode',
            'Total',
            'Fresh in',
            'Output',
            'Cache read',
            'Cache %',
          ],
          monthRows,
          ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
        )
      : '  no Kimi usage found for this period',
  );
  lines.push('');

  if (report.byModel.length) {
    const topModels = report.byModel.slice(0, 12);
    const modelRows = topModels.map((model) => [
      truncate(
        model.provider ? `${model.provider}/${model.model}` : model.model,
        54,
      ),
      model.source,
      fmt(model.total),
      fmt(model.input),
      fmt(model.output),
      fmt(model.cacheRead),
    ]);
    if (report.byModel.length > topModels.length) {
      const rest = report.byModel.slice(topModels.length);
      modelRows.push([
        `(other ${rest.length} models)`,
        '',
        fmt(rest.reduce((sum, model) => sum + model.total, 0)),
        fmt(rest.reduce((sum, model) => sum + model.input, 0)),
        fmt(rest.reduce((sum, model) => sum + model.output, 0)),
        fmt(rest.reduce((sum, model) => sum + model.cacheRead, 0)),
      ]);
    }
    lines.push('By model');
    lines.push(
      renderTable(
        ['Model', 'Source', 'Total', 'Fresh in', 'Output', 'Cache read'],
        modelRows,
        ['left', 'left', 'right', 'right', 'right', 'right'],
      ),
    );
    lines.push('');
  }

  if (report.topSessions.length) {
    const sessionRows = report.topSessions.map((session, index) => [
      String(index + 1),
      session.date,
      fmtInt(session.msgs),
      fmt(session.total),
      session.cachePerFresh == null ? '—' : `${session.cachePerFresh.toFixed(1)}x`,
      truncate(session.title, 52),
    ]);
    lines.push('Top OpenCode root sessions');
    lines.push(
      renderTable(
        ['#', 'Date', 'Msgs', 'Total', 'Cache/Fresh', 'Title'],
        sessionRows,
        ['right', 'left', 'right', 'right', 'right', 'left'],
      ),
    );
    lines.push('');
  }

  const efficiency = report.efficiency;
  const total = report.totals.total || 1;
  const pctOfTotal = (value) => fmtPct(value / total);
  lines.push('Efficiency');
  lines.push(
    `  Cache reads        ${fmt(report.totals.cacheRead).padStart(8)}  ${pctOfTotal(
      report.totals.cacheRead,
    )} of all tokens — context re-read every turn is the bill`,
  );
  lines.push(
    `  Fresh input        ${fmt(report.totals.input).padStart(8)}  ${pctOfTotal(
      report.totals.input,
    )}`,
  );
  lines.push(
    `  Output             ${fmt(report.totals.output).padStart(8)}  ${pctOfTotal(
      report.totals.output,
    )}`,
  );
  lines.push(
    `  Reasoning          ${fmt(report.totals.reasoning).padStart(8)}  ${pctOfTotal(
      report.totals.reasoning,
    )}`,
  );
  lines.push(
    `  Avg context/turn   root ${fmt(efficiency.avgRootCachePerTurn)} · subagent ${fmt(
      efficiency.avgSubagentCachePerTurn,
    )}`,
  );
  lines.push(
    `  Subagent share     ${fmtPct(efficiency.subagentTokenShare)} of OpenCode Kimi tokens (${fmtInt(
      efficiency.subagentSessions,
    )} sessions)`,
  );
  lines.push(`  Compactions        ${fmtInt(efficiency.compactions)}`);
  lines.push(
    `  Top 10 sessions    ${fmtPct(efficiency.top10Share)} of root tokens`,
  );
  lines.push(
    `  Top 5% sessions    ${fmtPct(efficiency.top5PctShare)} of root tokens`,
  );
  lines.push(
    `  Sessions >100M     ${fmtInt(efficiency.sessionsOver100M.count)} sessions · ${fmt(
      efficiency.sessionsOver100M.total,
    )} (${fmtPct(efficiency.sessionsOver100M.share)})`,
  );
  if (efficiency.peakWeeks.length) {
    lines.push(
      `  Peak weeks         ${efficiency.peakWeeks
        .map((week) => `${week.week} ${fmt(week.total)}`)
        .join(' · ')}`,
    );
  }
  lines.push('');
  lines.push('Tip: use --month YYYY-MM to scope a month, or --json for machine-readable data.');

  console.log(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const ctx = createContext(opts);
  const cache = loadCache(opts.cache);
  const cacheState = { dirty: false, announced: false };

  await scanOldKimiCli(ctx, cache, cacheState);
  await scanKimiCodeCli(ctx, cache, cacheState);
  readOpenCode(ctx);

  if (cacheState.dirty) saveCache(cache, opts.cache);

  const report = buildReport(ctx);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
}

main().catch((error) => {
  console.error(`[kimi-usage] ${error.stack || error.message}`);
  process.exitCode = 1;
});
