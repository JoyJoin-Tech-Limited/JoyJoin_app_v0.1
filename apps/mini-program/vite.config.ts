import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2020'
  },
  esbuild: {
    target: 'es2020',
    supported: {
      bigint: true
    }
  }
})
