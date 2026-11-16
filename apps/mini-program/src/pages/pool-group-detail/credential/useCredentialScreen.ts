import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import {
  VENUE_DEAL_SCREEN_BRIGHTNESS_ONLY,
  VENUE_DEAL_SCREEN_KEEP_ON_ONLY,
  VENUE_DEAL_SCREEN_STATUS,
} from '@shared/copy/venueDealCopy'

export interface CredentialScreenApi {
  getScreenBrightness?: () => Promise<{ value: number }>
  setScreenBrightness?: (options: { value: number }) => Promise<unknown>
  setKeepScreenOn?: (options: { keepScreenOn: boolean }) => Promise<unknown>
}

export type CredentialScreenStatus = typeof VENUE_DEAL_SCREEN_STATUS
  | typeof VENUE_DEAL_SCREEN_KEEP_ON_ONLY
  | typeof VENUE_DEAL_SCREEN_BRIGHTNESS_ONLY
  | ''

/**
 * 出示页屏幕控制。只有真实成功的动作才进入状态文案；任何迟到回调都不能在
 * 页面已隐藏后重新提亮/常亮。恢复原亮度只发生在确实拿到有效原值时。
 */
export function createCredentialScreenController(
  api: CredentialScreenApi,
  onStatus: (status: CredentialScreenStatus) => void,
) {
  let active = false
  let destroyed = false
  let generation = 0
  let originalBrightness: number | null = null
  let brightened = false
  let keptOn = false

  const publish = () => {
    onStatus(
      brightened && keptOn
        ? VENUE_DEAL_SCREEN_STATUS
        : brightened
          ? VENUE_DEAL_SCREEN_BRIGHTNESS_ONLY
          : keptOn
            ? VENUE_DEAL_SCREEN_KEEP_ON_ONLY
            : '',
    )
  }

  const restoreBrightness = async (value: number | null) => {
    if (value === null || !api.setScreenBrightness) return
    try {
      await api.setScreenBrightness({ value })
    } catch {
      // fail-open：恢复失败不阻断退出
    }
  }

  const deactivate = () => {
    active = false
    generation += 1
    const shouldRestore = brightened
    const previous = originalBrightness
    brightened = false
    originalBrightness = null
    if (shouldRestore) void restoreBrightness(previous)
    if (keptOn && api.setKeepScreenOn) {
      keptOn = false
      try {
        void Promise.resolve(api.setKeepScreenOn({ keepScreenOn: false })).catch(() => {})
      } catch {
        // 同步异常同样 fail-open
      }
    } else {
      keptOn = false
    }
    publish()
  }

  const activate = async () => {
    if (destroyed || active) return
    active = true
    const ticket = ++generation
    originalBrightness = null

    if (api.getScreenBrightness && api.setScreenBrightness) {
      try {
        const result = await api.getScreenBrightness()
        const value = result?.value
        if (active && !destroyed && ticket === generation && typeof value === 'number' && value >= 0 && value <= 1) {
          originalBrightness = value
          try {
            await api.setScreenBrightness({ value: 0.9 })
            if (active && !destroyed && ticket === generation) {
              brightened = true
              publish()
            } else {
              // set 在隐藏后才完成：立即恢复，不让迟到回调留下高亮
              await restoreBrightness(originalBrightness)
            }
          } catch {
            // 提亮失败：不显示虚假状态
          }
        }
      } catch {
        // 读取失败：原亮度未知，绝不擅自恢复
      }
    }

    if (!active || destroyed || ticket !== generation) return
    if (api.setKeepScreenOn) {
      try {
        await api.setKeepScreenOn({ keepScreenOn: true })
        if (active && !destroyed && ticket === generation) {
          keptOn = true
          publish()
        } else {
          try {
            await api.setKeepScreenOn({ keepScreenOn: false })
          } catch {
            // fail-open
          }
        }
      } catch {
        // 常亮失败：不显示虚假状态
      }
    }
  }

  return {
    activate,
    deactivate,
    destroy: () => {
      deactivate()
      destroyed = true
    },
  }
}

export default function useCredentialScreen(enabled: boolean): CredentialScreenStatus {
  const [status, setStatus] = useState<CredentialScreenStatus>('')
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const visibleRef = useRef(false)
  const controllerRef = useRef<ReturnType<typeof createCredentialScreenController> | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = createCredentialScreenController(Taro as CredentialScreenApi, setStatus)
  }

  useDidShow(() => {
    visibleRef.current = true
    if (enabledRef.current) void controllerRef.current?.activate()
  })
  useDidHide(() => {
    visibleRef.current = false
    controllerRef.current?.deactivate()
  })

  // 首屏数据可能在 useDidShow 之后才变成可出示：enabled 上升沿也要启用。
  useEffect(() => {
    if (enabled && visibleRef.current) void controllerRef.current?.activate()
    if (!enabled) controllerRef.current?.deactivate()
  }, [enabled])

  useEffect(() => () => {
    controllerRef.current?.destroy()
  }, [])

  return status
}
