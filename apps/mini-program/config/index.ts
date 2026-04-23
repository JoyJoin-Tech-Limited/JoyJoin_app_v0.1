import path from 'path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import { loadRepoRootEnvFile, resolveMiniProgramApiBaseUrl } from './apiBaseUrl'
import devConfig from './dev'
import prodConfig from './prod'
import { createPruneWeappDistPlugin } from './pruneWeappDist'

type MergeConfig = (...configs: UserConfigExport<'vite'>[]) => UserConfigExport<'vite'>

loadRepoRootEnvFile()

const MINI_PROGRAM_API_BASE_URL = resolveMiniProgramApiBaseUrl()
const SHOULD_PRUNE_WEAPP_DIST =
  process.env.TARO_ENV === 'weapp'
  || process.env.TARO_PLATFORM === 'weapp'
  || process.env.npm_lifecycle_event?.includes('weapp')
const MINI_PROGRAM_WECHAT_SUBSCRIBE_TMPL_IDS =
  process.env.TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS ?? ''
/** WP4: optional build-time flag to show "实时 vs 缓存" for group analysis (beta/preview only; off in normal prod). */
const MINI_PROGRAM_SHOW_GROUP_ANALYSIS_DEBUG =
  process.env.TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG ?? ''
const MINI_PROGRAM_VITE_PLUGINS = SHOULD_PRUNE_WEAPP_DIST
  ? [createPruneWeappDistPlugin(path.resolve(__dirname, '..', 'dist'))]
  : []

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
    },
    copy: {
      patterns: [
        {
          from: 'src/assets/box_logo_archetypes.png',
          to: 'dist/assets/box_logo_archetypes.png',
        },
        {
          from: 'src/assets/match.webp',
          to: 'dist/assets/match.webp',
        },
        {
          from: 'src/assets/dinner.webp',
          to: 'dist/assets/dinner.webp',
        },
        {
          from: 'src/assets/continue.webp',
          to: 'dist/assets/continue.webp',
        },
        {
          from: 'src/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf',
          to: 'dist/assets/fonts/Quicksand/Quicksand-VariableFont_wght.ttf',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp',
          to: 'dist/assets/personality/xiaoyue/xiaoyue-home-welcome.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-action-success.webp',
          to: 'dist/assets/personality/xiaoyue/xiaoyue-action-success.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-action-failure.webp',
          to: 'dist/assets/personality/xiaoyue/xiaoyue-action-failure.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-reminder-notice.webp',
          to: 'dist/assets/personality/xiaoyue/xiaoyue-reminder-notice.webp',
        },
        {
          from: 'src/assets/promo/*.webp',
          to: 'dist/assets/promo',
        },
        {
          from: 'src/assets/personality/archetypes/*.webp',
          to: 'dist/pages/onboarding/assets/personality/archetypes',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-home-welcome.webp',
          to: 'dist/pages/onboarding/assets/personality/xiaoyue/xiaoyue-home-welcome.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-match-waiting.webp',
          to: 'dist/pages/onboarding/assets/personality/xiaoyue/xiaoyue-match-waiting.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-match-success.webp',
          to: 'dist/pages/onboarding/assets/personality/xiaoyue/xiaoyue-match-success.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-thinking.webp',
          to: 'dist/pages/onboarding/assets/personality/xiaoyue/xiaoyue-thinking.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-cheer-encourage.webp',
          to: 'dist/pages/onboarding/assets/personality/xiaoyue/xiaoyue-cheer-encourage.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-thanks-feedback.webp',
          to: 'dist/pages/extras/assets/personality/xiaoyue/xiaoyue-thanks-feedback.webp',
        },
        {
          from: 'src/assets/empty-state/*.webp',
          to: 'dist/pages/experience/assets/empty-state',
        },
        {
          from: 'src/assets/matching/*.webp',
          to: 'dist/pages/experience/assets/matching',
        },
        {
          from: 'src/assets/qr/*.webp',
          to: 'dist/pages/experience/assets/qr',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-match-waiting.webp',
          to: 'dist/pages/experience/assets/personality/xiaoyue/xiaoyue-match-waiting.webp',
        },
        {
          from: 'src/assets/personality/xiaoyue/xiaoyue-cheer-encourage.webp',
          to: 'dist/pages/experience/assets/personality/xiaoyue/xiaoyue-cheer-encourage.webp',
        },
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
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      type: 'vite',
      vitePlugins: MINI_PROGRAM_VITE_PLUGINS
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
        vitePlugins: MINI_PROGRAM_VITE_PLUGINS
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
