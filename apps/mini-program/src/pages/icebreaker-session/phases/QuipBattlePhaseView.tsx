import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { apiRequest } from '../../../lib/api/api';
import { buildSocialPath } from '../icebreakerSessionModel';
import { CelebrationOverlay } from '../overlays/CelebrationOverlay';
import { SwipeCard } from '../../../components/gesture';
import { TapReaction } from '../../../components/gesture';
import { ParticleBurst } from '../../../components/reveal';

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

const REACTIONS = [
  { emoji: '😂', label: '好笑' },
  { emoji: '🔥', label: '绝了' },
  { emoji: '👏', label: '鼓掌' },
  { emoji: '🌹', label: '玫瑰' },
];

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
  const [stackIndex, setStackIndex] = useState(0);
  const [burstTrigger, setBurstTrigger] = useState(false);
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [reactionCounts, setReactionCounts] = useState<number[]>([0, 0, 0, 0]);
  const [selectedReaction, setSelectedReaction] = useState<number | undefined>();

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current);
        burstTimeoutRef.current = undefined;
      }
    };
  }, []);

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false;
  const hasVoted = userId ? votedUserIds.includes(userId) : false;
  const allSubmitted = submittedUserIds.length >= playerCount;
  const allVoted = votedUserIds.length >= playerCount;

  const championResult = revealed && results.length > 0 ? results[0] : null;

  // Build flat swipe stack: one card per answer, grouped by prompt order
  const swipeStack = useMemo(() => {
    const stack: { prompt: QuipBattlePrompt; answer: QuipBattleAnswer }[] = [];
    for (const prompt of prompts) {
      const promptAnswers = answers.filter((a) => a.promptId === prompt.id);
      for (const answer of promptAnswers) {
        stack.push({ prompt, answer });
      }
    }
    return stack;
  }, [prompts, answers]);

  // Reset stack index when entering voting phase
  useEffect(() => {
    if (hasSubmitted && allSubmitted && !hasVoted && !revealed) {
      setStackIndex(0);
    }
  }, [hasSubmitted, allSubmitted, hasVoted, revealed]);

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
      setError('题目没生成成功');
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
      setError('先回答一个题目吧');
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
      setError('提交遇到小状况');
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
      setError('先投一票再继续吧');
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
      setError('投票没成功');
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
      setError('揭晓遇到小状况');
    }
  };

  const handleSwipeRight = useCallback(() => {
    const current = swipeStack[stackIndex];
    if (!current) return;

    // Record vote for this prompt
    setVoteMap((prev) => ({
      ...prev,
      [current.prompt.id]: `${current.answer.userId}::${current.prompt.id}`,
    }));

    // Trigger burst
    setBurstTrigger(true);
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current);
    burstTimeoutRef.current = setTimeout(() => setBurstTrigger(false), 300);

    // Advance stack
    setStackIndex((i) => Math.min(i + 1, swipeStack.length));
  }, [stackIndex, swipeStack]);

  const handleSwipeLeft = useCallback(() => {
    // Skip — advance without voting
    setStackIndex((i) => Math.min(i + 1, swipeStack.length));
  }, [swipeStack.length]);

  const handleReaction = useCallback((index: number) => {
    setSelectedReaction(index);
    setReactionCounts((prev) => {
      const next = [...prev];
      next[index] = (next[index] || 0) + 1;
      return next;
    });
  }, []);

  // Derive "best of" top 3 answers across all results
  const bestOfAnswers = useMemo(() => {
    if (!revealed || results.length === 0) return [];
    const allAnswers: {
      promptText: string;
      displayName: string;
      answerText: string;
      voteCount: number;
      isWinner: boolean;
    }[] = [];
    for (const result of results) {
      for (const answer of result.answers) {
        const isWinner = answer.userId === result.winnerUserId;
        allAnswers.push({
          promptText: result.promptText,
          displayName: answer.displayName,
          answerText: answer.answerText,
          voteCount: isWinner ? result.voteCount : 0,
          isWinner,
        });
      }
    }
    // Sort by winner first, then by vote count
    return allAnswers
      .sort((a, b) => (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0) || b.voteCount - a.voteCount)
      .slice(0, 3);
  }, [revealed, results]);

  // How many prompts still need a vote?
  const votedPromptCount = Object.keys(voteMap).length;
  const totalPromptCount = prompts.length;

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
    const currentCard = swipeStack[stackIndex];

    return (
      <View className='icebreaker__phase'>
        <Text className='icebreaker__phase-title'>投票环节</Text>
        <Text className='icebreaker__phase-subtitle'>选出每个题目最搞笑的回复</Text>

        {/* Particle burst on upvote */}
        <View style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 20, pointerEvents: 'none' }}>
          <ParticleBurst trigger={burstTrigger} type='confetti' count={30} />
        </View>

        {currentCard ? (
          <View className='icebreaker__quip-stack'>
            <SwipeCard
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              threshold={0.35}
            >
              <View className='icebreaker__quip-stack-card'>
                <Text className='icebreaker__quip-stack-prompt'>
                  {currentCard.prompt.promptText}
                </Text>
                <Text className='icebreaker__quip-stack-author'>
                  {currentCard.answer.displayName}
                </Text>
                <Text className='icebreaker__quip-stack-answer'>
                  “{currentCard.answer.answerText}”
                </Text>
              </View>
            </SwipeCard>
            <Text className='icebreaker__quip-stack-progress'>
              卡片 {stackIndex + 1} / {swipeStack.length} · 已选 {votedPromptCount} / {totalPromptCount} 题
            </Text>
            <Text className='icebreaker__phase-subtitle' style={{ marginTop: '8rpx', fontSize: '22rpx' }}>
              右滑 = 投票 · 左滑 = 跳过
            </Text>
          </View>
        ) : (
          <Card className='icebreaker__challenge-card icebreaker__challenge-card--quip-battle'>
            <Text className='icebreaker__challenge-title'>所有卡片已浏览</Text>
            <Text className='icebreaker__challenge-desc'>
              已为 {votedPromptCount} / {totalPromptCount} 个题目投票
            </Text>
          </Card>
        )}

        {error ? <Text className='icebreaker__error'>{error}</Text> : null}

        <Button variant='primary' onClick={handleVote} disabled={voting || votedPromptCount === 0}>
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

        {/* Best-of reel */}
        {bestOfAnswers.length > 0 && (
          <View className='icebreaker__best-of-reel'>
            <Text className='icebreaker__phase-title' style={{ fontSize: '32rpx' }}>
              🏆 最佳回复 TOP 3
            </Text>
            {bestOfAnswers.map((item, idx) => (
              <View
                key={`${item.displayName}-${idx}`}
                className={`icebreaker__best-of-card icebreaker__best-of-card--delay-${idx}`}
              >
                <Text className='icebreaker__best-of-rank'>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} TOP {idx + 1}
                  {item.isWinner ? ' · 冠军' : ''}
                </Text>
                <Text className='icebreaker__best-of-author'>{item.displayName}</Text>
                <Text className='icebreaker__best-of-text'>“{item.answerText}”</Text>
                <Text className='icebreaker__best-of-votes'>
                  题目：{item.promptText}
                  {item.voteCount > 0 ? ` · ${item.voteCount} 票` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* TapReaction during reveal */}
        <View className='icebreaker__quip-reaction-row'>
          <TapReaction
            reactions={REACTIONS.map((r, i) => ({ ...r, count: reactionCounts[i] }))}
            onReact={handleReaction}
            selectedIndex={selectedReaction}
          />
        </View>

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
