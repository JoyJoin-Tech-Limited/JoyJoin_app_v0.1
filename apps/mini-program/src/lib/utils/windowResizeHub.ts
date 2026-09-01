import Taro from '@tarojs/taro'

type WindowResizeListener = () => void

const listeners = new Set<WindowResizeListener>()
let nativeSubscribed = false

function emitWindowResize(): void {
  listeners.forEach((listener) => {
    try {
      listener()
    } catch {
      /* listener errors must not break sibling subscribers */
    }
  })
}

/**
 * subscribeWindowResize — single native `Taro.onWindowResize` subscription
 * fanned out to all app listeners.
 *
 * WeChat's runtime warns when many WindowInfoChanged listeners accumulate
 * ("possibly causing memory leak"), and hidden pages in the nav stack keep
 * their listeners registered. One shared native subscription keeps the
 * footprint at 1 regardless of how many components subscribe.
 */
export function subscribeWindowResize(listener: WindowResizeListener): () => void {
  listeners.add(listener)
  if (!nativeSubscribed && typeof Taro.onWindowResize === 'function') {
    Taro.onWindowResize(emitWindowResize)
    nativeSubscribed = true
  }
  return () => {
    listeners.delete(listener)
  }
}
