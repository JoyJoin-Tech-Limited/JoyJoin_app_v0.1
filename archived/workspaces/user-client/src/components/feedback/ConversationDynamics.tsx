import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { MessageSquare, Scale, Smile } from "lucide-react";
import { useState } from "react";

interface ConversationDynamicsProps {
  initialData?: {
    balance?: number;
    comfort?: number;
    notes?: string;
  };
  onNext: (data: { balance: number; comfort: number; notes: string }) => void;
  onSkip: () => void;
}

const comfortEmojis = [
  { value: 0, emoji: "😞", label: "很不舒适" },
  { value: 25, emoji: "😐", label: "有点尴尬" },
  { value: 50, emoji: "🙂", label: "还可以" },
  { value: 75, emoji: "😊", label: "很舒适" },
  { value: 100, emoji: "😄", label: "非常愉快" },
];

export default function ConversationDynamics({ 
  initialData = {}, 
  onNext, 
  onSkip 
}: ConversationDynamicsProps) {
  const [balance, setBalance] = useState<number>(initialData.balance ?? 50);
  const [comfort, setComfort] = useState<number>(initialData.comfort ?? 50);
  const [notes, setNotes] = useState(initialData.notes ?? "");

  const handleSubmit = () => {
    onNext({ balance, comfort, notes });
  };

  // Find closest emoji for comfort level
  const closestComfortEmoji = comfortEmojis.reduce((prev, curr) => {
    return Math.abs(curr.value - comfort) < Math.abs(prev.value - comfort) ? curr : prev;
  });

  // Get balance description
  const getBalanceDescription = () => {
    if (balance < 30) return "对方主导了大部分话题";
    if (balance > 70) return "你主导了大部分话题";
    return "双方互动比较均衡";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">回忆你们的对话流程</h2>
            <p className="text-sm text-muted-foreground">帮助我们理解交流动态</p>
          </div>
        </div>
      </motion.div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">可选问题 2/3</span>
        <Badge variant="outline">简单滑动即可</Badge>
      </div>

      {/* Conversation Balance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold">主导话题的大致比例</h3>
                <p className="text-sm text-muted-foreground mt-1">{getBalanceDescription()}</p>
              </div>
            </div>

            {/* Balance Slider */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">对方 TA</span>
                <span className="font-medium text-primary">{balance}%</span>
                <span className="text-muted-foreground">我</span>
              </div>
              
              <Slider
                value={[balance]}
                onValueChange={(values) => setBalance(values[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-balance"
              />

              {/* Visual Representation */}
              <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-300"
                  style={{ width: `${100 - balance}%` }}
                />
                <div 
                  className="bg-gradient-to-r from-primary/80 to-primary transition-all duration-300"
                  style={{ width: `${balance}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Conversation Comfort */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Smile className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold">整体交流舒适度</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {closestComfortEmoji.label}
                </p>
              </div>
              <div className="text-4xl">{closestComfortEmoji.emoji}</div>
            </div>

            {/* Comfort Slider */}
            <div className="space-y-4">
              <Slider
                value={[comfort]}
                onValueChange={(values) => setComfort(values[0])}
                min={0}
                max={100}
                step={5}
                className="w-full"
                data-testid="slider-comfort"
              />

              {/* Emoji Scale */}
              <div className="flex justify-between">
                {comfortEmojis.map(item => (
                  <button
                    key={item.value}
                    onClick={() => setComfort(item.value)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      Math.abs(item.value - comfort) < 15 
                        ? 'bg-primary/10' 
                        : 'hover:bg-muted'
                    }`}
                    data-testid={`button-comfort-${item.value}`}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Optional Notes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">💭 想补充说明的（可选）</h3>
            <Textarea
              placeholder="例如：前半段比较安静，后半段聊开了..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20"
              data-testid="textarea-dynamics-notes"
            />
            <p className="text-xs text-muted-foreground">
              可选填写 · 帮助我们理解对话演变过程
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Value Impact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-lg bg-primary/5 border border-primary/10"
      >
        <p className="text-sm">
          <span className="font-medium text-primary">📊 你的共建贡献</span>
          <span className="text-muted-foreground ml-2">
            已完成 2/3 个可选模块 · 你的每个回答都在帮助校准系统
          </span>
        </p>
      </motion.div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={onSkip}
          className="flex-1"
          data-testid="button-skip"
        >
          跳过这一步
        </Button>
        <Button
          variant="default"
          size="lg"
          onClick={handleSubmit}
          className="flex-1"
          data-testid="button-next"
        >
          下一步
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-center text-xs text-muted-foreground">
        你的分享将继续这个改进循环
      </p>
    </div>
  );
}
