import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import Button from '../../../components/ui/Button'
import { getMascotDisplayName } from '../../../lib/mascot/mascotDisplay'
import { apiRequest } from '../../../lib/api/api'
import { logError } from '../../../lib/utils/logger'
import { haptics } from '../../../lib/utils/haptics'

// Shared row layout for the single action row (exactly one renders per role
// state — see the mutually exclusive conditionals in the JSX below).
const actionRowStyle = {
  display: 'flex',
  flexDirection: 'row',
  gap: '24rpx',
  width: '100%',
  marginTop: '16rpx',
} as const

interface BonusGateOverlayProps {
  socialSessionId: string
  isHost: boolean
  playerCount: number
  sentimentSummary?: { wantCount: number; passCount: number; responseCount: number }
  ownSentiment?: 'want' | 'pass'
  onResponded: () => void
}

export default function BonusGateOverlay({
  socialSessionId,
  isHost,
  playerCount,
  sentimentSummary = { wantCount: 0, passCount: 0, responseCount: 0 },
  ownSentiment,
  onResponded,
}: BonusGateOverlayProps) {
  const [loading, setLoading] = useState(false)
  const hasVoted = ownSentiment !== undefined
  const wantCount = sentimentSummary.wantCount

  const handleHostRespond = async (accept: boolean) => {
    haptics('light')
    setLoading(true)
    try {
      await apiRequest({
        path: '/api/miniscript/bonus/respond',
        method: 'POST',
        data: { socialSessionId, accept },
      })
      onResponded()
    } catch (err) {
      logError('bonus-gate-respond', { error: String(err) })
      Taro.showToast({ title: getErrorMessage('operation-failed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSentiment = async (sentiment: 'want' | 'pass') => {
    haptics('light')
    setLoading(true)
    try {
      await apiRequest({
        path: '/api/miniscript/bonus/sentiment',
        method: 'POST',
        data: { socialSessionId, sentiment },
      })
      onResponded()
    } catch (err) {
      logError('bonus-gate-sentiment', { error: String(err) })
      Taro.showToast({ title: getErrorMessage('operation-failed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View
      catchMove
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '40rpx',
        paddingBottom: 'calc(40rpx + env(safe-area-inset-bottom))',
      }}
    >
      <View
        style={{
          backgroundColor: '#1e1e2f',
          borderRadius: '24rpx',
          padding: '48rpx 32rpx',
          width: '100%',
          maxWidth: '640rpx',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24rpx',
        }}
      >
        <Text
          style={{
            fontSize: '40rpx',
            fontWeight: 700,
            color: '#d4af37',
            textAlign: 'center',
          }}
        >
          想不想来一局迷你剧本杀?
        </Text>
        <Text
          style={{
            fontSize: '28rpx',
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: '44rpx',
          }}
        >
          {getMascotDisplayName()}为大家准备了一个特别的收尾环节，用推理和演技为今晚画上句号。
        </Text>

        {wantCount > 0 && (
          <Text style={{ fontSize: '24rpx', color: '#6ee7b7', textAlign: 'center' }}>
            {wantCount}/{playerCount} 小伙伴想玩
          </Text>
        )}

        {/* Exactly ONE action row per role state: a host who hasn't voted
            records sentiment first; once voted, the host decides (跳过/接受);
            non-hosts only ever record sentiment. */}
        {isHost && !hasVoted && (
          <View style={actionRowStyle}>
            <Button
              variant='secondary'
              className='bonus-gate-overlay__btn'
              onClick={() => handleSentiment('pass')}
              disabled={loading}
              loading={loading}
            >
              不想玩
            </Button>
            <Button
              variant='primary'
              className='bonus-gate-overlay__btn'
              onClick={() => handleSentiment('want')}
              disabled={loading}
              loading={loading}
            >
              想玩
            </Button>
          </View>
        )}

        {isHost && hasVoted && (
          <View style={actionRowStyle}>
            <Button
              variant='secondary'
              className='bonus-gate-overlay__btn'
              onClick={() => handleHostRespond(false)}
              disabled={loading}
              loading={loading}
            >
              跳过
            </Button>
            <Button
              variant='primary'
              className='bonus-gate-overlay__btn'
              onClick={() => handleHostRespond(true)}
              disabled={loading}
              loading={loading}
            >
              接受
            </Button>
          </View>
        )}

        {!isHost && (
          <View style={actionRowStyle}>
            <Button
              variant='secondary'
              className='bonus-gate-overlay__btn'
              onClick={() => handleSentiment('pass')}
              disabled={loading || hasVoted}
              loading={loading}
            >
              下次吧
            </Button>
            <Button
              variant='primary'
              className='bonus-gate-overlay__btn'
              onClick={() => handleSentiment('want')}
              disabled={loading || hasVoted}
              loading={loading}
            >
              我也想玩!
            </Button>
          </View>
        )}

        {hasVoted && !isHost && (
          <Text style={{ fontSize: '24rpx', color: '#9CA3AF', marginTop: '8rpx' }}>
            已投票，等待主持人决定…
          </Text>
        )}
      </View>
    </View>
  )
}
