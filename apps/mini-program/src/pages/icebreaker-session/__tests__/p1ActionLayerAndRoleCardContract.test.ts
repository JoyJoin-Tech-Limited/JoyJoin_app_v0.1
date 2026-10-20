import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSrc = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const undercover = readSrc('src/pages/icebreaker-session/phases/UndercoverWordHeroView.tsx')
const groupMirror = readSrc('src/pages/icebreaker-session/phases/GroupMirrorHeroView.tsx')
const quipBattle = readSrc('src/pages/icebreaker-session/phases/QuipBattleHeroView.tsx')
const recap = readSrc('src/pages/icebreaker-session/phases/RecapPhaseView.tsx')
const phaseViews = readSrc('src/pages/icebreaker-session/SessionPhaseViews.tsx')
const page = readSrc('src/pages/icebreaker-session/index.tsx')
const actions = readSrc('src/pages/icebreaker-session/hooks/useSocialActions.ts')

/**
 * Wave 2 P1 action-layer 归口 (sprint icebreaker-polish-p1, contract AC-01).
 *
 * The four phase views used to fire their own writes straight at apiRequest
 * — no confirm haptic, no mutex, and Undercover/GroupMirror never even
 * refetched, so a submit could sit silent for up to one 3s poll tick. Every
 * self-state write now rides `performSocialAction` via useSocialActions.
 * Read-only calls (quip results GET, moment-card GET) are exempt.
 */
describe('AC-01 · 四视图无直发写操作', () => {
  it('no view fires a POST/PUT/DELETE through apiRequest directly', () => {
    for (const [name, source] of [
      ['UndercoverWordHeroView', undercover],
      ['GroupMirrorHeroView', groupMirror],
      ['QuipBattleHeroView', quipBattle],
      ['RecapPhaseView', recap],
    ] as const) {
      const writeCalls = source.match(/apiRequest[<(][\s\S]{0,240}?method:\s*'(POST|PUT|DELETE|PATCH)'/g) ?? []
      expect(writeCalls, `${name} must not fire writes directly: ${writeCalls.join(' | ')}`).toEqual([])
    }
  })

  it('the writes live in useSocialActions on the shared dispatcher', () => {
    for (const key of [
      "'undercover-generate'",
      "'undercover-describe'",
      "'undercover-vote'",
      "'undercover-reveal'",
      "'group-mirror-generate'",
      "'group-mirror-submit'",
      "'group-mirror-reveal'",
      "'quip-generate'",
      "'quip-submit'",
      "'quip-vote'",
      "'recap-ai-feedback'",
    ]) {
      expect(actions).toContain(`performSocialAction(${key}`)
    }
    // Dispatcher contract: success syncs + refetches (no 3s dead air).
    expect(actions).toContain('syncSocialActionResponse')
  })

  it('SessionPhaseViews forwards the handlers + pending-derived busy flags', () => {
    for (const token of [
      'onUndercoverDescribe: handleUndercoverDescribe',
      'onGroupMirrorSubmit: handleGroupMirrorSubmit',
      'onQuipVote: handleQuipVote',
      'onSubmitRecapFeedback: handleRecapAiFeedback',
    ]) {
      expect(page).toContain(token)
    }
    for (const token of [
      "isSubmitting={pendingAction === 'undercover-describe'}",
      "isVoting={pendingAction === 'undercover-vote'}",
      "isSubmitting={pendingAction === 'group-mirror-submit'}",
      "isVoting={pendingAction === 'quip-vote'}",
    ]) {
      expect(phaseViews).toContain(token)
    }
  })

  it('views consume result semantics: null = failure (inline copy)', () => {
    // Each view keeps its inline error surface via the null branch; the
    // dispatcher's error toast is suppressed for these actions.
    expect(undercover).toContain('if (result === null)')
    expect(groupMirror).toContain('if (result === null)')
    expect(quipBattle).toContain('if (result === null)')
    expect(actions.match(/suppressErrorToast: true/g)?.length ?? 0).toBeGreaterThanOrEqual(11)
  })
})

/**
 * Wave 2 P1 剧本卡 (contract AC-04): the role card flips BOTH ways and
 * re-show lands it face-down.
 */
describe('AC-04 · MiniScript 角色卡双向翻 + didShow 盖态', () => {
  const hero = readSrc('src/pages/icebreaker-session/phases/MiniScriptHeroView.tsx')

  it('the one-way flip guard is gone — the card toggles', () => {
    expect(hero).not.toContain('if (!roleFlipped) setRoleFlipped(true)')
    expect(hero).toContain('setRoleFlipped((v) => !v)')
  })

  it('useDidShow resets the card to face-down (离页→回=盖态)', () => {
    const didShowBlock = hero.match(/useDidShow\(\(\) => \{[\s\S]*?\}\)/)?.[0] ?? ''
    expect(didShowBlock).toContain('setRoleFlipped(false)')
  })

  it('initial state is face-down (翻→盖→离页→回=盖态 baseline)', () => {
    expect(hero).toContain('useState(false)')
    // roleFlipped is the first local UI state declared as false.
    expect(hero).toContain('const [roleFlipped, setRoleFlipped] = useState(false)')
  })
})
