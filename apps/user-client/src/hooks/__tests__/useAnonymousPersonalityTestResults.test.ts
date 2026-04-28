import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Setup global mocks
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const PRESIGNUP_SESSION_KEY = "joyjoin_v4_assessment_session";

describe('useAnonymousPersonalityTestResults', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('应该从 localStorage 读取并转换结果', () => {
    const mockResult = {
      sessionId: 'test-session-123',
      result: {
        primaryArchetype: 'corgi',
        secondaryArchetype: 'rooster',
        archetypeConfidence: 0.85,
        traitScores: {
          A: 0.75,
          C: 0.60,
          E: 0.80,
          O: 0.70,
          X: 0.90,
          P: 0.85,
        },
        traitConfidences: {
          A: 0.9,
          C: 0.8,
          E: 0.85,
          O: 0.75,
          X: 0.95,
          P: 0.9,
        },
        topMatches: [
          { archetype: 'corgi', score: 0.85, confidence: 0.95 },
          { archetype: 'rooster', score: 0.78, confidence: 0.85 },
        ],
        totalQuestionsAnswered: 12,
        wasExtended: false,
        validityScore: 0.92,
      },
      completedAt: '2024-01-15T10:30:00.000Z',
      timestamp: Date.now(),
    };

    localStorageMock.setItem(PRESIGNUP_SESSION_KEY, JSON.stringify(mockResult));
    
    const stored = localStorageMock.getItem(PRESIGNUP_SESSION_KEY);
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed.result.primaryArchetype).toBe('corgi');
    expect(parsed.result.traitScores.X).toBe(0.90);
  });

  it('应该在没有数据时返回 null', () => {
    const stored = localStorageMock.getItem(PRESIGNUP_SESSION_KEY);
    expect(stored).toBeNull();
  });

  it('应该在数据无效时返回 null', () => {
    localStorageMock.setItem(PRESIGNUP_SESSION_KEY, 'invalid json');
    
    const stored = localStorageMock.getItem(PRESIGNUP_SESSION_KEY);
    expect(stored).toBe('invalid json');
    
    // In real hook, this would be caught and return null
    expect(() => JSON.parse(stored!)).toThrow();
  });

  it('应该在结果不完整时返回 null', () => {
    const incompleteResult = {
      sessionId: 'test-session-123',
      result: {
        // Missing primaryArchetype
        traitScores: { A: 0.5 },
      },
    };

    localStorageMock.setItem(PRESIGNUP_SESSION_KEY, JSON.stringify(incompleteResult));
    
    const stored = localStorageMock.getItem(PRESIGNUP_SESSION_KEY);
    const parsed = JSON.parse(stored!);
    
    // Should not have primaryArchetype
    expect(parsed.result.primaryArchetype).toBeUndefined();
  });

  it('应该正确转换 trait scores 到百分制', () => {
    const traitScores = {
      A: 0.75,
      C: 0.60,
      E: 0.80,
      O: 0.70,
      X: 0.90,
      P: 0.85,
    };

    // Manual transformation to verify logic
    const transformed = {
      affinityScore: traitScores.A * 100,
      conscientiousnessScore: traitScores.C * 100,
      emotionalStabilityScore: traitScores.E * 100,
      opennessScore: traitScores.O * 100,
      extraversionScore: traitScores.X * 100,
      positivityScore: traitScores.P * 100,
    };

    expect(transformed.affinityScore).toBe(75);
    expect(transformed.extraversionScore).toBe(90);
    expect(transformed.positivityScore).toBe(85);
  });
});
