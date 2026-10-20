import { View, Text } from '@tarojs/components'
import Chip from '../../../components/ui/Chip'
import { QUIP_CHIP_ROW_LABEL } from '@shared/copy/quipInspirationChips'
import type { QuipInspirationChip } from '@shared/copy/quipInspirationChips'

export interface QuipInspirationChipsProps {
  /** This prompt's deterministic 3-chip subset (sessionId∥promptId∥userId). */
  chips: ReadonlyArray<QuipInspirationChip>
  onChipTap: (chip: QuipInspirationChip) => void
}

/**
 * 灵感起手 chips 行（2026-10-20 P2 #6，spec 规格二）— quip_battle 作答相位
 * 每题输入框下方的静态策展句式起手。
 *
 * 分层法则（详见 shared copy 模块头）：静态策展 ≠ AI 生成 —— 零 LLM、零
 * 网络请求、零 AIGC 角标、零 mascot 口吻（引导语为中性系统文案「灵感起手」，
 * toneMode = system-ui）。永不与「悦仔帮我写」类生成式入口同屏共存。
 *
 * 交互铁律：每个 chip 外层 View 承担触控（≥88rpx、hoverClass 按压反馈、
 * haptics 由调用方触发）；Chip.tsx（L3 安静级）纯视觉复用。
 * Styles are @use'd by the page SCSS (index.scss) — sub-common.wxss 纪律。
 */
export default function QuipInspirationChips({ chips, onChipTap }: QuipInspirationChipsProps) {
  if (chips.length === 0) return null
  return (
    <View className='quip-inspiration-chips' aria-label={QUIP_CHIP_ROW_LABEL}>
      <Text className='quip-inspiration-chips__label'>{QUIP_CHIP_ROW_LABEL}</Text>
      <View className='quip-inspiration-chips__row'>
        {chips.map((chip) => (
          <View
            key={chip.id}
            className='quip-inspiration-chips__chip-wrap'
            hoverClass='quip-inspiration-chips__chip-wrap--pressed'
            hoverStartTime={0}
            onClick={() => onChipTap(chip)}
            role='button'
            aria-label={`${QUIP_CHIP_ROW_LABEL}：${chip.text}`}
          >
            <Chip label={chip.text} level={3} className='quip-inspiration-chips__chip' />
          </View>
        ))}
      </View>
    </View>
  )
}
