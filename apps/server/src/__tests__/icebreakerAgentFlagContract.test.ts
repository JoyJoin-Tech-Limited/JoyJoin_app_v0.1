import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  FEATURE_FLAG_DESCRIPTIONS,
  FEATURE_FLAG_LABELS,
  FEATURE_FLAG_SECTION_BY_KEY,
} from "@shared/copy/featureFlags";

import { DEFAULT_FLAG_VALUES, FLAG_ENV_MAP } from "../lib/featureFlags";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../../..");

function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

function paragraphContaining(source: string, needle: string): string {
  return source.split(/\n\s*\n/).find((paragraph) => paragraph.includes(needle)) ?? "";
}

describe("icebreaker agent copilot launch flag contract", () => {
  it("is a DB-backed flag with an explicit true default (kill switch)", () => {
    expect(FLAG_ENV_MAP.icebreakerAgentCopilotEnabled).toBe("ICEBREAKER_AGENT_COPILOT_ENABLED");
    expect(DEFAULT_FLAG_VALUES.icebreakerAgentCopilotEnabled).toBe(true);
  });

  it("has complete admin copy and section ownership", () => {
    expect(FEATURE_FLAG_SECTION_BY_KEY.icebreakerAgentCopilotEnabled).toBe("icebreaker-core");
    expect(FEATURE_FLAG_LABELS.icebreakerAgentCopilotEnabled).toBe("悦仔破冰副驾");
    expect(FEATURE_FLAG_DESCRIPTIONS.icebreakerAgentCopilotEnabled).toContain("默认开启");
    expect(FEATURE_FLAG_DESCRIPTIONS.icebreakerAgentCopilotEnabled).toContain("kill switch");
  });

  it("ships enabled by default in the env example", () => {
    expect(readRepoFile(".env.example")).toMatch(/^ICEBREAKER_AGENT_COPILOT_ENABLED=true$/m);
  });

  it("documents the default-on kill-switch posture in both canonical domain docs", () => {
    const flagDoc = paragraphContaining(
      readRepoFile("docs/agent-context/feature-flags.md"),
      "icebreakerAgentCopilotEnabled",
    );
    const socialDoc = paragraphContaining(
      readRepoFile("docs/agent-context/social-icebreaker.md"),
      "icebreakerAgentCopilotEnabled",
    );

    for (const doc of [flagDoc, socialDoc]) {
      expect(doc).toContain("default `true`");
      expect(doc).toContain("kill switch");
      expect(doc).toContain("zero Agent");
    }
  });
});
