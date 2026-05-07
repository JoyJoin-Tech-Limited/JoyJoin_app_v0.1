import { useEffect, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { apiRequest } from '../../../lib/api/api';
import { buildSocialPath } from '../icebreakerSessionModel';
import { CelebrationOverlay } from '../overlays/CelebrationOverlay';

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

  useEffect(() => {
    if (revealed && results && results.length > 0) {
      setShowResult(true);
    }
  }, [revealed, results]);

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false;
  const allSubmitted = submittedUserIds.length >= playerCount;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/group-mirror/generate'), method: 'POST' });
    } catch (e) {
      setError('生成问题失败');
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
      setError('请至少回答一个问题');
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
      setError('提交失败');
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
      setError('揭晓失败');
    } finally {
      setRevealing(false);
    }
  };

  // State: not generated
  if (questions.length === 0) {
    return (
      <View className='icebreaker__phase'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--group-mirror icebreaker__challenge-card--has-bg'>
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
    const topResult = results[0]
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
          <Text className='icebreaker__phase-title'>群像镜像 · 揭晓</Text>
          {results.map((r) => (
            <View key={r.questionId}>
              <Text className='icebreaker__challenge-title'>{r.questionText}</Text>
              <Text className='icebreaker__challenge-desc'>
                最多票：{r.topTargetDisplayName}（{r.voteCount}/{r.totalVotes} 票）
              </Text>
            </View>
          ))}
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
        <Text className='icebreaker__phase-title'>群像镜像</Text>
        <Text className='icebreaker__phase-subtitle'>为每个问题选择最符合的人</Text>

        {hasSubmitted ? (
          <Text className='icebreaker__helper-text'>已提交，等待其他人...</Text>
        ) : (
          <>
            {questions.map((q) => (
              <View key={q.id}>
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
