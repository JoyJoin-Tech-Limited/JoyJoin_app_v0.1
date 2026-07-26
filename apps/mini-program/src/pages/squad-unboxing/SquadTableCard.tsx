/**
 * SquadTableCard — 「这桌的桌卡」 collectible banner (2026-07-24 P2).
 *
 * Appears once every card is face-up (and persists on re-entry — the return
 * hook): archetype head ring + chemistry word + date + 第N组, with a save
 * action that generates the canvas poster into the photo album.
 */

import { View, Text, Image } from '@tarojs/components'
import type { PoolGroupMemberSummary } from '@shared/api'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'

export interface SquadTableCardProps {
  members: PoolGroupMemberSummary[]
  currentUserId?: string | null
  chemistryWord: string
  /** e.g. "7月27日 周一" */
  dateLine: string
  saving: boolean
  onSave: () => void
}

const HEAD_RING_CAP = 6

function getHeadUrl(member: PoolGroupMemberSummary): string | undefined {
  if (member.avatarUrl) return member.avatarUrl
  if (!member.archetype) return undefined
  const id = resolveArchetype(member.archetype)?.id ?? member.archetype
  return ARCHETYPE_ASSET_MAP[id]?.webp
}

export default function SquadTableCard({
  members,
  currentUserId,
  chemistryWord,
  dateLine,
  saving,
  onSave,
}: SquadTableCardProps) {
  const shown = members.slice(0, HEAD_RING_CAP)
  const overflow = members.length - shown.length

  return (
    <View className='squad-unboxing__table-card' role='region' aria-label='这桌的桌卡'>
      <View className='squad-unboxing__table-card-main'>
        <View className='squad-unboxing__table-card-heads' aria-hidden='true'>
          {shown.map((member) => {
            const url = getHeadUrl(member)
            const isMe = member.userId === currentUserId
            return (
              <View
                key={member.userId}
                className={[
                  'squad-unboxing__table-card-head',
                  isMe ? 'squad-unboxing__table-card-head--me' : '',
                ].filter(Boolean).join(' ')}
              >
                {url ? (
                  <Image
                    className='squad-unboxing__table-card-head-img'
                    src={url}
                    mode='aspectFill'
                    lazyLoad={false}
                    aria-hidden='true'
                  />
                ) : (
                  <View className='squad-unboxing__table-card-head-fallback' />
                )}
              </View>
            )
          })}
          {overflow > 0 ? (
            <View className='squad-unboxing__table-card-head squad-unboxing__table-card-head--overflow'>
              <Text className='squad-unboxing__table-card-head-overflow-text'>+{overflow}</Text>
            </View>
          ) : null}
        </View>
        <View className='squad-unboxing__table-card-copy'>
          <Text className='squad-unboxing__table-card-title'>这桌的桌卡</Text>
          <Text className='squad-unboxing__table-card-meta'>
            {[chemistryWord, dateLine].filter(Boolean).join('·')}
          </Text>
        </View>
      </View>
      <View
        className={[
          'squad-unboxing__table-card-save',
          saving ? 'squad-unboxing__table-card-save--busy' : '',
        ].filter(Boolean).join(' ')}
        hoverClass='squad-unboxing__table-card-save--pressed'
        role='button'
        aria-label='保存桌卡到相册'
        aria-busy={saving}
        onClick={saving ? undefined : onSave}
      >
        <Text className='squad-unboxing__table-card-save-text'>
          {saving ? '生成中…' : '保存桌卡'}
        </Text>
      </View>
    </View>
  )
}
