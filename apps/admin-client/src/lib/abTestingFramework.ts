/**
 * A/B Testing Framework for Animation Optimization
 * 支持不同 Act 1 时长的 A/B 测试
 */

export type TestVariant = 'control' | 'variant_a' | 'variant_b';

export interface ABTestConfig {
  variant: TestVariant;
  act1Duration: number; // milliseconds
  act2Duration: number; // milliseconds
  act3Duration: number; // milliseconds
  totalDuration: number; // milliseconds
}

const AB_TEST_KEY = 'joyjoin_ab_test_variant';

/**
 * Get or assign A/B test variant for current user
 */
export const getOrAssignVariant = (): TestVariant => {
  // Check if already assigned
  const stored = localStorage.getItem(AB_TEST_KEY);
  if (stored && ['control', 'variant_a', 'variant_b'].includes(stored)) {
    return stored as TestVariant;
  }

  // Randomly assign new variant (33% each)
  const random = Math.random();
  const variant: TestVariant = 
    random < 0.33 ? 'control' :
    random < 0.66 ? 'variant_a' :
    'variant_b';

  localStorage.setItem(AB_TEST_KEY, variant);
  return variant;
};

/**
 * Get timing config for current test variant
 * 
 * Control: 1.2s (current optimized version)
 * Variant A: 1.0s (even faster - aggressive)
 * Variant B: 1.4s (slightly slower - give more build-up)
 */
export const getTimingConfig = (variant: TestVariant): ABTestConfig => {
  const configs: Record<TestVariant, ABTestConfig> = {
    control: {
      variant: 'control',
      act1Duration: 1200,  // 1.2s (current)
      act2Duration: 2000,  // 2s
      act3Duration: 2500,  // 2.5s
      totalDuration: 5700, // 5.7s total
    },
    variant_a: {
      variant: 'variant_a',
      act1Duration: 1000,  // 1.0s (faster)
      act2Duration: 2000,  // 2s
      act3Duration: 2500,  // 2.5s
      totalDuration: 5500, // 5.5s total
    },
    variant_b: {
      variant: 'variant_b',
      act1Duration: 1400,  // 1.4s (slower)
      act2Duration: 2000,  // 2s
      act3Duration: 2500,  // 2.5s
      totalDuration: 5900, // 5.9s total
    },
  };

  return configs[variant];
};

/**
 * Clear test variant (for testing purposes)
 */
export const clearTestVariant = () => {
  localStorage.removeItem(AB_TEST_KEY);
};
