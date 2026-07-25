import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const previewRoot = __dirname
const miniProgramRoot = path.resolve(previewRoot, '../..')
const brandLogoPath = path.resolve(miniProgramRoot, 'src/components/ui/BrandLogo.tsx')

export default defineConfig({
  root: previewRoot,
  publicDir: path.resolve(miniProgramRoot, 'src'),
  plugins: [
    {
      name: 'joyjoin-rpx-preview',
      enforce: 'pre',
      transform(source, id) {
        if (!id.endsWith('.scss')) return null
        return source.replace(/(-?\d+(?:\.\d+)?)rpx/g, (_, value) => `${Number(value) / 2}px`)
      },
    },
    react(),
  ],
  resolve: {
    alias: [
      { find: '@tarojs/components', replacement: path.resolve(previewRoot, 'taro-components.tsx') },
      { find: '@tarojs/taro', replacement: path.resolve(previewRoot, 'taro.ts') },
      { find: brandLogoPath, replacement: path.resolve(previewRoot, 'BrandLogo.tsx') },
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 4178,
    strictPort: true,
    fs: { allow: [miniProgramRoot] },
  },
})
