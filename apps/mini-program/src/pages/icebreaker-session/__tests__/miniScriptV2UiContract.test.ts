import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const heroSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.tsx'),
  'utf8',
)
const traySource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptEvidenceTray.tsx'),
  'utf8',
)
const drawerSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptClueDrawer.tsx'),
  'utf8',
)
const actionsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/hooks/useSocialActions.ts'),
  'utf8',
)
const phaseViewsSource = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/SessionPhaseViews.tsx'),
  'utf8',
)
const pageStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/icebreaker-session/index.scss'),
  'utf8',
)

/**
 * MiniScript V2 P2 client structural contract (sprint miniscript-v2-p2,
 * AC-08/09/10/13). Complements miniScriptV2Model.test.ts (derived logic)
 * with render-level assertions on the wiring.
 */
describe('MiniScript V2 P2 · evidence area (AC-08)', () => {
  it('hides the evidence tray unless the flag snapshot is on AND the framework has evidence', () => {
    expect(heroSource).toContain('session.miniScriptV2Enabled === true')
    expect(heroSource).toContain('frameworkHasAnyEvidence(framework)')
    expect(heroSource).toContain('showEvidenceTray')
  })

  it('limits rendered evidence to acts 1..currentAct via the shared model', () => {
    expect(traySource).toContain('resolveRevealedEvidence(framework, currentAct)')
  })

  it('shows the presenter the reaction immediately with the read-aloud guidance', () => {
    expect(traySource).toContain('大声读出来！大家都在听。')
    expect(traySource).toContain('已读完')
  })

  it('renders reaction visibility from the server contract — never a device-clock timer', () => {
    // V2 P3: sanitizeStateForClient omits reactionText until the server
    // releases it; the dead client-side 8s timer chain was deleted (the
    // discarded setNowTick meant the memos never recomputed — a dead chain).
    expect(traySource).toContain('isReactionRevealed')
    expect(traySource).toContain('pendingReactionEntries')
    expect(traySource).not.toContain('isReactionVisibleToMember')
    expect(traySource).not.toContain('MINISCRIPT_REACTION_DELAY_MS')
    expect(traySource).not.toContain('setNowTick')
    expect(traySource).not.toContain('setTimeout')
    expect(traySource).not.toContain('Date.now()')
    // Presented combos still grey out (server is idempotent on repeats).
    expect(traySource).toContain('buildPresentedComboSet')
    expect(traySource).toContain('miniscript-evidence__chip--taken')
  })

  it('shows a subtle pending line while a presentation sits inside the server gate', () => {
    expect(traySource).toContain('有人正在出示证物…')
    expect(traySource).toContain('miniscript-evidence__pending')
  })

  it('wires the presenter 已读完 early release through confirm-read', () => {
    expect(traySource).toContain('onConfirmRead?.(activeReaction.evidenceId, activeReaction.targetRoleSlot)')
    expect(actionsSource).toContain("'/api/miniscript/confirm-read'")
    expect(heroSource).toContain('onConfirmRead={onConfirmRead}')
    expect(phaseViewsSource).toContain('onConfirmRead={onMiniScriptConfirmRead}')
  })

  it('blocks background scroll behind both evidence masks (catchMove)', () => {
    expect(traySource).toMatch(/miniscript-evidence__picker-mask' catchMove/)
    expect(traySource).toMatch(/miniscript-evidence__reveal-mask' catchMove/)
  })

  it('stops offering presents once the vote has opened (WRONG_SUB_PHASE guard)', () => {
    expect(heroSource).toContain('presentingClosed={session.miniScriptVoteOpenedAt !== undefined}')
    expect(traySource).toContain('投票已开始，证物仅供回顾')
  })
})

describe('MiniScript V2 P2 · clue drawer (AC-09)', () => {
  it('renders the persistent count entry bar in act + vote sub-phases', () => {
    expect(drawerSource).toContain('线索 {itemCount} 条')
    // Mounted in actContent and at the vote sub-phase JSX level.
    expect(heroSource.match(/<MiniScriptClueDrawer/g)).toHaveLength(2)
  })

  it('sits the act-view entry bar above the fold sections (V2 P3 reposition)', () => {
    // Act view: the bar renders as the FIRST actContent child — directly
    // below 本幕任务, above 本幕新线索 and every fold section.
    const drawerIndex = heroSource.indexOf('<MiniScriptClueDrawer')
    const newCluesIndex = heroSource.indexOf('miniscript-hero__section--new-clues')
    expect(drawerIndex).toBeGreaterThan(-1)
    expect(newCluesIndex).toBeGreaterThan(-1)
    expect(drawerIndex).toBeLessThan(newCluesIndex)
  })

  it('derives groups from existing payloads only (state clues + framework evidence)', () => {
    expect(drawerSource).toContain('buildClueDrawerGroups({ framework, revealedClues, currentAct })')
    expect(drawerSource).not.toContain('apiRequest')
  })

  it('tracks the drawer-open funnel event', () => {
    expect(drawerSource).toContain("trackMiniScriptGameplay('miniscript_clue_drawer_opened'")
  })
})

describe('MiniScript V2 P2 · two-round vote (AC-10/13)', () => {
  it('filters the local vote-progress fallback by round (client half of AC-13)', () => {
    expect(heroSource).toContain('roundOneVotes(allVotes)')
    expect(heroSource).toContain('roundTwoVotes(allVotes)')
    expect(heroSource).toContain('session.miniScriptMotiveVoteProgress')
    expect(heroSource).toContain('voteOpenedAt: session.miniScriptMotiveVoteOpenedAt')
  })

  it('gives the host the 进入动机投票 CTA only when a motive round exists', () => {
    expect(heroSource).toContain('进入动机投票')
    expect(heroSource).toContain('voteRound === 1 && hasMotiveRound && onOpenMotiveVote')
  })

  it('renders motiveOptions as round-2 option cards submitting voteRound 2', () => {
    expect(heroSource).toContain('(motiveOptions ?? EMPTY_MOTIVE_OPTIONS).map')
    expect(heroSource).toContain('onVote({ voteRound: 2, motiveChoice })')
  })

  it('shows the public honor list for dual-correct players only', () => {
    expect(heroSource).toContain('本桌名侦探')
    expect(heroSource).toContain('r.round1Correct === true && r.round2Correct === true')
  })

  it('keeps wrong-answer feedback private to the own device', () => {
    expect(heroSource).toContain('差一点点——当事人其实是')
    expect(heroSource).toContain('playerResults.find((r) => r.userId === currentUserId)')
  })

  it('ships both one-time Xiaoyue hints with persisted dismissal', () => {
    expect(heroSource).toContain('把证物出示给想试探的人，听听 TA 怎么说')
    expect(heroSource).toContain('MINISCRIPT_EVIDENCE_HINT_STORAGE_KEY')
    expect(heroSource).toContain('MINISCRIPT_MOTIVE_HINT_STORAGE_KEY')
    expect(heroSource).toContain('persistHintSeen')
  })
})

describe('MiniScript V2 P3 · copy + waiting states (audit fixes)', () => {
  it('softens the round-2 hint and the round-1 why prompt', () => {
    expect(heroSource).toContain('还没完——再猜猜 TA 为什么这么做')
    expect(heroSource).not.toContain('猜对人还不够——再猜猜 TA 为什么这么做')
    expect(heroSource).toContain('随口聊聊你的推理')
  })

  it('tells round-1 players exactly who they are waiting for once the ballot can close', () => {
    // Player view: hasMotiveRound && voteRound === 1 && canReveal → the stale
    // 还在等 N 位 line is replaced by the explicit host wait.
    expect(heroSource).toContain('等待主持人开启动机投票')
    expect(heroSource).toContain('hasMotiveRound && voteRound === 1 && voteProgress.canReveal')
  })

  it('keeps interactive hit areas at ≥88rpx (vote-change / hint-dismiss / clue bar)', () => {
    const heroStyles = readFileSync(
      resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptHeroView.scss'),
      'utf8',
    )
    const drawerStyles = readFileSync(
      resolve(process.cwd(), 'src/pages/icebreaker-session/phases/MiniScriptClueDrawer.scss'),
      'utf8',
    )
    expect(heroStyles).toMatch(/&__vote-change\s*{[^}]*min-height:\s*88rpx;/s)
    expect(heroStyles).toMatch(/&__hint-dismiss\s*{[^}]*min-height:\s*88rpx;/s)
    expect(drawerStyles).toMatch(/&__bar\s*{[^}]*min-height:\s*88rpx;/s)
  })

  it('hoists empty-array fallbacks to module constants (memo hygiene)', () => {
    expect(heroSource).toContain('const EMPTY_VOTES')
    expect(heroSource).toContain('const EMPTY_PRESENTED_EVIDENCE')
    expect(heroSource).toContain('const EMPTY_PLAYER_RESULTS')
    expect(heroSource).toContain('session.miniScriptPresentedEvidence ?? EMPTY_PRESENTED_EVIDENCE')
    expect(heroSource).toContain('const handleSubmitVote = useCallback(')
    expect(heroSource).toContain('const handleSubmitMotiveVote = useCallback(')
  })
})

describe('MiniScript V2 P2 · style bundling (subpackage WXSS trap)', () => {
  it('@uses the new component stylesheets from the page SCSS', () => {
    expect(pageStyles).toContain("@use './phases/MiniScriptEvidenceTray';")
    expect(pageStyles).toContain("@use './phases/MiniScriptClueDrawer';")
  })

  it('never imports component SCSS from the component TSX (sub-common.wxss trap)', () => {
    expect(traySource).not.toContain("import './MiniScriptEvidenceTray.scss'")
    expect(drawerSource).not.toContain("import './MiniScriptClueDrawer.scss'")
  })
})
