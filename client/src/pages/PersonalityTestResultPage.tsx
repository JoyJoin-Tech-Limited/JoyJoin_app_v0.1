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
import { useState, useEffect } from 'react';

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const [showCountdown, setShowCountdown] = useState(true);
  const [countdown, setCountdown] = useState(3);

  const { data: result, isLoading } = useQuery<RoleResult>({
    queryKey: ['/api/personality-test/results'],
  });

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality-test/stats'],
  });

  const { data: roleDistribution } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality/role-distribution'],
  });

  // Countdown timer effect
  useEffect(() => {
    if (!result || !showCountdown) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setShowCountdown(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [countdown, result, showCountdown]);

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

  // Countdown Reveal Animation
  const CountdownReveal = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background z-50 flex items-center justify-center"
    >
      <div className="text-center space-y-8">
        <AnimatePresence mode="wait">
          {countdown > 0 ? (
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="text-9xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
            >
              {countdown}
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              className="space-y-6"
            >
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 0.6,
                  ease: "easeInOut"
                }}
                className="flex justify-center"
              >
                {primaryAvatar ? (
                  <img
                    src={primaryAvatar}
                    alt={result.primaryRole}
                    className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover shadow-lg"
                  />
                ) : (
                  <span className="text-9xl">🌟</span>
                )}
              </motion.div>
              
              {/* Particle explosion effect */}
              <div className="relative">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: 0, 
                      y: 0, 
                      scale: 1,
                      opacity: 1 
                    }}
                    animate={{
                      x: Math.cos((i * 360 / 20) * Math.PI / 180) * 150,
                      y: Math.sin((i * 360 / 20) * Math.PI / 180) * 150,
                      scale: 0,
                      opacity: 0
                    }}
                    transition={{
                      duration: 0.8,
                      ease: "easeOut"
                    }}
                    className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                    style={{
                      transformOrigin: 'center'
                    }}
                  />
                ))}
              </div>
              
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className={`text-4xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
              >
                {result.primaryRole}
              </motion.h2>
              
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg text-muted-foreground"
              >
                {result.roleSubtype}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-muted-foreground"
        >
          {countdown > 0 ? '即将揭晓你的社交角色...' : '✨ 你的独特社交DNA已解锁！'}
        </motion.p>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Countdown Animation */}
      <AnimatePresence>
        {showCountdown && result && <CountdownReveal />}
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
          {/* Avatar/Emoji - Responsive Size */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex justify-center"
          >
            <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl`}>
              {primaryAvatar ? (
                <img
                  src={primaryAvatar}
                  alt={result.primaryRole}
                  className="w-24 h-24 md:w-40 md:h-40 rounded-full object-cover"
                  data-testid="text-role-avatar"
                />
              ) : (
                <span className="text-6xl md:text-9xl" data-testid="text-role-avatar">🌟</span>
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

              {/* Ideal Friend Types */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="w-4 h-4 text-primary" />
                  <span>理想朋友类型</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.idealFriendTypes?.map((type: string) => {
                    const avatar = archetypeAvatars[type];
                    return (
                      <Badge
                        key={type}
                        variant="outline"
                        data-testid={`badge-ideal-friend-${type}`}
                      >
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={type}
                            className="w-4 h-4 rounded-full mr-1 inline-block"
                          />
                        ) : (
                          <span className="mr-1">👥</span>
                        )}
                        {type}
                      </Badge>
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
