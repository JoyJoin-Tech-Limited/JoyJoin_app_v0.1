import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Clock, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface QuizIntroProps {
  onStart: (gender: "female" | "male") => void;
  onSkip?: () => void;
}

export default function QuizIntro({ onStart, onSkip }: QuizIntroProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <motion.div
      className="space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">了解你的社交风格</h2>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Badge className="bg-primary/20 text-primary border-0">
                  专属测评
                </Badge>
              </motion.div>
            </div>

          <p className="text-sm text-muted-foreground">
            AI教练将用语音引导你完成测评，深入了解你的性格特质，发现潜在的社交挑战，并找到最适合你的朋友类型。
          </p>

            <div className="grid gap-3 pt-2">
              {[
                {
                  icon: Clock,
                  title: "仅需5分钟",
                  desc: "5个语音问题，每个约30秒",
                },
                {
                  icon: Mic,
                  title: "AI教练语音引导",
                  desc: "用自然的方式表达真实的你",
                },
                {
                  icon: Brain,
                  title: "AI深度分析",
                  desc: "获得个性化的社交建议和匹配推荐",
                },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-start gap-3"
                  variants={itemVariants}
                  whileHover={{ x: 8 }}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div className="space-y-3" variants={itemVariants}>
        <p className="text-sm font-medium text-center">选择你的AI教练</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              gender: "female" as const,
              name: "小周",
              role: "你的好姐妹",
              emoji: "👩",
              gradient:
                "bg-gradient-to-br from-pink-400/20 to-rose-400/20",
            },
            {
              gender: "male" as const,
              name: "Ben",
              role: "你的好兄弟",
              emoji: "👨",
              gradient:
                "bg-gradient-to-br from-blue-400/20 to-indigo-400/20",
            },
          ].map((coach) => (
            <motion.div
              key={coach.gender}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                className="border shadow-sm cursor-pointer hover-elevate active-elevate-2 transition-all"
                onClick={() => onStart(coach.gender)}
                data-testid={`button-select-${coach.gender}-coach`}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div
                    className={`h-16 w-16 rounded-full ${coach.gradient} flex items-center justify-center mx-auto`}
                  >
                    <span className="text-2xl">{coach.emoji}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{coach.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {coach.role}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {onSkip && (
        <motion.div variants={itemVariants}>
          <Button
            variant="ghost"
            className="w-full"
            onClick={onSkip}
            data-testid="button-skip-intro"
          >
            跳过，稍后完成
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
