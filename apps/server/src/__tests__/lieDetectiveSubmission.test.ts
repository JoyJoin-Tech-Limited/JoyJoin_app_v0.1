import { describe, expect, it } from 'vitest';
import {
  buildCustomLieDetectiveStatements,
  resolveLieDetectiveTargetUserId,
} from '../lib/lieDetectiveSubmission';

describe('lieDetectiveSubmission', () => {
  const botPersonas = [
    { botId: 'bot-1', userId: 'bot-user-1' },
    { botId: 'bot-2', userId: 'bot-user-2' },
  ];

  it('resolves a client-visible bot id to the server-owned user id', () => {
    expect(resolveLieDetectiveTargetUserId('bot-2', botPersonas)).toBe('bot-user-2');
  });

  it('leaves normal participant ids unchanged', () => {
    expect(resolveLieDetectiveTargetUserId('human-user', botPersonas)).toBe('human-user');
  });

  it('builds exactly two facts and one lie using canonical 1-based indexes', () => {
    expect(
      buildCustomLieDetectiveStatements(
        ['我养过一只猫', '我在三个城市生活过', '我从来没有坐过飞机'],
        3,
      ),
    ).toEqual([
      { index: 1, text: '我养过一只猫', isLie: false },
      { index: 2, text: '我在三个城市生活过', isLie: false },
      { index: 3, text: '我从来没有坐过飞机', isLie: true },
    ]);
  });

  it.each([
    { statements: ['一句', '二句'], lieIndex: 1 },
    { statements: ['重复内容', '重复内容', '另一句'], lieIndex: 1 },
    { statements: ['第一句', '第二句', '第三句'], lieIndex: 0 },
    { statements: ['第一句', '第二句', '第三句'], lieIndex: 4 },
    { statements: ['第一句', '第二句', ''], lieIndex: 2 },
  ])('rejects invalid custom sets: %o', ({ statements, lieIndex }) => {
    expect(() => buildCustomLieDetectiveStatements(statements, lieIndex)).toThrow();
  });
});
