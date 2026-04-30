import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { type SocialSessionState } from '@shared/socialIcebreaker'
import { useEffect, useRef, useState } from 'react'
import { haptics } from '../../lib/haptics'

const PHASE_EMOJI_MAP: Record<string, string> = {
  mini_script: '',
}

const STEP_LABELS = ['角色', '幕1', '幕2', '投票', '真相']

function PhaseHeaderIcon({ phase, size = 40 }: { phase: string; size?: number }) {
  const emoji = PHASE_EMOJI_MAP[phase] ?? ''
  if (!emoji) return null
  return (
    <Text style={{ fontSize: `${size}rpx`, lineHeight: `${size}rpx` }}>{emoji}</Text>
  )
}

function ProgressStepper({ currentStep }: { currentStep: number }) {
  return (
    <View style={{ display: 'flex', justifyContent: 'center', gap: '16rpx', marginTop: '12rpx', marginBottom: '8rpx' }}>
      {STEP_LABELS.map((label, idx) => {
        const isActive = idx === currentStep
        const isPast = idx < currentStep
        return (
          <View key={label} style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
            <View
              style={{
                width: '20rpx',
                height: '20rpx',
                borderRadius: '10rpx',
                background: isActive ? '#8B5CF6' : isPast ? '#c4b5fd' : '#e5e7eb',
                transition: 'background 0.3s ease',
              }}
            />
            <Text
              style={{
                fontSize: '22rpx',
                color: isActive ? '#8B5CF6' : isPast ? '#a78bfa' : '#9ca3af',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {label}
            </Text>
            {idx < STEP_LABELS.length - 1 && (
              <View style={{ width: '16rpx', height: '2rpx', background: '#e5e7eb', marginLeft: '4rpx' }} />
            )}
          </View>
        )
      })}
    </View>
  )
}

export function MiniScriptPhaseView({
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
  const myVote = session.miniScriptVotes?.find((v) => v.userId === currentUserId)
  const allVotes = session.miniScriptVotes ?? []
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
  const prevCurrentActRef = useRef(currentAct)
  const wasVotingRef = useRef(isVoting)

  // Detect act changes to flash new clue badge
  useEffect(() => {
    if (currentAct > prevCurrentActRef.current && framework) {
      const actClues = session.miniScriptRevealedClues ?? []
      const newIds = actClues.map((c) => c.clueId)
      const newlyRevealed = newIds.filter((id) => !lastRevealedClueIds.includes(id))
      if (newlyRevealed.length > 0) {
        setLastRevealedClueIds(newIds)
        // Clear the "new" flash after 3 seconds
        setTimeout(() => setLastRevealedClueIds([]), 3000)
      }
    }
    prevCurrentActRef.current = currentAct
  }, [currentAct, framework, session.miniScriptRevealedClues, lastRevealedClueIds])

  // Reset dirty flag when vote submission completes successfully
  useEffect(() => {
    if (wasVotingRef.current && !isVoting && myVote) {
      setVoteDirty(false)
    }
    wasVotingRef.current = isVoting
  }, [isVoting, myVote])

  // Sync from server ONLY when not dirty
  useEffect(() => {
    if (!voteDirty && myVote) {
      setVoteWho(myVote.who)
      setVoteWhat(myVote.what)
      setVoteWhy(myVote.why)
    }
  }, [myVote?.who, myVote?.what, myVote?.why, voteDirty])

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

  const handleAssignRolesWithHaptic = () => {
    haptics('cardReveal')
    onAssignRoles()
  }

  const handleRevealActWithHaptic = (targetAct: number) => {
    haptics('medium')
    onRevealAct(targetAct)
  }

  const handleVoteWithHaptic = () => {
    haptics('success')
    onVote({ who: voteWho, what: voteWhat, why: voteWhy })
  }

  const handleReadyToggle = () => {
    haptics('light')
    onReady?.(!isReady)
  }

  // Determine current step for stepper
  const currentStep = solutionRevealed
    ? 4
    : currentAct >= totalActs && totalActs > 0
      ? 3
      : currentAct > 0
        ? currentAct + 1 // act 1 -> step 1, act 2 -> step 2
        : session.miniScriptRoleAssignments && Object.keys(session.miniScriptRoleAssignments).length > 0
          ? 0
          : -1

  // Vote result summary (post-reveal)
  const voteSummary = solutionRevealed
    ? (() => {
        const whoCounts: Record<string, number> = {}
        allVotes.forEach((v) => {
          whoCounts[v.who] = (whoCounts[v.who] || 0) + 1
        })
        const sorted = Object.entries(whoCounts).sort((a, b) => b[1] - a[1])
        return sorted
      })()
    : []

  if (!framework) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="mini_script" size={80} /></View>
          <Text className='icebreaker__challenge-title'>剧本尚未生成</Text>
          <Text className='icebreaker__challenge-desc'>
            {isHost ? '点击上方「迷你剧本杀」配置风格与题材，生成你们的剧本。' : '请等待主持人生成剧本…'}
          </Text>
        </Card>
      </View>
    )
  }

  // State 1: Roles not yet assigned
  if (!session.miniScriptRoleAssignments || Object.keys(session.miniScriptRoleAssignments).length === 0) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="mini_script" size={80} /></View>
          <Text className='icebreaker__challenge-title'>迷你剧本杀</Text>
          <Text className='icebreaker__challenge-desc'>{framework.premise}</Text>
        </Card>
        {isHost ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={handleAssignRolesWithHaptic}
            disabled={isAssigningRoles}
            loading={isAssigningRoles}
          >
            {isAssigningRoles ? '分配中…' : '分配角色'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>等待主持人分配角色…</Text>
        )}
      </View>
    )
  }

  // State 2: Role assigned — show my role card
  if (currentAct === 0) {
    return (
      <View className='icebreaker__challenge'>
        {currentStep >= 0 && <ProgressStepper currentStep={currentStep} />}
        <Card className='icebreaker__challenge-card'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="mini_script" size={80} /></View>
          <Text className='icebreaker__challenge-title'>你的角色</Text>
          {myRole ? (
            <View className='icebreaker__ms-role icebreaker__ms-role--animate' style={{ marginTop: '16rpx', animationDelay: '0ms' }}>
              <Text className='icebreaker__ms-role-title' style={{ animationDelay: '80ms' }}>{myRole.roleLabel}</Text>
              <Text className='icebreaker__ms-role-line icebreaker__ms-role--animate' style={{ animationDelay: '160ms' }}>钩子：{myRole.sinHook}</Text>
              <Text className='icebreaker__ms-role-line icebreaker__ms-role--animate' style={{ animationDelay: '240ms' }}>表面：{myRole.alibi}</Text>
              {myRole.secretAgenda ? (
                <View className='icebreaker__ms-role--animate' style={{ marginTop: '12rpx', paddingTop: '12rpx', borderTop: '1px dashed rgba(0,0,0,0.1)', animationDelay: '320ms' }}>
                  <Text className='icebreaker__ms-secret-label'>你的秘密</Text>
                  <Text className='icebreaker__ms-role-line icebreaker__ms-secret-text'>{myRole.secretAgenda}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text className='icebreaker__challenge-desc'>你尚未被分配角色。</Text>
          )}
        </Card>
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-title'>故事 premise</Text>
          <Text className='icebreaker__challenge-desc'>{framework.premise}</Text>
        </Card>

        {!isHost && onReady && (
          <View style={{ marginTop: '16rpx' }}>
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              className='icebreaker__action-btn'
              onClick={handleReadyToggle}
              disabled={isSettingReady}
              loading={isSettingReady}
            >
              {isReady ? '已准备' : '准备好了'}
            </Button>
          </View>
        )}

        {isHost && (
          <View style={{ marginTop: '8rpx', textAlign: 'center' }}>
            <Text style={{ fontSize: '24rpx', color: '#888' }}>
              {readyCount}/{playerCount} 人已准备
            </Text>
          </View>
        )}

        {isHost ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={() => handleRevealActWithHaptic(1)}
            disabled={isRevealingAct}
            loading={isRevealingAct}
          >
            {isRevealingAct ? '解锁中…' : '揭开第一幕'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>主持人即将揭开第一幕…</Text>
        )}
      </View>
    )
  }

  // State 3+: Act progression + voting
  const allActsRevealed = currentAct >= totalActs

  return (
    <View className='icebreaker__challenge'>
      {currentStep >= 0 && <ProgressStepper currentStep={currentStep} />}

      <Card className='icebreaker__challenge-card'>
        <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="mini_script" size={80} /></View>
        <Text className='icebreaker__challenge-title'>迷你剧本杀 · 第 {currentAct} 幕</Text>
        <Text className='icebreaker__challenge-desc'>{framework.premise}</Text>
      </Card>

      {(session.miniScriptRevealedClues ?? []).length > 0 && (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-title'>已揭示线索</Text>
          {session.miniScriptRevealedClues!.map((clue, idx) => {
            const isNew = lastRevealedClueIds.includes(clue.clueId)
            return (
              <View key={clue.clueId} className='icebreaker__ms-role' style={{ position: 'relative' }}>
                <Text className='icebreaker__ms-role-line'>
                  线索 {idx + 1}：{clue.text}
                </Text>
                {isNew && (
                  <Text className='icebreaker__ms-new-clue-badge'>
                    新线索
                  </Text>
                )}
              </View>
            )
          })}
        </Card>
      )}

      {framework.act_flow[currentAct - 1] && (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-title'>当前幕节拍</Text>
          <Text className='icebreaker__ms-act-title'>
            第{framework.act_flow[currentAct - 1].actNumber}幕 · {framework.act_flow[currentAct - 1].title}
          </Text>
          {framework.act_flow[currentAct - 1].beats.map((beat, index) => (
            <Text key={index} className='icebreaker__ms-role-line'>· {beat}</Text>
          ))}
        </Card>
      )}

      {myRole && (
        <Card className='icebreaker__challenge-card'>
          <View
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            onClick={() => setRoleCardCollapsed(!roleCardCollapsed)}
          >
            <Text className='icebreaker__challenge-title'>我的角色 · {myRole.roleLabel}</Text>
            <Text style={{ fontSize: '24rpx', color: '#888' }}>{roleCardCollapsed ? '▼' : '▲'}</Text>
          </View>
          {!roleCardCollapsed && (
            <View style={{ marginTop: '8rpx' }}>
              <Text className='icebreaker__ms-role-line'>表面：{myRole.alibi}</Text>
              {myRole.secretAgenda ? (
                <View style={{ marginTop: '8rpx', paddingTop: '8rpx', borderTop: '1px dashed rgba(0,0,0,0.08)' }}>
                  <Text className='icebreaker__ms-secret-label'>你的秘密</Text>
                  <Text className='icebreaker__ms-role-line icebreaker__ms-secret-text'>{myRole.secretAgenda}</Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>
      )}

      {deductionHints.length > 0 && (
        <Card className='icebreaker__challenge-card'>
          <View
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setShowDeductionHints(!showDeductionHints)}
          >
            <Text className='icebreaker__challenge-title'>推理提示 ({deductionHints.length})</Text>
            <Text style={{ fontSize: '24rpx', color: '#888' }}>{showDeductionHints ? '▼' : '▶'}</Text>
          </View>
          {showDeductionHints && (
            <View style={{ marginTop: '12rpx' }}>
              {deductionHints.map((hint) => (
                <View key={hint.stepNumber} style={{ marginBottom: '8rpx' }}>
                  <Text style={{ fontSize: '24rpx', color: '#666' }}>
                    步骤 {hint.stepNumber}：{hint.conclusion}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      {allActsRevealed && !solutionRevealed && (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-title'>共识投票</Text>
          <Text style={{ fontSize: '24rpx', color: '#888', marginBottom: '12rpx' }}>
            {allVotes.length}/{playerCount} 人已投票
          </Text>
          <View style={{ marginTop: '16rpx' }}>
            <Text style={{ fontSize: '26rpx', color: '#666', marginBottom: '8rpx' }}>谁？</Text>
            <Input
              style={{ fontSize: '28rpx', padding: '12rpx', background: '#f5f5f5', borderRadius: '8rpx', marginBottom: '4rpx' }}
              value={voteWho}
              onInput={(e) => { setVoteDirty(true); setVoteWho(e.detail.value) }}
              placeholder='你觉得是谁？'
              maxlength={120}
            />
            <Text style={{ fontSize: '20rpx', color: '#bbb', textAlign: 'right', marginBottom: '12rpx' }}>{voteWho.length}/120</Text>

            <Text style={{ fontSize: '26rpx', color: '#666', marginBottom: '8rpx' }}>做了什么？</Text>
            <Input
              style={{ fontSize: '28rpx', padding: '12rpx', background: '#f5f5f5', borderRadius: '8rpx', marginBottom: '4rpx' }}
              value={voteWhat}
              onInput={(e) => { setVoteDirty(true); setVoteWhat(e.detail.value) }}
              placeholder='具体做了什么？'
              maxlength={200}
            />
            <Text style={{ fontSize: '20rpx', color: '#bbb', textAlign: 'right', marginBottom: '12rpx' }}>{voteWhat.length}/200</Text>

            <Text style={{ fontSize: '26rpx', color: '#666', marginBottom: '8rpx' }}>为什么？</Text>
            <Input
              style={{ fontSize: '28rpx', padding: '12rpx', background: '#f5f5f5', borderRadius: '8rpx', marginBottom: '4rpx' }}
              value={voteWhy}
              onInput={(e) => { setVoteDirty(true); setVoteWhy(e.detail.value) }}
              placeholder='动机是什么？'
              maxlength={300}
            />
            <Text style={{ fontSize: '20rpx', color: '#bbb', textAlign: 'right', marginBottom: '16rpx' }}>{voteWhy.length}/300</Text>

            <Button
              variant='primary'
              onClick={handleVoteWithHaptic}
              disabled={isVoting || !voteWho.trim() || !voteWhat.trim() || !voteWhy.trim()}
              loading={isVoting}
            >
              {isVoting ? '提交中…' : '提交投票'}
            </Button>
            {myVote && (
              <Text style={{ fontSize: '24rpx', color: '#27ae60', marginTop: '12rpx' }}>已投票</Text>
            )}
          </View>
        </Card>
      )}

      {solutionRevealed && (
        <>
          <Card className='icebreaker__challenge-card'>
            <Text className='icebreaker__challenge-title'>真相揭晓</Text>
            <Text className='icebreaker__challenge-desc'>{framework.ending.resolutionSummary}</Text>
            <Text className='icebreaker__challenge-desc' style={{ marginTop: '12rpx', color: '#e67e22' }}>
              {framework.ending.confessionMechanic}
            </Text>
          </Card>

          {voteSummary.length > 0 && (
            <Card className='icebreaker__challenge-card'>
              <Text className='icebreaker__challenge-title'>投票结果</Text>
              {voteSummary.map(([who, count], idx) => (
                <View key={who} style={{ marginTop: '8rpx', display: 'flex', justifyContent: 'space-between' }}>
                  <Text className='icebreaker__ms-role-line'>
                    {idx === 0 ? '' : '•'} {who}
                  </Text>
                  <Text style={{ fontSize: '24rpx', color: '#888' }}>{count} 票</Text>
                </View>
              ))}
              <Text style={{ fontSize: '22rpx', color: '#bbb', marginTop: '12rpx' }}>
                共 {allVotes.length} 人参与投票
              </Text>
            </Card>
          )}
        </>
      )}

      {isHost && !allActsRevealed && (
        <Button
          variant='primary'
          className='icebreaker__action-btn'
          onClick={() => handleRevealActWithHaptic(currentAct + 1)}
          disabled={isRevealingAct}
          loading={isRevealingAct}
        >
          {isRevealingAct ? '解锁中…' : `揭开第 ${currentAct + 1} 幕`}
        </Button>
      )}

      {isHost && allActsRevealed && !solutionRevealed && (
        <Button
          variant='primary'
          className='icebreaker__action-btn'
          onClick={handleRevealSolutionConfirm}
          disabled={isRevealingSolution}
          loading={isRevealingSolution}
        >
          {isRevealingSolution ? '揭晓中…' : '揭晓真相'}
        </Button>
      )}

      {isHost && solutionRevealed && (
        <Button
          variant='secondary'
          className='icebreaker__action-btn'
          onClick={onAdvance}
          disabled={isAdvancing}
          loading={isAdvancing}
        >
          {isAdvancing ? '切换中…' : '进入回顾'}
        </Button>
      )}

      {!isHost && (
        <Text className='icebreaker__helper-text'>
          {solutionRevealed ? '游戏结束，等待主持人推进…' : '跟随剧本节奏游玩，主持人控制进度。'}
        </Text>
      )}
    </View>
  )
}
