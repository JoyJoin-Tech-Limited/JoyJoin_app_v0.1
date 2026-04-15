import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import LoadingScreen from '../../components/LoadingScreen'
import Button from '../../components/Button'
import BottomNav from '../../components/BottomNav'
import './index.scss'

const BODY = '去看看为你准备的活动\n也许下一次连接就从这里开始'

export default function CenterTabEmptyPage() {
  const { isLoading: authLoading } = useAuthGuard()

  if (authLoading) {
    return <LoadingScreen message='加载中…' />
  }

  return (
    <View className='center-tab-empty'>
      <View className='center-tab-empty__content'>
        <View className='center-tab-empty__art'>
          <Image
            className='center-tab-empty__art-bg'
            src='/assets/empty-state/center-empty-bg.png'
            mode='aspectFill'
          />
          <Image
            className='center-tab-empty__art-illustration'
            src='/assets/empty-state/center-empty-illustration.png'
            mode='aspectFit'
          />
        </View>

        <Text className='center-tab-empty__title'>你还没参加任何活动</Text>
        <Text className='center-tab-empty__body'>{BODY}</Text>

        <Button
          className='center-tab-empty__cta'
          onClick={() => Taro.switchTab({ url: '/pages/discover/index' })}
        >
          去发现活动
        </Button>
      </View>

      <BottomNav enableFallback />
    </View>
  )
}