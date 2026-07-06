import { View, Image } from '@tarojs/components'
import { useState, useCallback } from 'react'
import type { BlindBoxVisualState } from './squadUnboxingViewModels'
import { BLIND_BOX_LID_ASSET, BLIND_BOX_ALT } from '../../lib/mascot/blindBoxAssets'

export function BlindBoxLid({
  state,
}: {
  state: BlindBoxVisualState
}) {
  const [hasError, setHasError] = useState(false)
  const handleError = useCallback(() => setHasError(true), [])

  const isOpening = state === 'opening'
  const isOpen = state === 'open'

  return (
    <View
      className={[
        'squad-unboxing__blind-box-lid',
        `squad-unboxing__blind-box-lid--${state}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasError ? (
        <View className='squad-unboxing__blind-box-lid-fallback' />
      ) : (
        <Image
          className='squad-unboxing__blind-box-lid-img'
          mode='aspectFit'
          src={BLIND_BOX_LID_ASSET}
          ariaLabel={BLIND_BOX_ALT.lid}
          lazyLoad={false}
          onError={handleError}
        />
      )}
    </View>
  )
}
