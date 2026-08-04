import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 15000,
    hookTimeout: 120000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    env: {
      RUN_PLAN_TEMPLATES_ENABLED: 'false',
      // Tier-1 msgSecCheck stays off in unit tests (no network); the wrapper's
      // own tests mock featureFlags and wechatMsgSecCheck directly.
      CONTENT_MODERATION_MSGSECCHECK_ENABLED: 'false',
    },
  },
});
