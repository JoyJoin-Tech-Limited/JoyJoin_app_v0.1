#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const FLAG_NAMES = [
  "icebreakerAgentCopilotEnabled",
  "icebreakerMatchingAwareEnabled",
];

const P90_CAVEAT =
  "n=5 nearest-rank 注意：位置 = ceil(0.9 × 5) = 第 5 个，即最大值；" +
  "P90 ≤4 等价于 5/5 全部 ≤4。线性插值 P90 仅记录，不参与判定。";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isIsoDateTime(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function displayNumber(value) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function validateEvidenceFile({ label, value, kind, incompleteReasons, cwd, checkEvidenceFiles }) {
  if (!isNonEmptyString(value)) {
    incompleteReasons.push(`${label}: 缺少${kind}路径`);
    return;
  }
  if (!checkEvidenceFiles) return;

  const absolutePath = resolve(cwd, value);
  try {
    const stats = statSync(absolutePath);
    if (kind === "证据目录") {
      if (!stats.isDirectory()) {
        incompleteReasons.push(`${label}: 证据目录不是目录：${value}`);
      }
    } else if (!stats.isFile() || stats.size === 0) {
      incompleteReasons.push(`${label}: ${kind}不存在、不是文件或为空：${value}`);
    }
  } catch {
    incompleteReasons.push(`${label}: ${kind}不可读取：${value}`);
  }
}

export function evaluateResults(data, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const checkEvidenceFiles = options.checkEvidenceFiles ?? true;
  const incompleteReasons = [];
  const failureReasons = [];
  const hostRows = [];
  const hardRuleHostIds = [];
  const boundaryReviewHostIds = [];
  const invalidHostIds = [];
  const botHostIds = [];
  const seenHostIds = new Set();

  if (!isRecord(data)) {
    return {
      verdict: "INCOMPLETE",
      incompleteReasons: ["结果文件根节点必须是 JSON object"],
      failureReasons: [],
      hostRows: [],
      sortedCounts: [],
      median: null,
      p90NearestRank: null,
      p90Linear: null,
      hardRuleHostIds: [],
      boundaryReviewHostIds: [],
      invalidHostIds: [],
      botHostIds: [],
      participantCoverage: "INCOMPLETE",
    };
  }

  if (data.schemaVersion !== 1) {
    incompleteReasons.push("schemaVersion 必须为 1");
  }

  const execution = isRecord(data.execution) ? data.execution : {};
  if (!isNonEmptyString(execution.date) || !/^\d{4}-\d{2}-\d{2}$/.test(execution.date)) {
    incompleteReasons.push("execution.date 必须是 YYYY-MM-DD 绝对日期");
  }
  if (!isNonEmptyString(execution.facilitator)) {
    incompleteReasons.push("缺少 execution.facilitator");
  }
  validateEvidenceFile({
    label: "execution",
    value: execution.evidenceDirectory,
    kind: "证据目录",
    incompleteReasons,
    cwd,
    checkEvidenceFiles,
  });

  const build = isRecord(data.build) ? data.build : {};
  if (!isNonEmptyString(build.sha)) incompleteReasons.push("缺少 build.sha");
  if (!isNonEmptyString(build.developmentVersion)) {
    incompleteReasons.push("缺少 build.developmentVersion");
  }
  if (!isNonEmptyString(build.deviceModel)) incompleteReasons.push("缺少 build.deviceModel");

  const hosts = Array.isArray(data.hosts) ? data.hosts : [];
  if (!Array.isArray(data.hosts)) {
    incompleteReasons.push("hosts 必须是数组");
  } else if (hosts.length !== 5) {
    incompleteReasons.push(`需要 5 名计入样本的 host，当前为 ${hosts.length} 名`);
  }

  hosts.forEach((host, index) => {
    const fallbackId = `host[${index}]`;
    if (!isRecord(host)) {
      incompleteReasons.push(`${fallbackId}: 必须是 object`);
      hostRows.push({ hostId: fallbackId, malformed: true });
      return;
    }

    const hostId = isNonEmptyString(host.hostId) ? host.hostId : fallbackId;
    if (!isNonEmptyString(host.hostId)) incompleteReasons.push(`${fallbackId}: 缺少 hostId`);
    if (seenHostIds.has(hostId)) incompleteReasons.push(`${hostId}: hostId 重复`);
    seenHostIds.add(hostId);

    const config = host.config;
    if (config !== "A" && config !== "B") {
      incompleteReasons.push(`${hostId}: config 必须为 A 或 B`);
    }
    if (config === "B") {
      botHostIds.push(hostId);
      incompleteReasons.push(
        `${hostId}: 配置 B 的 participant 新增输入 = 0 不构成证据，NOT COVERED，需配置 A 补证据`,
      );
    }

    const invalid = host.invalidReason !== null && host.invalidReason !== undefined;
    if (invalid) {
      invalidHostIds.push(hostId);
      if (isNonEmptyString(host.invalidReason)) {
        incompleteReasons.push(`${hostId}: INVALID（${host.invalidReason}），需补人`);
      } else {
        incompleteReasons.push(`${hostId}: invalidReason 必须为 null 或非空字符串`);
      }
    }

    let actionCount = null;
    if (isNonNegativeInteger(host.actionCount)) {
      actionCount = host.actionCount;
    } else {
      incompleteReasons.push(`${hostId}: actionCount 必须是非负整数`);
    }

    let longestStuckSeconds = null;
    if (isNonNegativeNumber(host.longestStuckSeconds)) {
      longestStuckSeconds = host.longestStuckSeconds;
      if (!invalid && longestStuckSeconds > 60) {
        hardRuleHostIds.push(hostId);
        failureReasons.push(
          `${hostId}: 硬规则 FAIL，无可见下一步卡死 ${longestStuckSeconds}s >60s`,
        );
      } else if (!invalid && longestStuckSeconds === 60) {
        boundaryReviewHostIds.push(hostId);
        incompleteReasons.push(
          `${hostId}: 最长无可见下一步恰好 60s；§4.5 的 ≥60 与 §6.5 的 >60 不一致，需 owner 裁定`,
        );
      }
    } else {
      incompleteReasons.push(`${hostId}: longestStuckSeconds 必须是非负数字`);
    }

    let firstUsableCardSeconds = null;
    if (isNonNegativeNumber(host.firstUsableCardSeconds)) {
      firstUsableCardSeconds = host.firstUsableCardSeconds;
    } else {
      incompleteReasons.push(`${hostId}: firstUsableCardSeconds 必须是非负数字`);
    }

    if (typeof host.completed !== "boolean") {
      incompleteReasons.push(`${hostId}: completed 必须为 boolean`);
    } else if (!host.completed && !invalid) {
      failureReasons.push(`${hostId}: 未自然完成到 recap，FAIL`);
    }

    if (host.resetChecklistComplete !== true) {
      incompleteReasons.push(`${hostId}: 重置清单未完成；该场必须 INVALID 并补人`);
    }

    if (typeof host.facilitatorIntervention !== "boolean") {
      incompleteReasons.push(`${hostId}: facilitatorIntervention 必须为 boolean`);
    } else if (host.facilitatorIntervention && !invalid) {
      failureReasons.push(`${hostId}: 存在 facilitator 干预，不满足无帮助完成`);
    }

    const session = isRecord(host.session) ? host.session : {};
    for (const key of ["poolId", "socialSessionId", "icebreakerSessionId"]) {
      if (!isNonEmptyString(session[key])) incompleteReasons.push(`${hostId}: 缺少 session.${key}`);
    }
    if (!isIsoDateTime(session.startedAt)) {
      incompleteReasons.push(`${hostId}: session.startedAt 必须是带时区的 ISO 日期时间`);
    }

    const flagPosture = isRecord(host.flagPosture) ? host.flagPosture : {};
    const flagSummary = {};
    for (const stage of ["before", "after"]) {
      const posture = isRecord(flagPosture[stage]) ? flagPosture[stage] : {};
      flagSummary[stage] = posture;
      for (const flagName of FLAG_NAMES) {
        if (posture[flagName] !== true) {
          const actual = posture[flagName] === false ? "OFF" : "缺失";
          incompleteReasons.push(
            `${hostId}: ${stage} ${flagName}=${actual}；要求 ON，OFF 场必须 INVALID 并补人`,
          );
        }
      }
      if (!isIsoDateTime(posture.checkedAt)) {
        incompleteReasons.push(`${hostId}: ${stage} flag checkedAt 必须是带时区的 ISO 日期时间`);
      }
    }

    const participantInput = isRecord(host.participantInput) ? host.participantInput : {};
    let newInputCount = null;
    if (config === "A") {
      if (isNonNegativeInteger(participantInput.newInputCount)) {
        newInputCount = participantInput.newInputCount;
        if (newInputCount !== 0 && !invalid) {
          failureReasons.push(`${hostId}: participant 新增输入 = ${newInputCount}，要求 0`);
        }
      } else {
        incompleteReasons.push(`${hostId}: 配置 A 缺少非负整数 participantInput.newInputCount`);
      }
    }
    if (typeof participantInput.privacyP0Observed !== "boolean") {
      incompleteReasons.push(`${hostId}: participantInput.privacyP0Observed 必须为 boolean`);
    } else if (participantInput.privacyP0Observed && !invalid) {
      failureReasons.push(`${hostId}: participant 端出现隐私/安全 P0，立即停止本门并升级`);
    }

    const evidence = isRecord(host.evidence) ? host.evidence : {};
    validateEvidenceFile({
      label: hostId,
      value: evidence.recording,
      kind: "录屏",
      incompleteReasons,
      cwd,
      checkEvidenceFiles,
    });
    validateEvidenceFile({
      label: hostId,
      value: evidence.observationSheet,
      kind: "观察表",
      incompleteReasons,
      cwd,
      checkEvidenceFiles,
    });

    if (!Array.isArray(host.confusionMoments)) {
      incompleteReasons.push(`${hostId}: confusionMoments 必须为数组；无困惑时为空数组`);
    } else {
      host.confusionMoments.forEach((moment, momentIndex) => {
        const label = `${hostId}.confusionMoments[${momentIndex}]`;
        if (!isRecord(moment)) {
          incompleteReasons.push(`${label}: 必须为 object`);
          return;
        }
        if (!isNonNegativeNumber(moment.minute)) {
          incompleteReasons.push(`${label}: minute 必须是相对 T0 的非负分钟数`);
        }
        if (!isNonEmptyString(moment.taxonomyId) || !/^F[1-9]\d*$/.test(moment.taxonomyId)) {
          incompleteReasons.push(`${label}: taxonomyId 必须为 F1–F9 或扩展的 F<n>`);
        }
        if (!isNonEmptyString(moment.note)) {
          incompleteReasons.push(`${label}: note 必须包含观察与录屏位置`);
        }
      });
    }

    hostRows.push({
      hostId,
      config,
      actionCount,
      longestStuckSeconds,
      firstUsableCardSeconds,
      completed: host.completed,
      invalidReason: invalid ? host.invalidReason : null,
      newInputCount,
      privacyP0Observed: participantInput.privacyP0Observed,
      flagSummary,
      confusionCount: Array.isArray(host.confusionMoments) ? host.confusionMoments.length : null,
      malformed: false,
    });
  });

  const sortedCounts = hostRows
    .filter((row) => !row.malformed && row.invalidReason === null && row.actionCount !== null)
    .map((row) => row.actionCount)
    .sort((a, b) => a - b);

  let median = null;
  let p90NearestRank = null;
  let p90Linear = null;
  if (sortedCounts.length === 5) {
    median = sortedCounts[2];
    p90NearestRank = sortedCounts[Math.ceil(0.9 * sortedCounts.length) - 1];
    const zeroBasedRank = (sortedCounts.length - 1) * 0.9;
    const lowerIndex = Math.floor(zeroBasedRank);
    const upperIndex = Math.ceil(zeroBasedRank);
    const fraction = zeroBasedRank - lowerIndex;
    p90Linear = sortedCounts[lowerIndex] + fraction * (sortedCounts[upperIndex] - sortedCounts[lowerIndex]);

    if (median > 3) failureReasons.push(`中位动作数 ${median} >3，FAIL`);
    if (p90NearestRank > 4) {
      failureReasons.push(`P90 nearest-rank 动作数 ${p90NearestRank} >4，FAIL`);
    }
  }

  let participantCoverage = "INCOMPLETE";
  if (botHostIds.length > 0) {
    participantCoverage = "NOT_COVERED";
  } else if (
    hosts.length === 5 &&
    invalidHostIds.length === 0 &&
    hostRows.length === 5 &&
    hostRows.every((row) => row.config === "A" && row.newInputCount !== null)
  ) {
    participantCoverage = hostRows.every((row) => row.newInputCount === 0) ? "PASS" : "FAIL";
  }

  let verdict = "PASS";
  if (failureReasons.length > 0) {
    verdict = "FAIL";
  } else if (
    incompleteReasons.length > 0 ||
    hosts.length !== 5 ||
    sortedCounts.length !== 5 ||
    participantCoverage !== "PASS"
  ) {
    verdict = "INCOMPLETE";
  }

  return {
    verdict,
    incompleteReasons,
    failureReasons,
    hostRows,
    sortedCounts,
    median,
    p90NearestRank,
    p90Linear,
    hardRuleHostIds,
    boundaryReviewHostIds,
    invalidHostIds,
    botHostIds,
    participantCoverage,
  };
}

function formatFlagSummary(flagSummary) {
  if (!isRecord(flagSummary)) return "缺失";
  const formatStage = (stage) => {
    const posture = flagSummary[stage];
    if (!isRecord(posture)) return "缺失";
    return FLAG_NAMES.map((name) => (posture[name] === true ? "ON" : posture[name] === false ? "OFF" : "缺失")).join("/");
  };
  return `${formatStage("before")} → ${formatStage("after")}`;
}

export function formatReport(result, sourceLabel = "") {
  const lines = [];
  lines.push("破冰主持零培训 15 分钟 Smoke 计分");
  if (sourceLabel) lines.push(`结果文件：${sourceLabel}`);
  lines.push("");
  lines.push("每场记录（flag 顺序：copilot / matchingAware，before → after）：");

  for (const row of result.hostRows) {
    if (row.malformed) {
      lines.push(`- ${row.hostId}: 记录格式错误`);
      continue;
    }
    const participant = row.config === "B"
      ? "NOT COVERED"
      : row.newInputCount === null || row.newInputCount === undefined
        ? "缺失"
        : String(row.newInputCount);
    const completed = row.completed === true ? "Y" : row.completed === false ? "N" : "缺失";
    const invalid = row.invalidReason === null ? "无" : String(row.invalidReason);
    lines.push(
      `- ${row.hostId} | 配置 ${row.config ?? "缺失"} | 动作 ${displayNumber(row.actionCount)} | ` +
        `最长无可见下一步 ${displayNumber(row.longestStuckSeconds)}s | ` +
        `首张可用卡 ${displayNumber(row.firstUsableCardSeconds)}s | 完成 ${completed} | ` +
        `participant 新增输入 ${participant} | 困惑 ${displayNumber(row.confusionCount)} 条 | ` +
        `flag ${formatFlagSummary(row.flagSummary)} | INVALID ${invalid}`,
    );
  }

  lines.push("");
  lines.push(`动作数升序：${result.sortedCounts.length > 0 ? result.sortedCounts.join(", ") : "—"}`);
  lines.push(`中位 = ${displayNumber(result.median)}（阈值 ≤3；需要 5 个有效动作数）`);
  lines.push(`P90 nearest-rank = ${displayNumber(result.p90NearestRank)}（阈值 ≤4）`);
  lines.push(`P90 线性插值 = ${displayNumber(result.p90Linear)}（仅记录，不参与判定）`);
  lines.push(`硬规则：${result.hardRuleHostIds.length > 0
    ? `FAIL（${result.hardRuleHostIds.join(", ")} 卡死 >60s 且无可见下一步）`
    : "未触发 >60s 自动 FAIL"}`);
  if (result.boundaryReviewHostIds.length > 0) {
    lines.push(`60s 边界复核：${result.boundaryReviewHostIds.join(", ")}；不得自动 PASS`);
  }

  const participantLabel = {
    PASS: "PASS（5/5 配置 A，新增输入均为 0）",
    FAIL: "FAIL（至少一场新增输入不为 0）",
    NOT_COVERED: "NOT COVERED（配置 B 不构成证据，不能关闭该判据）",
    INCOMPLETE: "INCOMPLETE（缺少配置 A 的完整覆盖）",
  }[result.participantCoverage];
  lines.push(`participant 新增输入 = 0：${participantLabel}`);
  lines.push(P90_CAVEAT);

  if (result.failureReasons.length > 0) {
    lines.push("");
    lines.push("未达标项：");
    for (const reason of result.failureReasons) lines.push(`- ${reason}`);
  }
  if (result.incompleteReasons.length > 0) {
    lines.push("");
    lines.push("证据 / 样本完整性缺口：");
    for (const reason of result.incompleteReasons) lines.push(`- ${reason}`);
  }

  lines.push("");
  lines.push(`VERDICT: ${result.verdict}`);
  if (result.verdict === "PASS") {
    lines.push("本 PASS 只覆盖这 5 名首次 host 的无培训完成，不证明统计显著、内容质量、留存或商业效果。");
  } else if (result.verdict === "INCOMPLETE") {
    lines.push("门保持 OPEN；补齐五名有效 host、配置 A participant 证据和全部录屏 / 观察表后再评分。");
  } else {
    lines.push("门保持 OPEN；按 F1–F9 归因回派，不得调阈值或删除失败记录。");
  }
  return lines.join("\n");
}

function makeFixture(counts) {
  return {
    schemaVersion: 1,
    execution: {
      date: "2026-10-30",
      facilitator: "fixture",
      evidenceDirectory: "fixture/evidence",
    },
    build: {
      sha: "a".repeat(40),
      developmentVersion: "fixture-1.0.0",
      deviceModel: "fixture-device",
    },
    hosts: counts.map((count, index) => ({
      hostId: `H${index + 1}`,
      config: "A",
      actionCount: count,
      longestStuckSeconds: 0,
      firstUsableCardSeconds: 4,
      completed: true,
      invalidReason: null,
      confusionMoments: [],
      flagPosture: {
        before: {
          icebreakerAgentCopilotEnabled: true,
          icebreakerMatchingAwareEnabled: true,
          checkedAt: "2026-10-30T09:00:00+08:00",
        },
        after: {
          icebreakerAgentCopilotEnabled: true,
          icebreakerMatchingAwareEnabled: true,
          checkedAt: "2026-10-30T09:30:00+08:00",
        },
      },
      session: {
        poolId: `pool-${index + 1}`,
        socialSessionId: `social-${index + 1}`,
        icebreakerSessionId: `icebreaker-${index + 1}`,
        startedAt: "2026-10-30T09:01:00+08:00",
      },
      resetChecklistComplete: true,
      facilitatorIntervention: false,
      participantInput: {
        newInputCount: 0,
        privacyP0Observed: false,
      },
      evidence: {
        recording: `fixture/H${index + 1}.mov`,
        observationSheet: `fixture/H${index + 1}-observation.md`,
      },
    })),
    verdict: {},
  };
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(message);
}

function numbersEqual(actual, expected) {
  if (expected === null) return actual === null;
  return typeof actual === "number" && Math.abs(actual - expected) < 1e-9;
}

export function runSelfTest() {
  const cases = [];
  const add = (name, data, expected) => cases.push({ name, data, expected });

  add("worked-example-1-pass", makeFixture([2, 3, 3, 4, 4]), {
    verdict: "PASS", median: 3, p90: 4, linear: 4,
  });
  add("worked-example-2-p90-fail", makeFixture([2, 3, 3, 4, 6]), {
    verdict: "FAIL", median: 3, p90: 6, linear: 5.2,
  });
  add("worked-example-3-median-fail", makeFixture([3, 3, 4, 4, 4]), {
    verdict: "FAIL", median: 4, p90: 4, linear: 4,
  });
  const workedHardRule = makeFixture([2, 2, 3, 3, 3]);
  workedHardRule.hosts[3].longestStuckSeconds = 72;
  add("worked-example-4-hard-rule", workedHardRule, {
    verdict: "FAIL", median: 3, p90: 3, linear: 3, hardRuleHosts: ["H4"],
  });

  const incompleteEvidence = makeFixture([2, 3, 3, 4, 4]);
  incompleteEvidence.hosts[2].evidence.recording = null;
  add("incomplete-evidence", incompleteEvidence, { verdict: "INCOMPLETE" });

  const hardRuleOverride = makeFixture([2, 3, 3, 4, 4]);
  hardRuleOverride.hosts[1].longestStuckSeconds = 61;
  add("hard-rule-overrides-passing-counts", hardRuleOverride, {
    verdict: "FAIL", median: 3, p90: 4, linear: 4, hardRuleHosts: ["H2"],
  });

  const invalidHost = makeFixture([2, 3, 3, 4, 4]);
  invalidHost.hosts[0].invalidReason = "ENV_FAULT";
  add("invalid-host-cannot-pass", invalidHost, { verdict: "INCOMPLETE" });

  const bots = makeFixture([2, 3, 3, 4, 4]);
  bots.hosts.forEach((host) => {
    host.config = "B";
    host.participantInput.newInputCount = 0;
  });
  add("config-b-cannot-cover-participant-input", bots, {
    verdict: "INCOMPLETE", participantCoverage: "NOT_COVERED",
  });

  const exactSixty = makeFixture([2, 3, 3, 4, 4]);
  exactSixty.hosts[0].longestStuckSeconds = 60;
  add("exact-sixty-requires-owner-review", exactSixty, { verdict: "INCOMPLETE" });

  const participantInput = makeFixture([2, 3, 3, 4, 4]);
  participantInput.hosts[0].participantInput.newInputCount = 1;
  add("participant-input-must-be-zero", participantInput, {
    verdict: "FAIL", participantCoverage: "FAIL",
  });

  let passed = 0;
  for (const testCase of cases) {
    try {
      const result = evaluateResults(testCase.data, { checkEvidenceFiles: false });
      const expected = testCase.expected;
      assertSelfTest(result.verdict === expected.verdict, `verdict expected ${expected.verdict}, got ${result.verdict}`);
      if ("median" in expected) {
        assertSelfTest(numbersEqual(result.median, expected.median), `median expected ${expected.median}, got ${result.median}`);
      }
      if ("p90" in expected) {
        assertSelfTest(
          numbersEqual(result.p90NearestRank, expected.p90),
          `P90 expected ${expected.p90}, got ${result.p90NearestRank}`,
        );
      }
      if ("linear" in expected) {
        assertSelfTest(
          numbersEqual(result.p90Linear, expected.linear),
          `linear P90 expected ${expected.linear}, got ${result.p90Linear}`,
        );
      }
      if (expected.hardRuleHosts) {
        assertSelfTest(
          JSON.stringify(result.hardRuleHostIds) === JSON.stringify(expected.hardRuleHosts),
          `hard-rule hosts expected ${expected.hardRuleHosts}, got ${result.hardRuleHostIds}`,
        );
      }
      if (expected.participantCoverage) {
        assertSelfTest(
          result.participantCoverage === expected.participantCoverage,
          `participant coverage expected ${expected.participantCoverage}, got ${result.participantCoverage}`,
        );
      }
      passed += 1;
      console.log(`ok ${passed} - ${testCase.name}: ${result.verdict}`);
    } catch (error) {
      console.error(`not ok - ${testCase.name}: ${error.message}`);
      console.error(formatReport(evaluateResults(testCase.data, { checkEvidenceFiles: false }), testCase.name));
      console.log(`SELF-TEST: ${passed}/${cases.length} PASS`);
      return false;
    }
  }
  console.log(`SELF-TEST: ${passed}/${cases.length} PASS`);
  return passed === cases.length;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--self-test") {
    process.exitCode = runSelfTest() ? 0 : 1;
    return;
  }
  if (args.length !== 1 || args[0].startsWith("--")) {
    console.error("用法：node scripts/testing/score-host-smoke.mjs <results.json>");
    console.error("自检：node scripts/testing/score-host-smoke.mjs --self-test");
    process.exitCode = 1;
    return;
  }

  const resultsPath = resolve(process.cwd(), args[0]);
  if (!existsSync(resultsPath)) {
    console.error(`结果文件不存在：${args[0]}`);
    process.exitCode = 1;
    return;
  }

  try {
    const data = JSON.parse(readFileSync(resultsPath, "utf8"));
    const result = evaluateResults(data, { cwd: process.cwd(), checkEvidenceFiles: true });
    console.log(formatReport(result, args[0]));
    process.exitCode = result.verdict === "PASS" ? 0 : 1;
  } catch (error) {
    console.error(`无法读取或解析结果文件：${error.message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) main();
