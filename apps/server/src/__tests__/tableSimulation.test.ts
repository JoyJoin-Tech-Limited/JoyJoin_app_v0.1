import { describe, expect, it, vi } from 'vitest';
import {
  buildSeatPersonas,
  describeSeatForPrompt,
  SEAT_PERSONA_FORBIDDEN_FIELDS,
} from '../lib/tableSimulation/personas';
import {
  detectAwkwardness,
  mergeJudgeFlags,
} from '../lib/tableSimulation/heuristics';
import {
  assertTableSimulationAllowed,
  buildSeatMessages,
  parseJudgeReply,
  parseSeatReply,
  replayTableTranscript,
  runTableSimulation,
  type SimulationLLMCall,
} from '../lib/tableSimulation/simulateTable';
import type {
  SeatLabel,
  SeatPersona,
  SimulationSeatInput,
  SimulationTurn,
} from '../lib/tableSimulation/types';

const PERSONAS: SeatPersona[] = [
  { seat: 'A', archetypeLabel: '社牛柯基', energy: 'high', interests: ['徒步'], vibe: '轻松聊天' },
  { seat: 'B', archetypeLabel: '树洞考拉', energy: 'low', interests: ['电影'], vibe: '深度交流' },
  { seat: 'C', archetypeLabel: '好奇猫头鹰', energy: 'mid', interests: ['读书'], vibe: '深度交流' },
];

function makeTurns(lines: Array<[SeatLabel, string | null, number?]>): SimulationTurn[] {
  let index = 0;
  return lines.map(([seat, text, round]) => {
    index += 1;
    return {
      round: round ?? Math.ceil(index / 3),
      index,
      seat,
      speak: Boolean(text),
      text,
      innerThought: null,
    };
  });
}

describe('table simulation personas', () => {
  it('drops every identifying field before it can reach a prompt', () => {
    const roster = [
      {
        primaryArchetype: 'corgi',
        archetype: '开心柯基',
        interests: ['徒步', '摄影', '桌游', '潜水'],
        tableVibePreference: '轻松聊天',
        displayName: 'NAME_SECRET',
        userId: 'USER_ID_SECRET',
        gender: 'GENDER_SECRET',
        birthdate: '1990-01-01',
        currentCity: 'CITY_SECRET',
        industryNicheLabel: 'INDUSTRY_SECRET',
        bio: 'BIO_SECRET',
        educationLevel: 'EDU_SECRET',
        vibeVector: { energy: 0.9 },
      },
    ] as unknown as SimulationSeatInput[];

    const personas = buildSeatPersonas(roster);
    const serialized = JSON.stringify(personas) + describeSeatForPrompt(personas[0]);

    expect(personas).toHaveLength(1);
    expect(personas[0].archetypeLabel).toBe('社牛柯基');
    expect(personas[0].interests).toEqual(['徒步', '摄影', '桌游']);
    for (const forbidden of ['NAME_SECRET', 'USER_ID_SECRET', 'GENDER_SECRET', 'CITY_SECRET', 'INDUSTRY_SECRET', 'BIO_SECRET', 'EDU_SECRET', '1990']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps the forbidden-field list explicit', () => {
    expect(SEAT_PERSONA_FORBIDDEN_FIELDS).toContain('displayName');
    expect(SEAT_PERSONA_FORBIDDEN_FIELDS).toContain('userId');
    expect(SEAT_PERSONA_FORBIDDEN_FIELDS).toContain('bio');
  });

  it('maps archetype energy into bands and normalizes machine vibe values', () => {
    const personas = buildSeatPersonas([
      { primaryArchetype: 'corgi', tableVibePreference: 'light_fun' },
      { primaryArchetype: 'turtle' },
      { primaryArchetype: 'owl', tableVibePreference: 'deep_talk' },
    ]);
    expect(personas.map((persona) => persona.energy)).toEqual(['high', 'low', 'mid']);
    expect(personas[0].vibe).toBe('轻松聊天');
    expect(personas[2].vibe).toBe('深度交流');
    expect(personas[1].vibe).toBe('不限');
  });

  it('never puts another seat persona or name into a seat prompt', () => {
    const persona: SeatPersona = {
      seat: 'A',
      archetypeLabel: '社牛柯基',
      energy: 'high',
      interests: ['徒步'],
      vibe: '轻松聊天',
    };
    const messages = buildSeatMessages(persona, 1, 1, [], 3);
    const text = messages.map((message) => message.content).join('\n');
    expect(text).toContain('座位：A');
    expect(text).toContain('社牛柯基');
    expect(text).not.toContain('座位：B');
  });
});

describe('table simulation heuristics', () => {
  it('flags a fully silent table as dead air', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', null],
      ['B', null],
      ['C', null],
    ]));
    expect(flags.map((flag) => flag.code)).toEqual(['dead_air']);
    expect(flags[0].severity).toBe('high');
  });

  it('flags a seat that never speaks', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '我先说一句。', 1],
      ['B', '我也说说。', 1],
      ['A', '今天人还挺多的。', 2],
      ['B', '是啊。', 2],
    ]));
    const silent = flags.find((flag) => flag.code === 'silent_seat');
    expect(silent?.seats).toEqual(['C']);
    expect(silent?.severity).toBe('medium');
  });

  it('flags one long turn and one dominant seat as monologue', () => {
    const longLine = '我'.repeat(210);
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', longLine, 1],
      ['B', '嗯。', 1],
    ]));
    const monologue = flags.find((flag) => flag.code === 'monologue');
    expect(monologue?.severity).toBe('high');
    expect(monologue?.seats).toEqual(['A']);
  });

  it('flags a two-person table', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '你周末一般干嘛？', 1],
      ['B', '在家躺着。', 1],
      ['A', '我也是。', 1],
      ['B', '哈哈。', 2],
      ['A', '那挺巧。', 2],
      ['B', '是挺巧。', 2],
    ]));
    const twoPerson = flags.find((flag) => flag.code === 'two_person_table');
    expect(twoPerson?.seats).toEqual(['A', 'B']);
  });

  it('flags a question nobody picks up', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '你们平时周末都做什么？', 1],
      ['A', '我一般在家。', 1],
      ['A', '或者出去走走。', 1],
    ]));
    expect(flags.some((flag) => flag.code === 'unanswered_question')).toBe(true);
  });

  it('flags three short questions in a row as an interview loop', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '你多大？', 1],
      ['B', '你住哪？', 1],
      ['C', '你做什么工作？', 1],
    ]));
    expect(flags.some((flag) => flag.code === 'interview_loop')).toBe(true);
  });

  it('flags money talk as a high-severity unsafe topic', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '你现在月薪多少？', 1],
      ['B', '这个不太方便说。', 1],
    ]));
    const unsafe = flags.find((flag) => flag.code === 'unsafe_topic');
    expect(unsafe?.severity).toBe('high');
    expect(unsafe?.seats).toEqual(['A']);
  });

  it('flags energy mismatch only when a loud seat dominates and a quiet seat is silent', () => {
    const flags = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '我'.repeat(130), 1],
      ['A', '我再说两句。', 1],
      ['A', '还有还有。', 1],
      ['C', '嗯。', 1],
      ['A', '对对对。', 2],
      ['C', '是。', 2],
    ]));
    expect(flags.some((flag) => flag.code === 'energy_mismatch')).toBe(true);
  });

  it('never lets the judge clear a heuristic flag', () => {
    const heuristic = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '你现在月薪多少？', 1],
      ['B', '这个不太方便说。', 1],
    ]));
    const merged = mergeJudgeFlags(heuristic, []);
    expect(merged.some((flag) => flag.code === 'unsafe_topic')).toBe(true);
    expect(merged.every((flag) => flag.source === 'heuristic')).toBe(true);
  });

  it('lets the judge raise severity and keeps judge-only codes', () => {
    const heuristic = detectAwkwardness(PERSONAS, makeTurns([
      ['A', '你现在月薪多少？', 1],
      ['B', '这个不太方便说。', 1],
    ]));
    const merged = mergeJudgeFlags(heuristic, [
      { code: 'unsafe_topic', severity: 'high', seats: ['A', 'B'], evidence: '评委证据' },
      { code: 'dead_air', severity: 'low', seats: ['C'], evidence: '短暂停顿' },
    ]);
    const unsafe = merged.find((flag) => flag.code === 'unsafe_topic');
    expect(unsafe?.source).toBe('heuristic+judge');
    expect(unsafe?.seats).toEqual(['A', 'B']);
    const judgeOnly = merged.find((flag) => flag.code === 'dead_air');
    expect(judgeOnly?.source).toBe('judge');
  });
});

describe('table simulation parsing', () => {
  it('parses fenced seat JSON and treats empty text as silence', () => {
    expect(parseSeatReply('```json\n{"speak": true, "text": "你好", "innerThought": "紧张"}\n```')).toEqual({
      speak: true,
      text: '你好',
      innerThought: '紧张',
    });
    expect(parseSeatReply('{"speak": true, "text": "   "}')).toEqual({
      speak: false,
      text: null,
      innerThought: null,
    });
    expect(parseSeatReply('not json')).toEqual({ speak: false, text: null, innerThought: null });
  });

  it('drops unknown judge codes and seats outside the table', () => {
    const parsed = parseJudgeReply(
      JSON.stringify({
        overallRead: '这桌有点冷',
        riskiestMoment: 'B 没接话',
        flags: [
          { code: 'made_up_code', severity: 'high', seats: ['A'], evidence: 'x' },
          { code: 'silent_seat', severity: 'medium', seats: ['B', 'Z'], evidence: 'B 一直没说话' },
        ],
      }),
      PERSONAS,
    );
    expect(parsed?.flags).toHaveLength(1);
    expect(parsed?.flags[0].code).toBe('silent_seat');
    expect(parsed?.flags[0].seats).toEqual(['B']);
  });

  it('refuses to run when APP_MODE=production without the explicit override', () => {
    expect(() => assertTableSimulationAllowed({ APP_MODE: 'production' })).toThrow(/APP_MODE=production/);
    expect(() =>
      assertTableSimulationAllowed({ APP_MODE: 'production', TABLE_SIMULATION_ALLOW_PRODUCTION: 'true' }),
    ).not.toThrow();
    expect(() => assertTableSimulationAllowed({ APP_MODE: 'staging', NODE_ENV: 'production' })).not.toThrow();
  });
});

describe('runTableSimulation', () => {
  it('never leaks one seat inner thought into another seat prompt', async () => {
    const captured: SimulationLLMCall[] = [];
    const caller = vi.fn(async (call: SimulationLLMCall) => {
      captured.push(call);
      const isJudge = call.callerTag === 'tableSimulationJudge';
      if (isJudge) {
        return {
          content: JSON.stringify({ overallRead: '还行', riskiestMoment: null, flags: [] }),
          provider: 'stub',
          model: 'stub',
          latencyMs: 1,
        };
      }
      const isFirst = captured.filter((entry) => entry.callerTag === 'tableSimulationSeat').length === 1;
      return {
        content: JSON.stringify(
          isFirst
            ? { speak: true, text: '我先开个头', innerThought: 'SECRET_THOUGHT' }
            : { speak: true, text: '接一句', innerThought: '别的想法' },
        ),
        provider: 'stub',
        model: 'stub',
        latencyMs: 1,
      };
    });

    const report = await runTableSimulation({
      roster: [
        { primaryArchetype: 'corgi' },
        { primaryArchetype: 'koala' },
        { primaryArchetype: 'owl' },
      ],
      rounds: 2,
      seed: 7,
      callLLM: caller,
    });

    expect(report.mode).toBe('llm');
    expect(report.transcript).toHaveLength(6);
    const seatPrompts = captured
      .filter((call) => call.callerTag === 'tableSimulationSeat')
      .slice(1)
      .map((call) => call.messages.map((message) => message.content).join('\n'));
    expect(seatPrompts.length).toBeGreaterThan(0);
    for (const prompt of seatPrompts) {
      expect(prompt).not.toContain('SECRET_THOUGHT');
      expect(prompt).not.toContain('别的想法');
    }
    expect(report.transcript[0].innerThought).toBe('SECRET_THOUGHT');
  });

  it('degrades to heuristic-only when every seat call fails', async () => {
    const caller = vi.fn(async () => {
      throw new Error('provider down');
    });

    const report = await runTableSimulation({
      roster: [{ primaryArchetype: 'corgi' }, { primaryArchetype: 'koala' }],
      rounds: 2,
      seed: 1,
      callLLM: caller,
    });

    expect(report.mode).toBe('heuristic-only');
    expect(report.meta.seatFailures).toBe(4);
    expect(report.flags.map((flag) => flag.code)).toContain('dead_air');
    expect(report.awkwardnessScore).toBeGreaterThan(0);
  });

  it('is deterministic for a fixed seed', async () => {
    const buildCaller = () =>
      vi.fn(async (call: SimulationLLMCall) => ({
        content:
          call.callerTag === 'tableSimulationJudge'
            ? JSON.stringify({ overallRead: '普通', riskiestMoment: null, flags: [] })
            : JSON.stringify({ speak: true, text: '嗯嗯', innerThought: null }),
        provider: 'stub',
        model: 'stub',
        latencyMs: 1,
      }));

    const options = {
      roster: [{ primaryArchetype: 'corgi' }, { primaryArchetype: 'koala' }, { primaryArchetype: 'owl' }],
      rounds: 3,
      seed: 99,
    };

    const first = await runTableSimulation({ ...options, callLLM: buildCaller() });
    const second = await runTableSimulation({ ...options, callLLM: buildCaller() });

    expect(first.transcript.map((turn) => turn.seat)).toEqual(second.transcript.map((turn) => turn.seat));
    expect(first.awkwardnessScore).toBe(second.awkwardnessScore);
  });

  it('requires at least two seats', async () => {
    await expect(
      runTableSimulation({ roster: [{ primaryArchetype: 'corgi' }], callLLM: async () => ({ content: '{}', provider: 'stub', model: 'stub', latencyMs: 1 }) }),
    ).rejects.toThrow(/at least 2 seats/);
  });
});

describe('replayTableTranscript', () => {
  const roster: SimulationSeatInput[] = [
    { primaryArchetype: 'corgi' },
    { primaryArchetype: 'koala' },
    { primaryArchetype: 'owl' },
  ];

  it('replays a recorded transcript with zero LLM calls', () => {
    const report = replayTableTranscript({
      roster,
      transcript: [
        { seat: 'A', text: '你多大？', round: 1 },
        { seat: 'B', text: '你住哪？', round: 1 },
        { seat: 'C', text: '你做什么工作？', round: 1 },
      ],
    });
    expect(report.mode).toBe('replay');
    expect(report.meta.seatCalls).toBe(0);
    expect(report.judge).toBeNull();
    expect(report.flags.some((flag) => flag.code === 'interview_loop')).toBe(true);
  });

  it('does not call ordinary opening banter an interview loop', () => {
    const report = replayTableTranscript({
      roster: [
        { primaryArchetype: 'corgi' },
        { primaryArchetype: 'koala' },
        { primaryArchetype: 'owl' },
        { primaryArchetype: 'dolphin_calm' },
        { primaryArchetype: 'fox' },
        { primaryArchetype: 'elephant' },
      ],
      transcript: [
        { seat: 'D', text: '要不咱先互相猜猜谁最像会干哪行的？我瞎猜一个，猜错别打我啊。', round: 1 },
        { seat: 'E', text: '猜职业我可不擅长，不过我先问一句，有人平时露营吗？', round: 1 },
        { seat: 'F', text: '露营我倒是想去，就是装备一直没凑齐，你们一般去哪儿？', round: 1 },
      ],
    });
    expect(report.flags.some((flag) => flag.code === 'interview_loop')).toBe(false);
  });

  it('rejects a transcript that references an unknown seat', () => {
    expect(() =>
      replayTableTranscript({ roster, transcript: [{ seat: 'F', text: 'hi' }] }),
    ).toThrow(/unknown seat/);
  });

  it('accepts the judge depth_mismatch code', () => {
    const parsed = parseJudgeReply(
      JSON.stringify({
        overallRead: '有人想深聊',
        riskiestMoment: null,
        flags: [{ code: 'depth_mismatch', severity: 'low', seats: ['C'], evidence: '想深聊的人被浅话题困住' }],
      }),
      PERSONAS,
    );
    expect(parsed?.flags[0].code).toBe('depth_mismatch');
  });
});
