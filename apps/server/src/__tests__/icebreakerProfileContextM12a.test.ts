import { describe, expect, it } from 'vitest';
import {
  ARCHETYPE_BY_ID,
  resolveRosterArchetype,
} from '@shared/personality/archetypeNames';
import { buildArchetypeMix } from '@shared/runPlanCompiler';
import { buildArchetypeContext } from '../lib/contextInjector';
import { buildSharedInterestAnchors } from '../lib/icebreakerRosterSignals';
import {
  XIAOYUE_COMMENT_PROMPT_VERSION,
  buildXiaoYueCommentPrompt,
} from '../ai/socialIcebreakerPrompts';
import {
  extractRosterInterestLabels,
  hasParticipantProfileSignal,
} from '../lib/socialIcebreakerStore';

const CORGI_NAME = ARCHETYPE_BY_ID.corgi.nameCn;

describe('M1.2a — canonical roster archetype normalization', () => {
  it('prefers the V4 canonical id over the legacy display-name column', () => {
    expect(resolveRosterArchetype('corgi', '开心柯基')).toBe('corgi');
    expect(resolveRosterArchetype(undefined, '开心柯基')).toBe('corgi');
    expect(resolveRosterArchetype('', '气氛组柯基')).toBe('corgi');
    expect(resolveRosterArchetype(undefined, '未知原型')).toBeUndefined();
  });

  it('counts primary-only and legacy-name members as the same archetype', () => {
    const context = buildArchetypeContext([
      { primaryArchetype: 'corgi' },
      { archetype: '开心柯基' },
    ]);
    expect(context.mixText).toBe(`${CORGI_NAME}×2`);
    expect(context.diversityScore).toBe(0.5);
  });

  it('normalizes both fields before run-plan composition counts', () => {
    expect(
      buildArchetypeMix([
        { primaryArchetype: 'corgi' },
        { archetype: '开心柯基' },
        { primaryArchetype: 'turtle', archetype: '慢热龟' },
      ]),
    ).toEqual({ corgi: 2, turtle: 1 });
  });
});

describe('M1.2a — shared-interest anchor selection', () => {
  it('collapses taxonomy synonyms into one canonical label with distinct-member coverage', () => {
    const anchors = buildSharedInterestAnchors([
      { interests: ['剧本杀'] },
      { interests: ['谋杀之谜'] },
      { interests: ['剧本杀', '谋杀之谜'] },
    ]);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toMatchObject({ label: '剧本杀', coverage: 3, macroCategory: 'play' });
  });

  it('de-prioritises generic politeness labels behind specific anchors', () => {
    const anchors = buildSharedInterestAnchors(
      [
        { interests: ['咖啡', '攀岩'] },
        { interests: ['咖啡', '攀岩'] },
        { interests: ['咖啡'] },
      ],
      { limit: 2 },
    );
    expect(anchors.map((anchor) => anchor.label)).toEqual(['攀岩', '咖啡']);
    expect(anchors[1].generic).toBe(true);
  });

  it('keeps the first pass category-diverse before filling by coverage', () => {
    const anchors = buildSharedInterestAnchors(
      [
        { interests: ['火锅', '咖啡', '攀岩'] },
        { interests: ['火锅', '咖啡', '攀岩'] },
        { interests: ['火锅', '咖啡'] },
      ],
      { limit: 2 },
    );
    expect(anchors.map((anchor) => anchor.label)).toEqual(['火锅', '攀岩']);
    expect(anchors.map((anchor) => anchor.macroCategory)).toEqual(['food', 'sports']);
  });
});

describe('M1.2a — whole-roster interests and profile gates', () => {
  it('keeps more than five declared labels so the deck layer can intersect the full set', () => {
    const labels = extractRosterInterestLabels(
      [
        { label: '旅行', heat: 1 },
        { label: '电影', heat: 2 },
        { label: '咖啡', heat: 3 },
        { label: '徒步', heat: 4 },
        { label: '看展', heat: 5 },
        { label: '剧本杀', heat: 6 },
      ],
      [{ label: '攀岩' }, { label: '露营' }],
    );
    expect(labels).toHaveLength(8);
    expect(labels.slice(0, 2)).toEqual(['攀岩', '露营']);
    expect(labels).toContain('剧本杀');
  });

  it('builds a profile for V4-only users and for any allowed profile field', () => {
    expect(hasParticipantProfileSignal({ primaryArchetype: 'corgi' })).toBe(true);
    expect(hasParticipantProfileSignal({ currentCity: '深圳' })).toBe(true);
    expect(hasParticipantProfileSignal({})).toBe(false);
  });
});

describe('M1.2a — XiaoYue comment prompt privacy', () => {
  it('uses aggregate archetype mix only and never forwards W3 profile fields', () => {
    const prompt = buildXiaoYueCommentPrompt({
      phase: 'warmup',
      event: 'phase_start',
      playerCount: 4,
      participants: [
        {
          archetype: 'corgi',
          primaryArchetype: 'corgi',
          // Runtime-only sentinels: these fields are not in the accepted type
          // and must never be rendered even if a caller leaks them.
          displayName: 'SecretName',
          profile: {
            industryLabel: 'SecretIndustry',
            age: 34,
            city: 'SecretCity',
            gender: 'SecretGender',
            educationLevel: 'SecretEducation',
            lifeStage: 'SecretStage',
            bio: 'SecretBio',
          },
        } as never,
      ],
    });

    expect(prompt).toContain('本桌构成');
    expect(prompt).toContain(CORGI_NAME);
    for (const leaked of [
      'SecretName',
      'SecretIndustry',
      'SecretCity',
      'SecretGender',
      'SecretEducation',
      'SecretStage',
      'SecretBio',
      '34岁',
    ]) {
      expect(prompt).not.toContain(leaked);
    }
  });

  it('bumps the prompt version because the prompt contract changed', () => {
    expect(XIAOYUE_COMMENT_PROMPT_VERSION).toBe('social-xiaoyue-comment-v3');
  });
});
