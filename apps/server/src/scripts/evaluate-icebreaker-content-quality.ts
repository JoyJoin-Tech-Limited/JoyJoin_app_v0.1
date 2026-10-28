#!/usr/bin/env node
/**
 * Evaluate one offline DQS evidence JSON file.
 *
 * Usage (from repository root):
 *   node --import tsx/esm apps/server/src/scripts/evaluate-icebreaker-content-quality.ts <evidence.json>
 *
 * CI policy: PASS=0, FAIL=1, INCONCLUSIVE=2, invalid input/read failure=1.
 * Stdout is always one JSON document; no live-quality claim is emitted.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateIcebreakerContentQuality,
  IcebreakerContentQualityInputError,
} from "../evaluation/icebreakerContentQuality";

function writeJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0]) {
    writeJson({
      status: "INVALID_INPUT",
      message: "Usage: evaluate-icebreaker-content-quality.ts <evidence.json>",
      exitCodePolicy: { PASS: 0, FAIL: 1, INCONCLUSIVE: 2, INVALID_INPUT: 1 },
    });
    process.exitCode = 1;
    return;
  }

  try {
    const input = JSON.parse(readFileSync(resolve(args[0]), "utf8")) as unknown;
    const report = evaluateIcebreakerContentQuality(input);
    writeJson(report);
    process.exitCode = report.conclusion === "PASS" ? 0 : report.conclusion === "FAIL" ? 1 : 2;
  } catch (error) {
    const isInputError = error instanceof IcebreakerContentQualityInputError;
    writeJson({
      status: "INVALID_INPUT",
      message: error instanceof Error ? error.message : String(error),
      issues: isInputError ? error.issues : [],
      exitCodePolicy: { PASS: 0, FAIL: 1, INCONCLUSIVE: 2, INVALID_INPUT: 1 },
    });
    process.exitCode = 1;
  }
}

main();
