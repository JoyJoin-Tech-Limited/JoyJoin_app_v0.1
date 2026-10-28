import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  DQS_DIMENSIONS,
  evaluateIcebreakerContentQuality,
  type IcebreakerContentQualityInput,
} from "../evaluation/icebreakerContentQuality";

vi.setConfig({ testTimeout: 30_000 });

const fixtureUrl = new URL(
  "./fixtures/icebreakerContentQuality/synthetic-pass.json",
  import.meta.url,
);
const syntheticFixture = JSON.parse(
  readFileSync(fixtureUrl, "utf8"),
) as IcebreakerContentQualityInput;
const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
const cliPath = join(repoRoot, "apps/server/src/scripts/evaluate-icebreaker-content-quality.ts");

function fixture(): IcebreakerContentQualityInput {
  return structuredClone(syntheticFixture);
}

function deckId(input: IcebreakerContentQualityInput, contextId: string, role: "current" | "candidate"): string {
  const variant = input.variants.find((entry) => entry.role === role);
  const deck = input.decks.find(
    (entry) => entry.contextId === contextId && entry.variantId === variant?.variantId,
  );
  if (!deck) throw new Error(`Missing synthetic ${role} deck for ${contextId}`);
  return deck.deckId;
}

function runCli(inputPath: string) {
  const processResult = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", cliPath, inputPath],
    { cwd: repoRoot, encoding: "utf8", timeout: 20_000 },
  );
  return {
    processResult,
    json: JSON.parse(processResult.stdout) as Record<string, unknown>,
  };
}

describe("offline icebreaker DQS evidence gate (synthetic fixtures only)", () => {
  it("passes only when every preregistered statistical, quality, and engineering gate holds", () => {
    const report = evaluateIcebreakerContentQuality(fixture());

    expect(report.conclusion).toBe("PASS");
    expect(report.dataOrigin).toBe("synthetic_unit_test");
    expect(report.liveQualityClaim).toBe("not_evaluated_offline_only");
    expect(report.preregistration.complete).toBe(true);
    expect(report.evidence.complete).toBe(true);
    expect(report.power.adequate).toBe(true);
    expect(report.dqs.delta).toBeCloseTo(0.925, 6);
    expect(report.dqs.ci?.lower).toBeGreaterThan(0.2);
    expect(report.preference.score).toBe(1);
    expect(report.preference.ci?.lower).toBeGreaterThan(0.5);
    expect(report.reliability.alpha).toBeGreaterThanOrEqual(0.6);
    expect(report.operations.byVariant["candidate-v2"]?.deckCount).toBe(2);
    expect(report.decks).toHaveLength(4);
    expect(report.contexts).toHaveLength(2);
    expect(DQS_DIMENSIONS).toEqual([
      "answerability",
      "contextFit",
      "specificity",
      "arc",
      "freshness",
    ]);
  });

  it("uses fourth-rater adjudication only for a dimension range of at least two", () => {
    const input = fixture();
    const report = evaluateIcebreakerContentQuality(input);
    const currentDeck = report.decks.find((entry) => entry.deckId === "deck-current-coffee");

    expect(currentDeck?.disagreements).toEqual([
      expect.objectContaining({
        dimension: "answerability",
        range: 2,
        adjudicated: true,
        adjudicatorRaterId: "rater-4",
      }),
    ]);
    expect(currentDeck?.scores?.dimensions.answerability).toBe(4);
    expect(currentDeck?.scores?.dqs).toBe(4);

    const withoutAdjudication = fixture();
    withoutAdjudication.adjudications = [];
    const incomplete = evaluateIcebreakerContentQuality(withoutAdjudication);
    expect(incomplete.conclusion).toBe("INCONCLUSIVE");
    expect(incomplete.reasons).toContain("ADJUDICATION_REQUIRED");
  });

  it("is deterministic under input reordering and uses the preregistered bootstrap seed", () => {
    const first = evaluateIcebreakerContentQuality(fixture());
    const reordered = fixture();
    reordered.contexts.reverse();
    reordered.variants.reverse();
    reordered.decks.reverse();
    reordered.ratings.reverse();
    reordered.preferences.reverse();
    const second = evaluateIcebreakerContentQuality(reordered);

    expect(second.dqs).toEqual(first.dqs);
    expect(second.preference).toEqual(first.preference);
    expect(second.reliability).toEqual(first.reliability);
    expect(second.decks).toEqual(first.decks);
  });

  it("cannot PASS without preregistration, even with otherwise strong scores", () => {
    const input = fixture();
    delete input.preregistration;

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.conclusion).toBe("INCONCLUSIVE");
    expect(report.preregistration.complete).toBe(false);
    expect(report.reasons).toContain("PREREGISTRATION_MISSING");
    expect(report.dqs.ci).toBeNull();
  });

  it("cannot turn an underpowered quality loss into FAIL or PASS", () => {
    const input = fixture();
    const removedDeckIds = new Set(
      input.decks.filter((entry) => entry.contextId === "ctx-boardgames").map((entry) => entry.deckId),
    );
    input.contexts = input.contexts.filter((entry) => entry.contextId !== "ctx-boardgames");
    input.decks = input.decks.filter((entry) => entry.contextId !== "ctx-boardgames");
    input.ratings = input.ratings.filter((entry) => !removedDeckIds.has(entry.deckId));
    input.adjudications = input.adjudications.filter((entry) => !removedDeckIds.has(entry.deckId));
    input.preferences = input.preferences
      .filter((entry) => entry.contextId !== "ctx-boardgames")
      .map((entry) => ({ ...entry, choice: "tie" }));

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.preference.score).toBe(0.5);
    expect(report.power.adequate).toBe(false);
    expect(report.conclusion).toBe("INCONCLUSIVE");
    expect(report.reasons).toContain("UNDERPOWERED_CONTEXTS");
    expect(report.reasons).toContain("UNDERPOWERED_PAIRWISE_COMPARISONS");
  });

  it("cannot PASS with incomplete required readings", () => {
    const input = fixture();
    const candidateDeckId = deckId(input, "ctx-boardgames", "candidate");
    const ratingIndex = input.ratings.findIndex(
      (entry) => entry.deckId === candidateDeckId && entry.raterId === "rater-3",
    );
    input.ratings.splice(ratingIndex, 1);

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.conclusion).toBe("INCONCLUSIVE");
    expect(report.evidence.complete).toBe(false);
    expect(report.reasons).toContain("INSUFFICIENT_RATERS");
  });

  it("cannot PASS when any analysis rater has not completed preregistered calibration", () => {
    const input = fixture();
    const rater = input.raters.find((entry) => entry.raterId === "rater-3");
    if (!rater) throw new Error("Missing rater fixture");
    rater.calibrationDecksCompleted = 19;

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.conclusion).toBe("INCONCLUSIVE");
    expect(report.evidence.complete).toBe(false);
    expect(report.reasons).toContain("UNCALIBRATED_RATER");
  });

  it("cannot PASS with ordinal rater reliability below 0.60, even when adjudicated DQS and preference are perfect", () => {
    const input = fixture();
    input.adjudications = [];
    for (const rating of input.ratings) {
      const score = rating.raterId === "rater-1" ? 1 : rating.raterId === "rater-2" ? 5 : 3;
      for (const dimension of DQS_DIMENSIONS) rating.scores[dimension] = score;
    }
    for (const deck of input.decks) {
      const role = input.variants.find((entry) => entry.variantId === deck.variantId)?.role;
      for (const dimension of DQS_DIMENSIONS) {
        input.adjudications.push({
          deckId: deck.deckId,
          dimension,
          adjudicatorRaterId: "rater-4",
          score: role === "candidate" ? 5 : 4,
        });
      }
    }

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.preregistration.complete).toBe(true);
    expect(report.evidence.complete).toBe(true);
    expect(report.power.adequate).toBe(true);
    expect(report.dqs.delta).toBe(1);
    expect(report.preference.score).toBe(1);
    expect(report.reliability.alpha).toBeLessThan(0.6);
    expect(report.conclusion).toBe("INCONCLUSIVE");
    expect(report.reasons).toContain("RELIABILITY_BELOW_THRESHOLD");
  });

  it("marks a hard-gate deck invalid and cannot average the failure away or hide it as incomplete", () => {
    const input = fixture();
    const candidateDeckId = deckId(input, "ctx-coffee", "candidate");
    const deck = input.decks.find((entry) => entry.deckId === candidateDeckId);
    if (!deck) throw new Error("Missing candidate fixture deck");
    deck.hardGates.contentSafety = false;
    input.ratings = input.ratings.filter((entry) => entry.deckId !== candidateDeckId);
    input.adjudications = input.adjudications.filter((entry) => entry.deckId !== candidateDeckId);
    delete input.preregistration;

    const report = evaluateIcebreakerContentQuality(input);
    const invalidDeck = report.decks.find((entry) => entry.deckId === candidateDeckId);

    expect(report.conclusion).toBe("FAIL");
    expect(invalidDeck?.invalid).toBe(true);
    expect(invalidDeck?.scores).toBeNull();
    expect(invalidDeck?.invalidReasons).toContain("hardGate:contentSafety");
    expect(report.operations.byVariant["candidate-v2"]?.invalidCount).toBe(1);
    expect(report.reasons).toContain("HARD_GATE_FAILURE");
  });

  it("fails a powered dimension regression even when total DQS and preference still clear their thresholds", () => {
    const input = fixture();
    const candidateVariantId = input.variants.find((entry) => entry.role === "candidate")?.variantId;
    const candidateDeckIds = new Set(
      input.decks.filter((entry) => entry.variantId === candidateVariantId).map((entry) => entry.deckId),
    );
    for (const rating of input.ratings) {
      if (candidateDeckIds.has(rating.deckId)) rating.scores.specificity = 2;
    }

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.dqs.delta).toBeGreaterThanOrEqual(0.4);
    expect(report.dqs.ci?.lower).toBeGreaterThan(0.2);
    expect(report.dqs.dimensions.specificity.delta).toBe(-1.5);
    expect(report.preference.score).toBe(1);
    expect(report.conclusion).toBe("FAIL");
    expect(report.reasons).toContain("DIMENSION_DROP_OVER_THRESHOLD");
  });

  it("retains fallback rows and fails candidate fallback-rate regression", () => {
    const input = fixture();
    const candidateDeckId = deckId(input, "ctx-coffee", "candidate");
    const deck = input.decks.find((entry) => entry.deckId === candidateDeckId);
    if (!deck) throw new Error("Missing candidate fixture deck");
    deck.fallbackUsed = true;

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.operations.byVariant["candidate-v2"]?.fallbackCount).toBe(1);
    expect(report.operations.byVariant["candidate-v2"]?.fallbackRate).toBe(0.5);
    expect(report.conclusion).toBe("FAIL");
    expect(report.reasons).toContain("FALLBACK_REGRESSION");
  });

  it("fails an explicit engineering-gate regression when the evidence is otherwise complete", () => {
    const input = fixture();
    const candidateDeckId = deckId(input, "ctx-coffee", "candidate");
    const deck = input.decks.find((entry) => entry.deckId === candidateDeckId);
    if (!deck) throw new Error("Missing candidate fixture deck");
    deck.engineeringGates.readyAndIdempotent = false;

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.preregistration.complete).toBe(true);
    expect(report.evidence.complete).toBe(true);
    expect(report.power.adequate).toBe(true);
    expect(report.conclusion).toBe("FAIL");
    expect(report.reasons).toContain("ENGINEERING_GATE_FAILURE");
  });

  it("counts a tie as half a win and reports supplied live coverage without making a live-quality claim", () => {
    const input = fixture();
    const firstPreference = input.preferences[0];
    if (!firstPreference) throw new Error("Missing preference fixture");
    firstPreference.choice = "tie";
    const candidateVariantId = input.variants.find((entry) => entry.role === "candidate")?.variantId;
    const currentVariantId = input.variants.find((entry) => entry.role === "current")?.variantId;
    if (!candidateVariantId || !currentVariantId) throw new Error("Missing variant fixture");
    input.liveEvidence = [
      {
        variantId: candidateVariantId,
        assignedDecks: 4,
        exposedDecks: 3,
        unobservedDecks: 1,
        invalidatedDecks: 0,
        helpful: 1,
        neutral: 1,
        awkward: 0,
      },
      {
        variantId: currentVariantId,
        assignedDecks: 4,
        exposedDecks: 2,
        unobservedDecks: 1,
        invalidatedDecks: 1,
        helpful: 1,
        neutral: 0,
        awkward: 1,
      },
    ];

    const report = evaluateIcebreakerContentQuality(input);

    expect(report.preference.wins).toBe(5);
    expect(report.preference.ties).toBe(1);
    expect(report.preference.score).toBeCloseTo(5.5 / 6, 6);
    expect(report.liveEvidence.byVariant[candidateVariantId]?.feedbackCoverage).toBeCloseTo(2 / 3, 6);
    expect(report.liveEvidence.byVariant[currentVariantId]?.feedbackCoverage).toBe(1);
    expect(report.liveEvidence.usedInOfflineConclusion).toBe(false);
    expect(report.liveQualityClaim).toBe("not_evaluated_offline_only");
  });

  it("CLI exits 0 for PASS, 1 for FAIL or invalid input, and 2 for INCONCLUSIVE with JSON stdout", () => {
    const directory = mkdtempSync(join(tmpdir(), "icebreaker-dqs-cli-"));
    try {
      const passPath = join(directory, "pass.json");
      const failPath = join(directory, "fail.json");
      const inconclusivePath = join(directory, "inconclusive.json");
      const invalidPath = join(directory, "invalid.json");
      writeFileSync(passPath, JSON.stringify(fixture()));

      const failing = fixture();
      const firstDeck = failing.decks[0];
      if (!firstDeck) throw new Error("Missing deck fixture");
      firstDeck.hardGates.arcConstraints = false;
      writeFileSync(failPath, JSON.stringify(failing));

      const inconclusive = fixture();
      delete inconclusive.preregistration;
      writeFileSync(inconclusivePath, JSON.stringify(inconclusive));

      const invalid = fixture() as IcebreakerContentQualityInput;
      const firstRating = invalid.ratings[0];
      if (!firstRating) throw new Error("Missing rating fixture");
      firstRating.scores.answerability = 6;
      writeFileSync(invalidPath, JSON.stringify(invalid));

      const pass = runCli(passPath);
      const fail = runCli(failPath);
      const inconclusiveResult = runCli(inconclusivePath);
      const invalidResult = runCli(invalidPath);

      expect(pass.processResult.status).toBe(0);
      expect(pass.json.conclusion).toBe("PASS");
      expect(fail.processResult.status).toBe(1);
      expect(fail.json.conclusion).toBe("FAIL");
      expect(inconclusiveResult.processResult.status).toBe(2);
      expect(inconclusiveResult.json.conclusion).toBe("INCONCLUSIVE");
      expect(invalidResult.processResult.status).toBe(1);
      expect(invalidResult.json.status).toBe("INVALID_INPUT");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
