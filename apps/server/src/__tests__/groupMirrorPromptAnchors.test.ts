import { describe, expect, it } from 'vitest';
import {
  buildGroupMirrorPrompt,
  GROUP_MIRROR_ANCHORED_PROMPT_VERSION,
  GROUP_MIRROR_MAX_TABLE_ANCHORS,
  GROUP_MIRROR_PROMPT_VERSION,
  resolveGroupMirrorPromptVersion,
  selectGroupMirrorPromptAnchors,
} from '../ai/socialIcebreakerPrompts';

/**
 * Byte-exact snapshot of the M1.2b privacy-clean prompt
 * (`social-group-mirror-v2`): no roster names, aggregate count only.
 *
 * This is a regression lock: the M3 anchor block must be additive only. If this
 * fixture needs updating, the unanchored prompt changed for every table that
 * has no shared-interest signal — which the plan forbids.
 */
const LEGACY_PROMPT_FIXTURE =
  '你是JoyJoin的社交观察家。为一场线下聚会（3人）生成5个"群像镜像"问题。\n\n' +
  '（你是纯数字助手，不身处现场——生成的问题通过应用界面完成匿名投票。）\n\n' +
  '游戏规则：\n' +
  '- 每个问题都是关于在场某人的趣味观察/猜测\n' +
  '- 大家匿名投票选出"最符合这个问题描述的人"\n' +
  '- 最后揭晓投票结果，形成"群像镜像"\n\n' +
  '要求：\n' +
  '- 问题要轻松、无攻击性，不能有冒犯性\n' +
  '- 问题要有"画面感"，让人能立刻想到某位朋友\n' +
  '- 问题类型覆盖：观察（谁最像...）、预测（谁最可能...）、记忆（谁给人的第一印象最...）\n' +
  '- 每个问题20-40字\n' +
  '- 禁止使用敏感话题（政治、宗教、种族、性、疾病、外貌攻击、收入）\n' +
  '- 语气像朋友间的好奇打量，不要像心理测试\n\n' +
  '请以JSON数组返回：\n' +
  '[{"id":"gm_1","questionText":"谁最有可能在聚会结束后第一个提议续摊？","category":"perception"},{"id":"gm_2","questionText":"...","category":"..."}]\n\n' +
  'category只能是 perception / memory / prediction 之一。\n' +
  '直接返回JSON，不要其他内容。';

describe('group mirror prompt — unanchored path is byte-identical', () => {
  it('matches the privacy-clean v2 fixture with no anchors supplied', () => {
    expect(
      buildGroupMirrorPrompt({ participantCount: 3 }),
    ).toBe(LEGACY_PROMPT_FIXTURE);
  });

  it('never reads caller-supplied participant names', () => {
    const prompt = buildGroupMirrorPrompt({
      participantCount: 3,
      participantNames: ['SECRET_ALICE', 'SECRET_BOB'],
    } as never);
    expect(prompt).not.toContain('SECRET_ALICE');
    expect(prompt).not.toContain('SECRET_BOB');
    expect(prompt).not.toContain('参与者：');
  });

  it('treats empty / blank / duplicate-free-but-empty anchor lists as no anchors', () => {
    expect(
      buildGroupMirrorPrompt({
        participantCount: 3,
        tableAnchors: [],
      }),
    ).toBe(LEGACY_PROMPT_FIXTURE);

    expect(
      buildGroupMirrorPrompt({
        participantCount: 3,
        tableAnchors: ['   ', ''],
      }),
    ).toBe(LEGACY_PROMPT_FIXTURE);

    expect(
      buildGroupMirrorPrompt({
        participantCount: 3,
        tableAnchors: undefined,
      }),
    ).toBe(LEGACY_PROMPT_FIXTURE);
  });

  it('keeps the v1 promptVersion when no anchors are used', () => {
    expect(resolveGroupMirrorPromptVersion(undefined)).toBe(GROUP_MIRROR_PROMPT_VERSION);
    expect(resolveGroupMirrorPromptVersion([])).toBe(GROUP_MIRROR_PROMPT_VERSION);
    expect(resolveGroupMirrorPromptVersion(['  '])).toBe(GROUP_MIRROR_PROMPT_VERSION);
  });
});

describe('group mirror prompt — anchored path (M3)', () => {
  it('uses at most two anchors even when more are offered', () => {
    const prompt = buildGroupMirrorPrompt({
      participantCount: 5,
      tableAnchors: ['攀岩', '露营', '手冲咖啡', '爵士乐'],
    });
    expect(GROUP_MIRROR_MAX_TABLE_ANCHORS).toBe(2);
    expect(prompt).toContain('攀岩');
    expect(prompt).toContain('露营');
    expect(prompt).not.toContain('手冲咖啡');
    expect(prompt).not.toContain('爵士乐');
  });

  it('dedupes and trims anchors', () => {
    expect(selectGroupMirrorPromptAnchors([' 攀岩 ', '攀岩', '露营', '露营'])).toEqual([
      '攀岩',
      '露营',
    ]);
    const prompt = buildGroupMirrorPrompt({
      participantCount: 4,
      tableAnchors: [' 攀岩 ', '攀岩'],
    });
    expect(prompt.match(/攀岩/g)).toHaveLength(1);
  });

  it('keeps the appreciation/anonymity guardrails in the anchor block', () => {
    const prompt = buildGroupMirrorPrompt({
      participantCount: 4,
      tableAnchors: ['攀岩'],
    });
    expect(prompt).toContain('【本桌共同话题】攀岩');
    expect(prompt).toContain('最多2个问题可以借共同话题起意');
    expect(prompt).toContain('欣赏式提问');
    expect(prompt).toContain('不得点名谁喜欢这些话题');
    expect(prompt).toContain('不得引用任何个人资料');
    // No coverage/count leakage into the prompt itself.
    expect(prompt).not.toMatch(/至少.*人/);
    expect(prompt).not.toMatch(/\d+\s*人.*喜欢/);
  });

  it('never injects participant names, identifiers, or individual terms beyond the pre-existing roster line', () => {
    const prompt = buildGroupMirrorPrompt({
      participantCount: 4,
      tableAnchors: ['攀岩'],
    });
    const anchorBlock = prompt.slice(
      prompt.indexOf('【本桌共同话题】'),
      prompt.indexOf('请以JSON数组返回'),
    );
    expect(anchorBlock.length).toBeGreaterThan(0);
    for (const forbidden of ['A', 'B', 'C', 'D', 'userId', 'user_', 'displayName', 'bio', 'supporters', 'coverage']) {
      expect(anchorBlock).not.toContain(forbidden);
    }
    // The anchor block only constrains framing; it never adds a "who is this" question stem.
    expect(anchorBlock).not.toMatch(/谁最(像|可能|有)/);
  });

  it('reports the anchored promptVersion only when anchors are actually used', () => {
    expect(resolveGroupMirrorPromptVersion(['攀岩'])).toBe(
      GROUP_MIRROR_ANCHORED_PROMPT_VERSION,
    );
    expect(GROUP_MIRROR_ANCHORED_PROMPT_VERSION).not.toBe(GROUP_MIRROR_PROMPT_VERSION);
  });

  it('does not invent anchors from other prompt inputs', () => {
    const prompt = buildGroupMirrorPrompt({
      participantCount: 4,
      sessionContext: { mixText: '社牛柯基×2', diversityScore: 0.5 },
    });
    expect(prompt).not.toContain('【本桌共同话题】');
    expect(prompt).toContain('【本组画像】社牛柯基×2');
  });
});
