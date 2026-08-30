import { ScrollView, Text, View } from '@tarojs/components'
import { useMemo, useState } from 'react'
import type { MiniScriptStoryFrameworkPublic } from '@shared/miniscriptStoryFramework'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { haptics } from '../../../lib/utils/haptics'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { trackMiniScriptGameplay } from '../../../lib/analytics/miniscriptGameplayAnalytics'
import {
  buildClueDrawerGroups,
  countClueDrawerItems,
  resolveEvidenceIconEmoji,
} from './miniScriptV2Model'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

/** Older server data self-numbered clue texts (「线索 1：…」); the drawer owns
 *  grouping by act, so strip any embedded prefix defensively (mirrors the
 *  hero view's stripCluePrefix). */
function stripCluePrefix(text: string): string {
  return text.replace(/^线索\s*\d+\s*[:：]\s*/, '').trim()
}

/**
 * MiniScriptClueDrawer (V2 P2, contract AC-09) — persistent 「线索 N 条」
 * entry bar in act/vote sub-phases + a slide-up drawer grouping everything
 * already revealed by act. Data is derived from existing payloads only
 * (revealed clues from session state, public evidence from the framework) —
 * zero new server requests; unrevealed acts never appear.
 */
export function MiniScriptClueDrawer({
  framework,
  revealedClues,
  currentAct,
}: {
  framework: MiniScriptStoryFrameworkPublic
  revealedClues: Array<{ clueId: string; text: string; revealedInAct?: number }>
  currentAct: number
}) {
  const [open, setOpen] = useState(false)

  // Swipe-back safety: the drawer must not reopen when the page is re-shown
  // (REL-04).
  useResetOnShow(setOpen)

  const groups = useMemo(
    () => buildClueDrawerGroups({ framework, revealedClues, currentAct }),
    [framework, revealedClues, currentAct],
  )
  const itemCount = useMemo(() => countClueDrawerItems(groups), [groups])

  if (itemCount === 0) return null

  const handleOpen = () => {
    haptics('light')
    setOpen(true)
    trackMiniScriptGameplay('miniscript_clue_drawer_opened', { itemCount })
  }

  return (
    <>
      <View
        className='miniscript-clues__bar'
        role='button'
        aria-label={`查看已揭示的 ${itemCount} 条线索`}
        onClick={handleOpen}
      >
        <JoyJoinIcon emoji='🔍' size={28} />
        <Text className='miniscript-clues__bar-text'>线索 {itemCount} 条</Text>
        <Text className='miniscript-clues__bar-arrow'>›</Text>
      </View>

      {open ? (
        <View className='miniscript-clues' catchMove onClick={() => setOpen(false)}>
          <View className='miniscript-clues__backdrop' />
          <View
            className='miniscript-clues__surface'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <View className='miniscript-clues__handle' aria-hidden='true' />
            <Text className='miniscript-clues__title'>目前已知的线索</Text>
            <ScrollView className='miniscript-clues__scroll' scrollY enhanced showScrollbar={false}>
              {groups.map((group) => (
                <View key={group.actNumber} className='miniscript-clues__act'>
                  <Text className='miniscript-clues__act-title'>第 {group.actNumber} 幕</Text>
                  {group.clues.map((clue) => (
                    <View key={clue.clueId} className='miniscript-clues__item'>
                      <Text className='miniscript-clues__item-text'>{stripCluePrefix(clue.text)}</Text>
                    </View>
                  ))}
                  {group.evidence.map((evidence) => (
                    <View key={evidence.id} className='miniscript-clues__item miniscript-clues__item--evidence'>
                      <View className='miniscript-clues__item-icon'>
                        <JoyJoinIcon emoji={resolveEvidenceIconEmoji(evidence.iconKey)} size={28} />
                      </View>
                      <View className='miniscript-clues__item-body'>
                        <Text className='miniscript-clues__item-name'>{evidence.name}</Text>
                        <Text className='miniscript-clues__item-text'>{evidence.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
            <View
              className='miniscript-clues__close'
              role='button'
              aria-label='关闭线索'
              onClick={() => {
                haptics('light')
                setOpen(false)
              }}
            >
              <Text className='miniscript-clues__close-text'>收起</Text>
            </View>
          </View>
        </View>
      ) : null}
    </>
  )
}
