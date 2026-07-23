import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import { haptics } from '../../lib/utils/haptics'
import FlowScene from './FlowScene'
import './index.scss'

export interface ProductFlowScene {
  id: string
  kicker: string
  title: string
  copy: string
  visual: ReactNode
  durationMs?: number
}

interface BaseFlowProps {
  ariaLabel: string
  scenes: readonly ProductFlowScene[]
  onFinish: (reason: 'completed' | 'skipped') => void
}

export default function BaseFlow({ ariaLabel, scenes, onFinish }: BaseFlowProps) {
  const [sceneIndex, setSceneIndex] = useState(0)
  const finishedRef = useRef(false)

  const finish = useCallback((reason: 'completed' | 'skipped') => {
    if (finishedRef.current) return
    finishedRef.current = true
    haptics(reason === 'completed' ? 'success' : 'light')
    onFinish(reason)
  }, [onFinish])

  useEffect(() => {
    const current = scenes[sceneIndex]
    if (!current) {
      finish('completed')
      return
    }

    const timer = setTimeout(() => {
      if (sceneIndex >= scenes.length - 1) {
        finish('completed')
      } else {
        setSceneIndex((index) => index + 1)
      }
    }, current.durationMs ?? 2800)

    return () => clearTimeout(timer)
  }, [finish, sceneIndex, scenes])

  const progress = scenes.length > 0 ? ((sceneIndex + 1) / scenes.length) * 100 : 100
  const currentScene = scenes[sceneIndex]

  return (
    <View className='product-flow' ariaLabel={ariaLabel}>
      <View className='product-flow__ambient product-flow__ambient--one' />
      <View className='product-flow__ambient product-flow__ambient--two' />

      <View className='product-flow__topbar'>
        <Text className='product-flow__brand'>JoyJoin</Text>
        <Button
          className='product-flow__skip'
          hoverClass='product-flow__skip--pressed'
          onClick={() => finish('skipped')}
          ariaLabel='跳过玩法介绍'
        >
          跳过
        </Button>
      </View>

      <View className='product-flow__stage'>
        {currentScene ? (
          <FlowScene
            key={currentScene.id}
            kicker={currentScene.kicker}
            title={currentScene.title}
            copy={currentScene.copy}
            active
          >
            {currentScene.visual}
          </FlowScene>
        ) : null}
      </View>

      <View className='product-flow__footer'>
        <View className='product-flow__progress'>
          <View className='product-flow__progress-fill' style={{ transform: `scaleX(${progress / 100})` }} />
        </View>
        <Text className='product-flow__count'>
          {String(sceneIndex + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}
        </Text>
      </View>
    </View>
  )
}
