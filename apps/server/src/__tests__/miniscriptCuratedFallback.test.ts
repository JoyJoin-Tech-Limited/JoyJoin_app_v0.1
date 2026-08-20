/**
 * T1/T2/T3/T4 coverage:
 *  (a) premise/title contain no snake_case genre keys on stub AND curated fallback paths
 *  (b) curated fallback frameworks validate against the schema and are playable
 *      (named roles, distinct secrets, distinct concrete clues, consistent solution)
 *  (d) title derivation helpers (clause truncation + ellipsis, explicit-title preference)
 *  (e) the v2 stub is gated off in production
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MINI_SCRIPT_GENRES,
  MINI_SCRIPT_STYLES,
  miniScriptStoryFrameworkSchema,
  deriveMiniScriptTitleFromPremise,
  resolveMiniScriptTitle,
  MINISCRIPT_TITLE_MAX_CHARS,
} from '@shared/miniscriptStoryFramework';
import { MINISCRIPT_CURATED_STORIES } from '@shared/miniscriptCuratedStories';
import { sanitizeMiniScriptUserText } from '@shared/miniscriptCatalog';

const hoisted = vi.hoisted(() => ({
  traceMock: vi.fn(),
  metricsMock: vi.fn(),
  validateMock: vi.fn(),
}));

vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn(() => ({
    client: { chat: { completions: { create: vi.fn() } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
  getDeepseekSelection: vi.fn(() => ({
    client: { chat: { completions: { create: vi.fn() } } },
    model: 'deepseek-v4-flash',
    provider: 'deepseek',
  })),
}));

vi.mock('../lib/miniscriptValidator', () => ({
  validateMiniScriptFramework: hoisted.validateMock,
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: (opts: unknown) => hoisted.traceMock(opts),
  createAiCorrelationId: () => '00000000-0000-4000-8000-000000000002',
}));

vi.mock('../middleware/metrics', () => ({
  recordAIProviderRecoveryMetric: (opts: unknown) => hoisted.metricsMock(opts),
}));

const ALL_MACHINE_KEYS: readonly string[] = [...MINI_SCRIPT_STYLES, ...MINI_SCRIPT_GENRES];

function expectNoMachineKeys(text: string | undefined, label: string) {
  expect(text, label).toBeTruthy();
  for (const key of ALL_MACHINE_KEYS) {
    expect(text, `${label} must not contain machine key "${key}"`).not.toContain(key);
  }
}

describe('curated story registry (b)', () => {
  it('contains at least two complete frameworks, including a western_court story', () => {
    expect(MINISCRIPT_CURATED_STORIES.length).toBeGreaterThanOrEqual(2);
    expect(MINISCRIPT_CURATED_STORIES.some((s) => s.style === 'western_court')).toBe(true);
  });

  for (const story of MINISCRIPT_CURATED_STORIES) {
    describe(`「${story.title}」 (${story.style})`, () => {
      it('validates against the v2 schema', () => {
        const result = miniScriptStoryFrameworkSchema.safeParse(story);
        expect(result.success, result.success ? '' : result.error.message).toBe(true);
      });

      it('has a ≤12-char Chinese title and an enum-key-free premise', () => {
        expect(story.title).toBeTruthy();
        expect(story.title!.length).toBeLessThanOrEqual(MINISCRIPT_TITLE_MAX_CHARS);
        expectNoMachineKeys(story.title, 'title');
        expectNoMachineKeys(story.premise, 'premise');
      });

      it('has ≥4 named roles with distinct, concrete secrets', () => {
        expect(story.characters.length).toBeGreaterThanOrEqual(4);
        const labels = story.characters.map((c) => c.roleLabel);
        expect(new Set(labels).size, 'role labels must be unique').toBe(labels.length);
        for (const label of labels) {
          expect(label, 'roles must be named, not 角色 N').not.toMatch(/^角色\s*\d+$/);
          expectNoMachineKeys(label, 'roleLabel');
        }
        const secrets = story.characters.map((c) => c.secret);
        expect(new Set(secrets).size, 'secrets must be distinct').toBe(secrets.length);
        for (const secret of secrets) {
          expect(secret.length, 'secret must be concrete').toBeGreaterThanOrEqual(10);
        }
      });

      it('has ≥4 distinct concrete clues without self-numbering', () => {
        expect(story.clues.length).toBeGreaterThanOrEqual(4);
        const texts = story.clues.map((c) => c.text);
        expect(new Set(texts).size, 'clue texts must be distinct').toBe(texts.length);
        for (const text of texts) {
          expect(text, 'no 线索 N： self-numbering — the client owns ordinals').not.toMatch(/^线索\s*\d+/);
          expect(text.length, 'clue must be concrete, not a placeholder').toBeGreaterThanOrEqual(12);
          expect(text).not.toContain('某个细节暗示了真相的一角');
          expectNoMachineKeys(text, 'clue text');
        }
        // Clues spread across acts so every act reveals something new.
        const acts = new Set(story.clues.map((c) => c.revealedInAct));
        expect(acts.size).toBeGreaterThanOrEqual(2);
      });

      it('has a solution that names an in-play role and carries vote options', () => {
        const labels = story.characters.map((c) => c.roleLabel);
        expect(labels.slice(0, 4), 'culprit must be in slots 0-3 (4-player consistency)').toContain(
          story.solution.who,
        );
        expect(story.voteOptions).toBeDefined();
        expect(story.voteOptions!.what.length).toBeGreaterThanOrEqual(3);
        expect(story.voteOptions!.why.length).toBeGreaterThanOrEqual(3);
        for (const chip of [...story.voteOptions!.what, ...story.voteOptions!.why]) {
          expect(chip.length).toBeLessThanOrEqual(12);
          expectNoMachineKeys(chip, 'vote option');
        }
      });
    });
  }
});

describe('title derivation helpers (d)', () => {
  it('derives from the first clause without mid-sentence cuts', () => {
    expect(deriveMiniScriptTitleFromPremise('周五晚的写字楼茶水间，有人发现冰箱上贴着一张便利贴。', 14)).toBe(
      '周五晚的写字楼茶水间',
    );
  });

  it('caps long clauses with an ellipsis', () => {
    const derived = deriveMiniScriptTitleFromPremise('一个特别特别长的分句超过十四个字一定会被截断，后面还有内容。', 14);
    expect(derived.endsWith('…')).toBe(true);
    expect(derived.length).toBe(15);
  });

  it('falls back to a default when the premise has no usable clause', () => {
    expect(deriveMiniScriptTitleFromPremise('，。')).toBe('今晚的神秘故事');
  });

  it('keeps explicit ≤12-char titles, derives otherwise', () => {
    expect(resolveMiniScriptTitle('凡尔赛的胸针', '任何前提。')).toBe('凡尔赛的胸针');
    const derived = resolveMiniScriptTitle('这个标题实在是太长了一共十五个字整', '短句，后文。');
    expect(derived).toBe('短句');
    expect(resolveMiniScriptTitle(undefined, '短句，后文。')).toBe('短句');
  });
});

describe('stub user-facing copy (a)', () => {
  it('emits Chinese genre labels and proper titles, no machine keys', async () => {
    const { generateV2Stub } = await import('../lib/miniscriptAgent');
    for (const style of MINI_SCRIPT_STYLES) {
      const stub = generateV2Stub({
        playerCount: 6,
        style,
        genres: ['absurd_comedy', 'romance', 'thriller_mystery'],
      });
      expectNoMachineKeys(stub.premise, `stub premise (${style})`);
      expectNoMachineKeys(stub.title, `stub title (${style})`);
      expect(stub.title!.length).toBeLessThanOrEqual(MINISCRIPT_TITLE_MAX_CHARS);
      expect(stub.premise).toContain('荒诞喜剧');
      for (const clue of stub.clues) {
        expect(clue.text).not.toMatch(/^线索\s*\d+/);
      }
      expect(stub.voteOptions).toBeDefined();
    }
  });
});

describe('curated fallback through the orchestrator (a, e)', () => {
  beforeEach(() => {
    hoisted.traceMock.mockClear();
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    delete process.env.MINISCRIPT_ENABLE_STUB_FALLBACK;
  });

  afterEach(() => {
    delete process.env.SOCIAL_MINISCRIPT_LLM_ENABLED;
    delete process.env.MINISCRIPT_ENABLE_STUB_FALLBACK;
  });

  it('serves the western_court curated story with clean copy when the LLM is disabled', async () => {
    process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
    const { generateMiniScriptFrameworkWithMeta } = await import('../lib/miniscriptAgent');
    const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
      playerCount: 4,
      style: 'western_court',
      genres: ['absurd_comedy', 'romance'],
    });

    expect(meta.fallbackUsed).toBe(true);
    expect(meta.catalogUsed).toBe(true);
    expect(framework.title).toBe('凡尔赛的胸针');
    expectNoMachineKeys(framework.premise, 'curated premise');
    expect(framework.characters[0]!.roleLabel).toBe('健忘的男爵夫人');
    for (const character of framework.characters) {
      expect(character.roleLabel).not.toMatch(/^角色\s*\d+$/);
    }
    const secrets = framework.characters.map((c) => c.secret);
    expect(new Set(secrets).size).toBe(secrets.length);
    expect(framework.voteOptions).toBeDefined();
  });

  it('gates the stub off in production and still serves a playable curated story', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { isMiniscriptStubFallbackEnabled, generateMiniScriptFrameworkWithMeta } = await import(
        '../lib/miniscriptAgent'
      );
      expect(isMiniscriptStubFallbackEnabled()).toBe(false);

      process.env.SOCIAL_MINISCRIPT_LLM_ENABLED = 'false';
      // xianxia + thriller_mystery matches no server-catalog entry and no exact
      // curated genre — the style-matched curated story must serve, never the stub.
      const { framework, meta } = await generateMiniScriptFrameworkWithMeta({
        playerCount: 4,
        style: 'xianxia',
        genres: ['thriller_mystery'],
      });
      expect(meta.fallbackUsed).toBe(true);
      expect(framework.title).toBe('失踪的桂花糕');
      expect(framework.characters[0]!.roleLabel).toBe('贪吃的小师弟');
      expect(framework.characters[0]!.roleLabel).not.toMatch(/^角色\s*\d+$/);
      expectNoMachineKeys(framework.premise, 'production fallback premise');
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('only enables the stub outside production or via explicit opt-in', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const { isMiniscriptStubFallbackEnabled } = await import('../lib/miniscriptAgent');
    try {
      process.env.NODE_ENV = 'production';
      expect(isMiniscriptStubFallbackEnabled()).toBe(false);
      process.env.MINISCRIPT_ENABLE_STUB_FALLBACK = 'true';
      expect(isMiniscriptStubFallbackEnabled()).toBe(true);
      delete process.env.MINISCRIPT_ENABLE_STUB_FALLBACK;
      process.env.NODE_ENV = 'development';
      expect(isMiniscriptStubFallbackEnabled()).toBe(true);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      delete process.env.MINISCRIPT_ENABLE_STUB_FALLBACK;
    }
  });
});

describe('sanitizeMiniScriptUserText', () => {
  it('replaces every style/genre machine key with its Chinese label, idempotently', () => {
    const dirty = '基调：absurd_comedy、romance（western_court 场景）';
    const clean = sanitizeMiniScriptUserText(dirty);
    expect(clean).toBe('基调：荒诞喜剧、浪漫爱情（西欧宫廷 场景）');
    expect(sanitizeMiniScriptUserText(clean)).toBe(clean);
    expectNoMachineKeys(clean, 'sanitized text');
  });
});
