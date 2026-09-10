import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import { Fragment } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type {
  MiniScriptPresentedEvidence,
  MiniScriptVote,
  SocialSessionState,
} from '@shared/socialIcebreaker'
import type {
  MiniScriptCharacterPublic,
  MiniScriptStoryFrameworkPublic,
} from '@shared/miniscriptStoryFramework'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { CardFlip } from '../../../components/reveal'
import { haptics } from '../../../lib/utils/haptics'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import { MiniScriptClueDrawer } from './MiniScriptClueDrawer'
import { MiniScriptEvidenceTray } from './MiniScriptEvidenceTray'
import {
  TRUTH_CEREMONY_CONTINUE_HINT,
  TRUTH_CEREMONY_HOST_NEXT_CTA,
  TRUTH_CEREMONY_STAGE_TITLE,
  TRUTH_CEREMONY_WAITING_HOST_HINT,
} from './miniScriptTruthCeremonyModel'
import type { useTruthCeremonyStage } from './useTruthCeremonyStage'
// Styles are @use'd by the page SCSS (index.scss) — see the sub-common.wxss
// staging note in MiniScriptHeroView.tsx. This module was extracted (2026-09-10)
// to keep MiniScriptHeroView under the harness size gate; it is pure
// presentational JSX — no hooks, no state.

type MiniScriptRoleView = NonNullable<SocialSessionState['miniScriptPlayerRuntimeViews']>[string]
type MiniScriptAct = MiniScriptStoryFrameworkPublic['act_flow'][number]
type MiniScriptVoteOptions = NonNullable<MiniScriptStoryFrameworkPublic['voteOptions']>
type MiniScriptSolution = NonNullable<SocialSessionState['miniScriptRevealedSolution']>
type TallyRow = { key: string; label: string; count: number }
type RevealedClue = { clueId: string; text: string; revealedInAct?: number }

// Module-level empty fallback — a `?? []` inline allocates a fresh array on
// every render, which busts every downstream useMemo keyed on the value.
const EMPTY_MOTIVE_OPTIONS: string[] = []

// ── Display-text hygiene (shared with MiniScriptHeroView) ───────────────────
// Legacy LLM content embedded snake_case machine tokens (genre keys like
// absurd_comedy) into premise/title/beats. The server strips them for new
// content; strip defensively here so old sessions never render raw keys.
export function sanitizeDisplayText(text: string): string {
  return text
    .replace(/[A-Za-z]+(?:_[A-Za-z0-9]+)+/g, '')
    .replace(/（\s*[、，,；;：:\s]*）/g, '')
    .replace(/\(\s*[、，,；;：:\s]*\)/g, '')
    .replace(/[、，；]\s*(?=[、，；。])/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Older server data self-numbered clue texts (「线索 1：…」); the client owns
 *  numbering via render index, so strip any embedded prefix defensively. */
export function stripCluePrefix(text: string): string {
  return sanitizeDisplayText(text.replace(/^线索\s*\d+\s*[:：]\s*/, ''))
}

/** V2 P3: shared 本桌名侦探 honor-card markup — ceremony stage D and the
 *  steady-state truth view render the same cards (the staggered pop-in lives
 *  in CSS; the reduced-motion media query flattens it). `privateLine` is the
 *  viewer's own result — it stays on their device only. */
export function HonorCardList({ honorNames, privateLine }: { honorNames: string[]; privateLine: string | null }) {
  return (
    <View className='miniscript-hero__honor-cards'>
      {honorNames.length > 0 ? (
        honorNames.map((name, index) => (
          <View key={`${name}-${index}`} className='miniscript-hero__honor-card'>
            <JoyJoinIcon emoji='🔍' size={32} />
            <Text className='miniscript-hero__honor-name'>{name}</Text>
          </View>
        ))
      ) : (
        <Text className='miniscript-hero__honor-empty'>今晚的真相藏得真好，没有人两步全中</Text>
      )}
      {privateLine ? <Text className='miniscript-hero__honor-private'>{privateLine}</Text> : null}
    </View>
  )
}

export function MiniScriptPreviewView({
  framework,
  premiseText,
  characters,
  totalActs,
  playMinutes,
  stepLabels,
  showFullScript,
  setShowFullScript,
}: {
  framework: MiniScriptStoryFrameworkPublic | undefined
  premiseText: string
  characters: MiniScriptCharacterPublic[]
  totalActs: number
  playMinutes: number
  stepLabels: string[]
  showFullScript: boolean
  setShowFullScript: Dispatch<SetStateAction<boolean>>
}) {
  if (!framework) return null
  return (
    <>
      <Text className='miniscript-hero__preview-premise'>{premiseText}</Text>
      <View className='miniscript-hero__preview-meta'>
        <Text className='miniscript-hero__preview-meta-item'>{characters.length} 角色</Text>
        <Text className='miniscript-hero__preview-meta-item'>{totalActs} 幕</Text>
        <Text className='miniscript-hero__preview-meta-item'>约 {playMinutes} 分钟</Text>
      </View>
      <View className='miniscript-hero__chips'>
        {characters.map((role) => (
          <Text key={role.slotIndex} className='miniscript-hero__chip'>{role.roleLabel}</Text>
        ))}
      </View>
      <View className='miniscript-hero__flow'>
        {stepLabels.map((label, idx) => (
          <Fragment key={label}>
            {idx > 0 ? <Text className='miniscript-hero__flow-arrow'>→</Text> : null}
            <Text className='miniscript-hero__flow-step'>{label}</Text>
          </Fragment>
        ))}
      </View>
      <View className='miniscript-hero__section'>
        <View
          className='miniscript-hero__section-header'
          onClick={() => setShowFullScript((v) => !v)}
          role='button'
          aria-expanded={showFullScript}
          aria-label='查看完整剧本'
        >
          <Text className='miniscript-hero__section-title'>查看完整剧本</Text>
          <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showFullScript ? '▼' : '▶'}</Text>
        </View>
        {showFullScript ? (
          <>
            <Text className='miniscript-hero__beat'>{premiseText}</Text>
            {framework.act_flow.map((act) => (
              <View key={act.actNumber} className='miniscript-hero__script-act'>
                <Text className='miniscript-hero__script-act-title'>
                  第 {act.actNumber} 幕 · {sanitizeDisplayText(act.title)}
                </Text>
                {act.beats.map((beat, index) => (
                  <Text key={index} className='miniscript-hero__beat'>· {sanitizeDisplayText(beat)}</Text>
                ))}
              </View>
            ))}
            <Text className='miniscript-hero__beat'>结局：{sanitizeDisplayText(framework.ending.resolutionSummary)}</Text>
          </>
        ) : null}
      </View>
    </>
  )
}

export function MiniScriptWaitingView() {
  return (
    <View className='miniscript-hero__waiting'>
      <Image
        className='miniscript-hero__waiting-mascot'
        src={getXiaoyueExpressionAsset('matchWaiting')}
        mode='aspectFit'
      />
      <Text className='miniscript-hero__waiting-text'>剧本已就位，等主持人发牌就能开场</Text>
    </View>
  )
}

export function MiniScriptRoleView({
  roleFlipped,
  setRoleFlipped,
  myRole,
  premiseText,
  roleNeedsScroll,
  showPremise,
  setShowPremise,
}: {
  roleFlipped: boolean
  setRoleFlipped: Dispatch<SetStateAction<boolean>>
  myRole: MiniScriptRoleView | undefined
  premiseText: string
  roleNeedsScroll: boolean
  showPremise: boolean
  setShowPremise: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <>
      <View className='miniscript-hero__role-flip'>
        <CardFlip
          flipped={roleFlipped}
          onFlip={() => {
            if (!roleFlipped) setRoleFlipped(true)
          }}
          front={
            <View className='miniscript-hero__role-front'>
              <JoyJoinIcon emoji='🎭' size={64} />
              <Text className='miniscript-hero__role-front-label'>你的角色是？</Text>
              <Text className='miniscript-hero__role-front-hint'>轻触卡片揭晓</Text>
            </View>
          }
          back={
            <View className='miniscript-hero__role-back'>
              {myRole ? (
                <>
                  <Text className='miniscript-hero__role-back-title'>{myRole.roleLabel}</Text>
                  <ScrollView
                    className='miniscript-hero__role-back-scroll'
                    scrollY
                    enhanced
                    showScrollbar={false}
                    aria-label='角色详情，可上下滑动'
                  >
                    <Text className='miniscript-hero__role-back-line'>{myRole.sinHook}</Text>
                    <Text className='miniscript-hero__role-back-line'>表面：{myRole.alibi}</Text>
                    {myRole.secretAgenda ? (
                      <>
                        <Text className='miniscript-hero__role-back-label'>你的秘密 · 先别告诉别人</Text>
                        <Text className='miniscript-hero__role-back-line miniscript-hero__role-back-line--secret'>
                          {myRole.secretAgenda}
                        </Text>
                      </>
                    ) : null}
                  </ScrollView>
                  {roleNeedsScroll ? (
                    <Text className='miniscript-hero__role-back-scroll-hint'>向上滑动查看更多</Text>
                  ) : null}
                </>
              ) : (
                <Text className='miniscript-hero__role-back-line'>你尚未被分配角色。</Text>
              )}
            </View>
          }
        />
      </View>
      <View className='miniscript-hero__section'>
        <View
          className='miniscript-hero__section-header'
          onClick={() => setShowPremise((v) => !v)}
          role='button'
          aria-expanded={showPremise}
          aria-label='故事背景'
        >
          <Text className='miniscript-hero__section-title'>故事背景</Text>
          <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showPremise ? '▼' : '▶'}</Text>
        </View>
        {showPremise ? <Text className='miniscript-hero__beat'>{premiseText}</Text> : null}
      </View>
    </>
  )
}

export function MiniScriptActView({
  framework,
  revealedClues,
  currentAct,
  showClueDrawer,
  newClues,
  showEvidenceHint,
  dismissEvidenceHint,
  showEvidenceTray,
  characters,
  presentedEvidence,
  currentUserId,
  isPresentingEvidence,
  presentingClosed,
  onPresentEvidence,
  onConfirmRead,
  myRole,
  roleExpanded,
  setRoleExpanded,
  isHost,
  currentActData,
  showBeats,
  setShowBeats,
  deductionHints,
  showDeductionHints,
  setShowDeductionHints,
}: {
  framework: MiniScriptStoryFrameworkPublic | undefined
  revealedClues: RevealedClue[]
  currentAct: number
  showClueDrawer: boolean
  newClues: RevealedClue[]
  showEvidenceHint: boolean
  dismissEvidenceHint: () => void
  showEvidenceTray: boolean
  characters: MiniScriptCharacterPublic[]
  presentedEvidence: MiniScriptPresentedEvidence[]
  currentUserId: string
  isPresentingEvidence: boolean
  presentingClosed: boolean
  onPresentEvidence?: (evidenceId: string, targetRoleSlot: number) => Promise<string | null>
  onConfirmRead?: (evidenceId: string, targetRoleSlot: number) => void
  myRole: MiniScriptRoleView | undefined
  roleExpanded: boolean
  setRoleExpanded: Dispatch<SetStateAction<boolean>>
  isHost: boolean
  currentActData: MiniScriptAct | undefined
  showBeats: boolean
  setShowBeats: Dispatch<SetStateAction<boolean>>
  deductionHints: Array<{ stepNumber: number; conclusion: string }>
  showDeductionHints: boolean
  setShowDeductionHints: Dispatch<SetStateAction<boolean>>
}) {
  return (
    <>
      {showClueDrawer && framework ? (
        <MiniScriptClueDrawer
          framework={framework}
          revealedClues={revealedClues}
          currentAct={currentAct}
        />
      ) : null}

      {newClues.length > 0 ? (
        <View className='miniscript-hero__section miniscript-hero__section--new-clues'>
          <Text className='miniscript-hero__section-title'>本幕新线索</Text>
          {newClues.map((clue) => (
            <View key={clue.clueId} className='miniscript-hero__clue-focus'>
              <Text className='miniscript-hero__clue-focus-text'>{stripCluePrefix(clue.text)}</Text>
              <Text className='miniscript-hero__clue-new'>新线索</Text>
            </View>
          ))}
        </View>
      ) : null}

      {showEvidenceHint ? (
        <View className='miniscript-hero__hint' role='note'>
          <Image
            className='miniscript-hero__hint-mascot'
            src={getXiaoyueExpressionAsset('coachGuide')}
            mode='aspectFit'
          />
          <Text className='miniscript-hero__hint-text'>把证物出示给想试探的人，听听 TA 怎么说</Text>
          <View
            className='miniscript-hero__hint-dismiss'
            role='button'
            aria-label='知道了'
            onClick={dismissEvidenceHint}
          >
            <Text className='miniscript-hero__hint-dismiss-text'>知道了</Text>
          </View>
        </View>
      ) : null}

      {showEvidenceTray && framework ? (
        <MiniScriptEvidenceTray
          framework={framework}
          currentAct={currentAct}
          characters={characters}
          presentedEvidence={presentedEvidence}
          currentUserId={currentUserId}
          isPresenting={isPresentingEvidence}
          presentingClosed={presentingClosed}
          onPresent={onPresentEvidence!}
          onConfirmRead={onConfirmRead}
        />
      ) : null}

      {myRole ? (
        <View className='miniscript-hero__section'>
          <View
            className='miniscript-hero__section-header'
            onClick={() => setRoleExpanded((v) => !v)}
            role='button'
            aria-expanded={roleExpanded}
            aria-label='我的角色详情'
          >
            <Text className='miniscript-hero__section-title'>我的角色 · {myRole.roleLabel}</Text>
            <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{roleExpanded ? '▼' : '▶'}</Text>
          </View>
          {roleExpanded ? (
            <>
              <Text className='miniscript-hero__beat'>表面：{myRole.alibi}</Text>
              {myRole.secretAgenda ? (
                <Text className='miniscript-hero__secret'>你的秘密：{myRole.secretAgenda}</Text>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {isHost && currentActData ? (
        <View className='miniscript-hero__section'>
          <View
            className='miniscript-hero__section-header'
            onClick={() => setShowBeats((v) => !v)}
            role='button'
            aria-expanded={showBeats}
            aria-label='主持人提词'
          >
            <Text className='miniscript-hero__section-title'>主持人提词</Text>
            <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showBeats ? '▼' : '▶'}</Text>
          </View>
          {showBeats
            ? currentActData.beats.map((beat, index) => (
                <Text key={index} className='miniscript-hero__beat'>· {sanitizeDisplayText(beat)}</Text>
              ))
            : null}
        </View>
      ) : null}

      {deductionHints.length > 0 ? (
        <View className='miniscript-hero__section'>
          <View
            className='miniscript-hero__section-header'
            onClick={() => setShowDeductionHints(!showDeductionHints)}
            role='button'
            aria-expanded={showDeductionHints}
            aria-label='推理提示'
          >
            <Text className='miniscript-hero__section-title'>推理提示（{deductionHints.length}）</Text>
            <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showDeductionHints ? '▼' : '▶'}</Text>
          </View>
          {showDeductionHints && deductionHints.map((hint) => (
            <Text key={hint.stepNumber} className='miniscript-hero__beat'>
              步骤 {hint.stepNumber}：{hint.conclusion}
            </Text>
          ))}
        </View>
      ) : null}
    </>
  )
}

export function MiniScriptVoteView({
  myVote,
  voteEditing,
  setVoteEditing,
  myVotedLabel,
  waitingForMotiveOpen,
  waitingOnCount,
  characters,
  suspectSlot,
  setSuspectSlot,
  voteOptions,
  voteWhat,
  setVoteWhat,
  voteWhy,
  setVoteWhy,
  voteReason,
  setVoteReason,
  isVoting,
  totalActs,
  handleSubmitVote,
  setFinalActSubView,
}: {
  myVote: MiniScriptVote | undefined
  voteEditing: boolean
  setVoteEditing: Dispatch<SetStateAction<boolean>>
  myVotedLabel: string
  waitingForMotiveOpen: boolean
  waitingOnCount: number
  characters: MiniScriptCharacterPublic[]
  suspectSlot: number | null
  setSuspectSlot: Dispatch<SetStateAction<number | null>>
  voteOptions: MiniScriptVoteOptions | undefined
  voteWhat: string
  setVoteWhat: Dispatch<SetStateAction<string>>
  voteWhy: string
  setVoteWhy: Dispatch<SetStateAction<string>>
  voteReason: string
  setVoteReason: Dispatch<SetStateAction<string>>
  isVoting: boolean
  totalActs: number
  handleSubmitVote: () => void
  setFinalActSubView: Dispatch<SetStateAction<'act' | 'vote'>>
}) {
  return (
    <>
      {myVote && !voteEditing ? (
        <View className='miniscript-hero__vote-status'>
          <Text className='miniscript-hero__vote-status-text'>
            已投给 {myVotedLabel || '一位角色'}
            {waitingForMotiveOpen ? ' · 等待主持人开启动机投票' : waitingOnCount > 0 ? ` · 还在等 ${waitingOnCount} 位` : ''}
          </Text>
          <View
            className='miniscript-hero__vote-change'
            role='button'
            aria-label='改票'
            onClick={() => {
              haptics('light')
              setVoteEditing(true)
            }}
          >
            <Text>改票</Text>
          </View>
        </View>
      ) : (
        <>
          <View className='miniscript-hero__section'>
            <Text className='miniscript-hero__section-title'>你怀疑谁？</Text>
            <View className='miniscript-hero__vote-chips'>
              {characters.map((role) => {
                const slot = role.slotIndex + 1
                const selected = suspectSlot === slot
                return (
                  <View
                    key={role.slotIndex}
                    className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                    role='button'
                    aria-label={`${role.roleLabel}${selected ? '，已选择' : '，未选择'}`}
                    aria-pressed={selected}
                    onClick={() => {
                      haptics('light')
                      setSuspectSlot(slot)
                    }}
                  >
                    <Text>{role.roleLabel}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          {voteOptions ? (
            <>
              <View className='miniscript-hero__section'>
                <Text className='miniscript-hero__section-title'>具体做了什么？</Text>
                <View className='miniscript-hero__vote-chips'>
                  {voteOptions.what.map((option) => {
                    const selected = voteWhat === option
                    return (
                      <View
                        key={option}
                        className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                        role='button'
                        aria-pressed={selected}
                        aria-label={option}
                        onClick={() => {
                          haptics('light')
                          setVoteWhat(selected ? '' : option)
                        }}
                      >
                        <Text>{option}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
              <View className='miniscript-hero__section'>
                <Text className='miniscript-hero__section-title'>随口聊聊你的推理</Text>
                <View className='miniscript-hero__vote-chips'>
                  {voteOptions.why.map((option) => {
                    const selected = voteWhy === option
                    return (
                      <View
                        key={option}
                        className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                        role='button'
                        aria-pressed={selected}
                        aria-label={option}
                        onClick={() => {
                          haptics('light')
                          setVoteWhy(selected ? '' : option)
                        }}
                      >
                        <Text>{option}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            </>
          ) : (
            <View className='miniscript-hero__section'>
              <Text className='miniscript-hero__section-title'>还有想说的吗？</Text>
              <Input
                className='miniscript-hero__vote-input'
                value={voteReason}
                onInput={(e) => setVoteReason(e.detail.value)}
                placeholder='说说你的推理（可跳过）'
                maxlength={200}
              />
            </View>
          )}

          <Button
            variant='primary'
            onClick={handleSubmitVote}
            disabled={isVoting || suspectSlot === null}
            loading={isVoting}
          >
            {isVoting ? '提交中…' : '提交投票'}
          </Button>
        </>
      )}
      <View
        className='miniscript-hero__link'
        role='button'
        aria-label={`返回第 ${totalActs} 幕`}
        onClick={() => {
          haptics('light')
          setFinalActSubView('act')
        }}
      >
        <Text>‹ 返回第 {totalActs} 幕</Text>
      </View>
    </>
  )
}

export function MiniScriptMotiveVoteView({
  showMotiveHint,
  dismissMotiveHint,
  myMotiveVote,
  motiveEditing,
  setMotiveEditing,
  myMotiveLabel,
  motiveWaitingCount,
  motiveOptions,
  motiveChoice,
  setMotiveChoice,
  isVoting,
  handleSubmitMotiveVote,
}: {
  showMotiveHint: boolean
  dismissMotiveHint: () => void
  myMotiveVote: MiniScriptVote | undefined
  motiveEditing: boolean
  setMotiveEditing: Dispatch<SetStateAction<boolean>>
  myMotiveLabel: string
  motiveWaitingCount: number
  motiveOptions: string[] | undefined
  motiveChoice: number | null
  setMotiveChoice: Dispatch<SetStateAction<number | null>>
  isVoting: boolean
  handleSubmitMotiveVote: () => void
}) {
  return (
    <>
      {showMotiveHint ? (
        <View className='miniscript-hero__hint' role='note'>
          <Image
            className='miniscript-hero__hint-mascot'
            src={getXiaoyueExpressionAsset('coachGuide')}
            mode='aspectFit'
          />
          <Text className='miniscript-hero__hint-text'>还没完——再猜猜 TA 为什么这么做</Text>
          <View
            className='miniscript-hero__hint-dismiss'
            role='button'
            aria-label='知道了'
            onClick={dismissMotiveHint}
          >
            <Text className='miniscript-hero__hint-dismiss-text'>知道了</Text>
          </View>
        </View>
      ) : null}

      {myMotiveVote && !motiveEditing ? (
        <View className='miniscript-hero__vote-status'>
          <Text className='miniscript-hero__vote-status-text'>
            动机已投给「{myMotiveLabel || '一个选项'}」{motiveWaitingCount > 0 ? ` · 还在等 ${motiveWaitingCount} 位` : ''}
          </Text>
          <View
            className='miniscript-hero__vote-change'
            role='button'
            aria-label='改票'
            onClick={() => {
              haptics('light')
              setMotiveEditing(true)
            }}
          >
            <Text>改票</Text>
          </View>
        </View>
      ) : (
        <>
          <View className='miniscript-hero__section'>
            <Text className='miniscript-hero__section-title'>TA 为什么这么做？</Text>
            <View className='miniscript-hero__vote-chips'>
              {(motiveOptions ?? EMPTY_MOTIVE_OPTIONS).map((option, index) => {
                const selected = motiveChoice === index
                return (
                  <View
                    key={option}
                    className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                    role='button'
                    aria-label={`${option}${selected ? '，已选择' : '，未选择'}`}
                    aria-pressed={selected}
                    onClick={() => {
                      haptics('light')
                      setMotiveChoice(index)
                    }}
                  >
                    <Text>{option}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <Button
            variant='primary'
            onClick={handleSubmitMotiveVote}
            disabled={isVoting || motiveChoice === null}
            loading={isVoting}
          >
            {isVoting ? '提交中…' : '提交动机'}
          </Button>
        </>
      )}
    </>
  )
}

export function MiniScriptTruthView({
  framework,
  revealedSolution,
  culpritCharacter,
  guessedCount,
  showTwoStepResults,
  honorNames,
  honorPrivateLine,
  characters,
  myRole,
  confessFlipped,
  setConfessFlipped,
  tallyRows,
  votedCount,
  scriptTitle,
  isHost,
}: {
  framework: MiniScriptStoryFrameworkPublic | undefined
  revealedSolution: MiniScriptSolution | undefined
  culpritCharacter: MiniScriptCharacterPublic | undefined
  guessedCount: number | undefined
  showTwoStepResults: boolean
  honorNames: string[]
  honorPrivateLine: string | null
  characters: MiniScriptCharacterPublic[]
  myRole: MiniScriptRoleView | undefined
  confessFlipped: boolean
  setConfessFlipped: Dispatch<SetStateAction<boolean>>
  tallyRows: TallyRow[]
  votedCount: number
  scriptTitle: string
  isHost: boolean
}) {
  if (!framework) return null
  return (
    <>
      <View className='miniscript-hero__section miniscript-hero__section--truth'>
        {revealedSolution ? (
          <>
            <Text className='miniscript-hero__truth-label'>真相人物</Text>
            <Text className='miniscript-hero__truth-who'>{culpritCharacter?.roleLabel ?? revealedSolution.who}</Text>
            <Text className='miniscript-hero__truth-label'>发生了什么</Text>
            <Text className='miniscript-hero__beat'>{revealedSolution.what}</Text>
            <Text className='miniscript-hero__truth-label'>背后原因</Text>
            <Text className='miniscript-hero__beat'>{revealedSolution.why}</Text>
            {guessedCount !== undefined ? (
              <Text className='miniscript-hero__truth-guessed'>{guessedCount} 人猜中了！</Text>
            ) : null}
            {showTwoStepResults ? (
              <View className='miniscript-hero__honor'>
                <Text className='miniscript-hero__honor-title'>本桌名侦探</Text>
                <HonorCardList honorNames={honorNames} privateLine={honorPrivateLine} />
              </View>
            ) : null}
          </>
        ) : (
          <Text className='miniscript-hero__beat'>真相正在同步，请稍候。</Text>
        )}
      </View>

      <View className='miniscript-hero__section'>
        <Text className='miniscript-hero__section-title'>认领小秘密</Text>
        <Text className='miniscript-hero__confession'>{sanitizeDisplayText(framework.ending.confessionMechanic)}</Text>
        {characters.map((role) => {
          const isMine = myRole?.slotIndex === role.slotIndex
          if (isMine && myRole?.secretAgenda) {
            return (
              <View key={role.slotIndex} className='miniscript-hero__confess-card'>
                <CardFlip
                  flipped={confessFlipped}
                  onFlip={() => setConfessFlipped((f) => !f)}
                  front={
                    <View className='miniscript-hero__confess-front'>
                      <Text className='miniscript-hero__confess-role'>{role.roleLabel}</Text>
                      <Text className='miniscript-hero__confess-hint'>你的秘密 · 轻触亮相</Text>
                    </View>
                  }
                  back={
                    <View className='miniscript-hero__confess-back'>
                      <Text className='miniscript-hero__confess-role'>{role.roleLabel}</Text>
                      <Text className='miniscript-hero__confess-secret'>你的秘密：{myRole.secretAgenda}</Text>
                    </View>
                  }
                />
              </View>
            )
          }
          return (
            <View key={role.slotIndex} className='miniscript-hero__confess-card'>
              <Text className='miniscript-hero__confess-role'>{role.roleLabel}</Text>
              <Text className='miniscript-hero__confess-hint'>
                {isHost ? '请 TA 大声说出自己的秘密' : '等 TA 亲口说出秘密'}
              </Text>
            </View>
          )
        })}
      </View>

      {tallyRows.length > 0 ? (
        <View className='miniscript-hero__section'>
          <Text className='miniscript-hero__section-title'>投票结果</Text>
          {tallyRows.map((row) => (
            <View key={row.key} className='miniscript-hero__vote-row'>
              <Text className='miniscript-hero__beat'>{row.label}</Text>
              <Text className='miniscript-hero__vote-count'>{row.count} 票</Text>
            </View>
          ))}
          <Text className='miniscript-hero__vote-total'>共 {votedCount} 人参与投票</Text>
        </View>
      ) : null}

      <View className='miniscript-hero__still'>
        <Text className='miniscript-hero__still-label'>今晚剧照</Text>
        <Text className='miniscript-hero__still-title'>{scriptTitle}</Text>
        <View className='miniscript-hero__still-roles'>
          {characters.map((role) => (
            <Text key={role.slotIndex} className='miniscript-hero__still-role'>{role.roleLabel}</Text>
          ))}
        </View>
        <Text className='miniscript-hero__still-outcome'>{sanitizeDisplayText(framework.ending.resolutionSummary)}</Text>
      </View>
    </>
  )
}

export function MiniScriptCeremonyView({
  ceremony,
  ceremonyStages,
  revealedSolution,
  tallyRows,
  votedCount,
  culpritCharacter,
  guessedCount,
  honorNames,
  honorPrivateLine,
  isHost,
  onAdvanceCeremony,
  isAdvancingCeremony,
}: {
  ceremony: ReturnType<typeof useTruthCeremonyStage>
  ceremonyStages: string[]
  revealedSolution: MiniScriptSolution | undefined
  tallyRows: TallyRow[]
  votedCount: number
  culpritCharacter: MiniScriptCharacterPublic | undefined
  guessedCount: number | undefined
  honorNames: string[]
  honorPrivateLine: string | null
  isHost: boolean
  onAdvanceCeremony?: () => void
  isAdvancingCeremony: boolean
}) {
  const stage = ceremony.stage
  if (!stage || !revealedSolution) return null
  const revealed = ceremony.stageRevealed
  return (
    <View
      className='miniscript-hero__ceremony'
      role={revealed ? 'button' : undefined}
      aria-label={revealed ? TRUTH_CEREMONY_CONTINUE_HINT : undefined}
      onClick={
        revealed
          ? () => {
              haptics('light')
              ceremony.advance()
            }
          : undefined
      }
    >
      <View className='miniscript-hero__ceremony-dots' aria-hidden='true'>
        {ceremonyStages.map((dotStage, dotIndex) => (
          <View
            key={dotStage}
            className={`miniscript-hero__ceremony-dot${dotIndex === ceremony.stageIndex ? ' miniscript-hero__ceremony-dot--active' : ''}${dotIndex < ceremony.stageIndex ? ' miniscript-hero__ceremony-dot--past' : ''}`}
          />
        ))}
      </View>
      <View key={stage} className='miniscript-hero__ceremony-stage'>
        <Text className='miniscript-hero__ceremony-title'>{TRUTH_CEREMONY_STAGE_TITLE[stage]}</Text>
        {revealed && stage === 'tally' ? (
          <View className='miniscript-hero__ceremony-panel'>
            {tallyRows.map((row) => (
              <View key={row.key} className='miniscript-hero__vote-row'>
                <Text className='miniscript-hero__beat'>{row.label}</Text>
                <Text className='miniscript-hero__vote-count'>{row.count} 票</Text>
              </View>
            ))}
            <Text className='miniscript-hero__vote-total'>共 {votedCount} 人参与投票</Text>
          </View>
        ) : null}
        {revealed && stage === 'culprit' ? (
          <View className='miniscript-hero__culprit-card'>
            <Text className='miniscript-hero__culprit-label'>真相人物</Text>
            <Text className='miniscript-hero__culprit-name'>{culpritCharacter?.roleLabel ?? revealedSolution.who}</Text>
            <Text className='miniscript-hero__culprit-what'>{revealedSolution.what}</Text>
            {guessedCount !== undefined ? (
              <Text className='miniscript-hero__truth-guessed'>{guessedCount} 人猜中了！</Text>
            ) : null}
          </View>
        ) : null}
        {revealed && stage === 'motive' ? (
          <View className='miniscript-hero__motive-card'>
            <Text className='miniscript-hero__motive-label'>真动机</Text>
            <Text className='miniscript-hero__motive-text'>{revealedSolution.why}</Text>
          </View>
        ) : null}
        {revealed && stage === 'honor' ? (
          <HonorCardList honorNames={honorNames} privateLine={honorPrivateLine} />
        ) : null}
      </View>
      {/* N8: the hold block is a SIBLING of the tap-to-continue stage, not
          nested inside it — on held beats the container carries no button
          role, so the host 下一段 CTA is the only button on the beat. */}
      {!revealed ? (
        <View className='miniscript-hero__ceremony-hold'>
          {isHost && onAdvanceCeremony ? (
            <View
              className='miniscript-hero__ceremony-next'
              role='button'
              aria-label={TRUTH_CEREMONY_HOST_NEXT_CTA}
              aria-disabled={isAdvancingCeremony}
              onClick={() => {
                if (isAdvancingCeremony) return
                haptics('medium')
                onAdvanceCeremony()
              }}
            >
              <Text className='miniscript-hero__ceremony-next-text'>
                {isAdvancingCeremony ? '揭晓中…' : TRUTH_CEREMONY_HOST_NEXT_CTA}
              </Text>
            </View>
          ) : (
            <View role='status' aria-live='polite'>
              <Text className='miniscript-hero__ceremony-waiting'>{TRUTH_CEREMONY_WAITING_HOST_HINT}</Text>
            </View>
          )}
        </View>
      ) : null}
      {revealed ? (
        <Text className='miniscript-hero__ceremony-hint'>{TRUTH_CEREMONY_CONTINUE_HINT}</Text>
      ) : null}
    </View>
  )
}
