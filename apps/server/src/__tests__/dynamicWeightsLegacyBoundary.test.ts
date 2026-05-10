import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, "../../../..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

describe("dynamicWeights legacy boundary", () => {
  it("keeps dynamicWeights.ts as a non-runnable legacy tombstone", () => {
    const source = readRepoFile("apps/server/src/dynamicWeights.ts");

    expect(source).toContain("@deprecated Legacy gradient-descent matching-weight experiment.");
    expect(source).toContain("matchingWeightsService.ts");
    expect(source).toContain("Do not add runtime callers here.");
    expect(source).not.toContain("export function ");
    expect(source).not.toContain("export default");
  });

  it("documents Thompson Sampling as the preferred adaptive-weight path", () => {
    const integrationPlan = readRepoFile("docs/ai/AI_INTEGRATION_PLAN.md");
    const harnessStrategy = readRepoFile("docs/ai/ai-agent-harness-separation-strategy.md");

    expect(integrationPlan).toContain("Primary adaptive-weight path");
    expect(integrationPlan).toContain("Deprecated legacy tombstone");
    expect(harnessStrategy).toContain("Primary adaptive-weight path, implemented but not wired");
  });
});
