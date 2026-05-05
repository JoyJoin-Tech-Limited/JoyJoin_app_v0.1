/**
 * Tool-Input Repair Layer
 *
 * Applies Ahmad Awais's validate-then-repair pattern to fix known
 * DeepSeek/GLM/Qwen tool-call failure modes before Zod validation.
 *
 * Core insight (from @MrAhmadAwais, May 2026):
 *   "open model bad at tool calling" is almost always a harness problem,
 *   not a model problem. The same 4 failure modes repeat across DeepSeek,
 *   GLM, and Qwen. A small repair layer bridges the gap.
 *
 * Design principle: validate-then-repair, NOT preprocess-then-validate.
 *   - Try parsing as-is first. Valid inputs are never touched.
 *   - On Zod failure, walk the validator's issue list. For each issue path,
 *     try the 4 repairs in order until one applies.
 *   - Retry parse. On success, log `tool_input_repaired:${toolName}`.
 *     On failure, log `tool_input_invalid:${toolName}` + return a
 *     model-readable retry message.
 *   - This prevents silent corruption of content that "happens" to look
 *     broken (e.g., writeFile content that is JSON-shaped).
 *
 * The 4 failure modes (ordered — json-array-parse MUST run before
 * bare-string-wrap to avoid double-wrapping):
 *   1. null-for-optional: sending `null` for optional fields instead of omitting
 *   2. stringified arrays: `"[\"a\",\"b\"]"` instead of `["a","b"]`
 *   3. singleton wrapping: single arg in `{}` where schema expected array
 *   4. bare-string-for-array: `"foo"` instead of `["foo"]`
 *
 * PLUS DeepSeek-specific: markdown auto-links in file paths
 *   `[notes.md](http://notes.md)` → `notes.md` (only when link text
 *   equals url-without-protocol; real markdown passes through untouched)
 *
 * Relational invariants: when a field pair has mutual dependency
 *   (e.g., read_file's offset↔limit), default the missing one and
 *   surface the choice back to the model transparently.
 *
 * Integration: This module is designed to be called at the boundary
 * where raw LLM-generated tool arguments meet Zod schemas — in the
 * OpenCode tool execution pipeline or any agent tool dispatcher.
 * See `scripts/tool-repair-integration.mjs` for the wiring pattern.
 *
 * Usage:
 *   import { repairToolInput } from './toolInputRepair';
 *
 *   const result = repairToolInput('read_file', rawArgs, ReadFileSchema);
 *   if (result.repaired) {
 *     // result.repaired is the fixed input — execute the tool
 *     executeTool(result.repaired);
 *   } else if (result.error) {
 *     // Return model-readable error — model can self-correct next turn
 *     return { error: result.error };
 *   }
 */

import { z, ZodError, ZodIssue, ZodSchema } from 'zod';
import { logger } from '../lib/logger';

// ─── Configuration ───────────────────────────────────────────────────────────

const TOOL_INPUT_REPAIR_ENABLED =
  process.env.TOOL_INPUT_REPAIR_ENABLED !== 'false'; // enabled by default

// ─── Types ───────────────────────────────────────────────────────────────────

export type RepairType =
  | 'null_for_optional'
  | 'stringified_array'
  | 'singleton_wrap'
  | 'bare_string_for_array'
  | 'markdown_auto_link'
  | 'relational_default';

export interface RepairResult {
  /** The repaired input object, or null if repair failed. */
  repaired: Record<string, unknown> | null;
  /** Which repair strategy was applied, or null if validation succeeded as-is. */
  repairType: RepairType | null;
  /** Model-readable error message if all repairs failed. No `Error:` prefix. */
  error: string | null;
  /**
   * Transparent notes surfaced to the model (relational defaults applied,
   * auto-link repairs, etc.). These are NOT errors — the model can use
   * them to self-correct on the next turn. No `Error:` prefix.
   */
  notes: string[] | null;
}

export interface ToolRepairLog {
  toolName: string;
  repairType: RepairType | 'none' | 'invalid';
  repairSuccess: boolean;
  timestamp: string;
  model?: string; // populated by caller for per-model telemetry
}

// ─── Relational Defaults (per-tool) ──────────────────────────────────────────

interface RelationalDefault {
  /** When this field is present and the paired field is missing, apply these defaults. */
  triggerField: string;
  /** The defaults to apply. */
  defaults: Record<string, unknown>;
  /** Transparent note surfaced to the model — no `Error:` prefix. */
  note: string;
}

const RELATIONAL_DEFAULTS: Record<string, RelationalDefault[]> = {
  read_file: [
    {
      triggerField: 'limit',
      defaults: { offset: 0 },
      note: 'Note: limit was provided without offset; defaulted offset to 0. To read from a different position, retry with both offset and limit.',
    },
    {
      triggerField: 'offset',
      defaults: { limit: 2000 },
      note: 'Note: offset was provided without limit; defaulted limit to 2000 lines. To read more or fewer lines, retry with both offset and limit.',
    },
  ],
  // Additional tools can be registered here as relational invariants are discovered
};

// ─── Utility: deep get/set by path ───────────────────────────────────────────

function getByPath(obj: unknown, path: (string | number)[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function setByPath(
  obj: Record<string, unknown>,
  path: (string | number)[],
  value: unknown,
): void {
  if (path.length === 0) return;
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = String(path[i]);
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = String(path[path.length - 1]);
  current[lastKey] = value;
}

function deleteByPath(obj: Record<string, unknown>, path: (string | number)[]): void {
  if (path.length === 0) return;
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = String(path[i]);
    if (!(key in current) || typeof current[key] !== 'object') return;
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = String(path[path.length - 1]);
  delete current[lastKey];
}

// ─── Repair 1: null-for-optional ────────────────────────────────────────────

/**
 * DeepSeek/GLM/Qwen often set optional fields to `null` instead of omitting them.
 * This repair strips null values from the input object.
 *
 * SAFETY: Only strips nulls from the *input object* before validation.
 * If the schema marks a field as `.nullable()`, this repair could still
 * apply — the re-validation will handle the correctness check.
 * Fields that truly require null will fail validation, and the repair
 * won't be logged as successful.
 */
function repairNullForOptional(
  input: Record<string, unknown>,
  _issues: ZodIssue[],
): Record<string, unknown> | null {
  let changed = false;
  const cleaned = { ...input };

  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] === null) {
      delete cleaned[key];
      changed = true;
    }
  }

  return changed ? cleaned : null;
}

// ─── Repair 2: stringified arrays ───────────────────────────────────────────

/**
 * DeepSeek often emits arrays as JSON-encoded strings:
 *   `"[\"a\",\"b\"]"` instead of `["a","b"]`
 *
 * This repair detects `invalid_type` issues where array was expected but
 * string was received, then attempts JSON.parse on the string value.
 *
 * ORDERING: Must run BEFORE bare-string-for-array to avoid double-wrapping
 * (e.g., `'["a","b"]'` → `['["a","b"]']`).
 */
function repairStringifiedArray(
  input: Record<string, unknown>,
  issues: ZodIssue[],
): Record<string, unknown> | null {
  let changed = false;
  const repaired = { ...input };

  for (const issue of issues) {
    if (
      issue.code === 'invalid_type' &&
      issue.expected === 'array' &&
      issue.received === 'string'
    ) {
      const value = getByPath(repaired, issue.path);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            setByPath(repaired, issue.path, parsed);
            changed = true;
          }
        } catch {
          // Not valid JSON — leave for bare-string-wrap repair
        }
      }
    }
  }

  return changed ? repaired : null;
}

// ─── Repair 3: singleton wrapping ───────────────────────────────────────────

/**
 * DeepSeek sometimes wraps a single value in an object when the schema
 * expects an array. E.g., `{ paths: { path: "/foo" } }` where
 * `{ paths: ["/foo"] }` was expected.
 *
 * This repair detects `invalid_type` issues where array was expected but
 * object was received, then extracts all values from the object into an array.
 */
function repairSingletonWrap(
  input: Record<string, unknown>,
  issues: ZodIssue[],
): Record<string, unknown> | null {
  let changed = false;
  const repaired = { ...input };

  for (const issue of issues) {
    if (
      issue.code === 'invalid_type' &&
      issue.expected === 'array' &&
      issue.received === 'object'
    ) {
      const value = getByPath(repaired, issue.path);
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const innerValues = Object.values(value as Record<string, unknown>);
        // Always convert to array — empty object → empty array is still
        // more useful than keeping it as an object (which always fails)
        setByPath(repaired, issue.path, innerValues);
        changed = true;
      }
    }
  }

  return changed ? repaired : null;
}

// ─── Repair 4: bare-string-for-array ─────────────────────────────────────────

/**
 * DeepSeek sometimes passes a bare string where an array was expected.
 * E.g., `"/foo"` instead of `["/foo"]`.
 *
 * ORDERING: Must run AFTER stringified-array repair to avoid wrapping
 * already-parsed arrays.
 *
 * This repair ONLY applies when:
 *   - The issue says array expected but string received
 *   - The string could NOT be JSON.parsed (already handled by repair #2)
 */
function repairBareStringForArray(
  input: Record<string, unknown>,
  issues: ZodIssue[],
): Record<string, unknown> | null {
  let changed = false;
  const repaired = { ...input };

  for (const issue of issues) {
    if (
      issue.code === 'invalid_type' &&
      issue.expected === 'array' &&
      issue.received === 'string'
    ) {
      const value = getByPath(repaired, issue.path);
      if (typeof value === 'string') {
        // Only wrap if it can't be JSON.parsed (repair #2 handles parseable strings)
        try {
          JSON.parse(value);
          // It IS parseable — repair #2 should have handled this.
          // Skip to avoid double-wrapping.
        } catch {
          setByPath(repaired, issue.path, [value]);
          changed = true;
        }
      }
    }
  }

  return changed ? repaired : null;
}

// ─── Markdown auto-link repair ──────────────────────────────────────────────

/**
 * DeepSeek sometimes emits file paths as markdown auto-links:
 *   `[notes.md](http://notes.md)` instead of `notes.md`
 *
 * This happens because the model was RL-trained to auto-link in chat output,
 * and that prior leaks through the tool boundary.
 *
 * FIX: Two regex lines that unwrap only the degenerate case where link text
 * equals the URL path (without protocol). Real markdown like
 * `[click](https://x.com)` passes through untouched.
 *
 * Applied to ALL string fields in the input before the 4 repairs.
 */
const MARKDOWN_AUTO_LINK_RE = /^\[([^\]]+)\]\(([^)]+)\)$/;

function unwrapMarkdownAutoLink(value: string): string | null {
  const match = value.match(MARKDOWN_AUTO_LINK_RE);
  if (!match) return null;

  const [, linkText, url] = match;
  // Extract path portion: strip protocol
  const urlPath = url.replace(/^https?:\/\//, '');

  // Only unwrap if link text matches the URL path
  // This catches `[notes.md](http://notes.md)` but NOT `[click](https://x.com)`
  if (linkText === urlPath) {
    return linkText;
  }

  return null; // Real markdown — don't touch
}

function repairMarkdownAutoLinks(
  input: Record<string, unknown>,
): Record<string, unknown> | null {
  let changed = false;
  const repaired = { ...input };

  // Walk all string values recursively (shallow walk is sufficient for tool args)
  for (const key of Object.keys(repaired)) {
    const value = repaired[key];
    if (typeof value === 'string') {
      const unwrapped = unwrapMarkdownAutoLink(value);
      if (unwrapped !== null) {
        repaired[key] = unwrapped;
        changed = true;
      }
    }
    // Also check nested objects (one level deep)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = repairMarkdownAutoLinks(value as Record<string, unknown>);
      if (nested !== null) {
        repaired[key] = nested;
        changed = true;
      }
    }
  }

  return changed ? repaired : null;
}

// ─── Relational defaults ─────────────────────────────────────────────────────

/**
 * Apply relational defaults when one half of a paired field is present but
 * the other is missing. E.g., `limit` alone → defaults `offset = 0`.
 *
 * Unlike the 4 shape repairs, relational invariants can't be fixed by
 * input repair alone — each field is independently valid. Instead, we
 * extend the semantics: default the missing field and surface the choice
 * transparently so the model can self-correct next turn.
 */
function applyRelationalDefaults(
  toolName: string,
  input: Record<string, unknown>,
): { repaired: Record<string, unknown>; defaultsApplied: string[] } {
  const rules = RELATIONAL_DEFAULTS[toolName];
  if (!rules) return { repaired: input, defaultsApplied: [] };

  const repaired = { ...input };
  const defaultsApplied: string[] = [];

  for (const rule of rules) {
    if (rule.triggerField in repaired) {
      let appliedCount = 0;
      for (const [key, value] of Object.entries(rule.defaults)) {
        if (!(key in repaired)) {
          repaired[key] = value;
          appliedCount++;
        }
      }
      if (appliedCount > 0) {
        defaultsApplied.push(rule.note);
      }
    }
  }

  return { repaired: defaultsApplied.length > 0 ? repaired : input, defaultsApplied };
}

// ─── Model-readable error formatting ─────────────────────────────────────────

/**
 * Format Zod validation errors into a model-readable message.
 * CRITICAL: Do NOT prefix with `Error:` — the TUI paints it red and the
 * model can't recover. Instead, provide actionable retry hints.
 */
function formatModelReadableError(error: ZodError, toolName: string): string {
  const issues = error.issues.slice(0, 5); // Cap at 5 — avoid overwhelming the model
  const issueLines = issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    // Missing required field (check before general type mismatch)
    if (issue.code === 'invalid_type' && (issue as any).received === 'undefined') {
      return `  ${path}: required field is missing`;
    }
    // Type mismatch
    if (issue.code === 'invalid_type') {
      return `  ${path}: expected ${(issue as any).expected}, received ${(issue as any).received}`;
    }
    // Union errors
    if (issue.code === 'invalid_union') {
      return `  ${path}: value does not match any allowed type`;
    }
    // Generic
    return `  ${path}: ${issue.message}`;
  });

  return [
    `Tool call validation failed for ${toolName}:`,
    ...issueLines,
    'To retry: review the expected parameter types and resubmit with corrected arguments.',
    `If this persists, the tool schema for ${toolName} may need review.`,
  ].join('\n');
}

// ─── Main repair pipeline ────────────────────────────────────────────────────

/**
 * Repair a raw LLM-generated tool input before Zod validation.
 *
 * This is the main entry point. It applies Ahmad Awais's validate-then-repair
 * pattern: try as-is, then walk Zod issues and apply repairs in order.
 *
 * @param toolName  - Name of the tool being called (e.g., 'read_file', 'edit')
 * @param rawInput  - Raw arguments from the LLM (may be stringified, malformed, etc.)
 * @param schema    - Zod schema to validate against
 * @param model     - Optional model identifier for per-model telemetry
 * @returns RepairResult with repaired input (if successful) or error message
 */
export function repairToolInput(
  toolName: string,
  rawInput: unknown,
  schema: ZodSchema,
  model?: string,
): RepairResult {
  // Gate: allow disabling via env var
  if (!TOOL_INPUT_REPAIR_ENABLED) {
    const parsed = schema.safeParse(rawInput);
    if (parsed.success) {
      return { repaired: parsed.data as Record<string, unknown>, repairType: null, error: null, notes: null };
    }
    return {
      repaired: null,
      repairType: null,
      error: formatModelReadableError(parsed.error, toolName),
      notes: null,
    };
  }

  // Step 0: Ensure input is an object
  let inputObj: Record<string, unknown>;
  if (typeof rawInput === 'string') {
    try {
      inputObj = JSON.parse(rawInput) as Record<string, unknown>;
    } catch {
      const error = `Cannot parse tool arguments for ${toolName}: input is not valid JSON. Raw: ${rawInput.toString().slice(0, 200)}`;
      logToolRepair({ toolName, repairType: 'invalid', repairSuccess: false, timestamp: new Date().toISOString(), model });
      recordRepairMetric(toolName, 'invalid');
      return { repaired: null, repairType: null, error, notes: null };
    }
  } else if (typeof rawInput === 'object' && rawInput !== null && !Array.isArray(rawInput)) {
    inputObj = { ...rawInput as Record<string, unknown> };
  } else {
    // Arrays, null, primitives — pass directly to schema
    inputObj = { _value: rawInput } as Record<string, unknown>;
  }

  const notes: string[] = [];

  // Step 0.5: Apply markdown auto-link repair first (before any validation)
  const autoLinkRepaired = repairMarkdownAutoLinks(inputObj);
  if (autoLinkRepaired !== null) {
    inputObj = autoLinkRepaired;
    notes.push('Note: markdown auto-links in file paths were unwrapped.');
  }

  // Step 1: Try parsing as-is (cheap path)
  let currentIssues = schema.safeParse(inputObj);
  if (currentIssues.success) {
    // Valid input — never touched. Apply relational defaults post-parse.
    const { repaired: withDefaults, defaultsApplied } = applyRelationalDefaults(toolName, inputObj);
    for (const note of defaultsApplied) notes.push(note);
    if (defaultsApplied.length > 0 || autoLinkRepaired !== null) {
      const appliedType = defaultsApplied.length > 0 ? 'relational_default' : 'markdown_auto_link';
      logToolRepair({ toolName, repairType: appliedType, repairSuccess: true, timestamp: new Date().toISOString(), model });
      recordRepairMetric(toolName, appliedType);
    }
    return {
      repaired: withDefaults as Record<string, unknown>,
      repairType: defaultsApplied.length > 0 ? 'relational_default' : (autoLinkRepaired !== null ? 'markdown_auto_link' : null),
      error: null,
      notes: notes.length > 0 ? notes : null,
    };
  }

  // Step 2: Walk issues, try repairs CUMULATIVELY
  // Order matters: json-array-parse BEFORE bare-string-wrap
  const repairs: Array<{
    fn: (input: Record<string, unknown>, issues: ZodIssue[]) => Record<string, unknown> | null;
    type: RepairType;
  }> = [
    { fn: repairNullForOptional, type: 'null_for_optional' },
    { fn: repairStringifiedArray, type: 'stringified_array' },
    { fn: repairSingletonWrap, type: 'singleton_wrap' },
    { fn: repairBareStringForArray, type: 'bare_string_for_array' },
  ];

  // Cumulative repair: each repair gets the result of all previous repairs
  let cumulativeInput: Record<string, unknown> | null = null;
  let lastRepairType: RepairType | null = null;

  for (const repair of repairs) {
    // Use cumulative result if available, otherwise original
    const baseInput = cumulativeInput ?? inputObj;
    const repairedObj = repair.fn(baseInput, currentIssues.error.issues);
    if (repairedObj === null) continue; // This repair didn't apply

    // Apply relational defaults after shape repair
    const { repaired: withDefaults, defaultsApplied } = applyRelationalDefaults(toolName, repairedObj);

    // Retry validation with cumulative changes
    const reparse = schema.safeParse(withDefaults);
    if (reparse.success) {
      const allNotes = [...notes];
      for (const note of defaultsApplied) allNotes.push(note);
      logToolRepair({
        toolName,
        repairType: repair.type,
        repairSuccess: true,
        timestamp: new Date().toISOString(),
        model,
      });
      recordRepairMetric(toolName, repair.type);
      return {
        repaired: reparse.data as Record<string, unknown>,
        repairType: repair.type,
        error: null,
        notes: allNotes.length > 0 ? allNotes : null,
      };
    }

    // Repair applied but validation still failed — keep cumulative state
    // and update issues for the next repair iteration
    cumulativeInput = repairedObj;
    currentIssues = reparse;
    lastRepairType = repair.type;
  }

  // Step 3: Apply relational defaults to cumulative repaired input + retry
  const baseForRelational = cumulativeInput ?? inputObj;
  const { repaired: withDefaults, defaultsApplied } = applyRelationalDefaults(toolName, baseForRelational);
  if (defaultsApplied.length > 0) {
    const reparse = schema.safeParse(withDefaults);
    if (reparse.success) {
      const allNotes = [...notes, ...defaultsApplied];
      logToolRepair({
        toolName,
        repairType: 'relational_default',
        repairSuccess: true,
        timestamp: new Date().toISOString(),
        model,
      });
      recordRepairMetric(toolName, 'relational_default');
      return {
        repaired: reparse.data as Record<string, unknown>,
        repairType: 'relational_default',
        error: null,
        notes: allNotes.length > 0 ? allNotes : null,
      };
    }
  }

  // Step 4: All repairs failed — return model-readable error
  logToolRepair({
    toolName,
    repairType: 'invalid',
    repairSuccess: false,
    timestamp: new Date().toISOString(),
    model,
  });
  recordRepairMetric(toolName, 'invalid');

  return {
    repaired: null,
    repairType: null,
    error: formatModelReadableError(
      currentIssues.error ?? (schema.safeParse(inputObj) as any).error,
      toolName,
    ),
    notes: notes.length > 0 ? notes : null,
  };
}

// ─── Bulk repair (for multi-tool calls) ──────────────────────────────────────

/**
 * Repair multiple tool call arguments in a single pass.
 * Useful for agent frameworks that batch tool calls.
 *
 * @returns Map of tool call index → RepairResult
 */
export function repairToolInputs(
  calls: Array<{ toolName: string; arguments: unknown; schema: ZodSchema }>,
  model?: string,
): Map<number, RepairResult> {
  const results = new Map<number, RepairResult>();
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    results.set(i, repairToolInput(call.toolName, call.arguments, call.schema, model));
  }
  return results;
}

// ─── Telemetry ───────────────────────────────────────────────────────────────

function logToolRepair(log: ToolRepairLog): void {
  const line = JSON.stringify({
    ...log,
    latencyMs: undefined, // populated by caller if needed
  });

  // Prefix with [ToolRepair] so log scanners can filter by prefix
  // without requiring full JSON parse on every line (same pattern as [AITrace])
  console.log(`[ToolRepair] ${line}`);

  // Also log structured for server-side monitoring
  logger.info('tool_input_repair', {
    toolName: log.toolName,
    repairType: log.repairType,
    repairSuccess: log.repairSuccess,
    model: log.model,
  });
}

// ─── Metrics (Prometheus-compatible) ─────────────────────────────────────────

/** In-memory counters for Prometheus scrape endpoint. */
export const toolRepairMetrics = {
  repairs: new Map<string, number>(),
  invalid: new Map<string, number>(),
};

/**
 * Record a repair metric for Prometheus export.
 * Call this after each repairToolInput invocation.
 */
export function recordRepairMetric(toolName: string, repairType: RepairType | 'invalid'): void {
  const key = `${toolName}:${repairType}`;
  const counter = repairType === 'invalid'
    ? toolRepairMetrics.invalid
    : toolRepairMetrics.repairs;
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

// ─── Health check ────────────────────────────────────────────────────────────

/**
 * Return repair statistics for health/readiness checks.
 */
export function getRepairStats(): {
  enabled: boolean;
  totalRepairs: number;
  totalInvalid: number;
  repairRates: Record<string, number>;
} {
  let totalRepairs = 0;
  let totalInvalid = 0;

  for (const count of toolRepairMetrics.repairs.values()) totalRepairs += count;
  for (const count of toolRepairMetrics.invalid.values()) totalInvalid += count;

  // Per-tool repair rates
  const repairRates: Record<string, number> = {};
  const allTools = new Set([
    ...toolRepairMetrics.repairs.keys(),
    ...toolRepairMetrics.invalid.keys(),
  ]);

  for (const key of allTools) {
    const repairs = toolRepairMetrics.repairs.get(key) ?? 0;
    const invalid = toolRepairMetrics.invalid.get(key) ?? 0;
    const total = repairs + invalid;
    repairRates[key] = total > 0 ? repairs / total : 1;
  }

  return {
    enabled: TOOL_INPUT_REPAIR_ENABLED,
    totalRepairs,
    totalInvalid,
    repairRates,
  };
}
