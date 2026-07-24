import { Image, View } from '@tarojs/components'
import { useState } from 'react'
import { localAsset } from '../../lib/utils/cdnAssets'
import './AvatarPlaceholder.scss'

interface AvatarPlaceholderProps {
  className?: string
}

const PRODUCT_PLACEHOLDER_IMAGE = localAsset('/assets/joyjoin-logo-tab.png')

export default function AvatarPlaceholder({ className = '' }: AvatarPlaceholderProps) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <View
      className={`avatar-placeholder ${className}`.trim()}
      role='img'
      aria-label='形象图片暂未加载'
    >
      {!imageFailed ? (
        <Image
          className='avatar-placeholder__image'
          src={PRODUCT_PLACEHOLDER_IMAGE}
          mode='aspectFit'
          lazyLoad={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View className='avatar-placeholder__empty' aria-hidden='true'>
          <View className='avatar-placeholder__spark avatar-placeholder__spark--large' />
          <View className='avatar-placeholder__spark avatar-placeholder__spark--small' />
        </View>
      )}
    </View>
  )
}
