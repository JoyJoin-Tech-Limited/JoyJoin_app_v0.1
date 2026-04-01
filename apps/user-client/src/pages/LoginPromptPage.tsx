/**
 * LoginPromptPage - Prompt users to login after completing personality assessment
 * 
 * Shows after FinalProfileReviewPage and displays:
 * - User's archetype preview from assessment results
 * - Primary CTA: Login to save their profile
 * - Secondary action: Continue without login (limited access)
 * - XiaoyueMascot explaining why login is valuable
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, ArrowRight, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { archetypeAvatars } from "@/lib/archetypeAvatars";
import { getArchetypeGradient } from "@/lib/archetypeAdapter";
import { XiaoyueMascot } from "@/components/shared/XiaoyueMascot";

export default function LoginPromptPage() {
  const [, setLocation] = useLocation();
  const [archetype, setArchetype] = useState<string>("");

  // Fetch archetype from assessment result API
  const { data: assessmentResult } = useQuery<{ primaryArchetype?: string }>({
    queryKey: ["/api/assessment/result"],
    retry: false,
  });

  // Fetch user data to get archetype (fallback)
  const { data: userData } = useQuery<{ personalityProfile?: { primaryArchetype?: string } }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  useEffect(() => {
    if (assessmentResult?.primaryArchetype) {
      setArchetype(assessmentResult.primaryArchetype);
    } else if (userData?.personalityProfile?.primaryArchetype) {
      setArchetype(userData.personalityProfile.primaryArchetype);
    }
  }, [assessmentResult, userData]);

  const displayArchetype = archetype || "开心柯基";
  const archetypeAvatar = archetypeAvatars[displayArchetype];
  const archetypeGradient = getArchetypeGradient(displayArchetype);

  const handleLogin = () => {
    // Navigate to login page to authenticate and save the user's archetype profile
    setLocation("/login");
  };

  const handleSkip = () => {
    setLocation("/discover");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Archetype Preview Card */}
          <Card className="mb-6 overflow-hidden">
            <div className={`bg-gradient-to-br ${archetypeGradient} p-8 text-center`}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
                className="relative mx-auto w-32 h-32 mb-4"
              >
                {archetypeAvatar && (
                  <img 
                    src={archetypeAvatar} 
                    alt={displayArchetype}
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                )}
                <motion.div
                  className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg"
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                </motion.div>
              </motion.div>
              
              <h2 className="text-2xl font-bold text-white mb-2">
                你是 {displayArchetype}
              </h2>
              <p className="text-white/90 text-sm">
                你的专属社交角色已生成
              </p>
            </div>
          </Card>

          {/* Xiaoyue Mascot with message */}
          <XiaoyueMascot 
            message="登录保存你的专属角色，解锁完整性格报告和智能匹配功能！" 
            horizontal
            size="md"
          />

          {/* Benefits List */}
          <div className="mb-8 space-y-3">
            <BenefitItem text="保存你的性格测评结果" />
            <BenefitItem text="获取完整的角色分析报告" />
            <BenefitItem text="参加小局活动，认识有趣的人" />
            <BenefitItem text="体验 AI 智能匹配推荐" />
          </div>

          {/* Primary CTA - Login */}
          <Button
            size="lg"
            className="w-full h-14 text-lg rounded-2xl mb-3"
            onClick={handleLogin}
          >
            <Lock className="w-5 h-5 mr-2" />
            登录保存你的专属角色
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          {/* Secondary action - Skip */}
          <Button
            variant="ghost"
            size="lg"
            className="w-full h-12 text-base"
            onClick={handleSkip}
          >
            稍后登录
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            未登录用户可以浏览活动，但无法报名参加
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 text-sm"
    >
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-3 h-3 text-white" />
      </div>
      <span className="text-foreground">{text}</span>
    </motion.div>
  );
}
