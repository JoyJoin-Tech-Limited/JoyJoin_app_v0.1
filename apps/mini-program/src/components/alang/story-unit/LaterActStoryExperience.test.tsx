import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  createLaterActProgress,
  LaterActStoryExperience,
  restoreLaterActProgress,
  type LaterActProgress,
} from './LaterActStoryExperience'
import { CUSTOM_LATER_ACT_CONFIGS, getCustomLaterActConfig } from './LaterActStoryConfigs'

vi.mock('@tarojs/components', () => ({
  View: ({ children, hoverClass: _hoverClass, ...props }: any) => <div {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Image: ({ mode, ...props }: any) => <img mode={mode} {...props} />,
  ScrollView: ({ children, scrollY: _scrollY, ...props }: any) => <div {...props}>{children}</div>,
}))

describe('LaterActStoryExperience', () => {
  it('keeps every rewritten act on the same complete six-beat contract', () => {
    expect(Object.keys(CUSTOM_LATER_ACT_CONFIGS)).toEqual(expect.arrayContaining([
      's1-p2-alang',
      's1-p3-alang',
      's1-p2-lizi',
      's1-p3-lizi',
      's1-p2-momo',
      's1-p3-momo',
      's1-p2-shiqi',
      's1-p3-shiqi',
    ]))
    expect(Object.keys(CUSTOM_LATER_ACT_CONFIGS)).toHaveLength(8)
    for (const config of Object.values(CUSTOM_LATER_ACT_CONFIGS)) {
      expect(config.approaches).toHaveLength(2)
      expect(config.highlights).toHaveLength(3)
      expect(config.objectExploration.details).toHaveLength(3)
      expect(config.followUps).toHaveLength(2)
      expect(config.game.steps).toHaveLength(3)
      expect(config.game.steps.every((step) => step.choices.filter(({ correct }) => correct).length === 1)).toBe(true)
      expect(config.ending.completionLabel.length).toBeGreaterThan(6)
    }
  })

  it('keeps Lizi and Shiqi on distinct canonical story threads', () => {
    const liziSecond = getCustomLaterActConfig('s1-p2-lizi')
    const liziThird = getCustomLaterActConfig('s1-p3-lizi')
    const shiqiSecond = getCustomLaterActConfig('s1-p2-shiqi')
    const shiqiThird = getCustomLaterActConfig('s1-p3-shiqi')

    expect(liziSecond.followUps.map(({ id }) => id)).toEqual(['ask-why', 'suggest-delete'])
    expect(liziThird.followUps.map(({ id }) => id)).toEqual(['ask-feel', 'ask-next'])
    expect(shiqiSecond.followUps.map(({ id }) => id)).toEqual(['ask-privacy', 'ask-delete'])
    expect(shiqiThird.followUps.map(({ id }) => id)).toEqual(['note-boundary', 'hand-back'])

    expect(liziSecond.title).toContain('圈')
    expect(liziThird.title).toContain('发生')
    expect(shiqiSecond.title).toContain('准确')
    expect(shiqiThird.title).toContain('删除')
    expect(shiqiSecond.opening).toContain('确认没有人动过')
    expect(JSON.stringify(shiqiSecond)).not.toContain('第二张和第五张换过位置')
    expect(new Set([liziSecond.game.title, liziThird.game.title, shiqiSecond.game.title, shiqiThird.game.title]).size).toBe(4)
  })

  it('resets malformed recovery data instead of skipping required exploration', () => {
    const config = getCustomLaterActConfig('s1-p2-alang')
    const restored = restoreLaterActProgress(config, {
      ...createLaterActProgress(config.unitId),
      seenHighlightIds: ['wet-notebook', 'made-up-clue', 'wet-notebook'],
      seenDetailIds: ['waterline', 'made-up-detail'],
      gameStep: 99,
      mistakes: -4,
      approachId: 'made-up-approach',
    })

    expect(restored.stage).toBe('approach')
    expect(restored.seenHighlightIds).toEqual([])
    expect(restored.seenDetailIds).toEqual([])
    expect(restored.gameStep).toBe(0)
    expect(restored.mistakes).toBe(0)
    expect(restored.approachId).toBeNull()
  })

  it('restores only the earliest reachable stage from a partially written snapshot', () => {
    const config = getCustomLaterActConfig('s1-p2-momo')
    const restored = restoreLaterActProgress(config, {
      ...createLaterActProgress(config.unitId),
      stage: 'ending',
      approachId: config.approaches[0].id,
      seenHighlightIds: [config.highlights[0].id],
      objectOpened: true,
      seenDetailIds: config.objectExploration.details.map(({ id }) => id),
      followupId: config.followUps[0].id,
      gameStarted: true,
      gameStep: config.game.steps.length,
      gameComplete: true,
    })

    expect(restored.stage).toBe('explore')
    expect(restored.seenHighlightIds).toEqual([config.highlights[0].id])
    expect(restored.objectOpened).toBe(false)
    expect(restored.gameComplete).toBe(false)
  })

  it('restores v2 evidence state only inside the matching act and migrates v1 safely', () => {
    const config = getCustomLaterActConfig('s1-p3-shiqi')
    const base = {
      ...createLaterActProgress(config.unitId),
      approachId: config.approaches[0].id,
      seenHighlightIds: config.highlights.map(({ id }) => id),
      objectOpened: true,
      seenDetailIds: config.objectExploration.details.map(({ id }) => id),
      followupId: config.followUps[0].id,
      gameStarted: true,
      gameStep: 1,
      selectedEvidenceId: config.objectExploration.details[1].id,
      stepMistakes: [1, 3, 0],
    }
    const restored = restoreLaterActProgress(config, base)
    expect(restored.selectedEvidenceId).toBe(config.objectExploration.details[1].id)
    expect(restored.stepMistakes).toEqual([1, 3, 0])

    expect(restoreLaterActProgress(getCustomLaterActConfig('s1-p2-shiqi'), base).stage).toBe('approach')
    expect(restoreLaterActProgress(config, { ...base, version: 'npc-later-act-v1' }).selectedEvidenceId).toBeNull()
    expect(restoreLaterActProgress(config, { ...base, selectedEvidenceId: config.objectExploration.details[0].id }).selectedEvidenceId).toBeNull()
  })

  it('reveals the second-layer object before entering the internal exploration', () => {
    const config = getCustomLaterActConfig('s1-p2-lizi')
    const Harness = () => {
      const [progress, setProgress] = useState<LaterActProgress>({
        ...createLaterActProgress(config.unitId),
        stage: 'explore',
        approachId: config.approaches[0].id,
        seenHighlightIds: config.highlights.map(({ id }) => id),
      })
      return (
        <LaterActStoryExperience
          config={config}
          stage={progress.stage}
          background='lizi-second.jpg'
          character='lizi.png'
          progress={progress}
          onProgress={setProgress}
          onApproach={vi.fn()}
          onExplorationComplete={vi.fn()}
          onFollowup={vi.fn()}
          onGameComplete={vi.fn()}
          onComplete={vi.fn()}
        />
      )
    }
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: `打开${config.objectTarget.label}` }))
    expect(screen.getByTestId('later-act-object-reveal')).toBeInTheDocument()
    expect(screen.queryByTestId('later-act-object-panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: `打开${config.objectExploration.shortLabel}` }))
    expect(screen.getByTestId('later-act-object-panel')).toBeInTheDocument()
  })

  it('shows the full image and makes a wrong game answer retryable without advancing', () => {
    const config = getCustomLaterActConfig('s1-p3-momo')
    const onGameComplete = vi.fn()
    const Harness = () => {
      const [progress, setProgress] = useState<LaterActProgress>({
        ...createLaterActProgress(config.unitId),
        stage: 'game',
        approachId: config.approaches[0].id,
        seenHighlightIds: config.highlights.map(({ id }) => id),
        objectOpened: true,
        seenDetailIds: config.objectExploration.details.map(({ id }) => id),
        followupId: config.followUps[0].id,
        gameStarted: true,
      })
      return (
        <LaterActStoryExperience
          config={config}
          stage={progress.stage}
          background='complete-scene.jpg'
          character='momo.png'
          progress={progress}
          onProgress={setProgress}
          onApproach={vi.fn()}
          onExplorationComplete={vi.fn()}
          onFollowup={vi.fn()}
          onGameComplete={onGameComplete}
          onComplete={vi.fn()}
        />
      )
    }
    render(<Harness />)

    expect(screen.getByTestId('later-act-background')).toHaveAttribute('src', 'complete-scene.jpg')
    expect(screen.getByTestId('later-act-background')).toHaveAttribute('mode', 'aspectFit')
    fireEvent.click(screen.getByRole('button', { name: `选择证据：${config.objectExploration.details[0].label}` }))
    fireEvent.click(screen.getByRole('button', { name: '放只有默默懂的颜色暗号' }))
    expect(screen.getByRole('alert')).toHaveTextContent('第一格先把时间说清楚')
    expect(screen.getByLabelText('已完成 0 步，共 3 步')).toBeInTheDocument()
    expect(onGameComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '再看一次' }))
    fireEvent.click(screen.getByRole('button', { name: '放一段可以商量的出发时间' }))
    expect(screen.getByText('第 2 步')).toBeInTheDocument()
  })

  it('requires evidence before action and reveals an assist after repeated wrong evidence', () => {
    const config = getCustomLaterActConfig('s1-p2-alang')
    const Harness = () => {
      const [progress, setProgress] = useState<LaterActProgress>({
        ...createLaterActProgress(config.unitId),
        stage: 'game',
        approachId: config.approaches[0].id,
        seenHighlightIds: config.highlights.map(({ id }) => id),
        objectOpened: true,
        seenDetailIds: config.objectExploration.details.map(({ id }) => id),
        followupId: config.followUps[0].id,
        gameStarted: true,
      })
      return <LaterActStoryExperience config={config} stage={progress.stage} background='scene.jpg' progress={progress} onProgress={setProgress} onApproach={vi.fn()} onExplorationComplete={vi.fn()} onFollowup={vi.fn()} onGameComplete={vi.fn()} onComplete={vi.fn()} />
    }
    render(<Harness />)
    expect(screen.queryByRole('button', { name: config.game.steps[0].choices[0].label })).not.toBeInTheDocument()
    const wrongEvidence = config.objectExploration.details[1]
    for (let attempt = 0; attempt < 3; attempt += 1) {
      fireEvent.click(screen.getByRole('button', { name: `选择证据：${wrongEvidence.label}` }))
      if (attempt >= 1) expect(screen.getByText(/线索：/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '再看一次' }))
    }
    expect(screen.getByRole('button', { name: '请角色标出关键痕迹' })).toBeInTheDocument()
  })

  it('falls back to a solid scene without hiding story controls when an image fails', () => {
    const config = getCustomLaterActConfig('s1-p2-momo')
    render(
      <LaterActStoryExperience
        config={config}
        stage='approach'
        background='bad.jpg'
        character='momo.png'
        progress={createLaterActProgress(config.unitId)}
        onProgress={vi.fn()}
        onApproach={vi.fn()}
        onExplorationComplete={vi.fn()}
        onFollowup={vi.fn()}
        onGameComplete={vi.fn()}
        onComplete={vi.fn()}
      />,
    )

    fireEvent.error(screen.getByTestId('later-act-background'))
    expect(screen.getByTestId('later-act-scene')).toHaveClass('later-act-scene--fallback')
    expect(screen.getByRole('button', { name: '先核对路线真正留下的颜色' })).toBeInTheDocument()
  })

  it('keeps the terminal completion action outside the native scroll layer', () => {
    const config = getCustomLaterActConfig('s1-p3-alang')
    const onComplete = vi.fn()
    render(
      <LaterActStoryExperience
        config={config}
        stage='ending'
        background='complete-scene.jpg'
        character='alang.png'
        progress={{
          ...createLaterActProgress(config.unitId),
          stage: 'ending',
          gameStep: config.game.steps.length,
          gameStarted: true,
          gameComplete: true,
        }}
        onProgress={vi.fn()}
        onApproach={vi.fn()}
        onExplorationComplete={vi.fn()}
        onFollowup={vi.fn()}
        onGameComplete={vi.fn()}
        onComplete={onComplete}
      />,
    )

    const completion = screen.getByRole('button', { name: config.ending.completionLabel })
    expect(completion.closest('.later-act-experience__scroll')).toBeNull()
    fireEvent.click(completion)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
