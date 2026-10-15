/**
 * profileTaglineService v2 test suite — sprint entry-card-insight-v2.
 *
 * Coverage map:
 *  - AC-01  response contract {lines, evidence, meta} + insightLine preserved
 *  - AC-02  prompt payload (archetype/secondary+blend/traits/Q&A/priorities/
 *           selections) + deterministic Q&A selection rule
 *  - AC-03  observation + evidence are deterministic (aigc=false, LLM-free)
 *  - AC-04  single LLM call, strict JSON + safeParse, per-line aigc, prompt
 *           chain markers, enforceReviewVocab moderation
 *  - AC-05  timeout / provider error / low quality / slot-missing → rule
 *           fallback; total failure → v1 GENERIC retreat (lines=[])
 *  - AC-06  cache key digests all citable signals; hit → no LLM call
 *  - AC-07  promptVersion='profile-tagline-v2' + AITrace metadata
 *  - AC-13  data-availability matrix (zero answers / zero interests / null
 *           topPriorities / unknown questionIds)
 *  - REL-01 five fault injections with per-line degradation
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { callSocialAIMock, logAITraceMock, fakeQuestionBank } = vi.hoisted(() => {
  const makeQuestion = (
    id: string,
    level: 1 | 2 | 3,
    discriminationIndex: number | undefined,
    options: Array<[string, string]>,
  ) => ({
    id,
    level,
    category: 'test',
    scenarioText: '',
    questionText: `题目${id}`,
    primaryTraits: [],
    discriminationIndex,
    options: options.map(([value, text]) => ({ value, text, traitScores: {} })),
  });

  const bank: Record<string, ReturnType<typeof makeQuestion>> = {
    Q_A1: makeQuestion('Q_A1', 1, 0.8, [['A', '独自待一会儿回血'], ['B', '约朋友出来聊']]),
    Q_A2: makeQuestion('Q_A2', 1, 0.6, [['A', '一级乙选项甲'], ['B', '一级乙选项乙']]),
    Q_B1: makeQuestion('Q_B1', 2, 0.7, [['A', '先观察再加入'], ['B', '直接加入']]),
    Q_B2: makeQuestion('Q_B2', 2, 0.7, [['A', '二级乙选项甲'], ['B', '二级乙选项乙']]),
    Q_B3: makeQuestion('Q_B3', 2, undefined, [['A', '二级丙选项甲'], ['B', '二级丙选项乙']]),
    Q_C1: makeQuestion('Q_C1', 3, 0.5, [['A', '三级甲选项甲'], ['B', '三级甲选项乙']]),
    Q_C2: makeQuestion('Q_C2', 3, 0.9, [['A', '我更相信直觉和感受'], ['B', '我更相信事实和逻辑']]),
  };

  return {
    callSocialAIMock: vi.fn(),
    logAITraceMock: vi.fn(),
    fakeQuestionBank: bank,
  };
});

vi.mock('../ai/socialModelRouter', () => ({
  callSocialAI: callSocialAIMock,
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: logAITraceMock,
}));

vi.mock('@shared/personality/questionsV4', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/personality/questionsV4')>();
  return {
    ...actual,
    getQuestionById: (id: string) => fakeQuestionBank[id],
  };
});

import {
  generateProfileTagline,
  selectQaPairs,
  buildTaglinePrompt,
  __resetProfileTaglineCacheForTests,
  type ProfileTaglineInput,
} from '../profileTaglineService';
import { GENERIC_PROFILE_TAGLINE_FALLBACK } from '@shared/ai/onboarding';

const GOOD_LLM_JSON = JSON.stringify({
  inference: '聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里',
  reveal: '你看似随性，其实每次落座前都在悄悄找同频的人',
});

function mockLLMSuccess(content: string = GOOD_LLM_JSON) {
  callSocialAIMock.mockResolvedValue({
    content,
    provider: 'deepseek',
    model: 'deepseek-flash',
    latencyMs: 120,
    fallbackUsed: false,
  });
}

const baseAnswers = [
  { questionId: 'Q_C2', questionLevel: 3, selectedOption: 'A', answeredAt: '2026-10-01T10:00:00Z' },
  { questionId: 'Q_B1', questionLevel: 2, selectedOption: 'A', answeredAt: '2026-10-01T09:00:00Z' },
  { questionId: 'Q_A1', questionLevel: 1, selectedOption: 'B', answeredAt: '2026-10-01T08:00:00Z' },
];

const baseInput: ProfileTaglineInput = {
  archetype: 'fox',
  secondaryArchetype: 'owl',
  isBlend: true,
  traitScores: { A: 72, C: 45, E: 60, O: 88, X: 66, P: 70 },
  rawAnswers: baseAnswers,
  selections: [
    { topicId: 't_frisbee', label: '飞盘', heat: 86 },
    { topicId: 't_talkshow', label: '脱口秀', heat: 72 },
    { topicId: 't_citywalk', label: '城市漫步', heat: 65 },
  ],
  topPriorities: [{ topicId: 't_frisbee', label: '飞盘', heat: 86 }],
};

describe('profileTaglineService v2', () => {
  beforeEach(() => {
    callSocialAIMock.mockReset();
    logAITraceMock.mockReset();
    __resetProfileTaglineCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── AC-01 / AC-04 / AC-07: live happy path ────────────────────────────────

  it('AC-01/AC-04: returns structured lines + evidence with per-line aigc, insightLine = inference text', async () => {
    mockLLMSuccess();

    const result = await generateProfileTagline(baseInput);

    expect(callSocialAIMock).toHaveBeenCalledTimes(1); // single LLM call
    expect(result.insightLine).toBe('聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里');
    expect(result.lines.map((l) => l.role)).toEqual(['observation', 'inference', 'reveal']);
    const observation = result.lines[0];
    expect(observation.aigc).toBe(false); // deterministic line never marked
    expect(observation.text).toContain('飞盘');
    const inference = result.lines[1];
    expect(inference.aigc).toBe(true);
    expect(inference.text).toBe(result.insightLine);
    const reveal = result.lines[2];
    expect(reveal.aigc).toBe(true);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence[0]).toMatchObject({ text: '飞盘', sourceRef: 'priority:t_frisbee' });
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.fromCache).toBe(false);
    expect(result.meta.promptVersion).toBe('profile-tagline-v2'); // AC-07
    expect(result.meta.aigc).toEqual({ aiGenerated: true, labelType: 'ai-generated' });
  });

  it('AC-02: prompt carries archetype, secondary/blend, trait vector, Q&A pairs, priorities, selections', async () => {
    mockLLMSuccess();

    await generateProfileTagline(baseInput);

    const prompt = callSocialAIMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain('寻宝狐'); // archetype nameCn
    expect(prompt).toContain('次高原型：好奇猫头鹰');
    expect(prompt).toContain('边界混合：是');
    expect(prompt).toContain('开放 88'); // normalized trait vector
    expect(prompt).toContain('外向 66');
    expect(prompt).toContain('【真实问答】');
    expect(prompt).toContain('题目Q_C2');
    expect(prompt).toContain('我更相信直觉和感受'); // recovered option text
    expect(prompt).toContain('飞盘（热度86）');
    expect(prompt).toContain('脱口秀（热度72）');
    expect(prompt).toContain('【最在意】飞盘');
    // AC-04: observe→infer→verify→phrase chain + anti-Barnum + strict JSON
    expect(prompt).toContain('observe');
    expect(prompt).toContain('infer');
    expect(prompt).toContain('verify');
    expect(prompt).toContain('phrase');
    expect(prompt).toContain('巴纳姆');
    expect(prompt).toContain('"inference"');
  });

  it('AC-02: Q&A selection rule = level desc → discriminationIndex desc (undefined=0) → recency desc, top 5', () => {
    const answers = [
      { questionId: 'Q_C1', questionLevel: 3, selectedOption: 'A', answeredAt: '2026-10-01T10:00:00Z' },
      { questionId: 'Q_C2', questionLevel: 3, selectedOption: 'B', answeredAt: '2026-10-01T09:00:00Z' },
      { questionId: 'Q_B1', questionLevel: 2, selectedOption: 'A', answeredAt: '2026-10-01T11:00:00Z' },
      { questionId: 'Q_B2', questionLevel: 2, selectedOption: 'B', answeredAt: '2026-10-01T08:00:00Z' },
      { questionId: 'Q_B3', questionLevel: 2, selectedOption: 'A', answeredAt: '2026-10-01T07:00:00Z' },
      // Level-1 answers have higher recency but must rank below L2/L3.
      { questionId: 'Q_A1', questionLevel: 1, selectedOption: 'A', answeredAt: '2026-10-02T00:00:00Z' },
      { questionId: 'Q_A2', questionLevel: 1, selectedOption: 'B', answeredAt: '2026-10-01T12:00:00Z' },
    ];

    const pairs = selectQaPairs(answers);

    expect(pairs.map((p) => p.questionId)).toEqual(['Q_C2', 'Q_C1', 'Q_B1', 'Q_B2', 'Q_B3']);
    // Option-text recovery mirrors assessmentV4.ts:366 find-by-value pattern.
    expect(pairs[0]).toMatchObject({ questionText: '题目Q_C2', answerText: '我更相信事实和逻辑' });
  });

  // ── AC-03: observation + evidence never depend on the LLM ────────────────

  it('AC-03: observation + evidence are identical whether LLM succeeds or fails', async () => {
    mockLLMSuccess();
    const live = await generateProfileTagline(baseInput);

    __resetProfileTaglineCacheForTests();
    callSocialAIMock.mockRejectedValue(new Error('provider down'));
    const degraded = await generateProfileTagline(baseInput);

    const liveObservation = live.lines.find((l) => l.role === 'observation');
    const degradedObservation = degraded.lines.find((l) => l.role === 'observation');
    expect(liveObservation).toEqual(degradedObservation);
    expect(liveObservation!.aigc).toBe(false);
    expect(live.evidence).toEqual(degraded.evidence);
  });

  // ── AC-04 / REL-01: per-line degradation ──────────────────────────────────

  it('REL-01: malformed single line drops only that line; template substitutes inference', async () => {
    mockLLMSuccess(
      JSON.stringify({
        inference: '太短', // < 12 chars → dropped
        reveal: '你看似随性，其实每次落座前都在悄悄找同频的人',
      }),
    );

    const result = await generateProfileTagline(baseInput);

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    const roles = result.lines.map((l) => l.role);
    expect(roles).toEqual(['observation', 'inference', 'reveal']);
    const inference = result.lines[1];
    expect(inference.aigc).toBe(false); // template substitute
    expect(inference.text).toContain('飞盘'); // slotted template filled
    const reveal = result.lines[2];
    expect(reveal.aigc).toBe(true); // LLM reveal survives
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('line_dropped');
    // insightLine must be the (template) inference text — old clients unaffected.
    expect(result.insightLine).toBe(inference.text);
    // AIGC meta is fail-closed: insightLine is NOT AI-generated here.
    expect(result.meta.aigc).toEqual({ aiGenerated: false });
  });

  it('REL-01/SEC-02: review-blocked vocab in one line drops only that line', async () => {
    mockLLMSuccess(
      JSON.stringify({
        inference: '你很会匹配别人的节奏和气氛，让每次聊天都变顺畅', // contains 匹配 → blocked
        reveal: '你看似随性，其实每次落座前都在悄悄找同频的人',
      }),
    );

    const result = await generateProfileTagline(baseInput);

    const inference = result.lines.find((l) => l.role === 'inference')!;
    expect(inference.aigc).toBe(false);
    expect(inference.text).not.toContain('匹配');
    const reveal = result.lines.find((l) => l.role === 'reveal')!;
    expect(reveal.aigc).toBe(true);
  });

  it('AC-04: reveal omitted by the LLM is respected — no template substitute', async () => {
    mockLLMSuccess(JSON.stringify({ inference: '聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里' }));

    const result = await generateProfileTagline(baseInput);

    expect(result.lines.map((l) => l.role)).toEqual(['observation', 'inference']);
    expect(result.meta.fallbackUsed).toBe(false);
  });

  // ── AC-05 / REL-01: five fault injections ─────────────────────────────────

  it('AC-05: LLM timeout → rule fallback, meta.evaluatorRejectionReason=timeout', async () => {
    vi.stubEnv('PROFILE_TAGLINE_TIMEOUT_MS', '60');
    callSocialAIMock.mockReturnValue(new Promise(() => {})); // never resolves

    const result = await generateProfileTagline(baseInput);

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('timeout');
    expect(result.lines.length).toBeGreaterThanOrEqual(2); // observation + template inference
    expect(result.insightLine).not.toBe(GENERIC_PROFILE_TAGLINE_FALLBACK);
    const trace = logAITraceMock.mock.calls.find((c) => c[0].errorCode === 'timeout');
    expect(trace).toBeDefined();
  });

  it('AC-05/REL-01: provider error → rule fallback with reason provider_error', async () => {
    callSocialAIMock.mockRejectedValue(new Error('provider down'));

    const result = await generateProfileTagline(baseInput);

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('provider_error');
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.lines.every((l) => l.aigc === false)).toBe(true);
  });

  it('AC-05/REL-01: empty content → rule fallback with reason empty_content', async () => {
    mockLLMSuccess('   ');

    const result = await generateProfileTagline(baseInput);

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('empty_content');
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
  });

  it('AC-05/REL-01: unparseable JSON → rule fallback with reason parse_error', async () => {
    mockLLMSuccess('这不是 JSON，只是一段话');

    const result = await generateProfileTagline(baseInput);

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('parse_error');
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
  });

  it('AC-05/REL-01: schema mismatch → rule fallback with reason schema_invalid', async () => {
    mockLLMSuccess(JSON.stringify({ wrong: 'shape' }));

    const result = await generateProfileTagline(baseInput);

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('schema_invalid');
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
  });

  it('AC-05: slot-missing (no interests, no answers) → slot-free template still guarantees ≥2 lines', async () => {
    callSocialAIMock.mockRejectedValue(new Error('provider down'));

    const result = await generateProfileTagline({
      archetype: 'koala',
      traitScores: { A: 80 },
    });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    expect(result.lines[0].role).toBe('observation'); // archetype-level line
    expect(result.lines[1].role).toBe('inference'); // slot-free template
    expect(result.evidence).toEqual([]); // zero interests → empty evidence
  });

  it('AC-05: total fallback failure → v1 GENERIC retreat (lines=[])', async () => {
    callSocialAIMock.mockRejectedValue(new Error('provider down'));

    const result = await generateProfileTagline({
      // No archetype → no templates; interests/answers absent → nothing citable.
      traitScores: { A: 80 },
    });

    expect(result.insightLine).toBe(GENERIC_PROFILE_TAGLINE_FALLBACK);
    expect(result.lines).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.aigc).toEqual({ aiGenerated: false });
  });

  it('AC-13: zero signals at all → no LLM call, GENERIC retreat (no_context)', async () => {
    const result = await generateProfileTagline();

    expect(callSocialAIMock).not.toHaveBeenCalled();
    expect(result.insightLine).toBe(GENERIC_PROFILE_TAGLINE_FALLBACK);
    expect(result.lines).toEqual([]);
    expect(result.meta.evaluatorRejectionReason).toBe('no_context');
    expect(result.meta.promptVersion).toBe('profile-tagline-v2');
  });

  // ── AC-06 / SCA-02: cache ─────────────────────────────────────────────────

  it('AC-06/SCA-02: same profile twice → single LLM call; second served from cache', async () => {
    mockLLMSuccess();

    const first = await generateProfileTagline(baseInput);
    const second = await generateProfileTagline(baseInput);

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(first.meta.fromCache).toBe(false);
    expect(second.meta.fromCache).toBe(true);
    expect(second.insightLine).toBe(first.insightLine);
    expect(second.lines).toEqual(first.lines);
    const cacheTrace = logAITraceMock.mock.calls.find((c) => c[0].fromCache === true);
    expect(cacheTrace).toBeDefined();
    expect(cacheTrace![0].promptVersion).toBe('profile-tagline-v2');
  });

  it('AC-06: concurrent identical calls share one in-flight LLM generation', async () => {
    mockLLMSuccess();

    const [a, b] = await Promise.all([
      generateProfileTagline(baseInput),
      generateProfileTagline(baseInput),
    ]);

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    expect(a.insightLine).toBe(b.insightLine);
  });

  it('AC-06: differing citable signals (questionIds) produce different cache keys — no cross-user leakage', async () => {
    mockLLMSuccess();

    await generateProfileTagline(baseInput);
    await generateProfileTagline({
      ...baseInput,
      rawAnswers: [
        { questionId: 'Q_A2', questionLevel: 1, selectedOption: 'A', answeredAt: '2026-10-01T08:00:00Z' },
      ],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(2);
  });

  it('AC-06: differing interest topicIds produce different cache keys', async () => {
    mockLLMSuccess();

    await generateProfileTagline(baseInput);
    await generateProfileTagline({
      ...baseInput,
      selections: [{ topicId: 't_boardgame', label: '飞盘', heat: 86 }],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(2);
  });

  it('AC-06: same questionIds but different selectedOption → different cache keys (answer-text leak guard)', async () => {
    mockLLMSuccess();

    const [first] = baseAnswers;
    await generateProfileTagline(baseInput);
    await generateProfileTagline({
      ...baseInput,
      rawAnswers: [
        { ...first, selectedOption: 'B_DIFFERENT' },
        ...baseAnswers.slice(1),
      ],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(2);
  });

  // ── AC-07 / OBS-01: trace metadata ────────────────────────────────────────

  it('AC-07/OBS-01: AITrace carries promptVersion, fallbackUsed, fromCache on the live path', async () => {
    mockLLMSuccess();

    await generateProfileTagline(baseInput);

    const trace = logAITraceMock.mock.calls.find((c) => c[0].feature === 'generateProfileTagline');
    expect(trace).toBeDefined();
    expect(trace![0]).toMatchObject({
      domain: 'onboarding',
      promptVersion: 'profile-tagline-v2',
      fallbackUsed: false,
      fromCache: false,
      success: true,
    });
    expect(typeof trace![0].latencyMs).toBe('number');
  });

  // ── AC-13: data-availability matrix ───────────────────────────────────────

  it('AC-13: zero answers → prompt omits the Q&A section, LLM still uses traits + interests', async () => {
    mockLLMSuccess();

    const result = await generateProfileTagline({
      archetype: 'fox',
      traitScores: { O: 88, X: 66 },
      selections: [{ topicId: 't_frisbee', label: '飞盘', heat: 86 }],
      topPriorities: [],
      rawAnswers: [],
    });

    expect(callSocialAIMock).toHaveBeenCalledTimes(1);
    const prompt = callSocialAIMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).not.toContain('【真实问答】');
    expect(prompt).toContain('六维特质');
    expect(prompt).toContain('飞盘');
    expect(result.lines.map((l) => l.role)).toEqual(['observation', 'inference', 'reveal']);
  });

  it('AC-13: zero interest selections → observation degrades to archetype-level line, evidence empty', async () => {
    mockLLMSuccess();

    const result = await generateProfileTagline({
      archetype: 'owl',
      traitScores: { O: 90 },
      rawAnswers: baseAnswers,
      selections: [],
      topPriorities: null,
    });

    const observation = result.lines.find((l) => l.role === 'observation')!;
    expect(observation.text).toContain('悦仔对你的第一印象');
    expect(observation.aigc).toBe(false);
    expect(result.evidence).toEqual([]);
  });

  it('AC-13: null/empty topPriorities → evidence pills come from selections only', async () => {
    mockLLMSuccess();

    const result = await generateProfileTagline({
      ...baseInput,
      topPriorities: null,
    });

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.evidence.every((e) => e.sourceRef.startsWith('interest:'))).toBe(true);
    expect(result.evidence.map((e) => e.text)).toContain('飞盘');
  });

  it('AC-13: questionIds no longer in the bank are skipped silently', async () => {
    mockLLMSuccess();

    const result = await generateProfileTagline({
      ...baseInput,
      rawAnswers: [
        { questionId: 'Q_REMOVED', questionLevel: 3, selectedOption: 'A', answeredAt: '2026-10-01T10:00:00Z' },
        { questionId: 'Q_C2', questionLevel: 3, selectedOption: 'A', answeredAt: '2026-10-01T09:00:00Z' },
      ],
    });

    expect(result.lines.length).toBeGreaterThanOrEqual(2);
    const prompt = callSocialAIMock.mock.calls[0][0].messages[0].content as string;
    expect(prompt).not.toContain('Q_REMOVED');
    expect(prompt).toContain('题目Q_C2');
    // selectQaPairs itself must not throw and must exclude the stale id.
    const pairs = selectQaPairs([
      { questionId: 'Q_REMOVED', questionLevel: 3, selectedOption: 'A' },
      { questionId: 'Q_C2', questionLevel: 3, selectedOption: 'A' },
    ]);
    expect(pairs.map((p) => p.questionId)).toEqual(['Q_C2']);
  });

  it('AC-13: prompt omits archetype section entirely when archetype is unknown', () => {
    const prompt = buildTaglinePrompt({
      qaPairs: [],
      topSelections: [{ topicId: 't_frisbee', label: '飞盘', heat: 86 }],
      priorities: [],
    });

    expect(prompt).not.toContain('原型：');
    expect(prompt).toContain('【兴趣方向】');
    expect(prompt).not.toContain('【真实问答】');
    expect(prompt).not.toContain('【最在意】');
  });

  // ── AC-20③: single-signal cohort convergence (archetype-only → no reveal) ──

  it('AC-20③: LLM path drops the reveal line when evidence and Q&A are both empty', async () => {
    mockLLMSuccess(); // returns BOTH inference and reveal

    const result = await generateProfileTagline({
      archetype: 'owl',
      traitScores: { O: 90, C: 80 },
      // no selections, no topPriorities, no rawAnswers → single-signal cohort
    });

    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.lines.map((l) => l.role)).toEqual(['observation', 'inference']);
    expect(result.lines.some((l) => l.role === 'reveal')).toBe(false);
    // insightLine is still the live LLM inference text.
    expect(result.insightLine).toBe('聊到飞盘时你话会明显变多，还会顺手把新人拉进圈子里');
    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.meta.aigc).toEqual({ aiGenerated: true, labelType: 'ai-generated' });
  });

  it('AC-20③: rule-fallback path also caps the cohort at ≤2 lines (no fabricated reveal)', async () => {
    callSocialAIMock.mockRejectedValue(new Error('provider down'));

    const result = await generateProfileTagline({
      archetype: 'owl',
      traitScores: { O: 90 },
    });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.lines.length).toBeLessThanOrEqual(2);
    expect(result.lines.some((l) => l.role === 'reveal')).toBe(false);
  });

  it('AC-20③: cohort rule does NOT fire when evidence exists (reveal kept)', async () => {
    mockLLMSuccess();

    const result = await generateProfileTagline({
      archetype: 'owl',
      traitScores: { O: 90 },
      selections: [{ topicId: 't_bookstore', label: '独立书店', heat: 77 }],
      // qaPairs empty — but evidence.length === 1, so this is NOT the cohort
    });

    expect(result.lines.map((l) => l.role)).toEqual(['observation', 'inference', 'reveal']);
    expect(result.lines.find((l) => l.role === 'reveal')?.aigc).toBe(true);
  });
});
