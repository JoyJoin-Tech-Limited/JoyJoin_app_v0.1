import { useEffect, useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { apiRequest } from '../../../lib/api/api';
import { buildSocialPath } from '../icebreakerSessionModel';
import { CelebrationOverlay } from '../overlays/CelebrationOverlay';

interface QuipBattlePrompt {
  id: string;
  promptText: string;
  category: string;
}

interface QuipBattleAnswer {
  userId: string;
  displayName: string;
  answerText: string;
  promptId: string;
}

interface QuipBattleResult {
  promptId: string;
  promptText: string;
  answers: QuipBattleAnswer[];
  winnerUserId: string;
  winnerDisplayName: string;
  voteCount: number;
}

interface QuipBattlePhaseViewProps {
  socialSessionId: string;
  isHost: boolean;
  prompts?: QuipBattlePrompt[];
  answers?: QuipBattleAnswer[];
  results?: QuipBattleResult[];
  revealed?: boolean;
  submittedUserIds?: string[];
  votedUserIds?: string[];
  userId?: string;
  playerCount?: number;
  onRefresh?: () => void;
  onAdvance?: () => void;
  isAdvancing?: boolean;
}

export default function QuipBattlePhaseView({
  socialSessionId,
  isHost,
  prompts = [],
  answers = [],
  results = [],
  revealed = false,
  submittedUserIds = [],
  votedUserIds = [],
  userId,
  playerCount = 1,
  onRefresh,
  onAdvance,
  isAdvancing = false,
}: QuipBattlePhaseViewProps) {
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({});
  const [voteMap, setVoteMap] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showChampion, setShowChampion] = useState(false);

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false;
  const hasVoted = userId ? votedUserIds.includes(userId) : false;
  const allSubmitted = submittedUserIds.length >= playerCount;
  const allVoted = votedUserIds.length >= playerCount;

  const championResult = revealed && results.length > 0 ? results[0] : null;

  useEffect(() => {
    if (revealed && championResult) {
      setShowChampion(true);
    }
  }, [revealed, championResult]);

  const handleAnswerChange = (promptId: string, text: string) => {
    setAnswerMap((prev) => ({ ...prev, [promptId]: text.slice(0, 100) }));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/quip-battle/generate'),
        method: 'POST',
      });
      onRefresh?.();
    } catch {
      setError('生成题目失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!userId) return;
    const answersToSubmit = prompts
      .map((p) => ({ promptId: p.id, answerText: answerMap[p.id] || '' }))
      .filter((a) => a.answerText.trim().length > 0);

    if (answersToSubmit.length === 0) {
      setError('请至少回答一个题目');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/quip-battle/submit'),
        method: 'POST',
        data: { answers: answersToSubmit },
      });
      onRefresh?.();
    } catch {
      setError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async () => {
    if (!userId) return;
    const votesToSubmit = Object.entries(voteMap)
      .filter(([, answerId]) => answerId)
      .map(([promptId, answerId]) => ({ promptId, answerId }));

    if (votesToSubmit.length === 0) {
      setError('请至少投一票');
      return;
    }

    setVoting(true);
    setError('');
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/quip-battle/vote'),
        method: 'POST',
        data: { votes: votesToSubmit },
      });
      onRefresh?.();
    } catch {
      setError('投票失败，请重试');
    } finally {
      setVoting(false);
    }
  };

  const handleReveal = async () => {
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/quip-battle/results'),
        method: 'GET',
      });
      onRefresh?.();
    } catch {
      setError('揭晓失败，请重试');
    }
  };

  // Phase 1: Submit answers
  if (!hasSubmitted && !revealed) {
    return (
      <View className='icebreaker__phase'>
        <Text className='icebreaker__phase-title'>机智对决</Text>
        <Text className='icebreaker__phase-subtitle'>填空造句，秀出你的脑洞</Text>

        {prompts.length === 0 && isHost && (
          <Button
            variant='primary'
            onClick={handleGenerate}
            disabled={isGenerating}
            loading={isGenerating}
          >
            生成题目
          </Button>
        )}

        {prompts.length === 0 && !isHost && (
          <Text className='icebreaker__phase-hint'>等待主持人生成题目...</Text>
        )}

        {prompts.map((prompt, i) => (
          <Card key={prompt.id} className='icebreaker__challenge-card icebreaker__challenge-card--quip-battle icebreaker__challenge-card--has-bg'>
            <Text className='icebreaker__challenge-label'>题目 {i + 1}</Text>
            <Text className='icebreaker__challenge-text'>{prompt.promptText}</Text>
            <Input
              className='icebreaker__text-input'
              placeholder='填入你的神回复...'
              value={answerMap[prompt.id] || ''}
              onInput={(e) => handleAnswerChange(prompt.id, e.detail.value)}
              maxlength={100}
            />
            <Text className='icebreaker__char-count'>
              {(answerMap[prompt.id] || '').length}/100
            </Text>
          </Card>
        ))}

        {error ? <Text className='icebreaker__error'>{error}</Text> : null}

        {prompts.length > 0 && (
          <Button variant='primary' onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '提交答案'}
          </Button>
        )}
      </View>
    );
  }

  // Phase 2: Voting (all submitted, not revealed)
  if (hasSubmitted && allSubmitted && !hasVoted && !revealed) {
    return (
      <View className='icebreaker__phase'>
        <Text className='icebreaker__phase-title'>投票环节</Text>
        <Text className='icebreaker__phase-subtitle'>选出每个题目最搞笑的回复</Text>

        {prompts.map((prompt) => {
          const promptAnswers = answers.filter((a) => a.promptId === prompt.id);
          return (
            <Card key={prompt.id} className='icebreaker__challenge-card icebreaker__challenge-card--quip-battle icebreaker__challenge-card--has-bg'>
              <Text className='icebreaker__challenge-text'>{prompt.promptText}</Text>
              {promptAnswers.map((answer) => (
                <View
                  key={answer.userId}
                  className={`icebreaker__answer-item ${voteMap[prompt.id] === `${answer.userId}::${prompt.id}` ? 'selected' : ''}`}
                  onClick={() =>
                    setVoteMap((prev) => ({
                      ...prev,
                      [prompt.id]: `${answer.userId}::${prompt.id}`,
                    }))
                  }
                >
                  <Text className='icebreaker__answer-author'>{answer.displayName}</Text>
                  <Text className='icebreaker__answer-text'>"{answer.answerText}"</Text>
                </View>
              ))}
            </Card>
          );
        })}

        {error ? <Text className='icebreaker__error'>{error}</Text> : null}

        <Button variant='primary' onClick={handleVote} disabled={voting}>
          {voting ? '投票中...' : '提交投票'}
        </Button>
      </View>
    );
  }

  // Phase 3: Waiting for others
  if (hasSubmitted && !allSubmitted && !revealed) {
    return (
      <View className='icebreaker__phase'>
        <Text className='icebreaker__phase-title'>等待其他玩家</Text>
        <Text className='icebreaker__phase-subtitle'>
          已提交 {submittedUserIds.length}/{playerCount}
        </Text>
        {isHost && (
          <Button variant='secondary' onClick={onRefresh}>
            刷新状态
          </Button>
        )}
      </View>
    );
  }

  if (hasVoted && !revealed) {
    return (
      <View className='icebreaker__phase'>
        <Text className='icebreaker__phase-title'>等待投票</Text>
        <Text className='icebreaker__phase-subtitle'>
          已投票 {votedUserIds.length}/{playerCount}
        </Text>
        {isHost && allVoted && (
          <Button variant='primary' onClick={handleReveal}>
            揭晓结果
          </Button>
        )}
      </View>
    );
  }

  // Phase 4: Results revealed
  if (revealed && results.length > 0) {
    return (
      <View className='icebreaker__phase'>
        <CelebrationOverlay
          visible={showChampion}
          frameKey='quip_champion'
          title='本轮冠军'
          subtitle={championResult ? `${championResult.winnerDisplayName} · ${championResult.voteCount} 票` : undefined}
          autoDismissMs={3000}
          onDismiss={() => setShowChampion(false)}
        />
        <Text className='icebreaker__phase-title'>揭晓时刻</Text>
        <Text className='icebreaker__phase-subtitle'>看看谁的脑洞最大</Text>

        {results.map((result, i) => (
          <Card key={result.promptId} className='icebreaker__challenge-card icebreaker__challenge-card--quip-battle icebreaker__challenge-card--has-bg'>
            <Text className='icebreaker__challenge-label'>题目 {i + 1}</Text>
            <Text className='icebreaker__challenge-text'>{result.promptText}</Text>

            {result.answers.map((answer) => {
              const isWinner = answer.userId === result.winnerUserId;
              return (
                <View
                  key={answer.userId}
                  className={`icebreaker__answer-item ${isWinner ? 'winner' : ''}`}
                >
                  <Text className='icebreaker__answer-author'>
                    {answer.displayName} {isWinner ? '(冠军)' : ''}
                  </Text>
                  <Text className='icebreaker__answer-text'>"{answer.answerText}"</Text>
                </View>
              );
            })}

            {result.winnerDisplayName && (
              <Text className='icebreaker__winner-banner'>
                最佳回复：{result.winnerDisplayName}（{result.voteCount}票）
              </Text>
            )}
          </Card>
        ))}

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

  // Fallback
  return (
    <View className='icebreaker__phase'>
      <Text className='icebreaker__phase-title'>机智对决</Text>
      <Text className='icebreaker__phase-subtitle'>准备开始...</Text>
      {isHost && prompts.length === 0 && (
        <Button
          variant='primary'
          onClick={handleGenerate}
          disabled={isGenerating}
          loading={isGenerating}
        >
          生成题目
        </Button>
      )}
    </View>
  );
}
