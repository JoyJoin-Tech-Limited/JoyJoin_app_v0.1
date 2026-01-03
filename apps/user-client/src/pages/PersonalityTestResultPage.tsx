import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PersonalityRadarChart from '@/components/PersonalityRadarChart';
import { XiaoyueInsightCard } from '@/components/XiaoyueInsightCard';
import { Sparkles, Users, TrendingUp, Heart, Share2, Quote, Eye, Crown, ChevronDown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { archetypeGradients, archetypeAvatars } from '@/lib/archetypeAvatars';
import { archetypeConfig } from '@/lib/archetypes';
import { getArchetypeInsight } from '@/lib/archetypeInsights';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import xiaoyueAvatar from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

const traitLabels: Record<string, string> = {
  A: '亲和力',
  O: '开放性',
  C: '责任心',
  E: '情绪稳定',
  X: '外向性',
  P: '正能量',
};

interface UnifiedAssessmentResult {
  algorithmVersion: string;
  primaryRole: string;
  primaryArchetype: string;
  secondaryRole?: string;
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
  totalQuestions: number;
  chemistryList: Array<{ role: string; percentage: number; reason?: string }>;
  archetypeTraitProfile: Record<string, number> | null;
  matchDetails: any;
  isDecisive: boolean;
  completedAt: string;
}

function MatchExplanationSection({ result }: { result: UnifiedAssessmentResult }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const generateMatchExplanation = () => {
    const archetype = result.primaryRole;
    const config = archetypeConfig[archetype];
    
    if (result.isDecisive) {
      return `根据你回答的${result.totalQuestions}道题目，你的特质轮廓与「${archetype}」高度匹配！你在社交中展现出的特点，与这个原型的核心特质非常契合。`;
    }
    
    return `通过${result.totalQuestions}道测试题的分析，我们发现你具有「${archetype}」的核心特质。虽然你可能也有其他原型的一些影子，但整体上最接近这个类型。`;
  };

  const getTopTraits = () => {
    const traits = [
      { key: 'A', label: traitLabels.A, score: result.affinityScore },
      { key: 'O', label: traitLabels.O, score: result.opennessScore },
      { key: 'C', label: traitLabels.C, score: result.conscientiousnessScore },
      { key: 'E', label: traitLabels.E, score: result.emotionalStabilityScore },
      { key: 'X', label: traitLabels.X, score: result.extraversionScore },
      { key: 'P', label: traitLabels.P, score: result.positivityScore },
    ];
    
    return traits.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  const topTraits = getTopTraits();

  return (
    <Card data-testid="match-explanation-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          匹配解读
          {result.isDecisive && (
            <Badge variant="outline" className="ml-2 text-xs">
              高置信
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <XiaoyueInsightCard
          content={generateMatchExplanation()}
          pose="thinking"
          tone={result.isDecisive ? "confident" : "playful"}
          badgeText="小悦分析"
          avatarSize="sm"
          animate={false}
        />
        
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between text-muted-foreground"
              data-testid="button-trait-breakdown-toggle"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                查看关键特质
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">你的三大核心特质:</p>
              {topTraits.map((trait, index) => (
                <div 
                  key={trait.key}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                  data-testid={`top-trait-${index}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs w-6 h-6 p-0 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <span className="font-medium text-sm">{trait.label}</span>
                  </div>
                  <span className="text-primary font-bold">{Math.round(trait.score)}%</span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function PersonalityTestResultPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showReveal, setShowReveal] = useState(true);

  const { data: result, isLoading } = useQuery<UnifiedAssessmentResult>({
    queryKey: ['/api/assessment/result'],
  });

  const { data: stats } = useQuery<Record<string, number>>({
    queryKey: ['/api/personality-test/stats'],
  });

  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setShowReveal(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">正在加载您的结果...</div>
        </div>
      </div>
    );
  }

  if (!result || !result.primaryRole) {
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

  const gradient = archetypeGradients[result.primaryRole] || 'from-purple-500 to-pink-500';
  const primaryAvatar = archetypeAvatars[result.primaryRole];
  const primaryRoleConfig = archetypeConfig[result.primaryRole];
  const nickname = primaryRoleConfig?.nickname || '';
  const tagline = primaryRoleConfig?.tagline || '';
  const epicDescription = primaryRoleConfig?.epicDescription || '';
  const styleQuote = primaryRoleConfig?.styleQuote || '';

  const handleShare = async () => {
    const shareData = {
      title: `我的社交角色是${result.primaryRole}！`,
      text: `刚完成了JoyJoin性格测评，发现我是${result.primaryRole}！快来测测你的社交特质吧~`,
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

  const RevealAnimation = () => (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: showReveal ? 1 : 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed inset-0 bg-background z-50 flex items-center justify-center ${!showReveal ? 'pointer-events-none' : ''}`}
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], type: "spring", stiffness: 200, damping: 20 }}
        className="flex flex-col items-center space-y-6"
      >
        <div className="relative">
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-full blur-xl opacity-40 scale-110`} />
          <div className={`relative w-40 h-40 md:w-52 md:h-52 rounded-full bg-gradient-to-br ${gradient} p-1 shadow-2xl`}>
            {primaryAvatar ? (
              <img src={primaryAvatar} alt={result.primaryRole} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                <Sparkles className="w-20 h-20 text-primary" />
              </div>
            )}
          </div>
        </div>
        <motion.h2 className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {result.primaryRole}
        </motion.h2>
        {nickname && <p className="text-xl md:text-2xl font-medium text-primary">{nickname}</p>}
        <p className="text-base md:text-lg text-muted-foreground italic">{tagline}</p>
      </motion.div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {showReveal && <RevealAnimation />}
      </AnimatePresence>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative min-h-[70vh] flex flex-col items-center justify-center px-4 py-6"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
        <div className="relative z-10 text-center space-y-4 max-w-2xl mx-auto">
          <div className="flex justify-center">
            <div className={`w-44 h-44 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-2xl p-1`}>
              {primaryAvatar ? (
                <img src={primaryAvatar} alt={result.primaryRole} className="w-full h-full rounded-full object-cover" />
              ) : (
                <Sparkles className="w-16 h-16 text-primary" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold" data-testid="text-primary-archetype">{result.primaryRole}</h1>
            {nickname && <p className="text-xl font-medium text-primary">{nickname}</p>}
            {tagline && <p className="text-base text-muted-foreground italic">{tagline}</p>}
          </div>
          {result.algorithmVersion === 'v2' && result.isDecisive && (
            <Badge variant="outline" className="mt-2">
              <Crown className="w-3 h-3 mr-1" />
              高置信匹配
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">
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
          const insight = getArchetypeInsight(result.primaryRole);
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
                archetype={result.primaryRole}
                affinityScore={result.affinityScore}
                opennessScore={result.opennessScore}
                conscientiousnessScore={result.conscientiousnessScore}
                emotionalStabilityScore={result.emotionalStabilityScore}
                extraversionScore={result.extraversionScore}
                positivityScore={result.positivityScore}
              />
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { key: 'A', label: '亲和力', score: result.affinityScore },
                  { key: 'O', label: '开放性', score: result.opennessScore },
                  { key: 'C', label: '责任心', score: result.conscientiousnessScore },
                  { key: 'E', label: '情绪稳定', score: result.emotionalStabilityScore },
                  { key: 'X', label: '外向性', score: result.extraversionScore },
                  { key: 'P', label: '正能量', score: result.positivityScore },
                ].map(({ key, label, score }) => (
                  <div key={key} className="flex flex-col p-2 bg-muted/50 rounded-lg">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-lg font-bold text-primary">{Math.round(score)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {result.algorithmVersion === 'v2' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <MatchExplanationSection result={result} />
          </motion.div>
        )}

        {result.chemistryList && result.chemistryList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  最佳搭档
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.chemistryList.map((chemistry, index) => (
                  <div
                    key={chemistry.role}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    data-testid={`chemistry-item-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${archetypeGradients[chemistry.role] || 'from-gray-400 to-gray-500'} flex items-center justify-center`}>
                        {archetypeAvatars[chemistry.role] ? (
                          <img src={archetypeAvatars[chemistry.role]} alt={chemistry.role} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium">{chemistry.role}</span>
                        {chemistry.reason && (
                          <p className="text-xs text-muted-foreground">{chemistry.reason}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {chemistry.percentage}%
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="flex flex-col gap-3 py-6">
          <Button className="w-full h-12 rounded-xl" onClick={handleContinue} data-testid="button-continue">
            继续完善资料
          </Button>
          <Button variant="outline" className="w-full" onClick={handleShare} data-testid="button-share">
            <Share2 className="w-5 h-5 mr-2" />分享原型
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setLocation('/personality-test')} data-testid="button-retest">
            重新测试
          </Button>
        </div>
      </div>
    </div>
  );
}
