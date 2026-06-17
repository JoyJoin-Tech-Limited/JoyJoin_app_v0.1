import type { UserConfigExport } from "@tarojs/cli"

export default {

  mini: {},
  h5: {
    router: {
      mode: 'hash',
    },
  }
} satisfies UserConfigExport<'vite'>
