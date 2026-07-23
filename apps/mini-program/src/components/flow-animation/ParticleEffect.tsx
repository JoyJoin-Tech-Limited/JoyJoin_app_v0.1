import { Text, View } from '@tarojs/components'

interface ParticleEffectProps {
  labels: readonly string[]
}

export default function ParticleEffect({ labels }: ParticleEffectProps) {
  return (
    <View className='flow-particles'>
      {labels.map((label, index) => (
        <View
          key={label}
          className={`flow-particles__item flow-particles__item--${(index % 5) + 1}`}
        >
          <View className='flow-particles__dot' />
          <Text className='flow-particles__label'>{label}</Text>
        </View>
      ))}
    </View>
  )
}
