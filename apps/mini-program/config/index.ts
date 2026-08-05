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
/** Build-time flag to enable H5 screenshot story modes (dev/preview only). */
const MINI_PROGRAM_ENABLE_STORY_MODE =
  process.env.TARO_APP_ENABLE_STORY_MODE ?? ''
/** Avatar 3D QA page entry on my-image (dev/preview only; page itself stays registered). */
const MINI_PROGRAM_AVATAR_3D_QA =
  process.env.TARO_APP_AVATAR_3D_QA ??
  (process.env.NODE_ENV !== 'production' ? 'true' : '')
/** vConsole is only allowed in local development builds. Production, staging,
 *  and 体验版 builds must ship with vConsole disabled. */
const MINI_PROGRAM_VCONSOLE_ENABLED =
  process.env.TARO_APP_VCONSOLE_ENABLED === 'true' &&
  process.env.NODE_ENV !== 'production'

/** Inlined at build time — WeChat runtime has no `process` global. */
const PRODUCTION_CDN_BASE_URL = 'https://joyjoinapp.com/static'
const MINI_PROGRAM_CDN_BASE_URL =
  process.env.TARO_APP_CDN_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? PRODUCTION_CDN_BASE_URL : '')
const MINI_PROGRAM_TARO_ENV = process.env.TARO_ENV ?? 'weapp'
const MINI_PROGRAM_NODE_ENV = process.env.NODE_ENV ?? 'production'

if (MINI_PROGRAM_NODE_ENV === 'production' && !MINI_PROGRAM_CDN_BASE_URL) {
  throw new Error(
    '[mini-program build] TARO_APP_CDN_BASE_URL is required in production builds.\n' +
      '  Set it in apps/mini-program/.env.local or as an environment variable, then rebuild.\n' +
      '  Example: TARO_APP_CDN_BASE_URL=https://joyjoinapp.com/static',
  )
}

/**
 * WebGL avatar (three.js + avatar3d) chunk routing.
 *
 * The 3D spider avatar stack is only reachable from pages/profile-linked/*
 * (my-image + qa3d — verified by import-cone grep 2026-07-18). Taro's
 * vite-runner forces every node_modules module into the root `vendors` chunk
 * (main package), which pushed the main package over WeChat's 2 MB zip
 * ceiling. Routing the whole avatar3d import cone into a slash-named chunk
 * emits the file inside the profile-linked subpackage directory instead
 * (chunkFileNames stays '[name].js'). Subpackage → main-package requires are
 * allowed by WeChat; main → subpackage is forbidden, so nothing outside this
 * cone may import these modules — keep it that way when adding imports.
 */
const AVATAR_3D_CHUNK_NAME = 'pages/profile-linked/three-avatar'
// Mirrored from @tarojs/helper dist/constants.js (Taro 4.2) — inlined so this
// config does not rely on hoisted transitive deps.
const REG_TARO_SCOPED_PACKAGE = /@tarojs[\\/][a-z]+/
const REG_NODE_MODULES_DIR = /[\\/]node_modules[\\/]/gi

type ManualChunksModuleInfo = { importers?: string[] } | null

/**
 * Mirrors Taro's manualChunks (react branch of getManualChunks() in
 * @tarojs/vite-runner dist/mini/config.js) and prepends the avatar3d rules.
 * This fully replaces Taro's function: vite mergeConfig lets the later plugin
 * config win for function values, and mini.compiler.vitePlugins run after
 * Taro's internal config plugin (dist/index.mini.js pushes them last).
 */
function miniProgramManualChunks(
  id: string,
  api: { getModuleInfo: (moduleId: string) => ManualChunksModuleInfo },
): string | null | undefined {
  if (
    /node_modules[\\/]three[\\/]/.test(id) ||
    /[\\/]src[\\/]lib[\\/]profile[\\/]avatar3d[\\/]/.test(id) ||
    /[\\/]src[\\/]components[\\/]profile[\\/]PixelAvatar3D\.tsx$/.test(id)
  ) {
    return AVATAR_3D_CHUNK_NAME
  }
  REG_NODE_MODULES_DIR.lastIndex = 0
  if (/node_modules[\\/]@tarojs[\\/]vite-runner/.test(id)) return null
  if (/node_modules[\\/]@babel[\\/]/.test(id) || /commonjsHelpers\.js$/.test(id)) {
    return 'babelHelpers'
  }
  if (
    REG_TARO_SCOPED_PACKAGE.test(id) ||
    /node_modules[\\/](react-reconciler|react|scheduler|tslib)[\\/]/.test(id)
  ) {
    return 'taro'
  }
  if (REG_NODE_MODULES_DIR.test(id)) return 'vendors'
  const moduleInfo = api.getModuleInfo(id)
  if (moduleInfo?.importers?.length && moduleInfo.importers.length > 1) {
    return 'common'
  }
  return undefined
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
      'process.env.TARO_APP_ENABLE_STORY_MODE': JSON.stringify(
        MINI_PROGRAM_ENABLE_STORY_MODE,
      ),
      'process.env.TARO_APP_AVATAR_3D_QA': JSON.stringify(
        MINI_PROGRAM_AVATAR_3D_QA,
      ),
      'process.env.TARO_APP_VCONSOLE_ENABLED': JSON.stringify(
        MINI_PROGRAM_VCONSOLE_ENABLED ? 'true' : 'false',
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
        ...['index.js', 'index.json', 'index.wxml', 'index.wxss'].map((fileName) => ({
          from: `src/native-custom-tab-bar/${fileName}`,
          to: `dist/custom-tab-bar/${fileName}`,
        })),
        // Tab bar notch background image for native custom tab bar (~3KB, critical)
        {
          from: 'src/assets/tab-bar-notch-bg.png',
          to: 'dist/assets/tab-bar-notch-bg.png',
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
          to: 'dist/pages/icebreaker-session/assets/mood-icons',
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
        // Info labels — semantic inline labels (calendar, location, people, target).
        {
          from: 'src/assets/icons/info-labels',
          to: 'dist/assets/icons/info-labels',
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
        // NOTE: reaction, reveal, achievement, expression (rating-faces), and
        // flow-icons are CDN tiers (CDN_ICON_TIERS in
        // packages/shared/src/iconSystem/emojiToIconMap.ts, and direct cdnAsset()
        // usage for flow-icons).
        // Do NOT copy them into the main package — JoyJoinIcon / cdnAsset()
        // resolves them from the CDN at runtime.
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
        // Archetype head icons — tiny (~45KB total), used everywhere for avatars.
        {
          from: 'src/assets/icons/archetype',
          to: 'dist/assets/icons/archetype',
        },
        // Archetype grid icons — circular icons cropped from the 3×4 archetype
        // spritesheet (~43KB total), used for small seat/queue avatars.
        {
          from: 'src/assets/icons/archetype-grid',
          to: 'dist/assets/icons/archetype-grid',
        },
        // Empty state illustrations — shown when center-hub is empty (~12KB).
        {
          from: 'src/assets/empty-state',
          to: 'dist/assets/empty-state',
        },
        // Discover hero promo banner — now CDN-only to keep the main package
        // under the 2 MB ceiling. The asset is served from `/assets/promo/`
        // via cdnAsset(). Do NOT copy it into the package.
        // (source remains in src/assets/promo-local/ for the CDN upload pipeline).
        // Batch C ceremony heroes — 8 WebP files (~310KB total, q=70 600px).
        // Served from CDN; source stays in src/assets/ceremony for upload via
        // `npm run upload:cdn-assets`. Local copies are no longer bundled so
        // the main package stays under WeChat's 2MB ceiling.
        // PNG masters live in `assets-source/lovart/batch-c/` (not bundled).
        // Pool-registration ceremony heroes travel with the subpackage so
        // the main package stays under the 2 MB ceiling.
        {
          from: 'src/pages/pool-registration/assets',
          to: 'dist/pages/pool-registration/assets',
        },
        // The three Alang prototype placeholders are byte-identical. Bundle one
        // shared fallback in the main package because Discover/Profile can render
        // it before the Alang subpackage is loaded.
        {
          from: 'src/assets/lovart/alang-event-card-placeholder.webp',
          to: 'dist/assets/lovart/alang-event-card-placeholder.webp',
        },
        {
          from: 'src/assets/lovart/alang-found-scene-placeholder.webp',
          to: 'dist/assets/lovart/alang-found-scene-placeholder.webp',
        },
        {
          from: 'src/assets/lovart/alang-result-placeholder.webp',
          to: 'dist/assets/lovart/alang-result-placeholder.webp',
        },
        // Profile is a main-package tab and cannot read an Alang subpackage
        // candidate until that subpackage has already been downloaded.
        {
          from: 'src/assets/lovart/alang-result-candidate.webp',
          to: 'dist/assets/lovart/alang-result-candidate.webp',
        },
        // Formal Flash runtime PNGs live with the Alang subpackage. The WebP
        // masters stay beside them for source-quality/package-integrity checks.
        {
          from: 'src/pages/alang/assets/npcs',
          to: 'dist/pages/alang/assets/npcs',
        },
        {
          from: 'src/pages/alang/assets/ui',
          to: 'dist/pages/alang/assets/ui',
        },
        {
          from: 'src/pages/alang/assets/candidates',
          to: 'dist/pages/alang/assets/candidates',
        },
        // Discover is a main-package page, so its static entry artwork must
        // also live in the main package. Flash pages can reuse that path.
        {
          from: 'src/assets/illustrations/street-blind-box-entry.webp',
          to: 'dist/assets/illustrations/street-blind-box-entry.webp',
        },
        {
          from: 'src/assets/illustrations/street-blind-box-entry.png',
          to: 'dist/assets/illustrations/street-blind-box-entry.png',
        },
        {
          from: 'src/assets/illustrations/street-blind-box-onboarding-fullscreen-v7.jpg',
          to: 'dist/pages/alang/assets/onboarding/street-blind-box-onboarding-fullscreen-v7.jpg',
        },
        {
          from: 'src/pages/alang/assets/backgrounds/radar-paper-scene.jpg',
          to: 'dist/pages/alang/assets/backgrounds/radar-paper-scene.jpg',
        },
        {
          from: 'src/pages/alang/assets/backgrounds/task-paper-scene.jpg',
          to: 'dist/pages/alang/assets/backgrounds/task-paper-scene.jpg',
        },
        {
          from: 'src/pages/alang/assets/backgrounds/feedback-paper-scene.jpg',
          to: 'dist/pages/alang/assets/backgrounds/feedback-paper-scene.jpg',
        },
        {
          from: 'src/pages/alang/assets/flash-city-encounter.jpg',
          to: 'dist/pages/alang/assets/flash-city-encounter.jpg',
        },
        {
          from: 'src/pages/alang/assets/street-blind-box-icon.png',
          to: 'dist/pages/alang/assets/street-blind-box-icon.png',
        },
        // Matching-status puzzle prelude pieces — bundled inside that page's
        // subpackage (~130KB total) so they do not count against the 2MB main
        // package while still painting instantly if the CDN is slow.
        // Source PNG masters and the contact sheet live in
        // assets-source/lovart/puzzle/ (not bundled).
        {
          from: 'src/assets/lovart/puzzle/lovart-puzzle-piece-01-20260701-v1.webp',
          to: 'dist/pages/matching-status/assets/puzzle/lovart-puzzle-piece-01-20260701-v1.webp',
        },
        {
          from: 'src/assets/lovart/puzzle/lovart-puzzle-piece-02-20260701-v1.webp',
          to: 'dist/pages/matching-status/assets/puzzle/lovart-puzzle-piece-02-20260701-v1.webp',
        },
        {
          from: 'src/assets/lovart/puzzle/lovart-puzzle-piece-03-20260701-v1.webp',
          to: 'dist/pages/matching-status/assets/puzzle/lovart-puzzle-piece-03-20260701-v1.webp',
        },
        {
          from: 'src/assets/lovart/puzzle/lovart-puzzle-piece-04-20260701-v1.webp',
          to: 'dist/pages/matching-status/assets/puzzle/lovart-puzzle-piece-04-20260701-v1.webp',
        },
        {
          from: 'src/assets/lovart/puzzle/lovart-puzzle-piece-05-20260701-v1.webp',
          to: 'dist/pages/matching-status/assets/puzzle/lovart-puzzle-piece-05-20260701-v1.webp',
        },
        {
          from: 'src/assets/lovart/puzzle/lovart-puzzle-piece-06-20260701-v1.webp',
          to: 'dist/pages/matching-status/assets/puzzle/lovart-puzzle-piece-06-20260701-v1.webp',
        },
        // Squad-unboxing composed-hero fallback — bundled locally (~19KB) so the
        // ready-state Xiaoyue host never paints a blank skeleton when the CDN is
        // unreachable. The CDN-primary hero (squad-host-xiaoyue.webp) stays
        // CDN-only and is wiped by the clean:cdn-assets step.
        {
          from: 'src/assets/lovart/squad/squad-host-xiaoyue-fallback.webp',
          to: 'dist/assets/lovart/squad/squad-host-xiaoyue-fallback.webp',
        },
        // Xiaoyue mascot sprite sheets — bundled locally as CDN fallback.
        // Only the core states that appear during the first session are kept
        // in the main package; the rest are CDN-only to stay under the 2 MB
        // WeChat limit. XiaoyueSpriteAnimator always tries CDN first.
        {
          from: 'src/assets/mascot/xiaoyue-welcome.webp',
          to: 'dist/assets/mascot/xiaoyue-welcome.webp',
        },
        {
          from: 'src/assets/mascot/xiaoyue-idle.webp',
          to: 'dist/assets/mascot/xiaoyue-idle.webp',
        },
        {
          from: 'src/assets/mascot/xiaoyue-coach.webp',
          to: 'dist/assets/mascot/xiaoyue-coach.webp',
        },
        {
          from: 'src/assets/mascot/xiaoyue-loading.webp',
          to: 'dist/assets/mascot/xiaoyue-loading.webp',
        },
        {
          from: 'src/assets/mascot/xiaoyue-listening.webp',
          to: 'dist/assets/mascot/xiaoyue-listening.webp',
        },
        {
          from: 'src/assets/mascot/xiaoyue-thinking.webp',
          to: 'dist/assets/mascot/xiaoyue-thinking.webp',
        },
        {
          from: 'src/assets/mascot/xiaoyue-spritesheet-manifest.json',
          to: 'dist/assets/mascot/xiaoyue-spritesheet-manifest.json',
        },
        // Matching status heroes — referenced via cdnAsset(); local copies are
        // not bundled because cdnAsset() returns the CDN URL in production.
        // Batch D milestone badges — 9 WebP files (~330KB total, q=70 600px).
        // Served from CDN; source stays in src/assets/badges for upload via
        // `npm run upload:cdn-assets`. Local copies are no longer bundled so
        // the main package stays under WeChat's 2MB ceiling.
        // PNG masters live in `assets-source/lovart/batch-d/` (not bundled).
        // Customer service QR code — critical for support (~11KB).
        {
          from: 'src/assets/qr',
          to: 'dist/assets/qr',
        },
        // Xiaoyue expressions — loading + welcome are critical first-impression
        // assets. Coach-guide and the remaining expressions are CDN-only to stay
        // within package size limits.
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-loading-system.webp',
          to: 'dist/assets/xiaoyue-expressions/xiaoyue-loading-system.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp',
          to: 'dist/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp',
        },
        // UI icons — info labels across the app (~81KB).
        {
          from: 'src/assets/icons/ui',
          to: 'dist/assets/icons/ui',
        },
        // NOTE: coach-guide, match-waiting, event-detail-tip moved to CDN
        // to stay under 2MB package limit. Only home-welcome + loading-system
        // remain bundled locally as critical first-impression assets.

        // NOTE: Large assets remaining on CDN to stay under 2MB:
        //  - Archetype full-body images (~285KB)
        // NOTE: Large CDN-only assets remaining:
        //  - Icebreaker backgrounds (~450KB)
        //  - Celebration images (~770KB)
        //  - Xiaoyue expressions (other 18, ~1.1MB)
        //  - Miniscript heroes (~590KB)
        //  - Lovart rewards/rewards-shop/history (~114KB)
        //  - Personality emoji PNGs (already bundled above)
        // Keep the main package under 2MB by leaving these on CDN.
        // Run `npm run upload:cdn-assets` after updating CDN assets.
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      type: 'vite',
      vitePlugins: [{
        name: 'joyjoin-build',
        config() {
          return {
            build: {
              esbuild: {
                drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
              },
            },
          }
        },
      }],
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
        vitePlugins: [{
          name: 'joyjoin-mini-build',
          config() {
            return {
              build: {
                esbuild: {
                  drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
                },
                rollupOptions: {
                  output: {
                    // Keep the WebGL avatar stack out of the main package.
                    manualChunks: miniProgramManualChunks,
                  },
                },
              },
            }
          },
        }],
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
