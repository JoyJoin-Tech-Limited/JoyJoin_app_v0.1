/**
 * Smoke test — Wave 3 (highlightsInjectorEnabled) + Wave 4 (sessionGlowEnabled)
 * full-chain validation against the real dev DB.
 *
 * Creates a throwaway 6-player session (1 scripted host + 5 virtual bots),
 * forces BOTH wave snapshots on via the state fields (the resolver honors
 * pre-set fields — socialIcebreakerHelpers.ts:1332/1363), then walks every
 * gameplay phase with the real bot simulation harness and the real
 * transitionPhase choke point, and asserts:
 *
 *   Wave 3: highlights extracted at warmup + quip_battle exits; the recap
 *           generator receives them and selects the paired *_HL promptVersion
 *           (hard check when the LLM actually fired, soft notice on fallback).
 *   Wave 4: glow banked from all deterministic sources (quip/mirror/auction/
 *           challenge/dice/lie + undercover either-way), caps respected,
 *           recap glow block present, dual-write medals === recapSnapshot.medals,
 *           medal honesty (every medal backed by persisted data), tiers derived.
 *
 * Mini_script (bonus-gate pause) and speed_friending (host-driven, no glow
 * source) are intentionally out of scope.
 *
 * Run (from apps/server):
 *   node --env-file=../../.env --import tsx/esm src/scripts/smoke-icebreaker-waves.ts [--no-llm] [--keep]
 *
 * Exit 0 = all checks pass; 1 = any failure. Cleans up everything it created
 * unless --keep is passed.
 */
import { eq } from "drizzle-orm";
import {
  socialIcebreakerLieTruths,
  socialIcebreakerParticipants,
  socialIcebreakerPhaseMetrics,
  socialIcebreakerPhasePulseChecks,
  socialIcebreakerSessions,
  users,
} from "@shared/schema";
import type {
  AuctionHighBid,
  GlowPointBreakdown,
  SocialIcebreakerPhase,
  SocialSessionState,
  SingleTestState,
} from "@shared/socialIcebreaker";
import { AUCTION_STARTING_COINS } from "@shared/socialIcebreaker";
import { db } from "../db";
import {
  createSession,
  getSessionWithExpiry,
  setLieTruths,
  updateSession,
  upsertParticipant,
} from "../lib/socialIcebreakerStore";
import {
  deriveGlowTier,
  glowTotal,
  hasFullGlowAttendance,
} from "../lib/sessionGlow";
import {
  MICRO_CHALLENGES_PROMPT_VERSION_HL,
  PERSONALITY_DICE_PROMPT_VERSION_HL,
  RECAP_SUMMARY_PROMPT_VERSION_HL,
} from "../ai/socialIcebreakerPrompts";
import { generateMicroChallenges } from "../socialIcebreakerAI/microChallenge";
import {
  generateGroupMirrorQuestions,
  generateLieDetectiveStatements,
  generateQuipBattlePrompts,
  generateUndercoverWordPair,
} from "../socialIcebreakerAIService";
import { generatePersonalityDiceChallenges } from "../socialIcebreakerPersonalityDiceAI";
import { generateAuctionLots } from "../socialIcebreakerAuctionAI";
import { simulateBotsForSession } from "../services/socialIcebreakerBotService";
import {
  ensureRecapSnapshot,
  transitionPhase,
} from "../routes/socialIcebreakerHelpers";

// ── Env gates (read at call time by the bot harness) ──
process.env.APP_MODE = "test";
process.env.SOCIAL_ICEBREAKER_TEST_MODE_ENABLED = "true";

const NO_LLM = process.argv.includes("--no-llm");
const KEEP = process.argv.includes("--keep");
if (NO_LLM) {
  process.env.SOCIAL_QUIP_BATTLE_LLM_ENABLED = "false";
  process.env.SOCIAL_UNDERCOVER_WORD_LLM_ENABLED = "false";
  process.env.SOCIAL_GROUP_MIRROR_LLM_ENABLED = "false";
  process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED = "false";
  process.env.SOCIAL_PERSONALITY_DICE_LLM_ENABLED = "false";
  process.env.SOCIAL_LIE_DETECTIVE_LLM_ENABLED = "false";
  process.env.SOCIAL_AUCTION_LLM_ENABLED = "false";
  process.env.SOCIAL_RECAP_LLM_ENABLED = "false";
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  const mark = ok ? "✅ PASS" : "❌ FAIL";
  if (!ok) failures += 1;
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}
function note(label: string, detail = ""): void {
  console.log(`ℹ️  NOTE ${label}${detail ? ` — ${detail}` : ""}`);
}

const ENABLED_PHASES: SocialIcebreakerPhase[] = [
  "warmup",
  "micro_challenge",
  "lie_detective",
  "auction",
  "quip_battle",
  "personality_dice",
  "group_mirror",
  "undercover_word",
];

async function main(): Promise<void> {
  const ts = Date.now();
  const socialSessionId = `social_smoke_waves_${ts}`;
  const icebreakerSessionId = `smoke_waves_${ts}`;
  const phone = `139${String(ts).slice(-8)}`;

  console.log(`\n=== Icebreaker Wave 3/4 smoke (run ${ts}) ===`);
  console.log(`    session=${socialSessionId} llm=${NO_LLM ? "disabled (curated fallbacks)" : "enabled"}\n`);

  // ── Seed: host user + session + participants ──
  console.log("[step] seed host user…");
  const [hostUser] = await db
    .insert(users)
    .values({ phoneNumber: phone, firstName: "冒烟", lastName: `主持${String(ts).slice(-4)}` })
    .returning({ id: users.id });
  if (!hostUser) throw new Error("failed to create smoke host user");
  const hostUserId = hostUser.id;

  const botPersonas = [1, 2, 3, 4, 5].map((n) => ({
    botId: `sw-bot-${n}-${ts}`,
    userId: `sw-bot-user-${n}-${ts}`,
    displayName: `机器人${n}号`,
    archetype: "社牛柯基",
  }));
  const singleTest: SingleTestState = {
    version: 2,
    groupId: `smoke-group-${ts}`,
    isTestModeSkip: true,
    runBots: true,
    bots: botPersonas.map((p) => ({ botId: p.botId, displayName: p.displayName, archetype: p.archetype })),
    botPersonas,
  } as SingleTestState;

  const now = Date.now();
  const state: SocialSessionState = {
    socialSessionId,
    icebreakerSessionId,
    currentPhase: "warmup",
    hostUserId,
    hostDisplayName: "冒烟主持人",
    playerCount: 6,
    phaseStartedAt: now,
    sessionStartedAt: now,
    completedPhases: [],
    enabledPhases: [...ENABLED_PHASES],
    singleTest,
    // Wave 3/4 snapshots forced on (resolver honors pre-set state fields).
    highlightsInjectorEnabled: true,
    sessionGlowEnabled: true,
    // Legacy dice path: bots complete via diceCompletedBy (simplest honest drive).
    personalityDiceChooseModeEnabled: false,
  } as SocialSessionState;

  console.log("[step] create session + participants…");
  await createSession(state);
  await upsertParticipant(socialSessionId, hostUserId, "冒烟主持人", false);
  for (const bot of botPersonas) {
    await upsertParticipant(socialSessionId, bot.userId, bot.displayName, true);
  }

  const rosterForGenerators = [
    { userId: hostUserId, displayName: "冒烟主持人", archetype: "社牛柯基" },
    ...botPersonas.map((p) => ({ userId: p.userId, displayName: p.displayName, archetype: p.archetype })),
  ];
  const llmMetas: Array<{ feature: string; promptVersion?: string; fallbackUsed?: boolean }> = [];

  async function advance(label: string): Promise<void> {
    const before = state.currentPhase;
    await transitionPhase({ state, socialSessionId, trigger: "host_tap" });
    await updateSession(socialSessionId, state);
    console.log(`  [advance] ${label}: ${before} → ${state.currentPhase}`);
  }

  // ── Phase 1: warmup ──
  console.log("[phase] warmup — topics discussed → Wave 3 warmup section");
  state.warmupTopics = [
    { question: "最近吃到最惊喜的一顿饭是什么？" },
    { question: "如果可以瞬移，这周末最想去哪里？" },
    { question: "最近有什么小事让你特别开心？" },
  ] as SocialSessionState["warmupTopics"];
  state.currentTopicIndex = 2;
  await simulateBotsForSession(socialSessionId, state);
  state.warmupReadyUserIds = [...(state.warmupReadyUserIds ?? []), hostUserId];
  const highlightsBeforeWarmup = state.highlights;
  await advance("warmup");
  check(
    "W3: warmup exit extracts 聊到 section",
    typeof state.highlights === "string" && state.highlights.includes("聊到") && state.highlights !== highlightsBeforeWarmup,
    state.highlights,
  );

  // ── Phase 2: micro_challenge ──
  console.log("[phase] micro_challenge — generator sees highlights (HL promptVersion)");
  const microResult = await generateMicroChallenges({
    eventType: "饭局",
    participantCount: 6,
    seed: socialSessionId,
    highlights: state.highlights,
  });
  llmMetas.push({ feature: "micro_challenge", promptVersion: microResult.meta?.promptVersion, fallbackUsed: microResult.meta?.fallbackUsed });
  state.currentChallenge = (Array.isArray(microResult.data) ? microResult.data[0] : microResult.data) as SocialSessionState["currentChallenge"];
  await simulateBotsForSession(socialSessionId, state);
  state.challengeCompletedBy = [...(state.challengeCompletedBy ?? []), hostUserId];
  await advance("micro_challenge");

  // ── Phase 3: lie_detective — full 6-turn reveal loop ──
  console.log("[phase] lie_detective — 6-turn reveal loop");
  for (let turn = 0; turn < 6; turn += 1) {
    state.currentLieDetectivePlayerIndex = turn;
    const current = (state.lieDetectivePlayers ?? [])[turn];
    // Ensure the current player has statements (bots self-generate on sim; host needs a scripted set).
    if (!current || current.userId === hostUserId) {
      const hostSet = await generateLieDetectiveStatements({
        userId: hostUserId,
        displayName: "冒烟主持人",
        archetype: "社牛柯基",
        mode: "v1",
      });
      const statements = hostSet.data ?? [];
      const players = state.lieDetectivePlayers ?? [];
      if (!players.find((p) => p.userId === hostUserId)) {
        players.push({
          userId: hostUserId,
          displayName: "冒烟主持人",
          statements: statements.map((s) => ({ index: s.index, text: s.text })),
        });
        state.lieDetectivePlayers = players;
      }
      await setLieTruths(socialSessionId, hostUserId, statements);
    }
    await simulateBotsForSession(socialSessionId, state);
    // Host votes for the current player (never for themselves).
    const target = (state.lieDetectivePlayers ?? [])[turn];
    if (target && target.userId !== hostUserId) {
      const votes = state.votes ?? [];
      if (!votes.some((v) => v.voterId === hostUserId && v.targetUserId === target.userId)) {
        votes.push({ voterId: hostUserId, targetUserId: target.userId, guessedStatementIndex: 2 });
        state.votes = votes;
      }
      // Re-run sim so the reveal fires now that every non-target player voted.
      await simulateBotsForSession(socialSessionId, state);
    }
    // Clear per-turn vote/reveal state for the next turn.
    state.votes = [];
    state.currentLieDetectiveReveal = undefined;
  }
  check(
    "drive: all 6 lie turns completed",
    (state.lieDetectiveCompletedUserIds ?? []).length === 6,
    `completed=${(state.lieDetectiveCompletedUserIds ?? []).length}`,
  );
  await advance("lie_detective");

  // ── Phase 4: auction — scripted lot closes with winners ──
  console.log("[phase] auction — 3 lots, alternating winners");
  const auctionBalances: Record<string, number> = {};
  for (const p of rosterForGenerators) auctionBalances[p.userId] = AUCTION_STARTING_COINS;
  state.auctionBalances = auctionBalances;
  const lotsResult = await generateAuctionLots({ participantCount: 6, eventType: "饭局", auctionV2: false });
  const lots = (lotsResult.data ?? []).slice(0, 3);
  state.auctionLots = lots;
  check("drive: auction lots generated", lots.length >= 2, `lots=${lots.length}`);
  for (let i = 0; i < lots.length; i += 1) {
    state.auctionCurrentLotIndex = i;
    state.auctionHighBid = null;
    await simulateBotsForSession(socialSessionId, state);
    const botHigh = state.auctionHighBid as AuctionHighBid | null;
    const hostWins = i % 2 === 0;
    if (hostWins && botHigh) {
      const hostBid = botHigh.amount + 10;
      auctionBalances[hostUserId] = (auctionBalances[hostUserId] ?? AUCTION_STARTING_COINS) - hostBid;
      state.auctionBalances = auctionBalances;
      state.auctionHighBid = { userId: hostUserId, amount: hostBid };
      state.auctionBidHistory = [
        ...(state.auctionBidHistory ?? []),
        { userId: hostUserId, amount: hostBid, at: Date.now(), lotIndex: i },
      ].slice(0, 200);
    }
    const winner = state.auctionHighBid;
    state.auctionLotResults = [
      ...(state.auctionLotResults ?? []),
      {
        lotIndex: i,
        lotId: lots[i].id,
        title: lots[i].title,
        winnerUserId: winner?.userId ?? null,
        winningAmount: winner?.amount ?? null,
        bidCount: (state.auctionBidHistory ?? []).filter((b) => b.lotIndex === i).length,
        wasAllIn: false,
      },
    ];
  }
  state.auctionAllLotsClosed = true;
  await advance("auction");

  // ── Phase 5: quip_battle — answers + votes + reveal results ──
  console.log("[phase] quip_battle — answers + votes → Wave 3 quip section");
  const quipResult = await generateQuipBattlePrompts({
    eventType: "饭局",
    participantCount: 6,
    participants: rosterForGenerators,
    roster: rosterForGenerators,
  });
  const prompts = quipResult.data ?? [];
  state.quipBattlePrompts = prompts;
  check("drive: quip prompts generated", prompts.length > 0, `prompts=${prompts.length}`);
  for (const prompt of prompts) {
    state.quipBattleAnswers = [
      ...(state.quipBattleAnswers ?? []),
      { userId: hostUserId, displayName: "冒烟主持人", promptId: prompt.id, answerText: "把周一开成周五的样子" },
    ];
  }
  state.quipBattleSubmittedUserIds = [...(state.quipBattleSubmittedUserIds ?? []), hostUserId];
  await simulateBotsForSession(socialSessionId, state);
  // Host votes for the first non-host answer per prompt.
  for (const prompt of prompts) {
    const target = (state.quipBattleAnswers ?? []).find((a) => a.promptId === prompt.id && a.userId !== hostUserId);
    if (target) {
      state.quipBattleVotes = [
        ...(state.quipBattleVotes ?? []),
        { voterId: hostUserId, answerId: `${target.userId}::${target.promptId}`, promptId: prompt.id },
      ];
    }
  }
  state.quipBattleVotedUserIds = [...(state.quipBattleVotedUserIds ?? []), hostUserId];
  // Reveal: replicate the route's results computation (socialIcebreakerExtended.ts).
  state.quipBattleResults = prompts.map((prompt) => {
    const promptAnswers = (state.quipBattleAnswers ?? []).filter((a) => a.promptId === prompt.id);
    const promptVotes = (state.quipBattleVotes ?? []).filter((v) => v.promptId === prompt.id);
    const voteCounts: Record<string, number> = {};
    for (const v of promptVotes) voteCounts[v.answerId] = (voteCounts[v.answerId] ?? 0) + 1;
    let winnerUserId = "";
    let winnerDisplayName = "";
    let maxVotes = 0;
    for (const [answerId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        const answer = promptAnswers.find((a) => `${a.userId}::${a.promptId}` === answerId);
        winnerUserId = answer?.userId ?? "";
        winnerDisplayName = answer?.displayName ?? "";
      }
    }
    return { promptId: prompt.id, promptText: prompt.promptText, answers: promptAnswers, winnerUserId, winnerDisplayName, voteCount: maxVotes };
  });
  state.quipBattleRevealed = true;
  const highlightsBeforeQuip = state.highlights;
  await advance("quip_battle");
  check(
    "W3: quip exit extracts 金句 section",
    typeof state.highlights === "string" && state.highlights.includes("金句") && state.highlights !== highlightsBeforeQuip,
    state.highlights,
  );

  // ── Phase 6: personality_dice (legacy completion path) ──
  console.log("[phase] personality_dice — generator sees highlights (HL promptVersion)");
  const diceResult = await generatePersonalityDiceChallenges({
    participants: rosterForGenerators,
    highlights: state.highlights,
  });
  llmMetas.push({ feature: "personality_dice", promptVersion: diceResult.meta?.promptVersion, fallbackUsed: diceResult.meta?.fallbackUsed });
  state.personalityDiceChallenges = diceResult.data as SocialSessionState["personalityDiceChallenges"];
  await simulateBotsForSession(socialSessionId, state);
  state.diceCompletedBy = [...(state.diceCompletedBy ?? []), hostUserId];
  await advance("personality_dice");

  // ── Phase 7: group_mirror — nominations ──
  console.log("[phase] group_mirror — nominations");
  const mirrorResult = await generateGroupMirrorQuestions({
    eventType: "饭局",
    participantCount: 6,
    participantNames: rosterForGenerators.map((p) => p.displayName),
    roster: rosterForGenerators,
  });
  const mirrorQuestions = mirrorResult.data ?? [];
  state.groupMirrorQuestions = mirrorQuestions;
  check("drive: mirror questions generated", mirrorQuestions.length > 0, `questions=${mirrorQuestions.length}`);
  for (const q of mirrorQuestions) {
    state.groupMirrorAnswers = [
      ...(state.groupMirrorAnswers ?? []),
      {
        userId: hostUserId,
        displayName: "冒烟主持人",
        questionId: q.id,
        targetUserId: botPersonas[0].userId,
        reasonText: "TA一进门就把气氛带起来了",
      },
    ];
  }
  state.groupMirrorSubmittedUserIds = [...(state.groupMirrorSubmittedUserIds ?? []), hostUserId];
  await simulateBotsForSession(socialSessionId, state);
  await advance("group_mirror");

  // ── Phase 8: undercover_word — descriptions + vote + result ──
  console.log("[phase] undercover_word — descriptions + vote");
  const pairResult = await generateUndercoverWordPair({
    eventType: "饭局",
    participantCount: 6,
    roster: rosterForGenerators,
  });
  state.undercoverWordPair = pairResult.data;
  const undercoverUserId = botPersonas[1].userId;
  state.undercoverUserId = undercoverUserId;
  state.undercoverWordCurrentRound = 0;
  state.undercoverWordRounds = [
    {
      roundNumber: 1,
      descriptions: [{ userId: hostUserId, displayName: "冒烟主持人", text: "这个东西周末经常出现" }],
    },
  ] as SocialSessionState["undercoverWordRounds"];
  await simulateBotsForSession(socialSessionId, state);
  // Host votes for the actual undercover (deterministic correct catch-vote).
  state.undercoverWordVotes = [
    ...(state.undercoverWordVotes ?? []),
    { voterId: hostUserId, targetUserId: undercoverUserId },
  ];
  state.undercoverWordVotedUserIds = [...(state.undercoverWordVotedUserIds ?? []), hostUserId];
  const tally: Record<string, number> = {};
  for (const v of state.undercoverWordVotes ?? []) {
    tally[v.targetUserId] = (tally[v.targetUserId] ?? 0) + 1;
  }
  const majorityTarget = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  state.undercoverWordResults = {
    undercoverUserId,
    caught: majorityTarget === undercoverUserId,
  } as SocialSessionState["undercoverWordResults"];
  state.undercoverWordRevealed = true;
  await advance("undercover_word");

  check("drive: session reached recap", state.currentPhase === "recap", `phase=${state.currentPhase}`);

  // ── Recap snapshot (idempotent; transition may have already built it) ──
  console.log("[step] ensure recap snapshot…");
  await ensureRecapSnapshot(state, socialSessionId);
  await updateSession(socialSessionId, state);

  // ── Assertions on persisted truth ──
  console.log("\n[assert] re-reading persisted session…");
  const { state: persisted } = await getSessionWithExpiry(socialSessionId);
  if (!persisted) throw new Error("persisted session not found");

  console.log("\n──────── Wave 3 highlights ────────");
  console.log(persisted.highlights ?? "(none)");
  console.log("──────── Wave 4 glow breakdown ────────");
  for (const [uid, breakdown] of Object.entries(persisted.glowPoints ?? {})) {
    const name = uid === hostUserId ? "主持人" : (botPersonas.find((b) => b.userId === uid)?.displayName ?? uid);
    console.log(`  ${name}: total=${glowTotal(breakdown)} ${JSON.stringify(breakdown)}`);
  }

  // Wave 4: sources banked.
  const glowEntries: GlowPointBreakdown[] = Object.values(persisted.glowPoints ?? {});
  const sourceTotal = (key: keyof GlowPointBreakdown) =>
    glowEntries.reduce((sum, b) => sum + (b[key] ?? 0), 0);
  check("W4: quip glow banked", sourceTotal("quip") > 0, `quip=${sourceTotal("quip")}`);
  check("W4: mirror glow banked", sourceTotal("mirror") > 0, `mirror=${sourceTotal("mirror")}`);
  check("W4: auction glow banked (from auctionLotResults)", sourceTotal("auction") > 0, `auction=${sourceTotal("auction")}`);
  check("W4: challenge glow banked", sourceTotal("challenge") > 0, `challenge=${sourceTotal("challenge")}`);
  check("W4: dice glow banked", sourceTotal("dice") > 0, `dice=${sourceTotal("dice")}`);
  check("W4: lie glow banked", sourceTotal("lie") > 0, `lie=${sourceTotal("lie")}`);
  check("W4: undercover glow banked (hidden or catch)", sourceTotal("undercover") > 0, `undercover=${sourceTotal("undercover")}`);

  // Wave 4: caps.
  check("W4: quip cap ≤ 8", glowEntries.every((b) => (b.quip ?? 0) <= 8));
  check("W4: mirror cap ≤ 8", glowEntries.every((b) => (b.mirror ?? 0) <= 8));
  check("W4: auction cap ≤ 6", glowEntries.every((b) => (b.auction ?? 0) <= 6));
  check("W4: challenge cap ≤ 2", glowEntries.every((b) => (b.challenge ?? 0) <= 2));
  check("W4: dice cap ≤ 2", glowEntries.every((b) => (b.dice ?? 0) <= 2));
  check("W4: lie cap ≤ 1", glowEntries.every((b) => (b.lie ?? 0) <= 1));

  // Recap glow block.
  const recapSnapshot = persisted.recapSnapshot as Record<string, unknown> | undefined;
  check("W4: recapSnapshot exists", Boolean(recapSnapshot));
  const glow = recapSnapshot?.glow as { tiers?: Record<string, string>; medals?: Array<{ title?: string; userId?: string }>; tableLine?: string } | undefined;
  check("W4: recap glow block present (flag-on)", Boolean(glow));
  const medals = (recapSnapshot?.medals as Array<{ title?: string; recipientDisplayName?: string }> | undefined) ?? [];
  const glowMedals = glow?.medals ?? [];
  check("W4: dual-write medals === recapSnapshot.medals", JSON.stringify(medals) === JSON.stringify(glowMedals), `medals=${medals.length}`);
  check("W4: ≤ 4 medals", medals.length <= 4, `count=${medals.length}`);
  check(
    "W4: distinct medal recipients",
    new Set(medals.map((m) => m.recipientDisplayName)).size === medals.length,
  );
  check("W4: table line present", typeof glow?.tableLine === "string" && glow.tableLine.length > 0, glow?.tableLine);

  // Medal honesty (mirrors scripts/check-glow-medal-honesty.ts invariants).
  const rosterIds = [hostUserId, ...botPersonas.map((b) => b.userId)];
  const uidFor = (displayName?: string) =>
    displayName === "冒烟主持人"
      ? hostUserId
      : botPersonas.find((b) => b.displayName === displayName)?.userId;
  for (const medal of medals) {
    const uid = uidFor(medal.recipientDisplayName) ?? "";
    check(`W4: medal 「${medal.title}」recipient in roster`, rosterIds.includes(uid), medal.recipientDisplayName);
    const breakdown = (persisted.glowPoints ?? {})[uid] as GlowPointBreakdown | undefined;
    if (medal.title === "接梗王") check("W4: 接梗王 honesty (quip ≥ 4)", (breakdown?.quip ?? 0) >= 4, `quip=${breakdown?.quip}`);
    if (medal.title === "暖心雷达") check("W4: 暖心雷达 honesty (mirror ≥ 4)", (breakdown?.mirror ?? 0) >= 4, `mirror=${breakdown?.mirror}`);
    if (medal.title === "豪气担当") {
      const won = (persisted.auctionLotResults ?? []).some((r) => r.winnerUserId === uid);
      check("W4: 豪气担当 honesty (won a lot)", won);
    }
    if (medal.title === "全勤小可爱") check("W4: 全勤小可爱 honesty (full attendance)", hasFullGlowAttendance(persisted, uid));
    if (medal.title === "最佳侦探") check("W4: 最佳侦探 honesty floor (lie ≥ 1)", (breakdown?.lie ?? 0) >= 1, `lie=${breakdown?.lie}`);
  }

  // Tier derivation matches persisted points for every roster member.
  const tiers = glow?.tiers ?? {};
  for (const uid of rosterIds) {
    const expected = deriveGlowTier(glowTotal((persisted.glowPoints ?? {})[uid]));
    check(`W4: tier derived for ${uid === hostUserId ? "主持人" : uid}`, tiers[uid] === expected, `tier=${tiers[uid]} expected=${expected}`);
  }

  // Wave 3: promptVersion selection on highlight-aware generators.
  console.log("\n──────── Wave 3 generator promptVersions ────────");
  for (const meta of llmMetas) {
    console.log(`  ${meta.feature}: ${meta.promptVersion} (fallback=${meta.fallbackUsed})`);
  }
  const microMeta = llmMetas.find((m) => m.feature === "micro_challenge");
  const diceMeta = llmMetas.find((m) => m.feature === "personality_dice");
  // selector-v1 is micro_challenge's first-class deterministic path
  // (fallbackUsed: false by design) — "the LLM fired" is detected by
  // promptVersion, not the fallback flag.
  const microLlmFired = microMeta?.fallbackUsed === false && microMeta.promptVersion !== "selector-v1";
  if (microLlmFired) {
    check("W3: micro_challenge selected *_HL promptVersion", microMeta?.promptVersion === MICRO_CHALLENGES_PROMPT_VERSION_HL, microMeta?.promptVersion);
  } else {
    note(`micro_challenge on deterministic path (${microMeta?.promptVersion}) — HL promptVersion check skipped (re-run with LLM to verify)`);
  }
  if (diceMeta?.fallbackUsed === false) {
    check("W3: personality_dice selected *_HL promptVersion", diceMeta.promptVersion === PERSONALITY_DICE_PROMPT_VERSION_HL, diceMeta.promptVersion);
  } else {
    note("personality_dice fell back to curated bank — HL promptVersion check skipped (re-run with LLM to verify)");
  }
  const recapMeta = recapSnapshot?.meta as { promptVersion?: string; fallbackUsed?: boolean } | undefined;
  console.log(`  recap: ${recapMeta?.promptVersion} (fallback=${recapMeta?.fallbackUsed})`);
  if (recapMeta?.fallbackUsed === false) {
    check("W3: recap selected *_HL promptVersion (highlights injected)", recapMeta.promptVersion === RECAP_SUMMARY_PROMPT_VERSION_HL, recapMeta.promptVersion);
  } else {
    note("recap fell back — HL promptVersion check skipped (re-run with LLM to verify)");
  }

  console.log("\n──────── Recap summary (truncated) ────────");
  const recapText = typeof recapSnapshot?.recapSummary === "string" ? recapSnapshot.recapSummary : JSON.stringify(recapSnapshot?.recapSummary);
  console.log((recapText ?? "(none)").slice(0, 400));
  console.log(`\n──────── Medals ────────`);
  for (const medal of medals) {
    console.log(`  「${medal.title}」 → ${medal.recipientDisplayName ?? "(unknown)"}`);
  }
  console.log(`  table line: ${glow?.tableLine ?? "(none)"}`);

  // ── Cleanup ──
  if (KEEP) {
    console.log(`\n⚠️  --keep passed: session ${socialSessionId} + host user ${hostUserId} left in DB`);
  } else {
    await db.delete(socialIcebreakerPhaseMetrics).where(eq(socialIcebreakerPhaseMetrics.socialSessionId, socialSessionId)).catch(() => undefined);
    await db.delete(socialIcebreakerPhasePulseChecks).where(eq(socialIcebreakerPhasePulseChecks.socialSessionId, socialSessionId)).catch(() => undefined);
    await db.delete(socialIcebreakerLieTruths).where(eq(socialIcebreakerLieTruths.socialSessionId, socialSessionId)).catch(() => undefined);
    await db.delete(socialIcebreakerParticipants).where(eq(socialIcebreakerParticipants.socialSessionId, socialSessionId)).catch(() => undefined);
    await db.delete(socialIcebreakerSessions).where(eq(socialIcebreakerSessions.id, socialSessionId)).catch(() => undefined);
    await db.delete(users).where(eq(users.id, hostUserId)).catch(() => undefined);
    console.log("\n🧹 cleanup done");
  }

  console.log(`\n=== Smoke result: ${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Smoke crashed:", err);
  process.exit(1);
});
