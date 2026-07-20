import { useMemo, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import PixelAvatar3D, { type Avatar3DStatusReport } from '../../../../components/profile/PixelAvatar3D'
import type { EquipmentItem, EquipmentOutfit, EquipmentSlot } from '../../../../lib/profile/equipmentApi'
import { haptics } from '../../../../lib/utils/haptics'
import './index.scss'

/**
 * 3D avatar QA page (dev/preview tooling). Lets WeChat DevTools / on-device QA
 * verify the real WebGL model from every angle (front / right / back / left)
 * and every dress state (all on / all off / per-slot) without touching the
 * production wardrobe data. Reachable from the my-image stage when the
 * TARO_APP_AVATAR_3D_QA build flag is on.
 */

const QA_ARCHETYPE_ID = 'spider'

function makeQaItem(slot: EquipmentSlot, name: string, description: string): EquipmentItem {
  return {
    id: `qa-${slot}-item`,
    slug: `qa-spider-${slot}`,
    name,
    description,
    slot,
    rarity: 'common',
    assetKey: `equipment/starter/spider/${slot}/v1`,
    compatibleArchetypes: null,
  } as EquipmentItem
}

const QA_ITEMS: EquipmentItem[] = [
  makeQaItem('top', '深茄紫飞行夹克', 'bomber 夹克：长袖、前中拉链、罗纹立领/袖口/下摆、左袖拉链袋'),
  makeQaItem('bottom', '黑灰工装短裤', 'cargo 短裤：腰头纽扣门襟、腰带袢、右侧立体工装袋带扣'),
  makeQaItem('shoes', '紫黑高帮球鞋', 'high-top：高帮轮廓、紫色鞋头/鞋舌、浅紫鞋带、米白多层鞋底'),
  makeQaItem('accessory', '蛛网通讯挂件', '白银蛛网（中心紫宝石）+ 紫黑矩形通讯挂件（小蜘蛛图案）'),
]

const QA_ITEMS_BY_ID: ReadonlyMap<string, EquipmentItem> = new Map(QA_ITEMS.map((item) => [item.id, item]))

const FULL_OUTFIT: EquipmentOutfit = {
  topItemId: QA_ITEMS[0].id,
  bottomItemId: QA_ITEMS[1].id,
  shoesItemId: QA_ITEMS[2].id,
  accessoryItemId: QA_ITEMS[3].id,
  version: 1,
} as EquipmentOutfit

const BARE_OUTFIT: EquipmentOutfit = {
  topItemId: null,
  bottomItemId: null,
  shoesItemId: null,
  accessoryItemId: null,
  version: 1,
} as EquipmentOutfit

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  top: '上装',
  bottom: '下装',
  shoes: '鞋子',
  accessory: '配饰',
}

const FALLBACK_REASON_LABELS: Record<string, string> = {
  'unsupported-archetype': '该人格暂无 3D（第一阶段仅蜘蛛）',
  'canvas-component-missing': 'Canvas 组件不可用',
  'canvas-query-missing': 'createSelectorQuery 不可用',
  'canvas-node-missing': 'canvas 节点获取失败',
  'webgl-context-missing': 'WebGL 上下文创建失败',
  'session-init-failed': '渲染器初始化异常',
  'context-lost': 'WebGL 上下文丢失',
}

const YAW_PRESETS = [
  { label: '正面', yaw: 0 },
  { label: '右侧', yaw: Math.PI / 2 },
  { label: '背面', yaw: Math.PI },
  { label: '左侧', yaw: (Math.PI * 3) / 2 },
] as const

export default function Avatar3DQaPage() {
  const [outfit, setOutfit] = useState<EquipmentOutfit>(FULL_OUTFIT)
  const [yawCommand, setYawCommand] = useState<number | null>(null)
  const [liveDegrees, setLiveDegrees] = useState(0)
  const [statusReport, setStatusReport] = useState<Avatar3DStatusReport>({ status: 'boot', reason: null })
  const liveYawRef = useRef(0)

  const equippedCount = useMemo(
    () => ['topItemId', 'bottomItemId', 'shoesItemId', 'accessoryItemId']
      .filter((key) => (outfit as any)[key] !== null).length,
    [outfit],
  )

  const statusLine = statusReport.status === 'ready'
    ? '3D 状态：渲染中（WebGL ready）'
    : statusReport.status === 'fallback'
      ? `3D 状态：已回退 V2（${FALLBACK_REASON_LABELS[statusReport.reason ?? ''] ?? statusReport.reason ?? '未知原因'}）`
      : '3D 状态：初始化中…'

  const toggleSlot = (slot: EquipmentSlot) => {
    haptics('light')
    setOutfit((current) => {
      const key = `${slot}ItemId` as const
      const item = QA_ITEMS.find((entry) => entry.slot === slot)
      return { ...current, [key]: (current as any)[key] === null ? item?.id ?? null : null }
    })
  }

  return (
    <View className='avatar3d-qa'>
      <ScrollView className='avatar3d-qa__scroll' scrollY enhanced showScrollbar={false}>
        <View className='avatar3d-qa__content'>
          <Text className='avatar3d-qa__title'>3D 形象调试</Text>
          <Text className='avatar3d-qa__subtitle'>
            真实 WebGL 渲染 · 当前朝向 {Math.round(liveDegrees)}° · 已穿 {equippedCount}/4
          </Text>
          <View className='avatar3d-qa__status' role='status'><Text>{statusLine}</Text></View>

          <View className='avatar3d-qa__stage'>
            <PixelAvatar3D
              archetypeId={QA_ARCHETYPE_ID}
              outfit={outfit}
              itemsById={QA_ITEMS_BY_ID}
              variant='full'
              externalYaw={yawCommand}
              onStatusChange={setStatusReport}
              onYawChange={(degrees) => {
                liveYawRef.current = (degrees * Math.PI) / 180
                setLiveDegrees(degrees)
              }}
            />
          </View>

          <Text className='avatar3d-qa__section-title'>视角预设</Text>
          <View className='avatar3d-qa__button-row'>
            {YAW_PRESETS.map((preset) => (
              <View
                key={preset.label}
                className='avatar3d-qa__button'
                hoverClass='avatar3d-qa__button--pressed'
                onClick={() => {
                  haptics('light')
                  setYawCommand(preset.yaw)
                }}
                role='button'
                aria-label={`切换到${preset.label}视角`}
              ><Text>{preset.label}</Text></View>
            ))}
            <View
              className='avatar3d-qa__button'
              hoverClass='avatar3d-qa__button--pressed'
              onClick={() => {
                haptics('light')
                setYawCommand(liveYawRef.current + Math.PI * 2)
              }}
              role='button'
              aria-label='再旋转一整圈'
            ><Text>+360°</Text></View>
          </View>

          <Text className='avatar3d-qa__section-title'>装备状态</Text>
          <View className='avatar3d-qa__button-row'>
            <View
              className='avatar3d-qa__button avatar3d-qa__button--primary'
              hoverClass='avatar3d-qa__button--pressed'
              onClick={() => {
                haptics('medium')
                setOutfit(FULL_OUTFIT)
              }}
              role='button'
              aria-label='全部穿上'
            ><Text>全穿</Text></View>
            <View
              className='avatar3d-qa__button'
              hoverClass='avatar3d-qa__button--pressed'
              onClick={() => {
                haptics('medium')
                setOutfit(BARE_OUTFIT)
              }}
              role='button'
              aria-label='全部脱下（保留基础内搭）'
            ><Text>全脱</Text></View>
          </View>
          <View className='avatar3d-qa__button-row'>
            {(Object.keys(SLOT_LABELS) as EquipmentSlot[]).map((slot) => {
              const equipped = (outfit as any)[`${slot}ItemId`] !== null
              return (
                <View
                  key={slot}
                  className={`avatar3d-qa__button${equipped ? ' avatar3d-qa__button--active' : ''}`}
                  hoverClass='avatar3d-qa__button--pressed'
                  onClick={() => toggleSlot(slot)}
                  role='button'
                  aria-pressed={equipped}
                  aria-label={`${equipped ? '脱下' : '穿上'}${SLOT_LABELS[slot]}`}
                ><Text>{SLOT_LABELS[slot]}{equipped ? ' ✓' : ''}</Text></View>
              )
            })}
          </View>

          <Text className='avatar3d-qa__note'>
            检查点：上装是深茄紫 bomber（拉链/罗纹立领/左袖拉链袋），下装是黑灰 cargo（右侧立体工装袋），
            鞋子是紫黑高帮（紫鞋头/鞋带/米白分层鞋底），配饰是左胸白银蛛网 + 右胸紫黑通讯挂件（小蜘蛛）；
            正面能看到双眼/獠牙，背面有 6 条蜘蛛腿与背刺；全脱后仍保留基础背心与安全短裤；
            连续拖动可 360° 无限旋转，双击或「回正」回到正面。非蜘蛛人格应显示「3D 形象正在准备」并回退 V2。
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
