import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    exclude: [
      'node_modules',
      'dist',
      'src/pages/icebreaker-session/UndercoverWordPhaseView.tsx',
    ],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@tarojs/taro': path.resolve(__dirname, './__mocks__/taro.ts'),
    },
  },
  deps: {
    inline: [/@tarojs\/components/],
  },
})
