import { describe, it, expect } from 'vitest';
import { buildArchetypeContext } from '../lib/contextInjector';

describe('buildArchetypeContext', () => {
  it('returns empty context for empty roster', () => {
    const result = buildArchetypeContext([]);
    expect(result.mixText).toBe('');
    expect(result.dominantArchetype).toBeUndefined();
    expect(result.diversityScore).toBe(0);
  });

  it('formats a single archetype repeated', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: 'corgi' },
      { archetype: 'corgi' },
    ];
    const result = buildArchetypeContext(roster);
    expect(result.mixText).toBe('气氛组柯基×3');
    expect(result.dominantArchetype).toBe('气氛组柯基');
    expect(result.diversityScore).toBeCloseTo(1 / 3, 5);
  });

  it('formats all different archetypes', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: 'rooster' },
      { archetype: 'fox' },
      { archetype: 'cat' },
    ];
    const result = buildArchetypeContext(roster);
    expect(result.mixText).toBe('气氛组柯基、情绪稳定鸡、探宝雷达狐、静音模式猫');
    expect(result.dominantArchetype).toBeUndefined(); // 4-way tie
    expect(result.diversityScore).toBe(1.0);
  });

  it('handles mixed counts correctly', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: 'corgi' },
      { archetype: 'rooster' },
      { archetype: 'fox' },
    ];
    const result = buildArchetypeContext(roster);
    expect(result.mixText).toBe('气氛组柯基×2、情绪稳定鸡、探宝雷达狐');
    expect(result.dominantArchetype).toBe('气氛组柯基');
    expect(result.diversityScore).toBeCloseTo(3 / 4, 5);
  });

  it('returns undefined dominantArchetype on a tie', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: 'corgi' },
      { archetype: 'rooster' },
      { archetype: 'rooster' },
    ];
    const result = buildArchetypeContext(roster);
    expect(result.mixText).toBe('气氛组柯基×2、情绪稳定鸡×2');
    expect(result.dominantArchetype).toBeUndefined();
    expect(result.diversityScore).toBeCloseTo(2 / 4, 5);
  });

  it('skips entries without archetype', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: undefined },
      { archetype: 'corgi' },
    ];
    const result = buildArchetypeContext(roster);
    expect(result.mixText).toBe('气氛组柯基×2');
    expect(result.dominantArchetype).toBe('气氛组柯基');
    expect(result.diversityScore).toBeCloseTo(1 / 3, 5);
  });

  it('caps diversityScore at 1.0', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: 'rooster' },
    ];
    const result = buildArchetypeContext(roster);
    expect(result.diversityScore).toBe(1.0);
  });

  it('uses canonical Chinese names for all 12 archetypes', () => {
    const roster = [
      { archetype: 'corgi' },
      { archetype: 'rooster' },
      { archetype: 'hamster_praise' },
      { archetype: 'fox' },
      { archetype: 'dolphin_calm' },
      { archetype: 'spider' },
      { archetype: 'koala' },
      { archetype: 'octopus' },
      { archetype: 'owl' },
      { archetype: 'elephant' },
      { archetype: 'turtle' },
      { archetype: 'cat' },
    ];
    const result = buildArchetypeContext(roster);
    const expected =
      '气氛组柯基、情绪稳定鸡、捧场王仓鼠、探宝雷达狐、读空气海豚、社交裁缝蛛、情绪树洞考拉、脑洞喷泉章鱼、追问猫头鹰、定海神针大象、慢半拍龟、静音模式猫';
    expect(result.mixText).toBe(expected);
    expect(result.dominantArchetype).toBeUndefined();
    expect(result.diversityScore).toBe(1.0);
  });
});
