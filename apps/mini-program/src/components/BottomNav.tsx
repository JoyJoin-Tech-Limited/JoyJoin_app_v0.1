import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './BottomNav.scss'

const ITEMS = [
  { label: '发现', url: '/pages/discover/index' },
  { label: '活动', url: '/pages/events/index' },
  { label: '连接', url: '/pages/connections/index' },
  { label: '我的', url: '/pages/profile/index' },
] as const

/**
 * Compatibility shim for the web BottomNav.
 *
 * The native mini-program `tabBar` is the primary navigation for tab pages.
 * This component intentionally renders nothing by default on tab pages, but it
 * can be mounted on sub-pages to provide a lightweight fallback shortcut bar.
 */
export default function BottomNav({ enableFallback = false }: { enableFallback?: boolean }) {
  const currentRoute = Taro.getCurrentPages().slice(-1)[0]?.route ?? ''
  const isTabRoute = ITEMS.some((item) => item.url.replace(/^\//, '') === currentRoute)

  if (!enableFallback || isTabRoute) {
    return null
  }

  return (
    <View className='bottom-nav'>
      {ITEMS.map((item) => {
        const isActive = currentRoute === item.url.replace(/^\//, '')
        return (
          <View
            key={item.url}
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            onClick={() => Taro.switchTab({ url: item.url })}
          >
            <Text className='bottom-nav__label'>{item.label}</Text>
          </View>
        )
      })}
    </View>
  )
}
