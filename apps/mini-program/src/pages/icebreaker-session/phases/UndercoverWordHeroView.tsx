import { useEffect, useState, useRef, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import { CardFlip, IdentityReveal, ParticleBurst } from '../../../components/reveal'
import { SwipeCard, TapReaction } from '../../../components/gesture'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PHASE_ACCENTS } from './phaseAccents'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import './UndercoverWordHeroView.scss'

interface UndercoverWordHeroViewProps {
  socialSessionId: string
  isHost: boolean
  userId?: string
  pair?: { civilianWord: string; undercoverWord: string; category: string } | null
  undercoverUserId?: string
  rounds?: Array<{ roundNumber: number; descriptions: Array<{ userId: string; displayName: string; text: string }> }>
  currentRound?: number
  votes?: Array<{ voterId: string; targetUserId: string }>
  votedUserIds?: string[]
  revealed?: boolean
  results?: {
    undercoverUserId: string
    undercoverDisplayName: string
    civilianWord: string
    undercoverWord: string
    voteCounts: Record<string, number>
    caught: boolean
  } | null
  playerCount?: number
  participants?: Array<{ userId: string; displayName?: string }>
  onAdvance?: () => void
  isAdvancing?: boolean
  pairMeta?: AIResponseMeta
}

const REACTION_ITEMS = [
  { emoji: '😂', label: '好笑' },
  { emoji: '🤔', label: '疑惑' },
  { emoji: '🔥', label: '精彩' },
  { emoji: '👏', label: '点赞' },
]

export function UndercoverWordHeroView({
  socialSessionId,
  isHost,
  userId,
  pair,
  undercoverUserId,
  rounds = [],
  currentRound = 0,
  votes: _votes = [],
  votedUserIds = [],
  revealed = false,
  results,
  playerCount = 1,
  participants = [],
  onAdvance,
  isAdvancing = false,
  pairMeta,
}: UndercoverWordHeroViewProps) {
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedTarget, setSelectedTarget] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const [cardFlipped, setCardFlipped] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [localReactions, setLocalReactions] = useState<Record<number, number>>({})
  const [selectedReaction, setSelectedReaction] = useState<number | null>(null)
  const [burstTriggered, setBurstTriggered] = useState(false)
  const hasAutoFlippedRef = useRef(false)

  // ── Derived ──
  const isUndercover = userId === undercoverUserId
  const myWord = isUndercover ? pair?.undercoverWord : pair?.civilianWord
  const currentRoundData = rounds[currentRound]
  const hasSubmittedDesc = currentRoundData?.descriptions.some((d) => d.userId === userId)
  const hasVoted = userId ? votedUserIds.includes(userId) : false
  const allDescribed = currentRoundData ? currentRoundData.descriptions.length >= playerCount : false
  const allVoted = votedUserIds.length >= playerCount
  const describedCount = currentRoundData?.descriptions.length ?? 0

  // ── Effects ──
  useEffect(() => {
    if (pair && !hasAutoFlippedRef.current) {
      hasAutoFlippedRef.current = true
      const timer = setTimeout(() => setCardFlipped(true), 500)
      return () => clearTimeout(timer)
    }
    if (!pair) {
      hasAutoFlippedRef.current = false
      setCardFlipped(false)
    }
  }, [pair])

  // Signature wow: unmask sheen fires with the reveal (CSS handles the sweep)
  useEffect(() => {
    if (revealed && results) {
      setShowSecret(true)
      setBurstTriggered(true)
    }
  }, [revealed, results])

  // ── Handlers ──
  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/undercover-word/generate'), method: 'POST' })
    } catch {
      setError('词对没生成成功')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDescribe = async () => {
    if (!userId || !description.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/undercover-word/describe'),
        method: 'POST',
        data: { text: description.trim() },
      })
      setDescription('')
    } catch {
      setError('提交没成功，再试一次')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async () => {
    if (!userId || !selectedTarget) return
    setVoting(true)
    setError('')
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/undercover-word/vote'),
        method: 'POST',
        data: { targetUserId: selectedTarget },
      })
    } catch {
      setError('投票没成功，再试试')
    } finally {
      setVoting(false)
    }
  }

  const handleReveal = async () => {
    if (!isHost) return
    setRevealing(true)
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/undercover-word/reveal'), method: 'POST' })
    } catch {
      setError('揭晓遇到小状况')
    } finally {
      setRevealing(false)
    }
  }

  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index)
    setLocalReactions((prev) => ({
      ...prev,
      [index]: (prev[index] || 0) + 1,
    }))
  }, [])

  const handleSwipeSelect = useCallback((targetId: string) => {
    try {
      Taro.vibrateShort({ type: 'light' })
    } catch {
      // ignore haptic failure
    }
    setSelectedTarget(targetId)
  }, [])

  const getDescriptionsForUser = (targetUserId: string) => {
    const out: string[] = []
    for (const r of rounds) {
      const d = r.descriptions.find((x) => x.userId === targetUserId)
      if (d) out.push(`第${r.roundNumber}轮：${d.text}`)
    }
    return out
  }

  const wordCard = (
    <CardFlip
      front={
        <View className='undercover-hero__word-front'>
          <JoyJoinIcon emoji='🕵️' tier='phase' size={56} />
          <Text className='undercover-hero__word-front-title'>你的身份是？</Text>
          <Text className='undercover-hero__word-front-hint'>点击或等待揭晓</Text>
        </View>
      }
      back={
        <View className={`undercover-hero__word-back${isUndercover ? ' undercover-hero__word-back--undercover' : ''}`}>
          <Text className='undercover-hero__word-back-word'>{myWord || '?'}</Text>
          <View className={`undercover-hero__word-back-pill${isUndercover ? ' undercover-hero__word-back-pill--undercover' : ''}`}>
            <Text className='undercover-hero__word-back-pill-text'>{isUndercover ? '卧底' : '平民'}</Text>
          </View>
          <Text className='undercover-hero__word-back-hint'>{isUndercover ? '不要暴露自己' : '找出卧底'}</Text>
        </View>
      }
      flipped={cardFlipped}
      onFlip={() => setCardFlipped((f) => !f)}
      duration={400}
    />
  )

  // ══ State 0 — waiting for pair ══
  if (!pair) {
    return (
      <View className='undercover-hero'>
        <PhaseHeroCard
          phase='undercover_word'
          title='谁是卧底'
          prompt='描述你的词，找出卧底'
          statusText={isHost ? '生成词对后开始' : '等待主持人生成词对…'}
          actions={
            isHost ? (
              <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
                {isGenerating ? '生成中…' : '生成词对'}
              </Button>
            ) : undefined
          }
        />
        {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
      </View>
    )
  }

  // ══ State 4 — revealed ══
  if (revealed && results) {
    return (
      <View className='undercover-hero'>
        <IdentityReveal
          identity={results.undercoverDisplayName}
          label='卧底身份曝光'
          revealed={showSecret}
          spotlightColor={PHASE_ACCENTS.undercover_word?.accent}
        />
        {showSecret && (
          <View className='undercover-hero__burst'>
            <ParticleBurst
              trigger={burstTriggered}
              type={results.caught ? 'confetti' : 'roses'}
              spotlightColor={results.caught ? '#5FA88F' : '#E67E22'}
              count={48}
            />
          </View>
        )}

        <PhaseHeroCard
          phase='undercover_word'
          title={`卧底是：${results.undercoverDisplayName}`}
          prompt={`平民词：${results.civilianWord} · 卧底词：${results.undercoverWord}`}
          statusText={results.caught ? '卧底被抓住了！' : '卧底成功隐藏！'}
          actions={
            isHost && onAdvance ? (
              <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
                {isAdvancing ? '切换中…' : '进入下一阶段 ›'}
              </Button>
            ) : undefined
          }
        >
          {/* Unmask sheen: one sweep across the identity card, then gone */}
          <View className='undercover-hero__identity-card'>
            <View className='undercover-hero__sheen' aria-hidden='true' />
            <View className='undercover-hero__vote-rows'>
              {participants.map((p) => (
                <View key={p.userId} className='undercover-hero__vote-row'>
                  <Text className='undercover-hero__vote-name'>{p.displayName}</Text>
                  <Text className='undercover-hero__vote-count'>{results.voteCounts[p.userId] || 0} 票</Text>
                </View>
              ))}
            </View>
          </View>
                  {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ══ State 3 — voting ══
  if (allDescribed && currentRound >= 1) {
    return (
      <View className='undercover-hero'>
        <PhaseHeroCard
          phase='undercover_word'
          title='投票环节'
          prompt='谁最有可能是卧底？'
          statusText={
            hasVoted ? `已投票，等待其他人… ${votedUserIds.length}/${playerCount}` : '右滑选择目标'
          }
          doneCount={votedUserIds.length}
          totalCount={playerCount}
          actions={
            <>
              {!hasVoted ? (
                <Button variant='primary' onClick={handleVote} disabled={!selectedTarget || voting}>
                  {voting ? '提交中…' : selectedTarget ? '确认投票' : '请选择目标'}
                </Button>
              ) : null}
              {isHost && allVoted ? (
                <Button variant='primary' onClick={handleReveal} disabled={revealing}>
                  {revealing ? '揭晓中…' : '揭晓结果'}
                </Button>
              ) : null}
            </>
          }
        >
          <View className='undercover-hero__word-reminder'>{wordCard}</View>

          {!hasVoted && (
            <View className='undercover-hero__targets'>
              {participants.map((p) => {
                const descs = getDescriptionsForUser(p.userId)
                const isSelected = selectedTarget === p.userId
                return (
                  <SwipeCard
                    key={p.userId}
                    onSwipeRight={() => handleSwipeSelect(p.userId)}
                    onSwipeLeft={() => setSelectedTarget('')}
                    threshold={0.35}
                  >
                    <View className={`undercover-hero__target${isSelected ? ' undercover-hero__target--selected' : ''}`}>
                      <View className='undercover-hero__target-avatar'>
                        <Text className='undercover-hero__target-avatar-text'>{(p.displayName || '?')[0]}</Text>
                      </View>
                      <View className='undercover-hero__target-info'>
                        <Text className='undercover-hero__target-name'>{p.displayName}</Text>
                        {descs.length > 0 && (
                          <Text className='undercover-hero__target-descs' numberOfLines={2}>
                            {descs.join(' · ')}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <View className='undercover-hero__target-check'>
                          <Text className='undercover-hero__target-check-text'>✓</Text>
                        </View>
                      )}
                    </View>
                  </SwipeCard>
                )
              })}
            </View>
          )}
                  {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ══ State 2 — describing ══
  return (
    <View className='undercover-hero'>
      <PhaseHeroCard
        phase='undercover_word'
        title={`谁是卧底 · 第${currentRound + 1}轮`}
        statusText={
          hasSubmittedDesc
            ? `已提交，等待其他人… ${describedCount}/${playerCount}`
            : `已描述 ${describedCount}/${playerCount} 人`
        }
        doneCount={describedCount}
        totalCount={playerCount}
        actions={
          <>
            {!hasSubmittedDesc ? (
              <Button variant='primary' onClick={handleDescribe} disabled={!description.trim() || submitting}>
                {submitting ? '提交中…' : '提交描述'}
              </Button>
            ) : null}
            {isHost && allDescribed ? (
              <Button variant='primary' onClick={handleReveal} disabled={revealing}>
                {revealing ? '处理中…' : currentRound >= 1 ? '进入投票' : '下一轮'}
              </Button>
            ) : null}
          </>
        }
      >
        <View className='undercover-hero__word-reminder'>{wordCard}</View>

        {currentRoundData && currentRoundData.descriptions.length > 0 && (
          <View className='undercover-hero__desc-list'>
            {currentRoundData.descriptions.map((d, i) => (
              <View key={i} className='undercover-hero__desc-item'>
                <Text className='undercover-hero__desc-name'>{d.displayName}</Text>
                <Text className='undercover-hero__desc-text'>“{d.text}”</Text>
              </View>
            ))}
          </View>
        )}

        <View className='undercover-hero__reactions'>
          <TapReaction
            reactions={REACTION_ITEMS.map((r, i) => ({
              ...r,
              count: (localReactions[i] || 0) > 0 ? localReactions[i] : undefined,
            }))}
            onReact={handleReact}
            selectedIndex={selectedReaction ?? undefined}
          />
        </View>

        {!hasSubmittedDesc && (
          <Input
            placeholder='用一句话描述你的词（不要直接说词）'
            value={description}
            onInput={(e) => setDescription(e.detail.value.slice(0, 100))}
            maxlength={100}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className={`undercover-hero__input${inputFocused ? ' undercover-hero__input--focused' : ''}`}
          />
        )}
        <PhaseAigcRow meta={pairMeta} reason='AI 生成卧底词对' />
        {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
    </View>
  )
}
