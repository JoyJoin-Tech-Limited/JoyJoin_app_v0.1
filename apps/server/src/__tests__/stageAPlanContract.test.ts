import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../../..");
const PLAN_PATH = path.join(
  REPO_ROOT,
  "docs/deliberations/2026-10-26-icebreaker-agent-content-plan-review.md",
);

const document = readFileSync(PLAN_PATH, "utf8");
const gateA = document.split("### Gate A — M1 timing（先过）")[1]?.split("### Gate B —")[0] ?? "";

// Only explicitly labelled rejected history may mention the retired numeric
// rule. It must never survive as an active validity criterion.
const activeGateA = gateA
  .split("\n")
  .filter((line) => !line.includes("已拒绝的历史规则"))
  .join("\n");

describe("Stage A active Gate A experiment-validity contract", () => {
  it("retains the 12-table × one executable Ask = maximum 12-exposure feasibility bound", () => {
    expect(gateA).toContain("12 处理桌");
    expect(gateA).toMatch(/上限\s*12\s*次曝光/);
  });

  it("requires preregistered baseline, MDE, alpha=.05 and power=.80", () => {
    expect(activeGateA).toMatch(/基线|baseline/i);
    expect(activeGateA).toMatch(/\bMDE\b/);
    expect(activeGateA).toMatch(/α\s*=\s*0?\.05/);
    expect(activeGateA).toMatch(/power\s*=\s*0?\.80/i);
  });

  it("requires table-level clustering, ICC and design-effect-aware table/exposure budgeting", () => {
    expect(activeGateA).toMatch(/桌级/);
    expect(activeGateA).toMatch(/\bICC\b/);
    expect(activeGateA).toMatch(/设计效应|design effect/i);
    expect(activeGateA).toMatch(/桌数.*曝光预算/);
  });

  it("requires an A/A or shadow validity check before treatment claims", () => {
    expect(activeGateA).toMatch(/A\/A/);
    expect(activeGateA).toMatch(/shadow/i);
  });

  it("keeps timing and content experiments separate", () => {
    expect(activeGateA).toMatch(/Gate A\s*只检验\s*timing/i);
    expect(activeGateA).toMatch(/内容实验.*Gate B\/C/);
  });

  it("does not present fixed 100 Ask exposures as the active validity gate", () => {
    expect(activeGateA).not.toMatch(/100\s*次\s*Ask|至少\s*100|fixed[- ]100/i);
    for (const line of gateA.split("\n").filter((candidate) => candidate.includes("100"))) {
      expect(line).toContain("已拒绝的历史规则");
    }
  });
});
