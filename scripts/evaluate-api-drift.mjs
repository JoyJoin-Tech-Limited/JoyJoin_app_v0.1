#!/usr/bin/env node
/**
 * evaluate-api-drift.mjs — Detect Zod schema / route handler drift
 *
 * Scans packages/shared/src/ for Zod schema changes and checks whether
 * corresponding route handlers in apps/server/src/routes/ have been updated.
 *
 * Usage:
 *   node scripts/evaluate-api-drift.mjs [--since=<ref>]
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { globSync } from "glob";
import path from "path";

const SHARED_DIR = "packages/shared/src";
const ROUTES_DIR = "apps/server/src/routes";

function getChangedFiles(since = "HEAD") {
  try {
    return execSync(`git diff --name-only ${since}`, { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractZodExports(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const exports = [];
  // Match: export const FooSchema = z.object({...})
  const regex = /export\s+const\s+(\w+Schema)\s*=\s*z\.(\w+)\(/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    exports.push({ name: m[1], type: m[2], line: content.slice(0, m.index).split("\n").length });
  }
  return exports;
}

function findSchemaUsage(schemaName, routesDir) {
  const usages = [];
  try {
    const files = globSync(`${routesDir}/**/*.ts`);
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes(schemaName)) {
        usages.push(file);
      }
    }
  } catch {
    // glob may fail if directory doesn't exist
  }
  return usages;
}

function main() {
  const args = process.argv.slice(2);
  let since = "HEAD";
  for (const arg of args) {
    if (arg.startsWith("--since=")) since = arg.slice("--since=".length);
  }

  const changed = getChangedFiles(since);
  const sharedChanged = changed.filter((f) => f.startsWith(SHARED_DIR));
  const routesChanged = changed.filter((f) => f.startsWith(ROUTES_DIR));

  if (sharedChanged.length === 0) {
    console.log(JSON.stringify({ status: "NO_SHARED_CHANGES", findings: [] }, null, 2));
    process.exit(0);
  }

  const findings = [];

  for (const file of sharedChanged) {
    if (!existsSync(file)) continue;
    const schemas = extractZodExports(file);
    for (const schema of schemas) {
      const usages = findSchemaUsage(schema.name, ROUTES_DIR);
      const usageInChangedRoutes = usages.some((u) => routesChanged.includes(u));

      findings.push({
        schema: schema.name,
        schemaFile: file,
        schemaLine: schema.line,
        schemaType: schema.type,
        totalUsages: usages.length,
        usages,
        routeUpdated: usageInChangedRoutes || usages.length === 0,
        // If no usages found, it may be a new schema — flag for manual review
        isNewSchema: usages.length === 0,
      });
    }
  }

  const drift = findings.filter((f) => !f.routeUpdated && !f.isNewSchema);
  const newSchemas = findings.filter((f) => f.isNewSchema);

  const verdict = drift.length > 0 ? "FAIL" : newSchemas.length > 0 ? "CONCERN" : "PASS";

  console.log(JSON.stringify({
    status: verdict,
    sharedFilesChanged: sharedChanged,
    routeFilesChanged: routesChanged,
    findings,
    driftCount: drift.length,
    newSchemaCount: newSchemas.length,
    evaluatedAt: new Date().toISOString(),
  }, null, 2));

  process.exit(verdict === "PASS" ? 0 : verdict === "CONCERN" ? 2 : 1);
}

main();
