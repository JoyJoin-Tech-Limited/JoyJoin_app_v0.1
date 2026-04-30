import { useEffect, useState } from 'react';
import { View, Text, Input, Image } from '@tarojs/components';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { apiRequest } from '../../lib/api';
import { buildSocialPath } from './icebreakerSessionModel';
import { CelebrationOverlay } from './CelebrationOverlay';

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
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    if (revealed && results) {
      setShowSecret(true);
    }
  }, [revealed, results]);

  const isUndercover = userId === undercoverUserId;
  const myWord = isUndercover ? pair?.undercoverWord : pair?.civilianWord;
  const currentRoundData = rounds[currentRound];
  const hasSubmittedDesc = currentRoundData?.descriptions.some((d) => d.userId === userId);
  const hasVoted = userId ? votedUserIds.includes(userId) : false;
  const allDescribed = currentRoundData ? currentRoundData.descriptions.length >= playerCount : false;
  const allVoted = votedUserIds.length >= playerCount;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/undercover-word/generate'), method: 'POST' });
    } catch (e) {
      setError('生成词对失败');
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
      setError('提交失败');
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
      setError('投票失败');
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
      setError('揭晓失败');
    } finally {
      setRevealing(false);
    }
  };

  // State: not generated yet
  if (!pair) {
    return (
      <View className='icebreaker__phase'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
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

  // State: reveal done
  if (revealed && results) {
    const roleIcon = results.undercoverUserId === userId
      ? require('../../assets/lovart/icebreaker/icons/icon-role-undercover.png')
      : require('../../assets/lovart/icebreaker/icons/icon-role-civilian.png');
    return (
      <View className='icebreaker__phase'>
        <CelebrationOverlay
          visible={showSecret}
          frameKey='undercover_secret'
          title='卧底身份曝光'
          subtitle={`卧底：${results.undercoverDisplayName}`}
          autoDismissMs={3500}
          onDismiss={() => setShowSecret(false)}
        />
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
          <Text className='icebreaker__phase-title'>揭晓时刻</Text>
          <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12rpx', marginBottom: '12rpx' }}>
            <Image src={roleIcon} mode='aspectFit' style={{ width: '48rpx', height: '48rpx' }} />
            <Text className='icebreaker__challenge-title'>卧底是：{results.undercoverDisplayName}</Text>
          </View>
          <Text className='icebreaker__challenge-desc'>平民词：{results.civilianWord}</Text>
          <Text className='icebreaker__challenge-desc'>卧底词：{results.undercoverWord}</Text>
          <Text className='icebreaker__challenge-desc'>
            {results.caught ? '卧底被抓住了！' : '卧底成功隐藏！'}
          </Text>
          {participants.map((p) => (
            <Text key={p.userId} className='icebreaker__helper-text'>
              {p.displayName}: {results.voteCounts[p.userId] || 0} 票
            </Text>
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

  // State: voting
  if (allDescribed && currentRound >= 1) {
    return (
      <View className='icebreaker__phase'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
          <Text className='icebreaker__phase-title'>投票环节</Text>
          <Text className='icebreaker__phase-subtitle'>谁最有可能是卧底？</Text>
          {hasVoted ? (
            <Text className='icebreaker__helper-text'>已投票，等待其他人...</Text>
          ) : (
            <>
              {participants.map((p) => (
                <Button
                  key={p.userId}
                  onClick={() => setSelectedTarget(p.userId)}
                  variant={selectedTarget === p.userId ? 'primary' : 'secondary'}
                >
                  {p.displayName}
                </Button>
              ))}
              <Button onClick={handleVote} disabled={!selectedTarget || voting}>
                {voting ? '提交中...' : '确认投票'}
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

  // State: describing
  return (
    <View className='icebreaker__phase'>
      <Card className='icebreaker__challenge-card icebreaker__challenge-card--undercover-word icebreaker__challenge-card--has-bg'>
        <Text className='icebreaker__phase-title'>谁是卧底 · 第{currentRound + 1}轮</Text>
        <Text className='icebreaker__challenge-title'>你的词</Text>
        <Text className='icebreaker__challenge-title'>{myWord || '?'}</Text>
        <Text className='icebreaker__helper-text'>
          {isUndercover ? '你是卧底！不要暴露自己' : '你是平民'}
        </Text>

        {currentRoundData?.descriptions.map((d, i) => (
          <Text key={i} className='icebreaker__helper-text'>
            {d.displayName}: {d.text}
          </Text>
        ))}

        {!hasSubmittedDesc ? (
          <>
            <Input
              placeholder='用一句话描述你的词（不要直接说词）'
              value={description}
              onInput={(e) => setDescription(e.detail.value.slice(0, 100))}
              maxlength={100}
            />
            <Button onClick={handleDescribe} disabled={!description.trim() || submitting}>
              {submitting ? '提交中...' : '提交描述'}
            </Button>
          </>
        ) : (
          <Text className='icebreaker__helper-text'>已提交，等待其他人...</Text>
        )}

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
