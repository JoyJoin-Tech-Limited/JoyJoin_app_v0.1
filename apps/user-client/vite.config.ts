import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — loaded on every page
          'react-vendor': ['react', 'react-dom'],
          // Data-fetching layer — used by critical-path pages
          'query': ['@tanstack/react-query'],
          // Radix UI primitives — used across onboarding and main app
          'ui-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-toast',
          ],
          // framer-motion is used on critical-path pages (PersonalityTest, Discover)
          // so it stays in its own chunk loaded with the initial bundle rather than
          // being inlined into the entry chunk.
          'motion': ['framer-motion'],
          // recharts and lottie are only used on secondary (lazy-loaded) pages;
          // keeping them in separate chunks prevents them from appearing in the
          // entry bundle even when a lazy page is eventually loaded.
          'charts': ['recharts'],
          'lottie': ['lottie-react'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 5001,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://0.0.0.0:5000',
        changeOrigin: true,
      },
    },
  },
});
