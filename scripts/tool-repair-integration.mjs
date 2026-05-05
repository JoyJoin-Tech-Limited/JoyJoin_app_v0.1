/**
 * Tool-Input Repair Integration — wiring guide for OpenCode agent tool dispatchers
 *
 * This script demonstrates where to call `repairToolInput()` in the OpenCode
 * tool execution pipeline. It is NOT run directly — it is reference code for
 * developers integrating the repair layer.
 *
 * ## Integration Points
 *
 * The repair layer should be called at THREE boundaries in the agent pipeline:
 *
 * ### 1. Pre-execution hook (primary)
 * Right before a tool is executed, pass the raw arguments through repairToolInput().
 * This catches all 4 failure modes + markdown auto-links BEFORE the tool sees them.
 *
 * ```
 * import { repairToolInput } from '../apps/server/src/ai/toolInputRepair';
 *
 * function dispatchTool(toolName, rawArgs, zodSchema) {
 *   const result = repairToolInput(toolName, rawArgs, zodSchema, currentModel);
 *
 *   if (result.repaired) {
 *     // Success — execute with repaired args
 *     if (result.notes) {
 *       // Surface transparent notes to model (no Error: prefix)
 *       appendToResponse(result.notes.join('\n'));
 *     }
 *     return executeTool(toolName, result.repaired);
 *   }
 *
 *   if (result.error) {
 *     // Model-readable error — no Error: prefix, model can self-correct
 *     return { error: result.error };
 *   }
 * }
 * ```
 *
 * ### 2. Post-generation hook (secondary)
 * After the LLM generates tool calls but before validation, apply auto-link repair
 * to catch markdown auto-links in file paths early.
 *
 * ### 3. Telemetry collector
 * Report repair-rate stats to observability. High repair rates for a specific
 * (model, tool) pair indicate a prompt improvement opportunity.
 *
 * ```
 * import { getRepairStats } from '../apps/server/src/ai/toolInputRepair';
 *
 * // On interval or at end of session:
 * const stats = getRepairStats();
 * // stats = { enabled: true, totalRepairs: 42, totalInvalid: 3, repairRates: { ... } }
 * ```
 *
 * ## Per-Model Observability
 *
 * Pass the model name to `repairToolInput(toolName, rawArgs, schema, model)` to
 * get per-model repair rates. This tells you whether DeepSeek, Kimi, or GLM
 * regresses on a specific tool contract before users notice.
 *
 * ## Reference
 * - Implementation: `apps/server/src/ai/toolInputRepair.ts`
 * - Tests: `apps/server/src/ai/__tests__/toolInputRepair.test.ts`
 * - Theory: Ahmad Awais (@MrAhmadAwais), May 2026 — "open model bad at tool
 *   calling is almost always a harness problem, not a model problem"
 */

// ─── Integration Pattern (TS pseudocode — reference, not executable) ─────────

/*
import {
  repairToolInput,
  repairToolInputs,
  getRepairStats,
} from '../apps/server/src/ai/toolInputRepair';
import { z } from 'zod';

// Tool schemas (one per OpenCode tool)
const BashSchema = z.object({
  command: z.string(),
  description: z.string().optional(),
  workdir: z.string().optional(),
});

const EditSchema = z.object({
  filePath: z.string(),
  oldString: z.string(),
  newString: z.string(),
  replaceAll: z.boolean().optional(),
});

const ReadSchema = z.object({
  filePath: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

const WriteSchema = z.object({
  filePath: z.string(),
  content: z.string(),
});

const GrepSchema = z.object({
  pattern: z.string(),
  include: z.string().optional(),
  path: z.string().optional(),
});

const GlobSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
});

// Schema registry
const TOOL_SCHEMAS: Record<string, z.ZodSchema> = {
  bash: BashSchema,
  edit: EditSchema,
  read: ReadSchema,
  write: WriteSchema,
  grep: GrepSchema,
  glob: GlobSchema,
};

// ─── Tool dispatcher with repair ─────────────────────────────────────────────

function dispatchWithRepair(
  toolName: string,
  rawArgs: unknown,
  model: string,
): { result?: unknown; error?: string } {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    // No schema registered — pass through
    return { result: executeToolRaw(toolName, rawArgs) };
  }

  const repaired = repairToolInput(toolName, rawArgs, schema, model);

  if (repaired.repaired) {
    // Notes are not errors — they inform the model of defaults/surface decisions
    if (repaired.notes) {
      console.log(repaired.notes.join('\n'));
    }
    return { result: executeToolRaw(toolName, repaired.repaired) };
  }

  return { error: repaired.error ?? `Unknown error repairing ${toolName}` };
}

// ─── Bulk repair for multi-tool calls ────────────────────────────────────────

function dispatchTools(
  calls: Array<{ toolName: string; arguments: unknown }>,
  model: string,
): Map<number, { result?: unknown; error?: string }> {
  const results = new Map();
  for (let i = 0; i < calls.length; i++) {
    results.set(i, dispatchWithRepair(calls[i].toolName, calls[i].arguments, model));
  }
  return results;
}

// ─── Periodic health check ───────────────────────────────────────────────────

function reportRepairHealth(): void {
  const stats = getRepairStats();
  if (stats.totalInvalid > stats.totalRepairs * 0.3) {
    console.warn(`Tool repair failure rate above 30%: ${stats.totalInvalid}/${stats.totalRepairs + stats.totalInvalid}`);
    console.warn('Per-tool rates:', JSON.stringify(stats.repairRates, null, 2));
  }
}

// Call periodically or at session end
reportRepairHealth();

function executeToolRaw(toolName: string, args: unknown): unknown {
  // Actual tool execution — this is where OpenCode runs bash, edit, write, etc.
  throw new Error('Not implemented — this is reference code for integration');
}
*/

console.log('Tool-repair integration guide loaded.');
console.log('This is reference code — see source comments for wiring instructions.');
