import { useEffect, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { getFlashStoryUnitDefinition } from '@shared/alang/flashStorySeason'

export interface FlashStoryMicroGameProps {
  episodeCode: string
  objectCode: string
  onSolved: () => void
  onInteractionStart?: () => void
  onFirstMistake?: () => void
  completed?: boolean
  disabled?: boolean
}

function useGameSignals(props: FlashStoryMicroGameProps) {
  const started = useRef(false)
  const mistaken = useRef(false)
  const solved = useRef(Boolean(props.completed))
  useEffect(() => { solved.current = Boolean(props.completed) }, [props.completed])
  return {
    start() {
      if (started.current) return
      started.current = true
      props.onInteractionStart?.()
    },
    mistake() {
      if (mistaken.current) return
      mistaken.current = true
      props.onFirstMistake?.()
    },
    solve() {
      if (solved.current || props.disabled) return
      solved.current = true
      props.onSolved()
    },
  }
}

function SpacingGame({ props, target, goal, success }: { props: FlashStoryMicroGameProps; target: number; goal: string; success: string }) {
  const signals = useGameSignals(props)
  const [distance, setDistance] = useState(props.completed ? target : 1)
  const adjust = (next: number) => { if (props.disabled || props.completed) return; signals.start(); setDistance(Math.max(0, Math.min(2, next))) }
  const confirm = () => {
    signals.start()
    if (distance === target) signals.solve()
    else { signals.mistake(); setDistance(1) }
  }
  return <View className='flash-story-game flash-story-game--spacing' data-testid='flash-story-microgame'>
    <Text className='flash-story-game__eyebrow'>旧物小试 · 座位图</Text><Text className='flash-story-game__title'>把距离摆清楚</Text><Text className='flash-story-game__instruction'>{goal}</Text>
    <View className={`flash-story-game__chairs flash-story-game__chairs--${distance}`} aria-label='两把椅子的距离'><View className='flash-story-game__chair' /><View className='flash-story-game__chair' /></View>
    <View className='flash-story-game__controls'><View role='button' aria-label='靠近一点' onClick={() => adjust(distance - 1)}><Text>靠近一点</Text></View><View role='button' aria-label='拉开一点' onClick={() => adjust(distance + 1)}><Text>拉开一点</Text></View><View role='button' aria-label='确认距离' onClick={confirm}><Text>就放这里</Text></View></View>
    <View className='flash-story-game__feedback' role='status'><Text>{props.completed ? success : '移动椅子，不用猜人物的答案。'}</Text></View>
  </View>
}

function PairingGame({ props, goal, success }: { props: FlashStoryMicroGameProps; goal: string; success: string }) {
  const signals = useGameSignals(props)
  const target = [2, 0, 1]
  const [pairs, setPairs] = useState<number[]>(props.completed ? target : [])
  const choose = (cap: number) => {
    if (props.disabled || props.completed || pairs.length >= 3) return
    signals.start()
    const next = [...pairs, cap]
    if (cap !== target[pairs.length]) { signals.mistake(); setPairs([]); return }
    setPairs(next)
    if (next.length === 3) signals.solve()
  }
  return <View className='flash-story-game flash-story-game--pairing' data-testid='flash-story-microgame'>
    <Text className='flash-story-game__eyebrow'>旧物小试 · 彩色笔</Text><Text className='flash-story-game__title'>按试写痕迹配回笔帽</Text><Text className='flash-story-game__instruction'>{goal}</Text>
    <View className='flash-story-game__swatches' aria-label='三段试写痕迹'>{['短线', '圆点', '折线'].map((label, index) => <View key={label} className={`flash-story-game__swatch${index < pairs.length ? ' is-paired' : ''}`}><Text>{label}</Text></View>)}</View>
    <View className='flash-story-game__caps'>{['紫帽', '橙帽', '蓝帽'].map((label, index) => <View key={label} role='button' aria-label={label} onClick={() => choose(index)}><Text>{label}</Text></View>)}</View>
    <View className='flash-story-game__feedback' role='status'><Text>{props.completed ? success : `${pairs.length}/3 已配回`}</Text></View>
  </View>
}

function InvitationGame({ props, success }: { props: FlashStoryMicroGameProps; success: string }) {
  const signals = useGameSignals(props)
  const steps = ['能写的笔', '补上时间', '补上方向']
  const [step, setStep] = useState(props.completed ? steps.length : 0)
  const choose = (index: number) => {
    if (props.disabled || props.completed || index < step) return
    signals.start()
    if (index !== step) { signals.mistake(); setStep(0); return }
    const next = step + 1
    setStep(next)
    if (next === steps.length) signals.solve()
  }
  return <View className='flash-story-game flash-story-game--invitation' data-testid='flash-story-microgame'>
    <Text className='flash-story-game__eyebrow'>旧物小试 · 留下的笔</Text>
    <Text className='flash-story-game__title'>找到能写的笔，再补完邀请</Text>
    <Text className='flash-story-game__instruction'>不替默默传话，只帮他把准备亲口说的时间和方向写完整。</Text>
    <View className='flash-story-game__controls' aria-label='邀请的三个落笔步骤'>
      {steps.map((label, index) => <View key={label} role='button' aria-label={label} aria-pressed={index < step} className={index < step ? 'is-visited' : ''} onClick={() => choose(index)}><Text>{label}</Text></View>)}
    </View>
    <View className='flash-story-game__feedback' role='status'><Text>{props.completed ? success : `写完 ${step}/${steps.length} 项`}</Text></View>
  </View>
}

function PathGame({ props, phase, goal, success }: { props: FlashStoryMicroGameProps; phase: number; goal: string; success: string }) {
  const signals = useGameSignals(props)
  const order = phase === 1 ? [0, 2, 1] : phase === 2 ? [1, 0, 2] : [2, 1, 0]
  const [step, setStep] = useState(props.completed ? 3 : 0)
  const visit = (node: number) => {
    if (props.disabled || props.completed) return
    signals.start()
    if (node !== order[step]) { signals.mistake(); setStep(0); return }
    const next = step + 1; setStep(next); if (next === 3) signals.solve()
  }
  return <View className='flash-story-game flash-story-game--path' data-testid='flash-story-microgame'>
    <Text className='flash-story-game__eyebrow'>旧物小试 · 路线本</Text><Text className='flash-story-game__title'>走到故事真正断开的地方</Text><Text className='flash-story-game__instruction'>{goal}</Text>
    <View className='flash-story-game__pathline'>{['旧路口', '空白页', '两声轻响'].map((label, index) => <View key={label} role='button' aria-label={label} className={order.slice(0, step).includes(index) ? 'is-visited' : ''} onClick={() => visit(index)}><Text>{label}</Text></View>)}</View>
    <View className='flash-story-game__feedback' role='status'><Text>{props.completed ? success : `走过 ${step}/3 个断点`}</Text></View>
  </View>
}

function OverlayGame({ props, phase, goal, success }: { props: FlashStoryMicroGameProps; phase: number; goal: string; success: string }) {
  const signals = useGameSignals(props)
  const target = phase === 2 ? 2 : 0
  const [layer, setLayer] = useState(props.completed ? target : 1)
  const move = (next: number) => { if (props.disabled || props.completed) return; signals.start(); setLayer((next + 3) % 3) }
  const confirm = () => { signals.start(); if (layer === target) signals.solve(); else { signals.mistake(); setLayer(1) } }
  return <View className='flash-story-game flash-story-game--overlay' data-testid='flash-story-microgame'>
    <Text className='flash-story-game__eyebrow'>旧物小试 · 出门册</Text><Text className='flash-story-game__title'>让纸痕落回同一格</Text><Text className='flash-story-game__instruction'>{goal}</Text>
    <View className={`flash-story-game__paper-stack flash-story-game__paper-stack--${layer}`}><View /><View /><View /></View>
    <View className='flash-story-game__controls'><View role='button' aria-label='向左移一格' onClick={() => move(layer - 1)}><Text>左移</Text></View><View role='button' aria-label='向右移一格' onClick={() => move(layer + 1)}><Text>右移</Text></View><View role='button' aria-label='确认纸痕' onClick={confirm}><Text>贴回去</Text></View></View>
    <View className='flash-story-game__feedback' role='status'><Text>{props.completed ? success : '只对齐痕迹，不替主人删选项。'}</Text></View>
  </View>
}

function PrivacyGame({ props, phase, goal, success }: { props: FlashStoryMicroGameProps; phase: number; goal: string; success: string }) {
  const signals = useGameSignals(props)
  const required = phase === 1 ? ['name', 'time'] : phase === 2 ? ['time', 'habit'] : ['time', 'habit', 'route']
  const [covered, setCovered] = useState<string[]>(props.completed ? required : [])
  const toggle = (id: string) => { if (props.disabled || props.completed) return; signals.start(); setCovered((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) }
  const confirm = () => {
    signals.start()
    if (required.every((item) => covered.includes(item)) && !covered.includes('city')) signals.solve()
    else { signals.mistake(); setCovered([]) }
  }
  const cards = [['city', '城市细节'], ['name', '名字'], ['time', '具体时间'], ['habit', '活动规律'], ['route', '个人路线']]
  return <View className='flash-story-game flash-story-game--privacy' data-testid='flash-story-microgame'>
    <Text className='flash-story-game__eyebrow'>旧物小试 · 观察卡</Text><Text className='flash-story-game__title'>留下细节，收起边界</Text><Text className='flash-story-game__instruction'>{goal}</Text>
    <View className='flash-story-game__privacy-grid'>{cards.map(([id, label]) => <View key={id} role='button' aria-label={`${covered.includes(id) ? '取消遮住' : '遮住'}${label}`} aria-pressed={covered.includes(id)} className={covered.includes(id) ? 'is-covered' : ''} onClick={() => toggle(id)}><Text>{label}</Text></View>)}</View>
    <View role='button' aria-label='确认保留范围' onClick={confirm}><Text>这样留下</Text></View>
    <View className='flash-story-game__feedback' role='status'><Text>{props.completed ? success : '遮住越界信息，城市细节可以留下。'}</Text></View>
  </View>
}

export function FlashStoryMicroGame(props: FlashStoryMicroGameProps) {
  const definition = getFlashStoryUnitDefinition(props.episodeCode)
  if (!definition || definition.objectCode !== props.objectCode) return <View role='alert'><Text>这件旧物暂时无法展开。</Text></View>
  const common = { props, goal: definition.goal, success: definition.success }
  if (definition.unitId === 's1-p3-momo') return <InvitationGame props={props} success={definition.success} />
  if (definition.interactionKind === 'spacing') return <SpacingGame {...common} target={definition.phase === 1 ? 2 : definition.phase === 2 ? 0 : 1} />
  if (definition.interactionKind === 'pairing') return <PairingGame {...common} />
  if (definition.interactionKind === 'path') return <PathGame {...common} phase={definition.phase} />
  if (definition.interactionKind === 'overlay') return <OverlayGame {...common} phase={definition.phase} />
  return <PrivacyGame {...common} phase={definition.phase} />
}
