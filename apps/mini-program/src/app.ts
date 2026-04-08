import { PropsWithChildren } from 'react'
import Taro, { useDidShow, useLaunch } from '@tarojs/taro'
import { logInfo } from './lib/logger'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    logInfo('JoyJoin Mini Program launched')
  })

  useDidShow(() => {
    const pendingOrder = wx.getStorageSync('pending_order')
    if (!pendingOrder || typeof pendingOrder !== 'string') {
      return
    }

    const pages = Taro.getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route ?? ''
    const isPaymentFlowRoute =
      currentRoute === 'pages/blind-box-payment/index' ||
      currentRoute === 'pages/payment-verification/index'

    if (!isPaymentFlowRoute) {
      Taro.navigateTo({
        url: '/pages/payment-verification/index',
      })
    }
  })

  return children
}

export default App
