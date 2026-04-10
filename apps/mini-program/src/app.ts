import { PropsWithChildren } from 'react'
import Taro, { useDidShow, useLaunch } from '@tarojs/taro'
import { QueryClientProvider } from '@tanstack/react-query'
import { logInfo } from './lib/logger'
import { queryClient } from './lib/queryClient'
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default App
