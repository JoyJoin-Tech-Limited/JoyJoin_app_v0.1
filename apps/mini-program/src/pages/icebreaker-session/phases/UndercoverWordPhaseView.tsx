import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { apiRequest } from '../../../lib/api/api';
import { buildSocialPath } from '../icebreakerSessionModel';
import { CardFlip, IdentityReveal, ParticleBurst } from '../../../components/reveal';
import { SwipeCard, TapReaction } from '../../../components/gesture';
import ChallengeCardBgImage from '../components/ChallengeCardBgImage';

interface UndercoverWordPhaseViewProps {
  socialSessionId: string;
  isHost: boolean;
  userId?: string;
  pair?: { civilianWord: string; undercoverWord: string; category: string } | null;
  undercoverUserId?: string;
  rounds?: Array<{ roundNumber: number; descriptions: Array<{ userId: string; displayName: string; text: string }> }>;
  currentRound?: number;
  votes?: Array<{ voterId: string; targetUserId: string }>;
  votedUserIds?: string[];
  revealed?: boolean;
  results?: {
    undercoverUserId: string;
    undercoverDisplayName: string;
    civilianWord: string;
    undercoverWord: string;
    voteCounts: Record<string, number>;
    caught: boolean;
  } | null;
  playerCount?: number;
  participants?: Array<{ userId: string; displayName?: string }>;
  onAdvance?: () => void;
  isAdvancing?: boolean;
}

const funny_emoji = '😂'
const thinking_emoji = '🤔'
const fire_emoji = '🔥'
const clap_emoji = '👏'

const REACTION_ITEMS = [
  { emoji: funny_emoji, label: '好笑' },
  { emoji: thinking_emoji, label: '疑惑' },
  { emoji: fire_emoji, label: '精彩' },
  { emoji: clap_emoji, label: '点赞' },
];

export default function UndercoverWordPhaseView({
  socialSessionId,
  isHost,
  userId,
  pair,
  undercoverUserId,
  rounds = [],
  currentRound = 0,
  votes = [],
  votedUserIds = [],
  revealed = false,
  results,
  playerCount = 1,
  participants = [],
  onAdvance,
  isAdvancing = false,
}: UndercoverWordPhaseViewProps) {
  // ── Existing state ──────────────────────────────────────────────
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // ── V2 state ────────────────────────────────────────────────────
  const [cardFlipped, setCardFlipped] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [localReactions, setLocalReactions] = useState<Record<number, number>>({});
  const [selectedReaction, setSelectedReaction] = useState<number | null>(null);
  const [burstTriggered, setBurstTriggered] = useState(false);
  const [descPulse, setDescPulse] = useState(false);
  const prevDescCountRef = useRef(0);
  const hasAutoFlippedRef = useRef(false);

  // ── Derived ─────────────────────────────────────────────────────
  const isUndercover = userId === undercoverUserId;
  const myWord = isUndercover ? pair?.undercoverWord : pair?.civilianWord;
  const currentRoundData = rounds[currentRound];
  const hasSubmittedDesc = currentRoundData?.descriptions.some((d) => d.userId === userId);
  const hasVoted = userId ? votedUserIds.includes(userId) : false;
  const allDescribed = currentRoundData ? currentRoundData.descriptions.length >= playerCount : false;
  const allVoted = votedUserIds.length >= playerCount;

  const describedCount = currentRoundData?.descriptions.length ?? 0;
  const describeProgress = playerCount > 0 ? describedCount / playerCount : 0;
  const undercover_emoji = '🕵️'
  const civilian_emoji = '🙂'
  const identity_emoji = isUndercover ? undercover_emoji : civilian_emoji
  const checkmark_emoji = '✓'

  // ── Effects ─────────────────────────────────────────────────────
  // Auto-flip card once when a new pair arrives
  useEffect(() => {
    if (pair && !hasAutoFlippedRef.current) {
      hasAutoFlippedRef.current = true;
      const timer = setTimeout(() => setCardFlipped(true), 500);
      return () => clearTimeout(timer);
    }
    if (!pair) {
      hasAutoFlippedRef.current = false;
      setCardFlipped(false);
    }
  }, [pair]);

  // Reveal burst
  useEffect(() => {
    if (revealed && results) {
      setShowSecret(true);
      setBurstTriggered(true);
    }
  }, [revealed, results]);

  // Progress bar pulse when someone new describes
  useEffect(() => {
    const count = currentRoundData?.descriptions.length ?? 0;
    if (count > prevDescCountRef.current && prevDescCountRef.current > 0) {
      setDescPulse(true);
      const t = setTimeout(() => setDescPulse(false), 500);
      return () => clearTimeout(t);
    }
    prevDescCountRef.current = count;
  }, [currentRoundData?.descriptions.length]);

  // ── Handlers (preserved exactly) ────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/undercover-word/generate'), method: 'POST' });
    } catch (e) {
      setError('词对没生成成功');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDescribe = async () => {
    if (!userId || !description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/undercover-word/describe'),
        method: 'POST',
        data: { text: description.trim() },
      });
      setDescription('');
    } catch (e) {
      setError('提交没成功，再试一次');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async () => {
    if (!userId || !selectedTarget) return;
    setVoting(true);
    setError('');
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/undercover-word/vote'),
        method: 'POST',
        data: { targetUserId: selectedTarget },
      });
    } catch (e) {
      setError('投票没成功，再试试');
    } finally {
      setVoting(false);
    }
  };

  const handleReveal = async () => {
    if (!isHost) return;
    setRevealing(true);
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/undercover-word/reveal'), method: 'POST' });
    } catch (e) {
      setError('揭晓遇到小状况');
    } finally {
      setRevealing(false);
    }
  };

  // ── V2 interaction handlers ─────────────────────────────────────
  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index);
    setLocalReactions((prev) => ({
      ...prev,
      [index]: (prev[index] || 0) + 1,
    }));
  }, []);

  const handleSwipeSelect = useCallback(
    (targetId: string) => {
      try {
        Taro.vibrateShort({ type: 'light' });
      } catch {
        // ignore haptic failure
      }
      setSelectedTarget(targetId);
    },
    [],
  );

  // ── Helpers ─────────────────────────────────────────────────────
  const getDescriptionsForUser = (targetUserId: string) => {
    const out: string[] = [];
    for (const r of rounds) {
      const d = r.descriptions.find((x) => x.userId === targetUserId);
      if (d) out.push(`第${r.roundNumber}轮：${d.text}`);
    }
    return out;
  };

  const avatarHue = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % 360;
  };

  // ════════════════════════════════════════════════════════════════
  //  State 0 — waiting for pair
  // ════════════════════════════════════════════════════════════════
  if (!pair) {
    return (
      <View className='icebreaker__phase'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='undercover-word' />
          <Text className='icebreaker__phase-title'>谁是卧底</Text>
          <Text className='icebreaker__phase-subtitle'>描述你的词，找出卧底</Text>
          {isHost ? (
            <Button onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
              生成词对
            </Button>
          ) : (
            <Text className='icebreaker__helper-text'>等待主持人生成词对...</Text>
          )}
        </Card>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  State 4 — revealed
  // ════════════════════════════════════════════════════════════════
  if (revealed && results) {
    return (
      <View className='icebreaker__phase'>
        {/* Dramatic reveal spotlight */}
        <IdentityReveal
          identity={results.undercoverDisplayName}
          label='卧底身份曝光'
          revealed={showSecret}
          spotlightColor='#EF4444'
        />

        {/* Celebration burst */}
        {showSecret && (
          <ParticleBurst
            trigger={burstTriggered}
            type={results.caught ? 'confetti' : 'roses'}
            spotlightColor={results.caught ? '#22C55E' : '#EF4444'}
            count={48}
          />
        )}

        <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='undercover-word' />
          <Text className='icebreaker__phase-title'>揭晓时刻</Text>

          <View
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12rpx',
              marginBottom: '12rpx',
            }}
          >
            {results.caught ? (
              <JoyJoinIcon emoji='🎉' tier='reaction' size={48} />
            ) : (
              <JoyJoinIcon emoji='😈' size={48} />
            )}
            <Text className='icebreaker__challenge-title'>
              卧底是：{results.undercoverDisplayName}
            </Text>
          </View>

          <Text className='icebreaker__challenge-desc'>平民词：{results.civilianWord}</Text>
          <Text className='icebreaker__challenge-desc'>卧底词：{results.undercoverWord}</Text>
          <Text className='icebreaker__challenge-desc'>
            {results.caught ? '卧底被抓住了！' : '卧底成功隐藏！'}
          </Text>

          <View style={{ width: '100%', marginTop: '16rpx', display: 'flex', flexDirection: 'column', gap: '8rpx' }}>
            {participants.map((p) => (
              <View
                key={p.userId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12rpx 16rpx',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '12rpx',
                }}
              >
                <Text style={{ fontSize: '28rpx' }} className='icebreaker__text--light'>{p.displayName}</Text>
                <Text style={{ fontSize: '28rpx', color: '#FBBF24', fontWeight: 'bold' }}>
                  {results.voteCounts[p.userId] || 0} 票
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {isHost && onAdvance && (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onAdvance}
            disabled={isAdvancing}
            loading={isAdvancing}
          >
            {isAdvancing ? '切换中…' : '进入下一阶段'}
          </Button>
        )}

        {error ? <Text className='icebreaker__error'>{error}</Text> : null}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  State 3 — voting
  // ════════════════════════════════════════════════════════════════
  if (allDescribed && currentRound >= 1) {
    return (
      <View className='icebreaker__phase'>
        {/* Word reminder (flipped open) */}
        <View style={{ marginBottom: '24rpx', width: '100%' }}>
          <CardFlip
            front={
              <View
                style={{
                  backgroundColor: 'rgba(30, 27, 75, 0.85)',
                  padding: '32rpx',
                  borderRadius: '16rpx',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8rpx',
                }}
              >
                <JoyJoinIcon emoji='🕵️' size={48} />
                <Text style={{ fontSize: '28rpx', fontWeight: 'bold' }} className='icebreaker__text--light'>你的身份是？</Text>
              </View>
            }
            back={
              <View
                style={{
                  backgroundColor: isUndercover
                    ? 'rgba(239, 68, 68, 0.10)'
                    : 'rgba(59, 130, 246, 0.10)',
                  padding: '32rpx',
                  borderRadius: '16rpx',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8rpx',
                }}
              >
                <Text style={{ fontSize: '40rpx', fontWeight: 'bold' }} className='icebreaker__text--light'>{myWord}</Text>
                <View
                  style={{
                    padding: '4rpx 16rpx',
                    borderRadius: '100rpx',
                    backgroundColor: isUndercover
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(59, 130, 246, 0.2)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: '22rpx',
                      fontWeight: '600',
                      color: isUndercover ? '#FCA5A5' : '#93C5FD',
                    }}
                  >
                    {isUndercover ? '卧底' : '平民'}
                  </Text>
                </View>
              </View>
            }
            flipped={cardFlipped}
            onFlip={() => setCardFlipped((f) => !f)}
            duration={400}
          />
        </View>

        <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='undercover-word' />
          <Text className='icebreaker__phase-title'>投票环节</Text>
          <Text className='icebreaker__phase-subtitle'>谁最有可能是卧底？</Text>

          {hasVoted ? (
            <Text className='icebreaker__helper-text'>已投票，等待其他人...</Text>
          ) : (
            <>
              <View style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16rpx', marginBottom: '16rpx' }}>
                {participants
                  .map((p) => {
                    const descs = getDescriptionsForUser(p.userId);
                    const isSelected = selectedTarget === p.userId;
                    return (
                      <SwipeCard
                        key={p.userId}
                        onSwipeRight={() => handleSwipeSelect(p.userId)}
                        onSwipeLeft={() => setSelectedTarget('')}
                        threshold={0.35}
                      >
                        <View
                          style={{
                            padding: '20rpx',
                            borderRadius: '16rpx',
                            backgroundColor: 'rgba(0,0,0,0.25)',
                            border: isSelected
                              ? '2rpx solid #22C55E'
                              : '2rpx solid rgba(255,255,255,0.1)',
                            boxShadow: isSelected
                              ? '0 0 20rpx rgba(34, 197, 94, 0.35)'
                              : 'none',
                            transition: 'border-color 200ms ease, box-shadow 200ms ease',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: '16rpx',
                          }}
                        >
                          {/* Avatar */}
                          <View
                            style={{
                              width: '72rpx',
                              height: '72rpx',
                              borderRadius: '50%',
                              backgroundColor: `hsl(${avatarHue(p.userId)}, 65%, 60%)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: '30rpx',
                                fontWeight: 'bold',
                              }}
                              className='icebreaker__text--light'
                            >
                              {(p.displayName || '?')[0]}
                            </Text>
                          </View>

                          {/* Info */}
                          <View style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4rpx' }}>
                            <Text
                              style={{
                                fontSize: '30rpx',
                                fontWeight: 'bold',
                              }}
                              className='icebreaker__text--light'
                            >
                              {p.displayName}
                            </Text>
                            {descs.length > 0 && (
                              <Text
                                style={{
                                  fontSize: '22rpx',
                                  color: 'rgba(255,255,255,0.7)',
                                  lineHeight: 1.4,
                                }}
                                numberOfLines={2}
                              >
                                {descs.join(' · ')}
                              </Text>
                            )}
                          </View>

                          {/* Selection indicator */}
                          {isSelected && (
                            <View
                              style={{
                                width: '40rpx',
                                height: '40rpx',
                                borderRadius: '50%',
                                backgroundColor: '#22C55E',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <Text style={{ fontSize: '24rpx' }} className='icebreaker__text--light'>{checkmark_emoji}</Text>
                            </View>
                          )}
                        </View>
                      </SwipeCard>
                    );
                  })}
              </View>

              <Button onClick={handleVote} disabled={!selectedTarget || voting}>
                {voting ? '提交中...' : selectedTarget ? '确认投票' : '请选择目标'}
              </Button>
            </>
          )}

          {isHost && allVoted && (
            <Button onClick={handleReveal} disabled={revealing}>
              {revealing ? '揭晓中...' : '揭晓结果'}
            </Button>
          )}
        </Card>

        {error ? <Text className='icebreaker__error'>{error}</Text> : null}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════
  //  State 2 — describing
  // ════════════════════════════════════════════════════════════════
  return (
    <View className='icebreaker__phase'>
      {/* CardFlip word reveal */}
      <View style={{ marginBottom: '24rpx', width: '100%' }}>
        <CardFlip
          front={
            <View
              style={{
                backgroundColor: 'rgba(30, 27, 75, 0.85)',
                padding: '48rpx 32rpx',
                borderRadius: '16rpx',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12rpx',
              }}
            >
              <JoyJoinIcon emoji='🕵️' size={72} />
              <Text style={{ fontSize: '36rpx', fontWeight: 'bold' }} className='icebreaker__text--light'>
                你的身份是？
              </Text>
              <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.6)' }}>
                点击或等待揭晓
              </Text>
            </View>
          }
          back={
            <View
              style={{
                backgroundColor: isUndercover
                  ? 'rgba(239, 68, 68, 0.10)'
                  : 'rgba(59, 130, 246, 0.10)',
                padding: '48rpx 32rpx',
                borderRadius: '16rpx',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16rpx',
              }}
            >
              <JoyJoinIcon emoji={identity_emoji} size={64} />
              <Text
                style={{
                  fontSize: '48rpx',
                  fontWeight: 'bold',
                }}
                className='icebreaker__text--light'
              >
                {myWord || '?'}
              </Text>
              <View
                style={{
                  padding: '8rpx 24rpx',
                  borderRadius: '100rpx',
                  backgroundColor: isUndercover
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(59, 130, 246, 0.2)',
                }}
              >
                <Text
                  style={{
                    fontSize: '26rpx',
                    fontWeight: '600',
                    color: isUndercover ? '#FCA5A5' : '#93C5FD',
                  }}
                >
                  {isUndercover ? '卧底' : '平民'}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: '22rpx',
                  color: 'rgba(255,255,255,0.6)',
                  marginTop: '4rpx',
                }}
              >
                {isUndercover ? '不要暴露自己' : '找出卧底'}
              </Text>
            </View>
          }
          flipped={cardFlipped}
          onFlip={() => setCardFlipped((f) => !f)}
          duration={400}
        />
      </View>

      <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='undercover-word' />
          <Text className='icebreaker__phase-title'>谁是卧底 · 第{currentRound + 1}轮</Text>

        {/* Tension progress bar */}
        <View style={{ width: '100%', marginBottom: '16rpx' }}>
          <View
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8rpx',
            }}
          >
            <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.7)' }}>
              描述进度
            </Text>
            <Text
              style={{
                fontSize: '24rpx',
                fontWeight: '600',
                transform: descPulse ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              className='icebreaker__text--light'
            >
              {describedCount}/{playerCount} 人已描述
            </Text>
          </View>
          <View
            style={{
              width: '100%',
              height: '8rpx',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '4rpx',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${describeProgress * 100}%`,
                height: '100%',
                backgroundColor: describeProgress >= 1 ? '#22C55E' : '#8B5CF6',
                borderRadius: '4rpx',
                transition: 'width 400ms cubic-bezier(0.22, 1, 0.36, 1)',
                transform: descPulse ? 'scaleY(1.8)' : 'scaleY(1)',
                transformOrigin: 'center',
                transitionProperty: 'width, transform',
              }}
            />
          </View>
        </View>

        {/* Previous descriptions */}
        {currentRoundData && currentRoundData.descriptions.length > 0 && (
          <View
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '10rpx',
              marginBottom: '16rpx',
            }}
          >
            {currentRoundData.descriptions.map((d, i) => (
              <View
                key={i}
                style={{
                  padding: '14rpx 18rpx',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: '12rpx',
                  animation: `icebreaker-phase-in 0.3s ease ${i * 60}ms both`,
                }}
              >
                <Text style={{ fontSize: '24rpx', color: 'rgba(255,255,255,0.6)', marginBottom: '2rpx' }}>
                  {d.displayName}
                </Text>
                <Text style={{ fontSize: '28rpx', lineHeight: 1.5 }} className='icebreaker__text--light'>
                  “{d.text}”
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* TapReaction row */}
        <View style={{ width: '100%', marginBottom: '8rpx' }}>
          <TapReaction
            reactions={REACTION_ITEMS.map((r, i) => ({
              ...r,
              count: (localReactions[i] || 0) > 0 ? localReactions[i] : undefined,
            }))}
            onReact={handleReact}
            selectedIndex={selectedReaction ?? undefined}
          />
        </View>

        {/* Input or submitted state */}
        {!hasSubmittedDesc ? (
          <>
            <Input
              placeholder='用一句话描述你的词（不要直接说词）'
              value={description}
              onInput={(e) => setDescription(e.detail.value.slice(0, 100))}
              maxlength={100}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              style={{
                width: '100%',
                marginTop: '8rpx',
                marginBottom: '8rpx',
                padding: '16rpx 20rpx',
                borderRadius: '16rpx',
                border: '1rpx solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                fontSize: '28rpx',
                boxShadow: inputFocused
                  ? '0 0 20rpx rgba(139, 92, 246, 0.35)'
                  : '0 0 0rpx transparent',
                transition: 'box-shadow 200ms ease',
              }}
              className='icebreaker__text--light'
              placeholderStyle='color: rgba(255,255,255,0.4)'
            />
            <Button onClick={handleDescribe} disabled={!description.trim() || submitting}>
              {submitting ? '提交中...' : '提交描述'}
            </Button>
          </>
        ) : (
          <View
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8rpx',
              padding: '16rpx',
            }}
          >
            <Text style={{ fontSize: '28rpx', color: '#22C55E' }}>{checkmark_emoji}</Text>
            <Text className='icebreaker__helper-text'>已提交，等待其他人...</Text>
          </View>
        )}

        {/* Host advance */}
        {isHost && allDescribed && (
          <Button onClick={handleReveal} disabled={revealing}>
            {revealing ? '处理中...' : currentRound >= 1 ? '进入投票' : '下一轮'}
          </Button>
        )}
      </Card>

      {error ? <Text className='icebreaker__error'>{error}</Text> : null}
    </View>
  );
}
