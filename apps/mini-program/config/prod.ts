import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: true,
    stats: false,
  },
  mini: {},
  h5: {
    /**
     * If you use webpack to build and want to analyze the bundle,
     * uncomment the code below:
     */
    // webpackChain (chain) {
    //   chain
    //     .plugin('analyzer')
    //     .use(require('webpack-bundle-analyzer').BundleAnalyzerPlugin, [])
    // }
  },
} satisfies UserConfigExport
