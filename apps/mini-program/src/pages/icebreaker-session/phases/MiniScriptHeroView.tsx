import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { type SocialSessionState } from '@shared/socialIcebreaker'
import { useEffect, useRef, useState, useCallback } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { haptics } from '../../../lib/utils/haptics'
import { CardFlip, ParticleBurst } from '../../../components/reveal'
import { TapReaction } from '../../../components/gesture'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

const STEP_LABELS = ['角色', '幕1', '幕2', '投票', '真相']

const REACTIONS = [
  { emoji: '😂', label: '好笑' },
  { emoji: '🔥', label: '绝了' },
  { emoji: '👏', label: '鼓掌' },
  { emoji: '🌹', label: '玫瑰' },
]

function ProgressStepper({ currentStep }: { currentStep: number }) {
  return (
    <View className='miniscript-hero__stepper'>
      {STEP_LABELS.map((label, idx) => {
        const isActive = idx === currentStep
        const isPast = idx < currentStep
        return (
          <View key={label} className='miniscript-hero__stepper-item'>
            <View
              className={`miniscript-hero__stepper-dot${isActive ? ' miniscript-hero__stepper-dot--active' : ''}${isPast ? ' miniscript-hero__stepper-dot--past' : ''}`}
            />
            <Text
              className={`miniscript-hero__stepper-label${isActive ? ' miniscript-hero__stepper-label--active' : ''}`}
            >
              {label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** Signature wow: curtain rise — two side panels part on act start. */
function CurtainRise({ visible, title }: { visible: boolean; title: string }) {
  if (!visible) return null
  return (
    <View className='miniscript-hero__curtain' aria-hidden='true'>
      <View className='miniscript-hero__curtain-panel miniscript-hero__curtain-panel--left' />
      <View className='miniscript-hero__curtain-panel miniscript-hero__curtain-panel--right' />
      <Text className='miniscript-hero__curtain-title'>{title}</Text>
    </View>
  )
}

export function MiniScriptHeroView({
  session,
  currentUserId,
  isHost,
  playerCount,
  onAssignRoles,
  onRevealAct,
  onVote,
  onRevealSolution,
  onAdvance,
  onReady,
  isAssigningRoles,
  isRevealingAct,
  isVoting,
  isRevealingSolution,
  isAdvancing,
  isSettingReady,
}: {
  session: SocialSessionState
  currentUserId: string
  isHost: boolean
  playerCount: number
  onAssignRoles: () => void
  onRevealAct: (targetAct: number) => void
  onVote: (vote: { who: string; what: string; why: string }) => void
  onRevealSolution: () => void
  onAdvance: () => void
  onReady?: (ready: boolean) => void
  isAssigningRoles: boolean
  isRevealingAct: boolean
  isVoting: boolean
  isRevealingSolution: boolean
  isAdvancing: boolean
  isSettingReady?: boolean
}) {
  const framework = session.miniScriptFramework
  const myRole = session.miniScriptPlayerRuntimeViews?.[currentUserId]
  const currentAct = session.miniScriptCurrentAct ?? 0
  const totalActs = framework?.act_flow.length ?? 0
  const solutionRevealed = session.miniScriptSolutionRevealed ?? false
  const revealedSolution = session.miniScriptRevealedSolution
  const myVote = session.miniScriptVotes?.find((v) => v.userId === currentUserId)
  const allVotes = session.miniScriptVotes ?? []
  const assignedPlayerIds = Object.keys(session.miniScriptRoleAssignments ?? {})
  const voterIds = new Set(allVotes.map((vote) => vote.userId))
  const allAssignedPlayersVoted = assignedPlayerIds.length > 0
    && assignedPlayerIds.every((userId) => voterIds.has(userId))
  const readyMap = session.miniScriptPlayerReady ?? {}
  const isReady = readyMap[currentUserId] ?? false
  const readyCount = Object.values(readyMap).filter(Boolean).length
  const deductionHints = session.miniScriptDeductionHints ?? []

  const [voteWho, setVoteWho] = useState(myVote?.who ?? '')
  const [voteWhat, setVoteWhat] = useState(myVote?.what ?? '')
  const [voteWhy, setVoteWhy] = useState(myVote?.why ?? '')
  const [voteDirty, setVoteDirty] = useState(false)
  const [roleCardCollapsed, setRoleCardCollapsed] = useState(false)
  const [showDeductionHints, setShowDeductionHints] = useState(false)
  const [lastRevealedClueIds, setLastRevealedClueIds] = useState<string[]>([])
  const clueTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const actTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const prevCurrentActRef = useRef(currentAct)
  const wasVotingRef = useRef(isVoting)

  const [roleFlipped, setRoleFlipped] = useState(false)
  const [showActReveal, setShowActReveal] = useState(false)
  const [actRevealTitle, setActRevealTitle] = useState('')
  const [burstTrigger, setBurstTrigger] = useState(false)
  const [reactionCounts, setReactionCounts] = useState<number[]>([0, 0, 0, 0])
  const [selectedReaction, setSelectedReaction] = useState<number | undefined>()

  useEffect(() => {
    if (currentAct > prevCurrentActRef.current && framework) {
      const actClues = session.miniScriptRevealedClues ?? []
      const newIds = actClues.map((c) => c.clueId)
      const newlyRevealed = newIds.filter((id) => !lastRevealedClueIds.includes(id))
      if (newlyRevealed.length > 0) {
        setLastRevealedClueIds(newIds)
        if (clueTimeoutRef.current) clearTimeout(clueTimeoutRef.current)
        clueTimeoutRef.current = setTimeout(() => setLastRevealedClueIds([]), 3000)
      }

      const act = framework.act_flow[currentAct - 1]
      if (act && currentAct > 0) {
        setActRevealTitle(`第 ${act.actNumber} 幕 · ${act.title}`)
        setShowActReveal(true)
        if (actTimeoutRef.current) clearTimeout(actTimeoutRef.current)
        actTimeoutRef.current = setTimeout(() => setShowActReveal(false), 1400)
      }
    }
    prevCurrentActRef.current = currentAct
  }, [currentAct, framework, session.miniScriptRevealedClues, lastRevealedClueIds])

  useEffect(() => {
    if (solutionRevealed) {
      setBurstTrigger(true)
    }
  }, [solutionRevealed])

  useEffect(() => {
    if (wasVotingRef.current && !isVoting && myVote) {
      setVoteDirty(false)
    }
    wasVotingRef.current = isVoting
  }, [isVoting, myVote])

  useEffect(() => {
    return () => {
      if (clueTimeoutRef.current) clearTimeout(clueTimeoutRef.current)
      if (actTimeoutRef.current) clearTimeout(actTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!voteDirty && myVote) {
      setVoteWho(myVote.who)
      setVoteWhat(myVote.what)
      setVoteWhy(myVote.why)
    }
  }, [myVote, voteDirty])

  const handleRevealSolutionConfirm = () => {
    Taro.showModal({
      title: '确认揭晓真相',
      content: '揭晓后游戏将进入回顾阶段，所有人将看到最终答案。确定要继续吗？',
      confirmText: '揭晓',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          haptics('heavy')
          onRevealSolution()
        }
      },
    })
  }

  const handleReaction = useCallback((index: number) => {
    setSelectedReaction(index)
    setReactionCounts((prev) => {
      const next = [...prev]
      next[index] = (next[index] || 0) + 1
      return next
    })
  }, [])

  const currentStep = solutionRevealed
    ? 4
    : currentAct >= totalActs && totalActs > 0
      ? 3
      : currentAct > 0
        ? currentAct + 1
        : session.miniScriptRoleAssignments && Object.keys(session.miniScriptRoleAssignments).length > 0
          ? 0
          : -1

  const voteSummary = solutionRevealed
    ? (() => {
        const whoCounts: Record<string, number> = {}
        allVotes.forEach((v) => {
          whoCounts[v.who] = (whoCounts[v.who] || 0) + 1
        })
        return Object.entries(whoCounts).sort((a, b) => b[1] - a[1])
      })()
    : []

  // ── No framework yet ──
  if (!framework) {
    return (
      <View className='miniscript-hero'>
        <PhaseHeroCard
          phase='mini_script'
          title='剧本尚未生成'
          prompt={isHost ? '点击上方「迷你剧本杀」配置风格与题材，生成你们的剧本。' : '请等待主持人生成剧本…'}
        />
      </View>
    )
  }

  // ── Roles not assigned ──
  if (!session.miniScriptRoleAssignments || Object.keys(session.miniScriptRoleAssignments).length === 0) {
    return (
      <View className='miniscript-hero'>
        <PhaseHeroCard
          phase='mini_script'
          title='迷你剧本杀'
          prompt={isHost ? framework.premise : '剧本已生成，等待主持人分配角色。'}
          statusText={isHost ? '分配角色后开演' : '等待主持人分配角色…'}
          actions={
            isHost ? (
              <Button
                variant='primary'
                onClick={() => {
                  haptics('cardReveal')
                  onAssignRoles()
                }}
                disabled={isAssigningRoles}
                loading={isAssigningRoles}
              >
                {isAssigningRoles ? '分配中…' : '分配角色'}
              </Button>
            ) : undefined
          }
        >
          {isHost ? (
            <View className='miniscript-hero__section'>
              <Text className='miniscript-hero__section-title'>主持人预览</Text>
              <Text className='miniscript-hero__beat'>{framework.premise}</Text>
              <Text className='miniscript-hero__beat'>角色：{framework.characters.map((role) => role.roleLabel).join('、')}</Text>
              <Text className='miniscript-hero__beat'>幕次：{framework.act_flow.map((act) => act.title).join(' → ')}</Text>
            </View>
          ) : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Role reveal (act 0) ──
  if (currentAct === 0) {
    return (
      <View className='miniscript-hero'>
        {currentStep >= 0 && <ProgressStepper currentStep={currentStep} />}
        <PhaseHeroCard
          phase='mini_script'
          title='你的角色'
          statusText={isHost ? `${readyCount}/${playerCount} 人已准备` : '看完角色卡后点准备'}
          doneCount={readyCount}
          totalCount={playerCount}
          actions={
            <>
              {!isHost && onReady ? (
                <Button
                  variant={isReady ? 'secondary' : 'primary'}
                  onClick={() => {
                    haptics('light')
                    onReady(!isReady)
                  }}
                  disabled={isSettingReady}
                  loading={isSettingReady}
                >
                  {isReady ? '已准备' : '准备好了'}
                </Button>
              ) : null}
              {isHost ? (
                <Button
                  variant='primary'
                  onClick={() => {
                    haptics('medium')
                    onRevealAct(1)
                  }}
                  disabled={isRevealingAct}
                  loading={isRevealingAct}
                >
                  {isRevealingAct ? '解锁中…' : '揭开第一幕'}
                </Button>
              ) : null}
            </>
          }
        >
          <View className='miniscript-hero__role-flip'>
            <CardFlip
              flipped={roleFlipped}
              onFlip={() => setRoleFlipped((f) => !f)}
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
                      <Text className='miniscript-hero__role-back-line'>钩子：{myRole.sinHook}</Text>
                      <Text className='miniscript-hero__role-back-line'>表面：{myRole.alibi}</Text>
                      {myRole.secretAgenda ? (
                        <Text className='miniscript-hero__role-back-line miniscript-hero__role-back-line--secret'>
                          秘密：{myRole.secretAgenda}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text className='miniscript-hero__role-back-line'>你尚未被分配角色。</Text>
                  )}
                </View>
              }
            />
          </View>
          <View className='miniscript-hero__premise'>
            <Text className='miniscript-hero__premise-label'>故事设定</Text>
            <Text className='miniscript-hero__premise-text'>{framework.premise}</Text>
          </View>
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Acts + voting + solution ──
  const allActsRevealed = currentAct >= totalActs

  return (
    <View className='miniscript-hero'>
      <CurtainRise visible={showActReveal} title={actRevealTitle} />

      {solutionRevealed && (
        <View className='miniscript-hero__burst'>
          <ParticleBurst trigger={burstTrigger} type='confetti' count={40} />
        </View>
      )}

      {currentStep >= 0 && <ProgressStepper currentStep={currentStep} />}

      <PhaseHeroCard
        phase='mini_script'
        title={solutionRevealed ? '真相揭晓' : `迷你剧本杀 · 第 ${currentAct} 幕`}
        statusText={
          solutionRevealed
            ? '游戏结束'
            : allActsRevealed
              ? `${allVotes.length}/${playerCount} 人已投票`
              : '跟随剧本节奏游玩，主持人控制进度'
        }
        doneCount={
          solutionRevealed
            ? playerCount
            : allActsRevealed
              ? allVotes.length
              : currentAct > 0
                ? currentAct
                : readyCount
        }
        totalCount={allActsRevealed || solutionRevealed ? playerCount : currentAct > 0 ? Math.max(totalActs, 1) : playerCount}
        actions={
          <>
            {isHost && !allActsRevealed ? (
              <Button
                variant='primary'
                onClick={() => {
                  haptics('medium')
                  onRevealAct(currentAct + 1)
                }}
                disabled={isRevealingAct}
                loading={isRevealingAct}
              >
                {isRevealingAct ? '解锁中…' : `揭开第 ${currentAct + 1} 幕`}
              </Button>
            ) : null}
            {isHost && allActsRevealed && !solutionRevealed ? (
              <Button
                variant='primary'
                onClick={handleRevealSolutionConfirm}
                disabled={isRevealingSolution || !allAssignedPlayersVoted}
                loading={isRevealingSolution}
              >
                {isRevealingSolution
                  ? '揭晓中…'
                  : allAssignedPlayersVoted ? '揭晓真相' : '等待全员投票'}
              </Button>
            ) : null}
            {isHost && solutionRevealed ? (
              <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
                {isAdvancing ? '切换中…' : '进入回顾 ›'}
              </Button>
            ) : null}
          </>
        }
      >
        {(session.miniScriptRevealedClues ?? []).length > 0 && (
          <View className='miniscript-hero__section'>
            <Text className='miniscript-hero__section-title'>已揭示线索</Text>
            {session.miniScriptRevealedClues!.map((clue, idx) => (
              <View key={clue.clueId} className='miniscript-hero__clue'>
                <Text className='miniscript-hero__clue-text'>线索 {idx + 1}：{clue.text}</Text>
                {lastRevealedClueIds.includes(clue.clueId) && (
                  <Text className='miniscript-hero__clue-new'>新线索</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {framework.act_flow[currentAct - 1] && (
          <View className='miniscript-hero__section'>
            <Text className='miniscript-hero__section-title'>
              第{framework.act_flow[currentAct - 1].actNumber}幕 · {framework.act_flow[currentAct - 1].title}
            </Text>
            {framework.act_flow[currentAct - 1].beats.map((beat, index) => (
              <Text key={index} className='miniscript-hero__beat'>· {beat}</Text>
            ))}
          </View>
        )}

        {myRole && (
          <View className='miniscript-hero__section'>
            <View
              className='miniscript-hero__section-header'
              onClick={() => setRoleCardCollapsed(!roleCardCollapsed)}
              role='button'
              aria-expanded={!roleCardCollapsed}
              aria-label='我的角色详情'
            >
              <Text className='miniscript-hero__section-title'>我的角色 · {myRole.roleLabel}</Text>
              <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{roleCardCollapsed ? '▼' : '▲'}</Text>
            </View>
            {!roleCardCollapsed && (
              <>
                <Text className='miniscript-hero__beat'>表面：{myRole.alibi}</Text>
                {myRole.secretAgenda ? (
                  <Text className='miniscript-hero__secret'>你的秘密：{myRole.secretAgenda}</Text>
                ) : null}
              </>
            )}
          </View>
        )}

        {deductionHints.length > 0 && (
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
        )}

        <View className='miniscript-hero__reactions'>
          <TapReaction
            reactions={REACTIONS.map((r, i) => ({ ...r, count: reactionCounts[i] }))}
            onReact={handleReaction}
            selectedIndex={selectedReaction}
          />
        </View>

        {allActsRevealed && !solutionRevealed && (
          <View className='miniscript-hero__section'>
            <Text className='miniscript-hero__section-title'>共识投票</Text>
            <View className='miniscript-hero__vote-field'>
              <Text className='miniscript-hero__vote-label'>谁？</Text>
              <Input
                className='miniscript-hero__vote-input'
                value={voteWho}
                onInput={(e) => { setVoteDirty(true); setVoteWho(e.detail.value) }}
                placeholder='你觉得是谁？'
                maxlength={120}
              />
              <Text className='miniscript-hero__vote-label'>做了什么？</Text>
              <Input
                className='miniscript-hero__vote-input'
                value={voteWhat}
                onInput={(e) => { setVoteDirty(true); setVoteWhat(e.detail.value) }}
                placeholder='具体做了什么？'
                maxlength={200}
              />
              <Text className='miniscript-hero__vote-label'>为什么？</Text>
              <Input
                className='miniscript-hero__vote-input'
                value={voteWhy}
                onInput={(e) => { setVoteDirty(true); setVoteWhy(e.detail.value) }}
                placeholder='动机是什么？'
                maxlength={300}
              />
              <Button
                variant='primary'
                onClick={() => {
                  haptics('success')
                  onVote({ who: voteWho, what: voteWhat, why: voteWhy })
                }}
                disabled={isVoting || !voteWho.trim() || !voteWhat.trim() || !voteWhy.trim()}
                loading={isVoting}
              >
                {isVoting ? '提交中…' : '提交投票'}
              </Button>
              {myVote && <Text className='miniscript-hero__vote-done'>已投票</Text>}
            </View>
          </View>
        )}

        {solutionRevealed && (
          <>
            <View className='miniscript-hero__section'>
              <Text className='miniscript-hero__section-title'>真相</Text>
              {revealedSolution ? (
                <>
                  <Text className='miniscript-hero__truth-label'>真相人物</Text>
                  <Text className='miniscript-hero__beat'>{revealedSolution.who}</Text>
                  <Text className='miniscript-hero__truth-label'>发生了什么</Text>
                  <Text className='miniscript-hero__beat'>{revealedSolution.what}</Text>
                  <Text className='miniscript-hero__truth-label'>背后原因</Text>
                  <Text className='miniscript-hero__beat'>{revealedSolution.why}</Text>
                </>
              ) : (
                <Text className='miniscript-hero__beat'>真相正在同步，请稍候。</Text>
              )}
              <Text className='miniscript-hero__confession'>{framework.ending.confessionMechanic}</Text>
            </View>
            {voteSummary.length > 0 && (
              <View className='miniscript-hero__section'>
                <Text className='miniscript-hero__section-title'>投票结果</Text>
                {voteSummary.map(([who, count]) => (
                  <View key={who} className='miniscript-hero__vote-row'>
                    <Text className='miniscript-hero__beat'>{who}</Text>
                    <Text className='miniscript-hero__vote-count'>{count} 票</Text>
                  </View>
                ))}
                <Text className='miniscript-hero__vote-total'>共 {allVotes.length} 人参与投票</Text>
              </View>
            )}
          </>
        )}
        <PhaseAigcRow reason='AI 生成剧本内容' />
      </PhaseHeroCard>
    </View>
  )
}
