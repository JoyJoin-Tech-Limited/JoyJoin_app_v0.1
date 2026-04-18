import { View } from '@tarojs/components'
import type { BlindBoxVisualState } from './squadUnboxingViewModels'

export function BlindBoxVisual({
  state,
  shouldReduceMotion,
}: {
  state: BlindBoxVisualState
  shouldReduceMotion: boolean
}) {
  return (
    <View
      className={[
        'squad-unboxing__blind-box-visual',
        `squad-unboxing__blind-box-visual--${state}`,
        shouldReduceMotion ? 'squad-unboxing__blind-box-visual--reduced' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--left' />
      <View className='squad-unboxing__blind-box-aura squad-unboxing__blind-box-aura--right' />
      <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--1' />
      <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--2' />
      <View className='squad-unboxing__blind-box-spark squad-unboxing__blind-box-spark--3' />

      <View className='squad-unboxing__blind-box-lid'>
        <View className='squad-unboxing__blind-box-ribbon squad-unboxing__blind-box-ribbon--lid-vertical' />
        <View className='squad-unboxing__blind-box-ribbon squad-unboxing__blind-box-ribbon--lid-horizontal' />
        <View className='squad-unboxing__blind-box-knot' />
      </View>

      <View className='squad-unboxing__blind-box-body'>
        <View className='squad-unboxing__blind-box-inner-glow' />
        <View className='squad-unboxing__blind-box-ribbon squad-unboxing__blind-box-ribbon--body-vertical' />
        <View className='squad-unboxing__blind-box-ribbon squad-unboxing__blind-box-ribbon--body-horizontal' />
      </View>

      <View className='squad-unboxing__blind-box-shadow' />
    </View>
  )
}
