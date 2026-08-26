import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import BlindBoxLifecycleFlow from '../../src/components/flow-animation/BlindBoxLifecycleFlow'
import '../../src/components/flow-animation/index.scss'
import './preview.scss'

type PreviewMode = 'flow2'
const showToolbar = new URLSearchParams(window.location.search).get('notoolbar') !== '1'

function PreviewApp() {
  const [replayKey, setReplayKey] = useState(0)

  return (
    <main className="preview-app">
      <BlindBoxLifecycleFlow
        key={replayKey}
        userId="web-preview"
        onSkip={() => undefined}
        onViewActivity={() => window.alert('正式产品中将进入本次报名的真实活动详情')}
      />

      {showToolbar ? <nav className="preview-toolbar" aria-label="Flow Preview 控制">
        <button onClick={() => setReplayKey((value) => value + 1)}>重新播放</button>
      </nav> : null}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<PreviewApp />)
