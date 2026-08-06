import { Image, Text, View } from '@tarojs/components'
import { useState } from 'react'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'

interface LoadingStageProps {
  phaseText?: string
}

export default function LoadingStage({ phaseText }: LoadingStageProps) {
  const [imgError, setImgError] = useState(false)
  const primarySrc = getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.completing)
  const fallbackSrc = getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.networkHolding)

  return (
    <View className='personality-results__centered-state' role='status' aria-live='polite' aria-busy='true'>
      {/* Full hero-card skeleton that matches the actual layout shape */}
      <View className='personality-results__hero-skeleton'>
        <View className='personality-results__hero-skeleton-left'>
          <View className='personality-results__hero-skeleton-eyebrow' />
          <View className='personality-results__hero-skeleton-title' />
          <View className='personality-results__hero-skeleton-name' />
          <View className='personality-results__hero-skeleton-summary' />
          <View className='personality-results__hero-skeleton-badge-row'>
            <View className='personality-results__hero-skeleton-badge' />
            <View className='personality-results__hero-skeleton-badge' />
          </View>
        </View>
        <View className='personality-results__hero-skeleton-art' />
        {/* Xiaoyue bubble row — mirrors the hero card's 悦仔 section */}
        <View className='personality-results__hero-skeleton-xiaoyue'>
          <View className='personality-results__hero-skeleton-xiaoyue-avatar' />
          <View className='personality-results__hero-skeleton-xiaoyue-bubble'>
            <View className='personality-results__hero-skeleton-line personality-results__hero-skeleton-line--short' />
            <View className='personality-results__hero-skeleton-line' />
            <View className='personality-results__hero-skeleton-line personality-results__hero-skeleton-line--wide' />
          </View>
        </View>
      </View>

      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={imgError ? fallbackSrc : primarySrc}
        onError={() => setImgError(true)}
      />
      {phaseText ? (
        <Text className='personality-results__network-copy'>{phaseText}</Text>
      ) : (
        <View className='personality-results__skeleton'>
          <View className='personality-results__skeleton-avatar' />
          <View className='personality-results__skeleton-title' />
          <View className='personality-results__skeleton-line personality-results__skeleton-line--short' />
        </View>
      )}
    </View>
  )
}
