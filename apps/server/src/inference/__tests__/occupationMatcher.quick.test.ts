import { describe, it, expect } from 'vitest';
import { matchOccupation } from '../occupationMatcher';

describe('occupationMatcher - Quick Test', () => {
  it('should test current behavior for 投资', () => {
    const result = matchOccupation('投资');
    console.log('投资 result:', result);
    expect(result).toBeDefined();
  });

  it('should test current behavior for PE', () => {
    const result = matchOccupation('PE');
    console.log('PE result:', result);
    expect(result).toBeDefined();
  });

  it('should test current behavior for VC', () => {
    const result = matchOccupation('VC');
    console.log('VC result:', result);
    expect(result).toBeDefined();
  });

  it('should test current behavior for 后端工程师', () => {
    const result = matchOccupation('后端工程师');
    console.log('后端工程师 result:', result);
    expect(result).toBeDefined();
  });
});
