import { View, Text, Image, ScrollView } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import MissingArchetypePlaceholder from '../../../components/mascot/MissingArchetypePlaceholder'
import { localAsset } from '../../../lib/utils/cdnAssets'
import type { SessionParticipant } from '../phaseUtils'
import './WarmupPresenceStrip.scss'

interface WarmupPresenceStripProps {
  participants: SessionParticipant[]
  readyUserIds: string[]
  hostUserId?: string
  currentUserId: string
  readyCount: number
  totalCount: number
}

export function WarmupPresenceStrip({
  participants,
  readyUserIds,
  hostUserId,
  currentUserId,
  readyCount,
  totalCount,
}: WarmupPresenceStripProps) {
  return (
    <View className='warmup-presence'>
      <ScrollView
        className='warmup-presence__scroll'
        scrollX
        scrollWithAnimation={false}
        enhanced={false}
        showScrollbar={false}
      >
        <View className='warmup-presence__inner'>
          {participants.map((p) => {
            const isReady = readyUserIds.includes(p.userId)
            const isHost = p.userId === hostUserId
            return (
              <View
                key={p.userId}
                className={`warmup-presence__item ${
                  isReady ? 'warmup-presence__item--ready' : ''
                }`}
              >
                <View className='warmup-presence__avatar-wrap'>
                  <View className='warmup-presence__avatar'>
                    {p.archetype ? (
                      <ArchetypeHead archetype={p.archetype} size={40} variant='head' fallback='none' />
                    ) : (
                      <MissingArchetypePlaceholder size={40} />
                    )}
                  </View>
                  {isHost && (
                    <Image
                      className='warmup-presence__host-crown'
                      src={localAsset('/assets/icons/status-icons/status-crown.webp')}
                      lazyLoad
                    />
                  )}
                  {isReady && (
                    <View className='warmup-presence__ready-badge'>
                      <JoyJoinIcon emoji='✓' tier='status' size={12} />
                    </View>
                  )}
                </View>
                <Text className='warmup-presence__name'>{p.displayName ?? '匿名'}</Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
      <View className='warmup-presence__count'>
        <Text className='warmup-presence__count-text'>
          {readyCount}/{totalCount} 已准备
        </Text>
      </View>
      <View className='warmup-presence__fade' aria-hidden='true' />
    </View>
  )
}
