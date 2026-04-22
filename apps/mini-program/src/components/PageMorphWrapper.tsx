import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import './PageMorphWrapper.scss'

export interface PageMorphWrapperProps {
  isLoading: boolean
  loading: ReactNode
  content: ReactNode
  className?: string
}

/**
 * PageMorphWrapper — cross-fades between a loading shell and content.
 *
 * Use this to avoid hard cuts when switching from loading to content states.
 * Both children are rendered simultaneously; opacity controls visibility.
 */
export default function PageMorphWrapper({
  isLoading,
  loading,
  content,
  className = '',
}: PageMorphWrapperProps) {
  const modifier = isLoading ? 'page-morph--loading' : 'page-morph--content'

  return (
    <View className={`page-morph ${modifier} ${className}`}>
      <View className='page-morph__layer page-morph__layer--loading'>
        {loading}
      </View>
      <View className='page-morph__layer page-morph__layer--content'>
        {content}
      </View>
    </View>
  )
}
