import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { apiRequest } from '../../../lib/api/api';
import { buildSocialPath } from '../icebreakerSessionModel';
import { CelebrationOverlay } from '../overlays/CelebrationOverlay';
import { CardFlip, IdentityReveal, ParticleBurst } from '../../../components/reveal';
import { TapReaction } from '../../../components/gesture';
import ChallengeCardBgImage from '../components/ChallengeCardBgImage';

interface GroupMirrorPhaseViewProps {
  socialSessionId: string;
  isHost: boolean;
  userId?: string;
  questions?: Array<{ id: string; questionText: string; category: string }>;
  answers?: Array<{ userId: string; displayName: string; questionId: string; targetUserId: string; reasonText?: string }>;
  submittedUserIds?: string[];
  revealed?: boolean;
  results?: Array<{
    questionId: string;
    questionText: string;
    topTargetUserId: string;
    topTargetDisplayName: string;
    voteCount: number;
    totalVotes: number;
  }>;
  playerCount?: number;
  participants?: Array<{ userId: string; displayName?: string }>;
  onAdvance?: () => void;
  isAdvancing?: boolean;
}

const REACTIONS = [
  { emoji: '👏', label: '鼓掌' },
  { emoji: '🔥', label: '火力' },
  { emoji: '😮', label: '哇哦' },
  { emoji: '🌹', label: '玫瑰' },
];

export default function GroupMirrorPhaseView({
  socialSessionId,
  isHost,
  userId,
  questions = [],
  answers = [],
  submittedUserIds = [],
  revealed = false,
  results,
  playerCount = 1,
  participants = [],
  onAdvance,
  isAdvancing = false,
}: GroupMirrorPhaseViewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [voteMap, setVoteMap] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  // V2 local state
  const [selectedReaction, setSelectedReaction] = useState<number | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<number, number>>({});
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({});
  const [showIdentity, setShowIdentity] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (revealed && results && results.length > 0) {
      setShowResult(true);
    }
  }, [revealed, results]);

  // V2: staggered card flip reveal when revealed
  useEffect(() => {
    if (revealed && results && results.length > 0) {
      setFlippedMap({});
      setShowIdentity(false);
      setShowBurst(false);

      const timers: ReturnType<typeof setTimeout>[] = [];
      results.forEach((r, index) => {
        timers.push(setTimeout(() => {
          setFlippedMap((prev) => ({ ...prev, [r.questionId]: true }));
        }, index * 300));
      });

      const totalDelay = results.length * 300 + 400;
      timers.push(setTimeout(() => {
        setShowIdentity(true);
      }, totalDelay));

      timers.push(setTimeout(() => {
        setShowBurst(true);
        setBurstKey((k) => k + 1);
      }, totalDelay + 300));

      return () => {
        timers.forEach(clearTimeout);
      };
    } else if (!revealed) {
      setFlippedMap({});
      setShowIdentity(false);
      setShowBurst(false);
    }
  }, [revealed, results]);

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false;
  const allSubmitted = submittedUserIds.length >= playerCount;

  // V2: compute overall winner
  const overallWinner = useMemo(() => {
    if (!results || results.length === 0) return null;
    const agg = new Map<string, { displayName: string; totalVotes: number }>();
    for (const r of results) {
      const existing = agg.get(r.topTargetUserId);
      if (existing) {
        existing.totalVotes += r.voteCount;
      } else {
        agg.set(r.topTargetUserId, { displayName: r.topTargetDisplayName, totalVotes: r.voteCount });
      }
    }
    let top: { userId: string; displayName: string; totalVotes: number } | null = null;
    for (const [uid, data] of agg) {
      if (!top || data.totalVotes > top.totalVotes) {
        top = { userId: uid, displayName: data.displayName, totalVotes: data.totalVotes };
      }
    }
    return top;
  }, [results]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/group-mirror/generate'), method: 'POST' });
    } catch (e) {
      setError('问题没生成成功');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    const answersToSubmit = questions
      .map((q) => ({ questionId: q.id, targetUserId: voteMap[q.id] }))
      .filter((a) => a.targetUserId);

    if (answersToSubmit.length === 0) {
      setError('先回答一个问题吧');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/group-mirror/submit'),
        method: 'POST',
        data: { answers: answersToSubmit },
      });
    } catch (e) {
      setError('提交没成功，再试一次');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReveal = async () => {
    if (!isHost) return;
    setRevealing(true);
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/group-mirror/reveal'), method: 'POST' });
    } catch (e) {
      setError('揭晓遇到小状况');
    } finally {
      setRevealing(false);
    }
  };

  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index);
    setReactionCounts((prev) => ({
      ...prev,
      [index]: (prev[index] ?? 0) + 1,
    }));
  }, []);

  // State: not generated
  if (questions.length === 0) {
    return (
      <View className='icebreaker__phase'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--group-mirror icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='group-mirror' />
          <Text className='icebreaker__phase-title'>群像镜像</Text>
          <Text className='icebreaker__phase-subtitle'>匿名投票，看看大家眼中的彼此</Text>
          {isHost ? (
            <Button onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
              生成问题
            </Button>
          ) : (
            <Text className='icebreaker__helper-text'>等待主持人生成问题...</Text>
          )}
        </Card>
      </View>
    );
  }

  // State: revealed
  if (revealed && results) {
    const topResult = results[0];
    return (
      <View className='icebreaker__phase'>
        <CelebrationOverlay
          visible={showResult}
          frameKey='mirror_result'
          title='群像揭晓'
          subtitle={topResult ? `${topResult.topTargetDisplayName} · ${topResult.voteCount} 票` : undefined}
          autoDismissMs={3000}
          onDismiss={() => setShowResult(false)}
        />
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--group-mirror icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='group-mirror' />
          <Text className='icebreaker__phase-title'>群像镜像 · 揭晓</Text>

          {/* V2: IdentityReveal spotlight on overall winner */}
          {overallWinner && (
            <View className='icebreaker__mirror-identity-wrapper'>
              <IdentityReveal
                identity={overallWinner.displayName}
                label='大家眼中的 TA'
                revealed={showIdentity}
                spotlightColor='#8B5CF6'
              />
            </View>
          )}

          {/* V2: ParticleBurst on winner reveal */}
          {showBurst && (
            <View className='icebreaker__mirror-burst'>
              <ParticleBurst
                key={burstKey}
                trigger={showBurst}
                type='roses'
                count={50}
                spotlightColor='#FF6B9D'
              />
            </View>
          )}

          {/* V2: CardFlip for each result */}
          <View className='icebreaker__mirror-results'>
            {results.map((r) => (
              <View key={r.questionId} className='icebreaker__mirror-result-item'>
                <CardFlip
                  front={
                    <View className='icebreaker__mirror-card-front'>
                      <Text className='icebreaker__mirror-card-question'>{r.questionText}</Text>
                      <Text className='icebreaker__mirror-card-hint'>点击揭晓</Text>
                    </View>
                  }
                  back={
                    <View className='icebreaker__mirror-card-back'>
                      <Text className='icebreaker__mirror-card-winner'>{r.topTargetDisplayName}</Text>
                      <Text className='icebreaker__mirror-card-votes'>
                        {r.voteCount} / {r.totalVotes} 票
                      </Text>
                    </View>
                  }
                  flipped={!!flippedMap[r.questionId]}
                  duration={400}
                />
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
      </View>
    );
  }

  // State: voting / submitting
  return (
    <View className='icebreaker__phase'>
      <Card className='icebreaker__challenge-card icebreaker__challenge-card--group-mirror icebreaker__challenge-card--has-bg'>
          <ChallengeCardBgImage phase='group-mirror' />
          <Text className='icebreaker__phase-title'>群像镜像</Text>
          <Text className='icebreaker__phase-subtitle'>为每个问题选择最符合的人</Text>

        {/* V2: TapReaction for spectator throws */}
        {!hasSubmitted && !revealed && (
          <View className='icebreaker__mirror-reactions'>
            <TapReaction
              reactions={REACTIONS.map((r, i) => ({
                ...r,
                count: reactionCounts[i] ?? 0,
              }))}
              onReact={handleReact}
              selectedIndex={selectedReaction ?? undefined}
            />
          </View>
        )}

        {hasSubmitted ? (
          <Text className='icebreaker__helper-text'>已提交，等待其他人...</Text>
        ) : (
          <>
            {questions.map((q) => (
              <View key={q.id} className='icebreaker__mirror-question-block'>
                <Text className='icebreaker__challenge-title'>{q.questionText}</Text>
                <View style={{ display: 'flex', flexWrap: 'wrap', gap: '8rpx', marginTop: '12rpx' }}>
                  {participants.map((p) => (
                    <Button
                      key={p.userId}
                      onClick={() => setVoteMap((prev) => ({ ...prev, [q.id]: p.userId }))}
                      variant={voteMap[q.id] === p.userId ? 'primary' : 'secondary'}
                    >
                      {p.displayName}
                    </Button>
                  ))}
                </View>
              </View>
            ))}
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? '提交中...' : '提交投票'}
            </Button>
          </>
        )}

        {isHost && allSubmitted && (
          <Button onClick={handleReveal} disabled={revealing}>
            {revealing ? '揭晓中...' : '揭晓结果'}
          </Button>
        )}
      </Card>
      {error ? <Text className='icebreaker__error'>{error}</Text> : null}
    </View>
  );
}
