import { describe, expect, it } from 'vitest';
import { archetypeRegistry } from '@shared/personality/archetypeRegistry';
import { deriveSocialSnapshot, parseAnalysisResponse, type ArchetypeAnalysisInput } from '../xiaoyueAnalysisService';

const baseInput: ArchetypeAnalysisInput = {
  archetype: 'corgi',
  confidence: 0.9,
  traitScores: {
    affinity: 0.74,
    openness: 0.58,
    conscientiousness: 0.46,
    emotionalStability: 0.62,
    extraversion: 0.84,
    positivity: 0.86,
  },
};

describe('xiaoyueAnalysisService', () => {
  it('derives a high-energy social snapshot from trait scores', () => {
    const snapshot = deriveSocialSnapshot(baseInput);

    expect(snapshot.stateLabel).toBe('快热带动型');
    expect(snapshot.socialRole).toContain('开场加速器');
    expect(snapshot.bestScene).toContain('人多一点');
  });

  it('parses structured model output and keeps derived state label', () => {
    const parsed = parseAnalysisResponse(
      JSON.stringify({
        headline: '你不是硬撑热闹，你是自然带热的人',
        analysis: '你进到陌生局里，通常会比自己想的更快把气氛带松。别人先记住的不是你有多吵，而是你让场子更好接近。你更适合有接话空间的小局。下次先抛一个轻松问题，再接住第一个回应你的人。',
        socialRole: '你更像开场加速器，能让大家更快同频。',
        bestScene: '更适合6到8人的轻松热场局。',
        microAction: '下次先抛一个轻松问题，再接住第一个回应你的人。',
        shareLine: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
        whyThisFits: '这次会落到corgi，主要是因为你的外向性和正能量更突出，放进真实社交场里会变成一种快热带动型的存在感。',
        blendLine: '虽然你身上也有一点rooster的影子，但这次更稳定地落在corgi这边。',
        expressionTags: ['一上桌就熟得快', '热场但不压人', '适合多人热场'],
        shareVariants: {
          selfIntro: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
          friendCallout: '认识我的人应该会懂，我不是硬撑热闹，是会自然把场子带热。',
          socialInvite: '如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。',
        },
      }),
      baseInput
    );

    expect(parsed.headline).toContain('自然带热');
    expect(parsed.stateLabel).toBe('快热带动型');
    expect(parsed.microAction).toContain('轻松问题');
    expect(parsed.expressionTags).toContain('热场但不压人');
    expect(parsed.shareVariants.socialInvite).toContain('轻松热场局');
  });

  it('falls back to confidence-aware copy when model output is invalid', () => {
    const fallback = parseAnalysisResponse('not-json', {
      ...baseInput,
      archetype: 'owl',
      secondaryArchetype: 'octopus',
      topArchetypes: [
        { archetype: 'owl', score: 78, confidence: 0.68 },
        { archetype: 'octopus', score: 74, confidence: 0.63 },
      ],
      confidence: 0.45,
      traitScores: {
        affinity: 0.6,
        openness: 0.76,
        conscientiousness: 0.65,
        emotionalStability: 0.58,
        extraversion: 0.32,
        positivity: 0.54,
      },
    });

    expect(fallback.stateLabel).toBe('慢热深聊型');
    expect(fallback.analysis).toContain('往往不是人多人少');
    expect(fallback.shareLine).toContain('猫头鹰');
    expect(fallback.expressionTags.length).toBeGreaterThanOrEqual(3);
    expect(fallback.blendLine).toContain('章鱼');
    expect(fallback.shareVariants.friendCallout).toContain('章鱼');
  });

  it('falls back when structured output violates prompt length constraints', () => {
    const fallback = parseAnalysisResponse(
      JSON.stringify({
        headline: '太短了',
        analysis: '你进到陌生局里，通常会比自己想的更快把气氛带松。别人先记住的不是你有多吵，而是你让场子更好接近。你更适合有接话空间的小局。下次先抛一个轻松问题，再接住第一个回应你的人。',
        socialRole: '你更像开场加速器，能让大家更快同频。',
        bestScene: '更适合6到8人的轻松热场局。',
        microAction: '下次先抛一个轻松问题，再接住第一个回应你的人。',
        shareLine: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
        whyThisFits: '这次会落到corgi，主要是因为你的外向性和正能量更突出，放进真实社交场里会变成一种快热带动型的存在感。',
        blendLine: '虽然你身上也有一点rooster的影子，但这次更稳定地落在corgi这边。',
        expressionTags: ['一上桌就熟得快', '热场但不压人', '这是一个超过八个字的标签'],
        shareVariants: {
          selfIntro: '我是corgi型，属于一进场就会慢慢把气氛带起来的那种。',
          friendCallout: '认识我的人应该会懂，我不是硬撑热闹，是会自然把场子带热。',
          socialInvite: '如果一起组局，我更适合6到8人的轻松热场局，会比较容易进入状态。',
        },
      }),
      baseInput,
    );

    expect(fallback.headline).toBe('你不是硬撑热闹，你是自然带热的人');
    expect(fallback.expressionTags.length).toBeGreaterThanOrEqual(3);
    expect(fallback.expressionTags.length).toBeLessThanOrEqual(4);
    expect(fallback.expressionTags.every((tag) => tag.length <= 8)).toBe(true);
  });

  /**
   * Regression lock for the 2026-11-17 copy rework: the reading explains how a
   * person runs (signal → mechanism → cost → condition). It must never slide
   * back into event tactics ("下次进局…"), which is what made it read like a
   * tip sheet instead of an interpretation.
   */
  describe('five-beat reading copy', () => {
    const traitScores = (overrides: Partial<ArchetypeAnalysisInput['traitScores']>) => ({
      affinity: 50,
      openness: 50,
      conscientiousness: 50,
      emotionalStability: 50,
      extraversion: 50,
      positivity: 50,
      ...overrides,
    });

    /**
     * Fixtures stay self-consistent: each archetype's registry-declared
     * stateLabel equals the state under test, so this loop covers all seven
     * states even though the registry now wins over threshold derivation.
     */
    const cases: Array<{ state: string; input: ArchetypeAnalysisInput }> = [
      {
        state: '快热带动型',
        input: { archetype: 'corgi', confidence: 0.9, traitScores: traitScores({ extraversion: 84, positivity: 86 }) },
      },
      {
        state: '稳场推进型',
        input: {
          archetype: 'rooster',
          confidence: 0.9,
          traitScores: traitScores({ emotionalStability: 80, conscientiousness: 75 }),
        },
      },
      {
        state: '熟了更有火花型',
        input: {
          archetype: 'hamster',
          confidence: 0.9,
          traitScores: traitScores({ affinity: 80, extraversion: 60, positivity: 68 }),
        },
      },
      {
        state: '灵感破冰型',
        input: { archetype: 'fox', confidence: 0.9, traitScores: traitScores({ openness: 80, extraversion: 60 }) },
      },
      {
        state: '慢热深聊型',
        input: { archetype: 'koala', confidence: 0.9, traitScores: traitScores({ extraversion: 40, openness: 70 }) },
      },
      {
        state: '低耗观察型',
        input: {
          archetype: 'turtle',
          confidence: 0.9,
          traitScores: traitScores({ extraversion: 40, openness: 50, emotionalStability: 70 }),
        },
      },
      {
        // An unknown id has no registry declaration, so the threshold
        // derivation (and its fallback state) is what gets exercised.
        state: '局内升温型',
        input: { archetype: 'rabbit', confidence: 0.9, traitScores: traitScores({}) },
      },
    ];

    const TACTIC_TOKENS = /下次|进局|第一轮|开场|破冰|活动|社交|局/;

    it.each(cases)('writes $state without event tactics', ({ state, input }) => {
      const snapshot = deriveSocialSnapshot(input);
      expect(snapshot.stateLabel).toBe(state);


      for (const layer of [
        snapshot.verdictLine,
        snapshot.archetypeNoteLine,
        snapshot.sceneLens,
        snapshot.mechanismLine,
        snapshot.misreadLine,
        snapshot.conditionLine,
      ].filter(Boolean)) {
        expect(layer.length).toBeGreaterThan(0);
        expect(layer.endsWith('。')).toBe(true);
        expect(layer).not.toMatch(TACTIC_TOKENS);
      }

      const fallback = parseAnalysisResponse('not-json', input);
      expect(fallback.analysis).not.toMatch(TACTIC_TOKENS);
      expect(fallback.analysis.length).toBeGreaterThanOrEqual(30);
      expect(fallback.analysis.length).toBeLessThanOrEqual(400);
      // Legacy slot must carry the condition sentence, never an instruction.
      expect(fallback.microAction).toBe(snapshot.conditionLine);
    });

    it.each(cases)('opens $state with the verdict beat', ({ input }) => {
      const snapshot = deriveSocialSnapshot(input);
      const beats = parseAnalysisResponse('not-json', input).analysis.split('\n');
      const expected = [
        snapshot.verdictLine,
        snapshot.archetypeNoteLine,
        snapshot.sceneLens,
        snapshot.mechanismLine,
        snapshot.misreadLine,
        snapshot.conditionLine,
      ].filter(Boolean);

      // The verdict is the first thing read: label first, reasoning after.
      expect(beats).toHaveLength(expected.length);
      expect(beats[0]).toContain(snapshot.verdictLine);
      expect(beats[0]).toMatch(/你是那种/);
      expect(beats.slice(1)).toEqual(expected.slice(1));
    });

    it('calibrates the verdict instead of the following beat', () => {
      const lowConfidence = parseAnalysisResponse('not-json', {
        archetype: 'rabbit',
        confidence: 0.4,
        traitScores: traitScores({}),
      });
      const verdict = deriveSocialSnapshot({
        archetype: 'rabbit',
        confidence: 0.4,
        traitScores: traitScores({}),
      }).verdictLine;

      expect(lowConfidence.analysis.split('\n')[0]).toBe(`这次更偏这一边——${verdict}`);
    });

    it('keeps bestScene in the "我更适合…" shape used by shareVariants', () => {
      for (const { input } of cases) {
        const fallback = parseAnalysisResponse('not-json', input);
        expect(fallback.shareVariants.socialInvite).toContain('我更适合');
        expect(fallback.shareVariants.socialInvite).not.toMatch(/我更适合更适合/);
      }
    });
  });

  /**
   * Regression lock for the 2026-11-17 identity mismatch: the card is titled
   * with one of the 12 archetypes, so a single high-confidence result must read
   * in that archetype's declared state. Threshold-only derivation had 8 of 12
   * archetypes describing a different person than the card named.
   */
  describe('state resolution precedence', () => {
    const quietTraits: ArchetypeAnalysisInput['traitScores'] = {
      affinity: 50,
      openness: 50,
      conscientiousness: 70,
      emotionalStability: 70,
      extraversion: 40,
      positivity: 50,
    };

    it('trusts the registry declaration for one archetype at high confidence', () => {
      // Traits alone derive 稳场推进型; corgi is declared 快热带动型.
      const snapshot = deriveSocialSnapshot({ archetype: 'corgi', confidence: 0.9, traitScores: quietTraits });
      expect(snapshot.stateLabel).toBe('快热带动型');
    });

    it('falls back to threshold derivation when confidence is low', () => {
      const snapshot = deriveSocialSnapshot({ archetype: 'corgi', confidence: 0.4, traitScores: quietTraits });
      expect(snapshot.stateLabel).toBe('稳场推进型');
    });

    it('falls back to threshold derivation for an unknown archetype', () => {
      const snapshot = deriveSocialSnapshot({ archetype: 'rabbit', confidence: 0.9, traitScores: quietTraits });
      expect(snapshot.stateLabel).toBe('稳场推进型');
    });
  });

/**
 * Regression lock for the per-archetype reading layer (2026-11-17).
 *
 * The seven behavioural states are a bucket. Reading a 人脉蛛 through the
 * 局内升温型 bucket described somebody else, and that mismatch is why the copy
 * kept collapsing into Barnum lines. Each archetype now carries its own five
 * beats; states stay as the fallback for blends and low confidence.
 */
describe('per-archetype readings', () => {
  const DECLARED_STATE: Record<string, string> = {
    corgi: '快热带动型',
    rooster: '稳场推进型',
    hamster_praise: '快热带动型',
    fox: '灵感破冰型',
    dolphin_calm: '稳场推进型',
    spider: '局内升温型',
    koala: '慢热深聊型',
    octopus: '灵感破冰型',
    owl: '慢热深聊型',
    elephant: '稳场推进型',
    turtle: '低耗观察型',
    cat: '低耗观察型',
  };

  const TACTIC_TOKENS = /下次|进局|第一轮|开场|破冰|活动|社交|局/;

  /**
   * Lock: the threshold bands must reproduce every declared label.
   *
   * The probe passes an unknown archetype id on purpose — that forces the
   * derivation path instead of the registry-first shortcut. Before the
   * 2026-11-17 recalibration, 9 of 12 derived a state their own card did not
   * declare, so a blended reading described a different person than the card
   * named. This asserts both sides of that contract stay in agreement.
   */
  it('derives every declared state from its own trait profile', () => {
    for (const [archetype, state] of Object.entries(DECLARED_STATE)) {
      const { traitProfile } = archetypeRegistry[archetype as keyof typeof archetypeRegistry].profile;
      const snapshot = deriveSocialSnapshot({
        archetype: 'threshold-probe',
        confidence: 0.9,
        traitScores: {
          affinity: traitProfile.A,
          conscientiousness: traitProfile.C,
          emotionalStability: traitProfile.E,
          openness: traitProfile.O,
          extraversion: traitProfile.X,
          positivity: traitProfile.P,
        },
      });
      expect(snapshot.stateLabel, archetype).toBe(state);
    }
  });

  const readings = Object.entries(DECLARED_STATE).map(([archetype, state]) => ({ archetype, state }));

  const fixtures = readings.map(({ archetype }) => {
    const input: ArchetypeAnalysisInput = {
      archetype,
      confidence: 0.9,
      traitScores: {
        affinity: 50,
        openness: 50,
        conscientiousness: 50,
        emotionalStability: 50,
        extraversion: 50,
        positivity: 50,
      },
    };
    const snapshot = deriveSocialSnapshot(input);
    return { archetype, input, snapshot, beats: parseAnalysisResponse('not-json', input).analysis.split('\n') };
  });

  it.each(fixtures)('$archetype reads its own six beats', ({ archetype, snapshot, beats }) => {
    expect(snapshot.stateLabel).toBe(DECLARED_STATE[archetype]);
    // Verdict, the name's origin, then the four layers.
    expect(beats).toHaveLength(6);
    expect(snapshot.archetypeNoteLine.length).toBeGreaterThan(0);
    // The verdict is a judgement, not a maybe: it must open the reading.
    expect(beats[0]).toMatch(/^你是那种/);
    expect(beats[1]).toBe(snapshot.archetypeNoteLine);
    for (const beat of beats) {
      expect(beat.length).toBeGreaterThan(0);
      expect(beat.endsWith('。')).toBe(true);
      expect(beat).not.toMatch(TACTIC_TOKENS);
    }
    expect(beats.join('\n').length).toBeLessThanOrEqual(400);
  });

  it('names the animal without letting the name explain the person', () => {
    for (const { archetype, snapshot } of fixtures) {
      // The note must hand the habit back, not assert "because you are X".
      expect(snapshot.archetypeNoteLine, archetype).not.toMatch(/因为你是|所以你/);
      expect(snapshot.archetypeNoteLine, archetype).not.toMatch(TACTIC_TOKENS);
    }
    const notes = new Set(fixtures.map(({ snapshot }) => snapshot.archetypeNoteLine));
    expect(notes.size).toBe(fixtures.length);
  });

  it('gives every archetype distinct copy, including those sharing a state', () => {
    const signals = new Set(fixtures.map(({ snapshot }) => snapshot.sceneLens));
    const verdicts = new Set(fixtures.map(({ snapshot }) => snapshot.verdictLine));

    expect(signals.size).toBe(fixtures.length);
    expect(verdicts.size).toBe(fixtures.length);
  });
});
});
