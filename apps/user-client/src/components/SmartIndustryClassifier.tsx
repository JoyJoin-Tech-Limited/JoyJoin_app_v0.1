/**
 * SmartIndustryClassifier - AI-powered三层行业智能识别组件
 * 
 * 功能：
 * - 用户输入职业描述（自由文本）
 * - 调用混合智能分类引擎（Seed → Ontology → AI）
 * - 展示三层分类结果（大类 > 细分 > 赛道）
 * - 显示置信度徽章
 * - 支持"准确"/"重新识别"操作
 */

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, CheckCircle2, RotateCcw, Briefcase, Building2, Stethoscope, Palette, Package, GraduationCap, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CELEBRATION_COLORS } from "@/components/slot-machine/particleUtils";

interface ClassificationResult {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  confidence: number;
  reasoning?: string;
  source: "seed" | "ontology" | "ai" | "fallback";
  processingTimeMs: number;
  normalizedInput: string; // NEW
}

interface SmartIndustryClassifierProps {
  onClassified: (result: ClassificationResult & { rawInput: string; normalizedInput: string }) => void;
  onManualSelect?: () => void;
  placeholder?: string;
  mascotPrompt?: string;
  debounceMs?: number;
  className?: string;
}

// Quick suggestion job examples with gradients
const JOB_SUGGESTIONS = [
  { text: "互联网产品经理", emoji: "💼", gradient: "from-blue-400 to-cyan-400" },
  { text: "医疗AI工程师", emoji: "🏥", gradient: "from-green-400 to-emerald-400" },
  { text: "银行柜员", emoji: "🏦", gradient: "from-purple-400 to-pink-400" },
  { text: "独立设计师", emoji: "🎨", gradient: "from-orange-400 to-red-400" },
  { text: "快递员", emoji: "📦", gradient: "from-yellow-400 to-amber-400" },
  { text: "教育培训", emoji: "📚", gradient: "from-indigo-400 to-violet-400" },
];

const MAX_JOB_DESCRIPTION_LENGTH = 50;

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  speed: number;
}

export function SmartIndustryClassifier({
  onClassified,
  onManualSelect,
  placeholder = "例：我做医疗AI / 银行柜员 / 快递员",
  mascotPrompt = "🎯 告诉小悦你的职业，让AI帮你精准匹配",
  debounceMs = 800,
  className,
}: SmartIndustryClassifierProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [celebrationTimeoutId, setCelebrationTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const { mutate: classifyIndustry, isPending } = useMutation({
    mutationFn: async (description: string) => {
      const res = await apiRequest("POST", "/api/inference/classify-industry", { description });
      return (await res.json()) as ClassificationResult;
    },
    onError: (error: Error) => {
      console.error("Classification error:", error);
      toast({
        description: "识别失败，请稍后再试或选择手动选择",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setIsConfirmed(false);
    },
  });

  useEffect(() => {
    if (!text?.trim()) {
      setResult(null);
      setIsConfirmed(false);
      return;
    }
    const handle = setTimeout(() => classifyIndustry(text.trim()), debounceMs);
    return () => clearTimeout(handle);
  }, [text, debounceMs, classifyIndustry]);

  const handleConfirm = () => {
    if (!result) return;
    setIsConfirmed(true);
    
    // Generate confetti
    const newParticles: Particle[] = Array.from({ length: 15 }, (_, i) => ({
      id: i,
      x: 50,
      y: 50,
      color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
      size: Math.random() * 8 + 4,
      angle: (Math.PI * 2 * i) / 15,
      speed: Math.random() * 3 + 2,
    }));
    setParticles(newParticles);
    setShowConfetti(true);
    
    const timeoutId = setTimeout(() => {
      setShowConfetti(false);
      onClassified({
        ...result,
        rawInput: text,
        normalizedInput: result.normalizedInput, // NEW - AI-cleaned version
      });
    }, 1000);
    
    setCelebrationTimeoutId(timeoutId);
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimeoutId) {
        clearTimeout(celebrationTimeoutId);
      }
    };
  }, [celebrationTimeoutId]);

  const handleRetry = () => {
    setResult(null);
    setIsConfirmed(false);
    setText("");
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (confidence >= 0.7) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  };
  
  const getConfidenceBadgeText = (confidence: number) => {
    if (confidence >= 0.9) return "🎯 非常确定";
    if (confidence >= 0.7) return "👍 比较确定";
    return "🤔 可能是这个";
  };

  const getSourceLabel = (source: string) => {
    const labels = {
      seed: "精准匹配",
      ontology: "智能推理",
      ai: "AI分析",
      fallback: "默认",
    };
    return labels[source as keyof typeof labels] || source;
  };

  // 构建完整路径显示
  const getFullPath = () => {
    if (!result) return "";
    const parts = [
      result.category.label,
      result.segment.label,
      result.niche?.label,
    ].filter(Boolean);
    return parts.join(" > ");
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mascot提示 */}
      <div className="text-base text-muted-foreground font-medium">
        {mascotPrompt}
      </div>

      {/* 输入框 with animated border */}
      <div className="relative">
        <div className={cn(
          "rounded-2xl transition-all",
          isPending && "ring-2 ring-primary/50 animate-pulse"
        )}>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            inputMode="text"
            className="h-14 text-lg rounded-2xl pr-12"
            disabled={isConfirmed}
            maxLength={MAX_JOB_DESCRIPTION_LENGTH}
            data-testid="input-industry-smart"
          />
        </div>
        {isPending && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
            <motion.div
              className="w-2 h-2 bg-primary rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="w-2 h-2 bg-primary rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="w-2 h-2 bg-primary rounded-full"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
            />
          </div>
        )}
      </div>
      
      {/* Character counter */}
      {text && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>职业描述</span>
          <span>{text.length}/{MAX_JOB_DESCRIPTION_LENGTH}</span>
        </div>
      )}

      {/* Quick suggestions when empty */}
      {!text && !result && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">快速选择示例：</p>
          <div className="grid grid-cols-2 gap-2">
            {JOB_SUGGESTIONS.map((job, index) => (
              <motion.button
                key={job.text}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setText(job.text)}
                className={cn(
                  "relative p-3 rounded-xl border transition-all overflow-hidden",
                  "hover:shadow-md hover:scale-105 active:scale-95"
                )}
                whileTap={{ scale: 0.95 }}
              >
                {/* Gradient background */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-20",
                  job.gradient
                )} />
                
                {/* Content */}
                <div className="relative flex items-center gap-2 justify-center">
                  <span className="text-xl">{job.emoji}</span>
                  <span className="text-sm font-medium">{job.text}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* 分类结果展示 - Instagram Story style */}
      {result && !isConfirmed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative space-y-3 p-5 rounded-2xl overflow-hidden"
          style={{
            border: "2px solid transparent",
            backgroundImage: "linear-gradient(white, white), linear-gradient(to right, #a855f7, #ec4899, #f97316)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
          }}
        >
          {/* 结果标题 */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <span className="font-semibold text-base">识别结果</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <Badge variant="outline" className={cn("text-xs", getConfidenceColor(result.confidence))}>
                {getConfidenceBadgeText(result.confidence)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getSourceLabel(result.source)}
              </Badge>
            </div>
          </div>

          {/* 三层分类路径 - Three-tier display with icons */}
          <div className="space-y-3">
            {/* Category */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center shrink-0">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">行业大类</div>
                <div className="text-lg font-bold">{result.category.label}</div>
              </div>
            </div>
            
            {/* Segment */}
            <div className="flex items-center gap-3 ml-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">细分领域</div>
                <div className="text-base font-semibold">{result.segment.label}</div>
              </div>
            </div>
            
            {/* Niche (if available) */}
            {result.niche && (
              <div className="flex items-center gap-3 ml-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">具体赛道</div>
                  <div className="text-sm font-medium">{result.niche.label}</div>
                </div>
              </div>
            )}
          </div>

          {/* AI推理说明 */}
          {result.reasoning && (
            <div className="text-sm text-muted-foreground italic bg-muted/50 p-3 rounded-lg">
              💡 {result.reasoning}
            </div>
          )}
          
          {/* Processing time as fun fact */}
          <div className="text-xs text-muted-foreground text-center">
            ⚡ 仅用 {result.processingTimeMs}ms 完成分析
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleConfirm}
              size="lg"
              className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 shadow-xl"
              data-testid="btn-confirm-classification"
            >
              <CheckCircle2 className="h-4 w-4" />
              就是这个！
            </Button>
            <Button
              onClick={handleRetry}
              size="lg"
              variant="outline"
              className="gap-2"
              data-testid="btn-retry-classification"
            >
              <RotateCcw className="h-4 w-4" />
              重新试试
            </Button>
          </div>

          {/* 低置信度提示 */}
          {result.confidence < 0.7 && onManualSelect && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-center text-yellow-800 dark:text-yellow-200">
                识别不太确定？
                <button
                  onClick={onManualSelect}
                  className="text-primary hover:underline ml-1 font-medium"
                >
                  试试手动选择
                </button>
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* 已确认状态 with celebration */}
      {result && isConfirmed && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative p-5 border-2 border-green-500/30 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 overflow-hidden"
        >
          {/* Confetti particles */}
          <AnimatePresence>
            {showConfetti && particles.map((particle) => (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  width: particle.size,
                  height: particle.size,
                  backgroundColor: particle.color,
                  left: "50%",
                  top: "50%",
                }}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{
                  x: Math.cos(particle.angle) * 100 * particle.speed,
                  y: Math.sin(particle.angle) * 100 * particle.speed,
                  opacity: 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            ))}
          </AnimatePresence>
          
          <div className="relative flex flex-col items-center gap-3 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-white" />
            </motion.div>
            
            <div>
              <p className="text-lg font-bold text-green-700 dark:text-green-300 mb-1">
                🎉 完美！
              </p>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                {getFullPath()}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 处理时间（调试信息） */}
      {result && process.env.NODE_ENV === "development" && (
        <div className="text-xs text-muted-foreground text-center">
          处理时间: {result.processingTimeMs}ms
        </div>
      )}
    </div>
  );
}
