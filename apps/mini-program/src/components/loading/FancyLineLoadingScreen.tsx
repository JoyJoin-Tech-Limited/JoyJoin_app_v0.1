import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { View, Image } from '@tarojs/components'
import './FancyLineLoadingScreen.scss'

export type FancyLineLoadingScreenProps = {
  loop?: boolean
  onFinish?: () => void
  visible?: boolean
  /** Optional content below the logo (e.g. status line). */
  bottomContent?: ReactNode
}

/**
 * Full-screen JoyJoin logo loader (user-client FancyLineLoadingScreen equivalent).
 * Non-loop mode fades out after 1s and invokes onFinish (matches web timing).
 */
export function FancyLineLoadingScreen({
  loop = false,
  onFinish,
  visible = true,
  bottomContent,
}: FancyLineLoadingScreenProps) {
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (loop) {
      setDone(false)
      return
    }
    const t = setTimeout(() => {
      setDone(true)
      onFinish?.()
    }, 1000)
    return () => clearTimeout(t)
  }, [loop, onFinish])

  if (!visible) {
    return null
  }

  return (
    <View
      className={`fancy-line-loading-screen ${done ? 'fancy-line-loading-screen--fade-out' : ''}`}
      role='status'
      ariaLabel='加载中'
    >
      <View className='fancy-line-loading-screen__inner'>
        <Image
          className='fancy-line-loading-screen__logo'
          src='/assets/box-logo.webp'
          mode='aspectFit'
          ariaLabel='悦聚 JoyJoin'
        />
        {bottomContent ? (
          <View className='fancy-line-loading-screen__bottom'>{bottomContent}</View>
        ) : null}
      </View>
    </View>
  )
}
