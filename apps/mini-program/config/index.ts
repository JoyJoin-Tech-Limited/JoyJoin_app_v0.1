import path from 'path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import { loadRepoRootEnvFile, resolveMiniProgramApiBaseUrl } from './apiBaseUrl'
import devConfig from './dev'
import prodConfig from './prod'

type MergeConfig = (...configs: UserConfigExport<'vite'>[]) => UserConfigExport<'vite'>

loadRepoRootEnvFile()

const MINI_PROGRAM_API_BASE_URL = resolveMiniProgramApiBaseUrl()
if (MINI_PROGRAM_API_BASE_URL.includes('yuejuapp.com')) {
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
        {
          from: 'src/assets',
          to: 'dist/assets',

        },
        // Archetype PNG fallbacks for canvas drawImage live in the onboarding
        // subpackage to keep them out of the main package.
        {
          from: 'src/pages/onboarding/assets',
          to: 'dist/pages/onboarding/assets',
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
