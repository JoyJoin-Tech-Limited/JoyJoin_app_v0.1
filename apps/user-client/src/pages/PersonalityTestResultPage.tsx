//my path: /Users/felixg/projects/JoyJoin3/client/src/pages/PersonalityTestResultPage.tsx
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PersonalityRadarChart from '@/components/PersonalityRadarChart';
import { Sparkles, Users, TrendingUp, Heart, Share2, Quote, Eye, Crown } from 'lucide-react';
import type { RoleResult } from '@shared/schema';
import { motion, AnimatePresence } from 'framer-motion';
import { archetypeGradients, archetypeAvatars } from '@/lib/archetypeAvatars';
import { archetypeConfig } from '@/lib/archetypes';
import { getArchetypeInsight } from '@/lib/archetypeInsights';
import { useState, useEffect } from 'react';
import xiaoyueAvatar from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const [showOverlay, setShowOverlay] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [animationPhase, setAnimationPhase] = useState<'countdown' | 'reveal'>('countdown');

  const { data: result, isLoading } = useQuery<RoleResult>({
    queryKey: ['/api/personality-test/results'],
  });

  const { data: v4Result, isLoading: isV4Loading } = useQuery({
    queryKey: ['/api/assessment/v4/result'],
    enabled: !!result && !result.primaryRole,
  });

  const finalResult = result?.primaryRole ? result : (v4Result as any);
  const isActuallyLoading = isLoading || (!!result && !result.primaryRole && isV4Loading);

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality-test/stats'],
  });

  useEffect(() => {
    setShowOverlay(true);
    setCountdown(3);
    setAnimationPhase('countdown');
  }, []);

  useEffect(() => {
    if (!finalResult || !showOverlay) return;

    if (animationPhase === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setAnimationPhase('reveal');
        }, 200);
        return () => clearTimeout(timer);
      }
    } else if (animationPhase === 'reveal') {
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [countdown, finalResult, showOverlay, animationPhase]);

  if (isActuallyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">正在加载您的结果...</div>
        </div>
      </div>
    );
  }

  if (!finalResult || !finalResult.primaryRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">未找到测试结果</div>
          <Button
            data-testid="button-back-to-test"
            className="mt-4"
            onClick={() => setLocation('/personality-test')}
          >
            返回测试
          </Button>
        </div>
      </div>
    );
  }

  const chemistryMap: Record<string, Array<{ role: string; percentage: number }>> = {
    '火花塞': [{ role: '探索者', percentage: 92 }, { role: '故事家', percentage: 88 }, { role: '协调者', percentage: 85 }],
    '探索者': [{ role: '火花塞', percentage: 92 }, { role: '挑战者', percentage: 90 }, { role: '连接者', percentage: 86 }],
    '故事家': [{ role: '连接者', percentage: 94 }, { role: '火花塞', percentage: 88 }, { role: '肯定者', percentage: 87 }],
    '挑战者': [{ role: '探索者', percentage: 90 }, { role: '协调者', percentage: 88 }, { role: '氛围组', percentage: 82 }],
    '连接者': [{ role: '故事家', percentage: 94 }, { role: '探索者', percentage: 86 }, { role: '肯定者', percentage: 89 }],
    '协调者': [{ role: '火花塞', percentage: 85 }, { role: '挑战者', percentage: 88 }, { role: '连接者', percentage: 84 }],
    '氛围组': [{ role: '肯定者', percentage: 91 }, { role: '故事家', percentage: 87 }, { role: '挑战者', percentage: 82 }],
    '肯定者': [{ role: '氛围组', percentage: 91 }, { role: '连接者', percentage: 89 }, { role: '故事家', percentage: 87 }],
  };

  const myChemistry = chemistryMap[finalResult.primaryRole] || [];
  const gradient = archetypeGradients[finalResult.primaryRole] || 'from-purple-500 to-pink-500';
  const primaryAvatar = archetypeAvatars[finalResult.primaryRole];
  const primaryRoleConfig = archetypeConfig[finalResult.primaryRole];
  const nickname = primaryRoleConfig?.nickname || '';
  const tagline = primaryRoleConfig?.tagline || '';
  const epicDescription = primaryRoleConfig?.epicDescription || '';
  const styleQuote = primaryRoleConfig?.styleQuote || '';

  const handleShare = async () => {
    const shareData = {
      title: `我的社交角色是${finalResult.primaryRole}！`,
      text: `刚完成了JoyJoin性格测评，发现我是${finalResult.primaryRole}！快来测测你的社交特质吧~ ✨`,
      url: window.location.origin + '/personality-test',
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      toast({ title: '已复制到剪贴板！' });
    }
  };

  const handleContinue = () => {
    setLocation('/personality-test/complete');
  };

  const CountdownReveal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-background z-50 flex items-center justify-center"
    >
      <div className="text-center flex flex-col items-center justify-center min-h-[60vh]">
        <AnimatePresence mode="wait">
          {animationPhase === 'countdown' && countdown > 0 && (
            <motion.div
              key={`countdown-${countdown}`}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-[120px] md:text-[180px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent leading-none"
            >
              {countdown}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {animationPhase === 'reveal' && (
            <motion.div
              key="reveal-content"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative">
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-full blur-xl opacity-40 scale-110`} />
                <div className={`relative w-40 h-40 md:w-52 md:h-52 rounded-full bg-gradient-to-br ${gradient} p-1 shadow-2xl`}>
                  {primaryAvatar ? (
                    <img src={primaryAvatar} alt={finalResult.primaryRole} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                      <Sparkles className="w-20 h-20 text-primary" />
                    </div>
                  )}
                </div>
              </div>
              <motion.h2 className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
                {finalResult.primaryRole}
              </motion.h2>
              {nickname && <p className="text-xl md:text-2xl font-medium text-primary">{nickname}</p>}
              <p className="text-base md:text-lg text-muted-foreground italic">{tagline || finalResult.roleSubtype}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {showOverlay && finalResult && <CountdownReveal />}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-6 overflow-hidden"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
        <div className="relative z-10 text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex justify-center">
            <div className={`w-44 h-44 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl p-1`}>
              {primaryAvatar ? (
                <img src={primaryAvatar} alt={finalResult.primaryRole} className="w-full h-full rounded-full object-cover" />
              ) : (
                <Sparkles className="w-16 h-16 text-primary" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">{finalResult.primaryRole}</h1>
            {nickname && <p className="text-xl font-medium text-primary">{nickname}</p>}
            {tagline && <p className="text-base text-muted-foreground italic">{tagline}</p>}
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto p-4 pb-8 space-y-4">
        {(epicDescription || styleQuote) && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />角色解读</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {epicDescription && <p className="text-sm leading-relaxed">{epicDescription}</p>}
              {styleQuote && (
                <div className={`relative bg-gradient-to-br ${gradient} bg-opacity-10 rounded-lg p-4 border-l-4 border-primary/50`}>
                  <Quote className="w-6 h-6 text-primary/40 absolute top-2 left-2" />
                  <p className="text-sm font-medium italic pl-8">{styleQuote}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(() => {
          const insight = getArchetypeInsight(finalResult.primaryRole);
          if (!insight) return null;
          return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />你的特质</CardTitle>
                  <Badge variant="outline">前{insight.rarityPercentage}%</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{insight.counterIntuitive}</p>
                <div className="flex items-start gap-2 bg-card border rounded-lg p-3">
                  <div className="w-10 h-10 shrink-0"><img src={xiaoyueAvatar} alt="小悦" className="w-8 h-8 object-contain" /></div>
                  <p className="text-sm italic">"{insight.xiaoyueComment}"</p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader><CardTitle>维度概览</CardTitle></CardHeader>
            <CardContent>
              <PersonalityRadarChart 
                affinityScore={finalResult.traitScores?.A}
                opennessScore={finalResult.traitScores?.O}
                conscientiousnessScore={finalResult.traitScores?.C}
                emotionalStabilityScore={finalResult.traitScores?.E}
                extraversionScore={finalResult.traitScores?.X}
                positivityScore={finalResult.traitScores?.P}
              />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {finalResult.traitScores && Object.entries(finalResult.traitScores).map(([trait, score]) => {
                   const traitLabels: Record<string, string> = {
                     A: '宜人性',
                     O: '开放性',
                     C: '尽责性',
                     E: '情绪稳度',
                     X: '外向性',
                     P: '耐心'
                   };
                   return (
                    <div key={trait} className="flex flex-col p-2 bg-muted/50 rounded-lg">
                      <span className="text-xs text-muted-foreground">{traitLabels[trait] || trait}</span>
                      <span className="text-lg font-bold text-primary">{Math.round((score as number) * 10)}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex flex-col gap-3 py-6">
          <Button className="w-full h-12 rounded-xl" onClick={handleContinue}>继续完善资料</Button>
          <Button variant="outline" className="w-full" onClick={handleShare}><Share2 className="w-5 h-5 mr-2" />分享原型</Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setLocation('/personality-test')}>重新测试</Button>
        </div>
      </div>
    </div>
  );
}
