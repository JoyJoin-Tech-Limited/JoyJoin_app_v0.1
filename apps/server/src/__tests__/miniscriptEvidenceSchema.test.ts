/**
 * MiniScript V2 P1 additive schema tests (AC-01):
 *  - legacy v2 JSON without the new fields still validates (schemaVersion stays 2)
 *  - evidence[] / evidenceReactions / motiveOptions validate when present
 *  - caps are enforced: >2 evidence per act, >120-char reactions, and motiveOptions
 *    outside 3-4 items are dropped (catch) instead of failing the whole parse
 */
import { describe, it, expect } from 'vitest';
import {
  miniScriptStoryFrameworkSchema,
  miniScriptEvidenceSchema,
} from '@shared/miniscriptStoryFramework';

const baseV2Framework = {
  schemaVersion: 2,
  style: 'modern_urban',
  genres: ['light_reasoning'],
  premise: '共享自习室里，大家凑钱买的加湿器不见了。',
  characters: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    roleLabel: `角色${slotIndex + 1}`,
    sinHook: '一点无伤大雅的小别扭。',
    alibi: '只记得模糊细节。',
    secret: '一句没说出口的谢谢。',
  })),
  act_flow: [
    { actNumber: 1, title: '开场', beats: ['落座', '表态'], cliffhanger: '可是谁都不愿先开口。' },
    { actNumber: 2, title: '收束', beats: ['交换线索', '投票'] },
  ],
  ending: {
    resolutionSummary: '误会解开，温柔收尾。',
    confessionMechanic: '每人一句话认领小秘密。',
  },
  clues: [
    { clueId: 'c1', text: '线索一', revealedInAct: 1 },
    { clueId: 'c2', text: '线索二', revealedInAct: 2 },
  ],
  solution: { who: '角色1', what: '误会', why: '太害羞' },
  playerKnowledge: [0, 1, 2, 3].map((slotIndex) => ({
    slotIndex,
    knownFacts: ['fact1'],
    secretAgenda: 'secret',
    truthfulAlibi: 'alibi',
  })),
};

const evidenceItem = {
  id: 'e1',
  name: '登记表',
  description: '前台的进出登记表，背面有一行被划掉的字。',
  iconKey: '登记表',
  evidenceReactions: {
    '1': '她扶了扶眼镜，说登记表她每天都会誊进手账，今晚那一页恰好空着。',
    '2': '他摘下耳机看了一眼，嘟囔说自己签完名就回座位了没注意背面。',
    '3': '她凑近看了看那行划掉的字，忽然想起什么似的抿住了嘴不再说话。',
    '4': '他的手指在桌沿敲了两下，承认登记表是他整理的但说划掉只是笔误。',
  },
};

describe('MiniScriptStoryFramework V2 P1 additive fields', () => {
  it('still validates legacy v2 JSON without evidence/motiveOptions', () => {
    const result = miniScriptStoryFrameworkSchema.safeParse(baseV2Framework);
    expect(result.success, result.success ? '' : result.error.message).toBe(true);
    expect(result.success && result.data.schemaVersion).toBe(2);
    expect(result.success && result.data.act_flow[0]!.evidence).toBeUndefined();
    expect(result.success && result.data.motiveOptions).toBeUndefined();
  });

  it('accepts act evidence with server-only evidenceReactions', () => {
    const result = miniScriptStoryFrameworkSchema.safeParse({
      ...baseV2Framework,
      act_flow: [
        { ...baseV2Framework.act_flow[0], evidence: [evidenceItem] },
        baseV2Framework.act_flow[1],
      ],
    });
    expect(result.success, result.success ? '' : result.error.message).toBe(true);
    const act = result.success ? result.data.act_flow[0]! : undefined;
    expect(act?.evidence).toHaveLength(1);
    expect(act?.evidence?.[0]?.evidenceReactions?.['4']).toContain('登记表是他整理的');
  });

  it('accepts framework-level motiveOptions with 3-4 strings', () => {
    const result = miniScriptStoryFrameworkSchema.safeParse({
      ...baseV2Framework,
      motiveOptions: ['怕丢面子', '善意帮忙', '一时糊涂'],
    });
    expect(result.success, result.success ? '' : result.error.message).toBe(true);
    expect(result.success && result.data.motiveOptions).toHaveLength(3);
  });

  it('enforces the ≤2 evidence per act cap by dropping an over-long array', () => {
    const three = [evidenceItem, { ...evidenceItem, id: 'e2' }, { ...evidenceItem, id: 'e3' }];
    const result = miniScriptStoryFrameworkSchema.safeParse({
      ...baseV2Framework,
      act_flow: [{ ...baseV2Framework.act_flow[0], evidence: three }, baseV2Framework.act_flow[1]],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.act_flow[0]!.evidence).toBeUndefined();
  });

  it('enforces the 120-char reaction hard cap by dropping the reaction map', () => {
    const result = miniScriptEvidenceSchema.safeParse({
      ...evidenceItem,
      evidenceReactions: { '1': '长'.repeat(121) },
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.evidenceReactions).toBeUndefined();
  });

  it('drops evidenceReactions with out-of-range roleSlot keys', () => {
    const result = miniScriptEvidenceSchema.safeParse({
      ...evidenceItem,
      evidenceReactions: { '7': '不存在的角色。' },
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.evidenceReactions).toBeUndefined();
  });

  it('drops motiveOptions outside the 3-4 item band', () => {
    const tooFew = miniScriptStoryFrameworkSchema.safeParse({
      ...baseV2Framework,
      motiveOptions: ['只有一个', '两个选项'],
    });
    expect(tooFew.success).toBe(true);
    expect(tooFew.success && tooFew.data.motiveOptions).toBeUndefined();

    const tooMany = miniScriptStoryFrameworkSchema.safeParse({
      ...baseV2Framework,
      motiveOptions: ['一', '二', '三', '四', '五'],
    });
    expect(tooMany.success).toBe(true);
    expect(tooMany.success && tooMany.data.motiveOptions).toBeUndefined();
  });
});
