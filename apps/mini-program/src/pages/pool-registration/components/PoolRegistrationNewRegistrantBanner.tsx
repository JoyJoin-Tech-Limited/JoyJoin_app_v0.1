import { View, Text } from '@tarojs/components'

interface PoolRegistrationNewRegistrantBannerProps {
  delta: number
  onClose: () => void
}

export default function PoolRegistrationNewRegistrantBanner({
  delta,
  onClose,
}: PoolRegistrationNewRegistrantBannerProps) {
  return (
    <View className='pool-reg__persona-banner'>
      <Text className='pool-reg__persona-banner-text'>最近又新增了 {delta} 位伙伴，画像已更新</Text>
      <View
        className='pool-reg__persona-banner-close'
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        hoverClass='pool-reg__persona-banner-close--active'
        aria-label='关闭提示'
      >
        <Text className='pool-reg__persona-banner-close-text'>×</Text>
      </View>
    </View>
  )
}
