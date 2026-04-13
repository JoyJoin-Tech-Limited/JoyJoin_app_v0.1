import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

type PathModule = {
  resolve: (...paths: string[]) => string
}

declare const __dirname: string
declare const process: {
  env: Record<string, string | undefined>
}
declare function require(moduleName: string): unknown

const path = require('path') as PathModule

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge) => {
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
      'process.env.TARO_APP_API_BASE_URL': JSON.stringify(process.env.TARO_APP_API_BASE_URL || 'http://localhost:5000')
    },
    copy: {
      patterns: [
        {
          from: 'src/assets',
          to: 'dist/assets',
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
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
      '@shared': path.resolve(__dirname, '..', '..', '..', 'packages', 'shared', 'src'),
      '@tarojs/plugin-framework-react/dist/runtime': path.resolve(__dirname, '..', 'node_modules/@tarojs/plugin-framework-react/dist/runtime.js'),
    },
    sass: {
      resource: [
        path.resolve(__dirname, '..', 'src/styles/_variables.scss'),
        path.resolve(__dirname, '..', 'src/styles/_mixins.scss'),
      ],
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
