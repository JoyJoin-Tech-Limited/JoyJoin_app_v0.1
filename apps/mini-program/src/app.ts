import { PropsWithChildren, createElement } from 'react'
import Taro, { useDidShow, useLaunch } from '@tarojs/taro'
import { logInfo } from './lib/logger'
import AuthProvider from './providers/AuthProvider'
import './app.scss'

const PAYMENT_PAGE_ROUTE = 'pages/blind-box-payment/index'
const VERIFICATION_PAGE_ROUTE = 'pages/payment-verification/index'

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
      currentRoute === PAYMENT_PAGE_ROUTE ||
      currentRoute === VERIFICATION_PAGE_ROUTE

    if (!isPaymentFlowRoute) {
      Taro.navigateTo({
        url: `/${VERIFICATION_PAGE_ROUTE}`,
      })
    }
  })

  return createElement(AuthProvider, null, children)
}

export default App
