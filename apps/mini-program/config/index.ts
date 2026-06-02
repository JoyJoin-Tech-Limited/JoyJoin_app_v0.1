import path from 'path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import { loadRepoRootEnvFile, loadMiniProgramEnvFile, resolveMiniProgramApiBaseUrl } from './apiBaseUrl'
import devConfig from './dev'
import prodConfig from './prod'

type MergeConfig = (...configs: UserConfigExport<'vite'>[]) => UserConfigExport<'vite'>

loadRepoRootEnvFile()
loadMiniProgramEnvFile()

const MINI_PROGRAM_API_BASE_URL = resolveMiniProgramApiBaseUrl()
if (MINI_PROGRAM_API_BASE_URL.includes('joyjoinapp.com')) {
  // eslint-disable-next-line no-console
  console.warn(
    `\n[mini-program] API base URL is ${MINI_PROGRAM_API_BASE_URL}. That domain often times out in production.\n` +
      '  Set TARO_APP_API_BASE_URL=https://api.joyjoinapp.com in repo-root .env, or clear/update API_URL / APP_URL\n' +
      '  (see resolveMiniProgramApiBaseUrl in config/apiBaseUrl.ts), then rebuild: npm run build:weapp --workspace=mini-program\n',
  )
}
const MINI_PROGRAM_WECHAT_SUBSCRIBE_TMPL_IDS =
  process.env.TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS ?? ''
/** WP4: optional build-time flag to show "实时 vs 缓存" for group analysis (beta/preview only; off in normal prod). */
const MINI_PROGRAM_SHOW_GROUP_ANALYSIS_DEBUG =
  process.env.TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG ?? ''
/** Xiaoyue connection reactions feature flag (default OFF). */
const MINI_PROGRAM_XIAOYUE_CONNECTION_REACTIONS_ENABLED =
  process.env.TARO_APP_XIAOYUE_CONNECTION_REACTIONS_ENABLED ??
  process.env.XIAOYUE_CONNECTION_REACTIONS_ENABLED ??
  ''

/** Inlined at build time — WeChat runtime has no `process` global. */
const MINI_PROGRAM_CDN_BASE_URL = process.env.TARO_APP_CDN_BASE_URL ?? ''
const MINI_PROGRAM_TARO_ENV = process.env.TARO_ENV ?? 'weapp'
const MINI_PROGRAM_NODE_ENV = process.env.NODE_ENV ?? 'production'

if (MINI_PROGRAM_NODE_ENV === 'production' && !MINI_PROGRAM_CDN_BASE_URL) {
  throw new Error(
    '[mini-program build] TARO_APP_CDN_BASE_URL is required in production builds.\n' +
      '  Set it in apps/mini-program/.env.local or as an environment variable, then rebuild.\n' +
      '  Example: TARO_APP_CDN_BASE_URL=https://joyjoinapp.com/static',
  )
}

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge: MergeConfig) => {
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'mini-program',
    date: '2026-3-4',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [
      "@tarojs/plugin-generator"
    ],
    defineConstants: {
      'process.env.TARO_APP_API_BASE_URL': JSON.stringify(MINI_PROGRAM_API_BASE_URL),
      'process.env.TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS': JSON.stringify(
        MINI_PROGRAM_WECHAT_SUBSCRIBE_TMPL_IDS,
      ),
      'process.env.TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG': JSON.stringify(
        MINI_PROGRAM_SHOW_GROUP_ANALYSIS_DEBUG,
      ),
      'process.env.TARO_APP_XIAOYUE_CONNECTION_REACTIONS_ENABLED': JSON.stringify(
        MINI_PROGRAM_XIAOYUE_CONNECTION_REACTIONS_ENABLED,
      ),
      'process.env.TARO_APP_CDN_BASE_URL': JSON.stringify(MINI_PROGRAM_CDN_BASE_URL),
      'process.env.TARO_ENV': JSON.stringify(MINI_PROGRAM_TARO_ENV),
      'process.env.NODE_ENV': JSON.stringify(MINI_PROGRAM_NODE_ENV),
    },
    copy: {
      patterns: [
        // Tab bar icons — stay in main package (~60KB)
        {
          from: 'src/assets/tab-icons',
          to: 'dist/assets/tab-icons',
        },
        // Taro Vite runner does not auto-compile custom-tab-bar.
        // We ship it as a pre-built native WeChat component instead.
        {
          from: 'src/native-custom-tab-bar/',
          to: 'dist/custom-tab-bar/',
        },
        // Tab bar notch background image for native custom tab bar (~3KB, critical)
        {
          from: 'src/assets/tab-bar-notch-bg.png',
          to: 'dist/assets/tab-bar-notch-bg.png',
        },
        // JoyJoin logo for native custom tab bar center button (~94KB, critical)
        {
          from: 'src/assets/joyjoin-logo.webp',
          to: 'dist/assets/joyjoin-logo.webp',
        },
        // Tab bar center logo — smaller 128×128 variant for custom tab bar (~18KB).
        {
          from: 'src/assets/joyjoin-logo-tab.png',
          to: 'dist/assets/joyjoin-logo-tab.png',
        },
        // Archetype result images — spritesheet used locally in onboarding subpackage.
        // Individual archetype images loaded via CDN (cdnAsset).
        // PNG moved to CDN (2026-05-22); canvas draws WebP primary with CDN PNG fallback.
        {
          from: 'src/pages/onboarding/assets/archetypes',
          to: 'dist/pages/onboarding/assets/archetypes',
        },
        // Mood icons — bundled locally (~16KB total).
        {
          from: 'src/assets/icons/mood-icons',
          to: 'dist/assets/icons/mood-icons',
        },
        // Chemistry badges — matching status indicators (~16KB total).
        {
          from: 'src/assets/icons/chemistry-badges',
          to: 'dist/assets/icons/chemistry-badges',
        },
        // Status icons — misc UI states (~8KB total).
        {
          from: 'src/assets/icons/status-icons',
          to: 'dist/assets/icons/status-icons',
        },
        // Category icons — interest category labels in onboarding (~13KB @1x / ~38KB all).
        {
          from: 'src/assets/icons/category-icons',
          to: 'dist/assets/icons/category-icons',
        },
        // Intent icons — social intent selectors in onboarding (~17KB @1x / ~48KB all).
        {
          from: 'src/assets/icons/intent-icons',
          to: 'dist/assets/icons/intent-icons',
        },
        // Reaction icons — icebreaker phase reactions (~11KB @1x / ~38KB all).
        {
          from: 'src/assets/icons/reaction-icons',
          to: 'dist/assets/icons/reaction-icons',
        },
        // Reveal icons — matching common ground reveals (~17KB @1x / ~62KB all).
        {
          from: 'src/assets/icons/reveal-icons',
          to: 'dist/assets/icons/reveal-icons',
        },
        // Achievement badges — personality test milestones (~14KB @1x / ~51KB all).
        {
          from: 'src/assets/icons/achievement-badges',
          to: 'dist/assets/icons/achievement-badges',
        },
        // Quicksand English brand font (~124KB).
        {
          from: 'src/assets/fonts/Quicksand',
          to: 'dist/assets/fonts/Quicksand',
        },
        // Alimama minimal subset — landing + onboarding instant display (~66KB).
        // Full font (621KB) loads from CDN in background.
        {
          from: 'src/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2',
          to: 'dist/assets/fonts/Alimama/AlimamaFangYuanTiVF-Thin-minimal.woff2',
        },
        // Landing page phase icons — bundled locally (bypasses CDN reliability
        // issues on some WeChat clients). Only the 6 icons shown on landing;
        // all other phase icons remain on CDN.
        {
          from: 'src/assets/icons/phase-icons/phase-topic-card.webp',
          to: 'dist/assets/landing-phase-icons/phase-topic-card.webp',
        },
        {
          from: 'src/assets/icons/phase-icons/phase-lie-detective.webp',
          to: 'dist/assets/landing-phase-icons/phase-lie-detective.webp',
        },
        {
          from: 'src/assets/icons/phase-icons/phase-personality-dice.webp',
          to: 'dist/assets/landing-phase-icons/phase-personality-dice.webp',
        },
        {
          from: 'src/assets/icons/phase-icons/phase-auction.webp',
          to: 'dist/assets/landing-phase-icons/phase-auction.webp',
        },
        {
          from: 'src/assets/icons/phase-icons/phase-mini-script.webp',
          to: 'dist/assets/landing-phase-icons/phase-mini-script.webp',
        },
        {
          from: 'src/assets/icons/phase-icons/phase-quip-battle.webp',
          to: 'dist/assets/landing-phase-icons/phase-quip-battle.webp',
        },
        // Archetype head icons — tiny (~45KB total), used everywhere for avatars.
        {
          from: 'src/assets/icons/archetype',
          to: 'dist/assets/icons/archetype',
        },
        // Empty state illustrations — shown when center-hub is empty (~12KB).
        {
          from: 'src/assets/empty-state',
          to: 'dist/assets/empty-state',
        },
        // Auction phase coin icons — tiny game UI elements (~23KB).
        // Copied to a dedicated directory so the clean step doesn't remove them
        // (the clean step wipes the entire lovart/ tree for CDN assets).
        {
          from: 'src/assets/lovart/icebreaker/icons/icon-coin-single.png',
          to: 'dist/assets/auction-icons/icon-coin-single.png',
        },
        {
          from: 'src/assets/lovart/icebreaker/icons/icon-coin-stack.png',
          to: 'dist/assets/auction-icons/icon-coin-stack.png',
        },
        {
          from: 'src/assets/lovart/icebreaker/icons/icon-coin-empty.png',
          to: 'dist/assets/auction-icons/icon-coin-empty.png',
        },
        // Customer service QR code — critical for support (~11KB).
        {
          from: 'src/assets/qr',
          to: 'dist/assets/qr',
        },
        // Xiaoyue expressions — loading + welcome are critical first-impression assets.
        // Copied to a dedicated directory so the clean step doesn't remove them
        // (the clean step wipes the entire personality/ tree for CDN assets).
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-loading-system.webp',
          to: 'dist/assets/xiaoyue-expressions/xiaoyue-loading-system.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp',
          to: 'dist/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp',
        },
        // NOTE: All other phase icons, lovart backgrounds, celebration images,
        // matching heroes, promo banners, and remaining mascot images stay on CDN
        // to keep the main package under 2MB. Use routePreloadAssets.ts for smart
        // background loading. Run `npm run upload:cdn-assets` after updating CDN assets.
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      type: 'vite',
      vitePlugins: []
    },
    build: {
      target: 'es2020'
    },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
      '@shared': path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src'),
      '@tarojs/plugin-framework-react/dist/runtime': path.resolve(__dirname, '..', 'node_modules/@tarojs/plugin-framework-react/dist/runtime.js'),
    },
    mini: {
      imageUrlLoaderOption: {
        limit: 0, // 强制禁止将任何图片转为 Base64，全部使用真实路径
        esModule: false // 确保 Taro 正确处理图片路径
      },
      compiler: {
        type: 'vite',
        vitePlugins: []
      },
      postcss: {
        pxtransform: {
          enable: true,
          config: {

          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }


  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
