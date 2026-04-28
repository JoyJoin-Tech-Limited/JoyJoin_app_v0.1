/**
 * ResultStage - The full personality result page content.
 *
 * Card-centric layout that replaces the legacy long-scroll report format.
 * Secondary content lives in a tabbed layer beneath the hero card.
 * Deep-dive data is behind a tactile "了解更多" trigger.
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronDown, Star, Users, Zap, Heart, TrendingUp, MessageSquare, Image as ImageIcon, ThumbsUp, ThumbsDown, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { personalityResultAnalytics } from '@/lib/personalityResultAnalytics';
import { invalidateUserDerivedQueries } from '@/lib/userStateInvalidation';
import type { PersonalityResultViewModel } from '@joyjoin/shared/personality/resultViewModel';
import { PremiumCard } from './PremiumCard';
import PersonalityRadarChart from '@/components/PersonalityRadarChart';
import { ShareCardModal } from '@/components/ShareCardModal';

interface ResultStageProps {
  viewModel: PersonalityResultViewModel;
  onContinue: () => void;
  isContinuing: boolean;
}

// ─── Animation Variants ───

const reducedMotionContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
};

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 },
  },
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
};

export function ResultStage({ viewModel, onContinue, isContinuing }: ResultStageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const resultsViewedTrackedRef = useRef(false);

  const containerVariants = prefersReducedMotion
    ? reducedMotionContainerVariants
    : staggerContainerVariants;

  const record = viewModel.archetypeRecord;
  const gradient = record?.displayTokens.gradientKey ?? 'from-purple-500 to-pink-500';
  const share = viewModel.share;

  // Track result viewed (once)
  useEffect(() => {
    if (resultsViewedTrackedRef.current) return;
    resultsViewedTrackedRef.current = true;
    personalityResultAnalytics.track('personality_result_viewed', {
      primaryArchetype: viewModel.primaryArchetype,
      archetypeIndex: viewModel.archetypeIndex,
      isDecisive: viewModel.isDecisive,
      totalQuestions: viewModel.totalQuestions,
      secondaryArchetype: viewModel.secondaryArchetype,
    });
  }, [viewModel.primaryArchetype, viewModel.archetypeIndex, viewModel.isDecisive, viewModel.totalQuestions, viewModel.secondaryArchetype]);

  // ─── Feedback Handler ───
  const handleFeedback = async (value: 'accurate' | 'partial' | 'inaccurate') => {
    if (feedbackSubmitted || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    try {
      await apiRequest('POST', '/api/assessment/feedback', {
        archetype: viewModel.primaryArchetype,
        accuracy: value,
      });
      setFeedbackSubmitted(true);
    } catch (error: any) {
      toast({ title: '反馈提交失败', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // ─── Share Handlers ───
  const handleCopyShareLine = async () => {
    try {
      await navigator.clipboard.writeText(
        `${share.shareLine} ${window.location.origin + '/personality-test'}`
      );
      toast({ title: '已复制文字版结果' });
    } catch {
      toast({ title: '复制失败', description: '请长按文案后手动复制', variant: 'destructive' });
    }
  };

  const handleCopyVariant = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: '已复制分享文案' });
    } catch {
      toast({ title: '复制失败', description: '请长按文案后手动复制', variant: 'destructive' });
    }
  };

  // ─── Tabs Content ───
  const tabItems = [
    {
      id: 'role',
      label: '你在局里的作用',
      icon: Star,
      content: share.socialRole,
    },
    {
      id: 'scene',
      label: '更适合的局',
      icon: Users,
      content: share.bestScene,
    },
    {
      id: 'action',
      label: '下一步更顺手',
      icon: Zap,
      content: share.microAction,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ─ Hero: Premium Card ─ */}
      <PremiumCard
        archetypeName={viewModel.primaryArchetype}
        nickname={record?.narrative.nickname ?? ''}
        tagline={record?.narrative.tagline ?? ''}
        rarityPercentage={record?.insights.rarityPercentage}
        typeNo={viewModel.typeNo}
        skillSet={viewModel.skillSet}
        isDecisive={viewModel.isDecisive}
        gradientClass={gradient}
      />

      {/* ─ Content ─ */}
      <motion.div
        className="max-w-2xl mx-auto px-4 pb-32 space-y-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Tabbed Secondary Content */}
        <motion.div variants={staggerItemVariants}>
          <Tabs defaultValue="role" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              {tabItems.map((item) => (
                <TabsTrigger key={item.id} value={item.id} className="text-xs gap-1">
                  <item.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {tabItems.map((item) => (
              <TabsContent key={item.id} value={item.id}>
                <Card className="border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                      <item.icon className="w-4 h-4 text-primary" />
                      {item.label}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90">{item.content}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>

        {/* Xiaoyue Analysis */}
        <motion.div variants={staggerItemVariants}>
          <Card className="border-primary/20 overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">小悦的结论</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{share.analysis}</p>
              {share.blendLine && (
                <p className="text-sm leading-relaxed text-muted-foreground">{share.blendLine}</p>
              )}
              {share.expressionTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {share.expressionTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Best Partners */}
        {viewModel.highCompatibilityPartners.length > 0 && (
          <motion.div variants={staggerItemVariants}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="w-5 h-5 text-primary" />
                  最佳搭档
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {viewModel.highCompatibilityPartners.map((chemistry, index) => (
                  <div
                    key={`${chemistry.role}-${index}`}
                    className="p-3 bg-muted/50 rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{chemistry.role}</span>
                      <Badge variant="secondary" className="text-xs">
                        {chemistry.percentage}%
                      </Badge>
                    </div>
                    {chemistry.reason && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {chemistry.reason}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Share Toolkit (compact) */}
        <motion.div variants={staggerItemVariants}>
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium">{share.headline}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyShareLine}>
                  复制文字版结果
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyVariant(share.selfIntro)}
                >
                  自我介绍
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyVariant(share.friendCallout)}
                >
                  朋友视角
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyVariant(share.socialInvite)}
                >
                  社交邀请
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Deep Dive: 了解更多 */}
        <motion.div variants={staggerItemVariants}>
          <Card>
            <CardContent className="p-4">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <TrendingUp className="w-4 h-4" />
                    想了解更多？
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="pt-4 space-y-4">
                  <PersonalityRadarChart
                    affinityScore={viewModel.traitEntries.find((t) => t.key === 'A')?.score ?? 0}
                    opennessScore={viewModel.traitEntries.find((t) => t.key === 'O')?.score ?? 0}
                    conscientiousnessScore={viewModel.traitEntries.find((t) => t.key === 'C')?.score ?? 0}
                    emotionalStabilityScore={viewModel.traitEntries.find((t) => t.key === 'E')?.score ?? 0}
                    extraversionScore={viewModel.traitEntries.find((t) => t.key === 'X')?.score ?? 0}
                    positivityScore={viewModel.traitEntries.find((t) => t.key === 'P')?.score ?? 0}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    {viewModel.traitEntries.map(({ key, label, score }) => (
                      <div key={key} className="flex flex-col p-2 bg-muted/50 rounded-lg">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-lg font-bold text-primary">{Math.round(score)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feedback */}
        <motion.div variants={staggerItemVariants}>
          {feedbackSubmitted ? (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <p className="text-sm text-muted-foreground">感谢反馈！你的意见帮助我们做得更好</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-4">
                <div className="space-y-3">
                  <p className="text-sm">这个结果符合你对自己的认知吗？</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback('accurate')}
                      disabled={isSubmittingFeedback}
                      className="gap-1"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      很准
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback('partial')}
                      disabled={isSubmittingFeedback}
                    >
                      部分符合
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFeedback('inaccurate')}
                      disabled={isSubmittingFeedback}
                      className="gap-1"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      不太像
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Poster CTA (primary share action) */}
        <motion.div variants={staggerItemVariants} className="py-4">
          <div className="relative group">
            <div
              className={`absolute inset-0 bg-gradient-to-r ${gradient} rounded-2xl blur-md opacity-50 group-hover:opacity-70 transition-opacity duration-300`}
              aria-hidden="true"
            />
            <Button
              className={`relative w-full h-16 rounded-2xl text-lg font-bold shadow-xl bg-gradient-to-r ${gradient} hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 border-2 border-white/30`}
              onClick={() => {
                if (!isAuthenticated) {
                  setLocation('/personality-test/auth-gate');
                  return;
                }
                try {
                  if (navigator.vibrate) navigator.vibrate(50);
                } catch {}
                setShareModalOpen(true);
              }}
              aria-label={`下载你的${viewModel.archetypeRecord?.name ?? viewModel.primaryArchetype}原型海报`}
            >
              <div className="flex items-center justify-center gap-3 w-full">
                <ImageIcon className="w-6 h-6 animate-pulse" aria-hidden="true" />
                <span>下载你的{viewModel.archetypeRecord?.name ?? viewModel.primaryArchetype}海报</span>
                <Badge variant="secondary" className="ml-2 bg-white/20 backdrop-blur-sm border-white/40 text-xs">
                  🖼️ 海报
                </Badge>
              </div>
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              上面的文字版适合直接发出去，这张海报更适合截图收藏或发朋友圈。
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Floating CTA */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent z-40"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
      >
        <div className="max-w-2xl mx-auto">
          {isAuthenticated ? (
            <Button
              className={`w-full h-14 rounded-2xl text-lg font-bold shadow-lg bg-gradient-to-r ${gradient} hover:opacity-90 transition-all duration-200 border-0`}
              onClick={onContinue}
              disabled={isContinuing}
            >
              {isContinuing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  继续完善个人信息
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          ) : null}
        </div>
      </motion.div>

      {/* Share Modal */}
      <ShareCardModal open={shareModalOpen} onOpenChange={setShareModalOpen} />
    </div>
  );
}
