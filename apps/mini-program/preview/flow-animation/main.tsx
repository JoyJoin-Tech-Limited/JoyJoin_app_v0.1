import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import JoyJoinIntroFlow from '../../src/components/flow-animation/JoyJoinIntroFlow'
import BlindBoxLifecycleFlow from '../../src/components/flow-animation/BlindBoxLifecycleFlow'
import '../../src/components/flow-animation/index.scss'
import './preview.scss'

type PreviewMode = 'flow1' | 'event' | 'street' | 'flow2'
const getInitialMode = (): PreviewMode => {
  const raw = new URLSearchParams(window.location.search).get('mode')
  if (raw === 'event' || raw === 'street' || raw === 'flow2') return raw
  return 'flow1'
}
const showToolbar = new URLSearchParams(window.location.search).get('notoolbar') !== '1'
const getInitialArchetype = (): string => {
  const raw = new URLSearchParams(window.location.search).get('archetype')
  const valid = ['corgi','rooster','hamster_praise','fox','dolphin_calm','spider','koala','octopus','owl','elephant','turtle','cat']
  return raw && valid.includes(raw) ? raw : 'corgi'
}
const ARCHETYPES = [
  ['corgi', '社牛柯基'], ['rooster', '小太阳鸡'], ['hamster_praise', '夸夸仓鼠'],
  ['fox', '寻宝狐'], ['dolphin_calm', '机灵海豚'], ['spider', '人脉蛛'],
  ['koala', '树洞考拉'], ['octopus', '脑洞章鱼'], ['owl', '好奇猫头鹰'],
  ['elephant', '靠谱大象'], ['turtle', '慢热龟'], ['cat', '小透明猫'],
] as const

function PreviewApp() {
  const [mode, setMode] = useState<PreviewMode>(getInitialMode())
  const [replayKey, setReplayKey] = useState(0)
  const [archetypeId, setArchetypeId] = useState(getInitialArchetype())

  const show = (nextMode: PreviewMode) => {
    setMode(nextMode)
    setReplayKey((value) => value + 1)
  }

  return (
    <main className="preview-app">
      {mode === 'flow2' ? (
        <BlindBoxLifecycleFlow
          key={`${mode}-${replayKey}`}
          userId="web-preview"
          archetypeId={archetypeId}
          onSkip={() => undefined}
          onViewActivity={() => window.alert('正式产品中将进入本次报名的真实活动详情')}
        />
      ) : (
        <JoyJoinIntroFlow
          key={`${mode}-${replayKey}`}
          userId="web-preview"
          archetypeId={archetypeId}
          initialDetailId={mode === 'event' ? 'event' : mode === 'street' ? 'street' : undefined}
          onComplete={() => undefined}
        />
      )}

      {showToolbar ? <nav className="preview-toolbar" aria-label="Flow Preview 控制">
        <select
          className="preview-toolbar__select"
          value={archetypeId}
          onChange={(event) => {
            setArchetypeId(event.target.value)
            setMode('flow1')
            setReplayKey((value) => value + 1)
          }}
          aria-label="模拟当前用户的人格类型"
        >
          {ARCHETYPES.map(([id, name]) => <option key={id} value={id}>{name}版 Flow 1</option>)}
        </select>
        <button className={mode === 'flow1' ? 'is-active' : ''} onClick={() => show('flow1')}>Flow 1 首页</button>
        <button className={mode === 'event' ? 'is-active' : ''} onClick={() => show('event')}>正式盲盒详情</button>
        <button className={mode === 'street' ? 'is-active' : ''} onClick={() => show('street')}>街头盲盒详情</button>
        <button className={mode === 'flow2' ? 'is-active' : ''} onClick={() => show('flow2')}>Flow 2</button>
        <button onClick={() => setReplayKey((value) => value + 1)}>重新播放</button>
      </nav> : null}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<PreviewApp />)
