import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
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
 *
 * If the wrapper is created with `isLoading=false` and has never seen a loading
 * state, it skips the transition entirely so the loading layer does not paint
 * before content (prevents the tab-switch flash when auth is already cached).
 */
export default function PageMorphWrapper({
  isLoading,
  loading,
  content,
  className = '',
}: PageMorphWrapperProps) {
  const hasEverLoadedRef = useRef(false)
  useEffect(() => {
    if (isLoading) {
      hasEverLoadedRef.current = true
    }
  }, [isLoading])
  const immediate = !isLoading && !hasEverLoadedRef.current

  const modifier = isLoading ? 'page-morph--loading' : 'page-morph--content'
  const immediateClass = immediate ? 'page-morph--immediate' : ''

  return (
    <View className={`page-morph ${modifier} ${immediateClass} ${className}`}>
      <View className='page-morph__layer page-morph__layer--loading'>
        {loading}
      </View>
      <View className='page-morph__layer page-morph__layer--content'>
        {content}
      </View>
    </View>
  )
}
