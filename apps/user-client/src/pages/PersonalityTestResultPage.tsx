//my path: /Users/felixg/projects/JoyJoin3/client/src/pages/PersonalityTestResultPage.tsx
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PersonalityRadarChart from '@/components/PersonalityRadarChart';
import { Sparkles, Users, TrendingUp, AlertTriangle, Heart, Share2, Quote, Target } from 'lucide-react';
import type { RoleResult } from '@shared/schema';
import { queryClient } from '@/lib/queryClient';
import { motion, AnimatePresence } from 'framer-motion';
import { archetypeGradients, archetypeAvatars } from '@/lib/archetypeAvatars';
import { archetypeConfig } from '@/lib/archetypes';
import { getTopCompatibleArchetypes, getCompatibilityCategory } from '@/lib/archetypeCompatibility';
import { getCompatibilityDescription } from '@/lib/archetypeCompatibilityDescriptions';
import { useState, useEffect } from 'react';

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const [showOverlay, setShowOverlay] = useState(true);
  const [countdown, setCountdown] = useState(3);
  const [animationPhase, setAnimationPhase] = useState<'countdown' | 'reveal'>('countdown');

  const { data: result, isLoading } = useQuery<RoleResult>({
    queryKey: ['/api/personality-test/results'],
  });

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality-test/stats'],
  });

  const { data: roleDistribution } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality/role-distribution'],
  });

  // Reset animation state on component mount
  // This ensures the countdown runs every time user navigates to this page
  useEffect(() => {
    // Always start fresh on mount
    setShowOverlay(true);
    setCountdown(3);
    setAnimationPhase('countdown');
  }, []); // Empty dependency - only runs on mount

  // Countdown timer effect - using single continuous overlay
  useEffect(() => {
    if (!result || !showOverlay) return;

    if (animationPhase === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Countdown finished, transition to reveal phase
        const timer = setTimeout(() => {
          setAnimationPhase('reveal');
        }, 200);
        return () => clearTimeout(timer);
      }
    } else if (animationPhase === 'reveal') {
      // Stay on reveal for 4 seconds before closing overlay
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [countdown, result, showOverlay, animationPhase]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">正在加载您的结果...</div>
        </div>
      </div>
    );
  }

  if (!result) {
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

  // Chemistry/matching compatibility data
  const chemistryMap: Record<string, Array<{ role: string; percentage: number }>> = {
    '火花塞': [
      { role: '探索者', percentage: 92 },
      { role: '故事家', percentage: 88 },
      { role: '协调者', percentage: 85 },
    ],
    '探索者': [
      { role: '火花塞', percentage: 92 },
      { role: '挑战者', percentage: 90 },
      { role: '连接者', percentage: 86 },
    ],
    '故事家': [
      { role: '连接者', percentage: 94 },
      { role: '火花塞', percentage: 88 },
      { role: '肯定者', percentage: 87 },
    ],
    '挑战者': [
      { role: '探索者', percentage: 90 },
      { role: '协调者', percentage: 88 },
      { role: '氛围组', percentage: 82 },
    ],
    '连接者': [
      { role: '故事家', percentage: 94 },
      { role: '探索者', percentage: 86 },
      { role: '肯定者', percentage: 89 },
    ],
    '协调者': [
      { role: '火花塞', percentage: 85 },
      { role: '挑战者', percentage: 88 },
      { role: '连接者', percentage: 84 },
    ],
    '氛围组': [
      { role: '肯定者', percentage: 91 },
      { role: '故事家', percentage: 87 },
      { role: '挑战者', percentage: 82 },
    ],
    '肯定者': [
      { role: '氛围组', percentage: 91 },
      { role: '连接者', percentage: 89 },
      { role: '故事家', percentage: 87 },
    ],
  };

  const myChemistry = chemistryMap[result.primaryRole] || [];
  const myPercentage = stats?.[result.primaryRole] || 0;
  const gradient = archetypeGradients[result.primaryRole] || 'from-purple-500 to-pink-500';
  const secondaryGradient = result.secondaryRole ? archetypeGradients[result.secondaryRole] || 'from-blue-500 to-purple-500' : '';
  const primaryAvatar = archetypeAvatars[result.primaryRole];
  const secondaryAvatar = result.secondaryRole ? archetypeAvatars[result.secondaryRole] : undefined;
  const primaryRoleConfig = archetypeConfig[result.primaryRole];
  const nickname = primaryRoleConfig?.nickname || '';
  const tagline = primaryRoleConfig?.tagline || '';
  const epicDescription = primaryRoleConfig?.epicDescription || '';
  const styleQuote = primaryRoleConfig?.styleQuote || '';
  const coreContributions = primaryRoleConfig?.coreContributions || '';

  const handleShare = async () => {
    const shareData = {
      title: `我的社交角色是${result.primaryRole}！`,
      text: `刚完成了JoyJoin性格测评，发现我是${result.primaryRole}！快来测测你的社交特质吧~ ✨`,
      url: window.location.origin + '/personality-test',
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      alert('已复制到剪贴板！');
    }
  };

  // Countdown Reveal Animation - Single continuous overlay without flickering
  const CountdownReveal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-background z-50 flex items-center justify-center"
    >
      <div className="text-center flex flex-col items-center justify-center min-h-[60vh]">
        {/* Phase 1: Countdown Numbers */}
        <AnimatePresence mode="wait">
          {animationPhase === 'countdown' && countdown > 0 && (
            <motion.div
              key={`countdown-${countdown}`}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ 
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="text-[120px] md:text-[180px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent leading-none"
            >
              {countdown}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phase 2: Reveal Animation - Larger avatar with dramatic entrance */}
        <AnimatePresence>
          {animationPhase === 'reveal' && (
            <motion.div
              key="reveal-content"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ 
                duration: 0.6, 
                ease: [0.22, 1, 0.36, 1],
                type: "spring",
                stiffness: 200,
                damping: 20
              }}
              className="flex flex-col items-center space-y-6"
            >
              {/* Larger avatar with glow effect */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="relative"
              >
                {/* Glow ring */}
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-full blur-xl opacity-40 scale-110`} />
                
                {/* Avatar container */}
                <div className={`relative w-40 h-40 md:w-52 md:h-52 rounded-full bg-gradient-to-br ${gradient} p-1 shadow-2xl`}>
                  {primaryAvatar ? (
                    <img
                      src={primaryAvatar}
                      alt={result.primaryRole}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                      <Sparkles className="w-20 h-20 text-primary" />
                    </div>
                  )}
                </div>
                
                {/* Particle explosion effect */}
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: 0, 
                      y: 0, 
                      scale: 1,
                      opacity: 0.9 
                    }}
                    animate={{
                      x: Math.cos((i * 360 / 12) * Math.PI / 180) * 140,
                      y: Math.sin((i * 360 / 12) * Math.PI / 180) * 140,
                      scale: 0,
                      opacity: 0
                    }}
                    transition={{
                      duration: 0.8,
                      ease: "easeOut",
                      delay: i * 0.03
                    }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                  />
                ))}
              </motion.div>
              
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
              >
                {result.primaryRole}
              </motion.h2>
              
              {nickname && (
                <motion.p
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="text-xl md:text-2xl font-medium text-primary"
                >
                  {nickname}
                </motion.p>
              )}
              
              <motion.p
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="text-base md:text-lg text-muted-foreground italic"
              >
                {tagline || result.roleSubtype}
              </motion.p>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-sm text-muted-foreground/70 mt-4"
              >
                你的独特社交DNA已解锁
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading hint during countdown */}
        {animationPhase === 'countdown' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-muted-foreground mt-8"
          >
            即将揭晓你的社交角色...
          </motion.p>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Countdown Animation */}
      <AnimatePresence>
        {showOverlay && result && <CountdownReveal />}
      </AnimatePresence>
      {/* Compact Hero Section - Mobile Optimized */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative min-h-[70vh] md:min-h-screen flex flex-col items-center justify-center px-4 py-6 md:p-6 overflow-hidden"
      >
        {/* Gradient Background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
        
        {/* Content */}
        <div className="relative z-10 text-center space-y-4 md:space-y-8 max-w-2xl mx-auto">
          {/* Avatar/Emoji - Enlarged for impact */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex justify-center"
          >
            <div className={`w-44 h-44 md:w-56 md:h-56 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl p-1`}>
              {primaryAvatar ? (
                <img
                  src={primaryAvatar}
                  alt={result.primaryRole}
                  className="w-full h-full rounded-full object-cover"
                  data-testid="text-role-avatar"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <Sparkles className="w-16 h-16 text-primary" data-testid="text-role-avatar" />
                </div>
              )}
            </div>
          </motion.div>

          {/* Role Name and Description */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-3 md:space-y-4 text-center"
          >
            <div className="space-y-2 md:space-y-3">
              <h1 className="text-4xl md:text-5xl font-bold text-center" data-testid="text-primary-role">
                {result.primaryRole}
              </h1>
              {nickname && (
                <p className="text-xl md:text-2xl font-medium text-primary text-center" data-testid="text-nickname">
                  {nickname}
                </p>
              )}
              {tagline && (
                <p className="text-base md:text-lg text-muted-foreground text-center italic" data-testid="text-tagline">
                  {tagline}
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scrollable Content Section */}
      <div className="max-w-2xl mx-auto p-4 pb-8 space-y-4">
        {/* Role Details Card - Epic Description & Style Quote */}
        {(epicDescription || styleQuote || coreContributions) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  角色深度解读
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Epic Description */}
                {epicDescription && (
                  <div className="space-y-2">
                    <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-epic-description">
                      {epicDescription}
                    </p>
                  </div>
                )}

                {/* Style Quote */}
                {styleQuote && (
                  <div className={`relative bg-gradient-to-br ${gradient} bg-opacity-10 rounded-lg p-4 border-l-4 border-primary/50`}>
                    <Quote className="w-6 h-6 text-primary/40 absolute top-2 left-2" />
                    <p className="text-sm font-medium italic text-foreground pl-8" data-testid="text-style-quote">
                      {styleQuote}
                    </p>
                  </div>
                )}

                {/* Core Contributions */}
                {coreContributions && (
                  <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3">
                    <Target className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">核心贡献</p>
                      <p className="text-sm font-medium text-foreground" data-testid="text-core-contributions">
                        {coreContributions}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Radar Chart Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                六维社交特质
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4">
                <PersonalityRadarChart
                  affinityScore={result.affinityScore}
                  opennessScore={result.opennessScore}
                  conscientiousnessScore={result.conscientiousnessScore}
                  emotionalStabilityScore={result.emotionalStabilityScore}
                  extraversionScore={result.extraversionScore}
                  positivityScore={result.positivityScore}
                />
              </div>

              {/* Strengths */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>你的优势</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-strengths">
                  {result.strengths}
                </p>
              </div>

              {/* Challenges */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span>可能的挑战</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-challenges">
                  {result.challenges}
                </p>
              </div>

              {/* Ideal Friend Types - Enhanced with larger avatars and descriptions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="w-4 h-4 text-primary" />
                  <span>理想朋友类型</span>
                </div>
                <div className="space-y-3">
                  {result.idealFriendTypes?.map((type: string) => {
                    const avatar = archetypeAvatars[type];
                    const compatDesc = getCompatibilityDescription(result.primaryRole, type);
                    return (
                      <div
                        key={type}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        data-testid={`card-ideal-friend-${type}`}
                      >
                        {/* Larger avatar */}
                        <div className="flex-shrink-0">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={type}
                              className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {/* Name and description */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{type}</span>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {compatDesc.highlight}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {compatDesc.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Social Comparison Card */}
        {stats && myPercentage > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-primary" />
                  你在人群中的位置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center py-4">
                  <div className="text-4xl font-bold text-primary mb-2">
                    {myPercentage}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    在港深使用JoyJoin的用户中，<span className="font-semibold text-foreground">{myPercentage}%</span> 的人也是<span className="font-semibold text-foreground">{result.primaryRole}</span>
                  </p>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    社群分布概览
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(stats)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([role, percentage]) => {
                        const avatar = archetypeAvatars[role];
                        return (
                          <div key={role} className="text-center p-2 rounded-lg bg-muted/30">
                            <div className="mb-1 flex justify-center">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={role}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-lg">👥</span>
                              )}
                            </div>
                            <div className="text-xs font-semibold">{percentage}%</div>
                            <div className="text-[10px] text-muted-foreground truncate">{role}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Chemistry/Matching Prediction Card */}
        {myChemistry.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Heart className="w-5 h-5 text-red-500" />
                  活动匹配预测
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  作为<span className="font-semibold text-foreground">{result.primaryRole}</span>，你在活动中与这些角色最有化学反应：
                </p>
                <div className="space-y-3">
                  {myChemistry.map((match, index) => (
                    <motion.div
                      key={match.role}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                        {archetypeAvatars[match.role] ? (
                          <img
                            src={archetypeAvatars[match.role]}
                            alt={match.role}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">👥</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{match.role}</div>
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${match.percentage}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, delay: index * 0.1 }}
                            className="bg-primary h-2 rounded-full"
                          />
                        </div>
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {match.percentage}%
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground text-center">
                    💡 我们的AI算法会优先为你匹配这些化学反应高的角色，让每次聚会都能擦出火花！
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">接下来做什么？</p>
                  <p className="text-sm text-muted-foreground">
                    你的角色信息将帮助我们为你匹配更合适的聚会和朋友。现在可以继续完善你的个人资料，或者直接开始探索活动！
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <div className="flex gap-3">
            <Button
              data-testid="button-share"
              variant="outline"
              className="flex-1"
              onClick={handleShare}
            >
              <Share2 className="w-4 h-4 mr-2" />
              分享结果
            </Button>
            <Button
              data-testid="button-continue"
              className="flex-1"
              onClick={async () => {
                await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
                setLocation('/');
              }}
            >
              开始探索活动
            </Button>
          </div>
          <Button
            data-testid="button-retake-test"
            variant="outline"
            className="w-full"
            onClick={() => setLocation('/personality-test')}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            重新测试
          </Button>
        </div>
      </div>
    </div>
  );
}
