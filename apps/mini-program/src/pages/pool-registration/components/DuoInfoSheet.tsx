import { View, Text, ScrollView } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import './DuoInfoSheet.scss'

interface DuoInfoSheetProps {
  reduceMotion: boolean
  onClose: () => void
}

const HOW_IT_WORKS_STEPS = [
  '选 2 人，把卡片发给朋友',
  'TA 完成测试，各自报名这场局',
  '悦仔把你们安排进同一桌',
]

/**
 * DuoInfoSheet — 双人成行玩法说明 (bottom sheet, PersonaSnapshotSheet pattern).
 *
 * Copy per spec §B as amended by 附录 H (B'-1 single-line why, B'-2 two-item
 * 注意事项 + FALLBACK slot, B'-3 tightened 怎么玩 without the 🟠 word "匹配").
 * Info-type overlays are ALWAYS bottom sheets; decision-type overlays are
 * centred dialogs — never both visible at once (B'-5, enforced by the page).
 */
export default function DuoInfoSheet({ reduceMotion, onClose }: DuoInfoSheetProps) {
  const surfaceClass = reduceMotion
    ? 'duo-info-sheet__surface duo-info-sheet__surface--static'
    : 'duo-info-sheet__surface'

  return (
    <View className='duo-info-sheet' catchMove onClick={onClose}>
      <View className='duo-info-sheet__backdrop' />
      <View
        className={surfaceClass}
        role='dialog'
        aria-modal='true'
        aria-label='双人成行玩法说明'
        onClick={(e) => e.stopPropagation()}
      >
        <View className='duo-info-sheet__handle' />
        <View className='duo-info-sheet__header'>
          <Text className='duo-info-sheet__title'>双人成行怎么玩</Text>
        </View>

        <ScrollView className='duo-info-sheet__scroll' scrollY enhanced showScrollbar={false}>
          <View className='duo-info-sheet__section'>
            <Text className='duo-info-sheet__section-title'>为什么做</Text>
            <View className='duo-info-sheet__items' role='list'>
              <View className='duo-info-sheet__listitem' role='listitem'>
                <Text className='duo-info-sheet__item'>
                  一个人开新桌有点慌？带个熟人，悦仔帮你们留座。
                </Text>
              </View>
            </View>
          </View>

          <View className='duo-info-sheet__section'>
            <Text className='duo-info-sheet__section-title'>注意事项</Text>
            <View className='duo-info-sheet__items' role='list'>
              <View className='duo-info-sheet__listitem' role='listitem'>
                <Text className='duo-info-sheet__item'>
                  每桌最多一对双人，先成队先得。
                </Text>
              </View>
              {/* FALLBACK 槽位（spec §B / B'-2）— owner 定稿为变体 A（整组顺延）。
                  若匹配侧 fallback 语义改为「拆散+补偿券」，此行必须同步替换为
                  变体 B：如果同桌实在排不开，悦仔送上一张补偿券。 */}
              <View className='duo-info-sheet__listitem' role='listitem'>
                <Text className='duo-info-sheet__item'>
                  如果同桌实在排不开，你们一起顺延到下一局。
                </Text>
              </View>
            </View>
          </View>

          <View className='duo-info-sheet__section'>
            <Text className='duo-info-sheet__section-title'>怎么玩</Text>
            <View className='duo-info-sheet__items' role='list'>
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <View key={step} className='duo-info-sheet__step' role='listitem'>
                  <Text className='duo-info-sheet__step-index'>{index + 1}</Text>
                  <Text className='duo-info-sheet__item'>{step}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='duo-info-sheet__cta'>
            <Button variant='primary' onClick={onClose}>
              知道了
            </Button>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}
