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
import { Sparkles, CheckCircle2, RotateCcw, Briefcase, Building2, Zap, HelpCircle, ChevronRight, AlertCircle, X } from "lucide-react";
import { SpiralWaveAnimation } from "./SpiralWaveAnimation";
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
  source: "seed" | "ontology" | "ai" | "fallback" | "fuzzy";
  processingTimeMs: number;
  normalizedInput: string;
  
  // 🆕 Candidate list
  candidates?: CandidateOption[];
}

interface CandidateOption {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  confidence: number;
  reasoning: string;
  occupationId?: string;
  occupationName?: string;
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
  const [isComposing, setIsComposing] = useState(false); // IME composition state
  const [showCandidateSelection, setShowCandidateSelection] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateOption | null>(null);

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
      setSelectedCandidate(null); // Reset selected candidate on new classification
      
      // 🆕 Show candidate selection if low confidence
      if (data.candidates && data.candidates.length > 0 && data.confidence < 0.7) {
        setShowCandidateSelection(true);
      } else {
        setShowCandidateSelection(false);
      }
    },
  });

  // IME composition event handlers
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  useEffect(() => {
    if (!text?.trim() || isComposing) {
      // Don't trigger classification during IME composition
      if (!text?.trim()) {
        setResult(null);
        setIsConfirmed(false);
        setShowCandidateSelection(false);
        setSelectedCandidate(null);
      }
      return;
    }
    const handle = setTimeout(() => classifyIndustry(text.trim()), debounceMs);
    return () => clearTimeout(handle);
  }, [text, isComposing, debounceMs, classifyIndustry]);

  const handleCandidateSelect = (candidate: CandidateOption) => {
    setSelectedCandidate(candidate);
    setShowCandidateSelection(false);
  };

  const handleNoneMatch = () => {
    setShowCandidateSelection(false);
    setSelectedCandidate(null);
  };

  const handleConfirm = () => {
    if (!result) return;
    
    // Use selected candidate if available, otherwise use main result
    const finalResult = selectedCandidate || result;
    
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
      
      // Construct complete result with all required properties
      const completeResult: ClassificationResult & { rawInput: string; normalizedInput: string } = {
        category: finalResult.category,
        segment: finalResult.segment,
        niche: finalResult.niche,
        confidence: finalResult.confidence,
        reasoning: finalResult.reasoning,
        source: 'source' in finalResult ? finalResult.source : result.source,
        processingTimeMs: 'processingTimeMs' in finalResult ? finalResult.processingTimeMs : result.processingTimeMs,
        normalizedInput: 'normalizedInput' in finalResult ? finalResult.normalizedInput : result.normalizedInput,
        rawInput: text,
        candidates: 'candidates' in finalResult ? finalResult.candidates : result.candidates,
      };
      
      onClassified(completeResult);
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
    setShowCandidateSelection(false);
    setSelectedCandidate(null);
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
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={placeholder}
            inputMode="text"
            className="h-14 text-lg rounded-2xl pr-12"
            disabled={isConfirmed}
            maxLength={MAX_JOB_DESCRIPTION_LENGTH}
            data-testid="input-industry-smart"
          />
        </div>
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-8 h-8 transform scale-[0.15] origin-center">
              <SpiralWaveAnimation />
            </div>
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

      {/* Analyzing overlay with Spiral Wave */}
      <AnimatePresence>
        {isPending && text && !result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 space-y-4"
          >
            <div className="w-32 h-32 transform scale-50 origin-center">
              <SpiralWaveAnimation />
            </div>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-muted-foreground font-medium"
            >
              小悦正在分析您的职业描述...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick suggestions when empty */}
      {!text && !result && !isPending && (
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

      {/* 🆕 Duolingo-Style Candidate Selection */}
      <AnimatePresence>
        {result && showCandidateSelection && result.candidates && result.candidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-5 p-6 border-2 border-blue-300 rounded-3xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 shadow-xl"
          >
            {/* Owl mascot header (Duolingo style) */}
            <div className="flex items-start gap-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="relative"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
                  <span className="text-3xl">🦉</span>
                </div>
                {/* Speech bubble */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="absolute -right-2 top-0 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
                >
                  <HelpCircle className="h-4 w-4 text-blue-600" />
                </motion.div>
              </motion.div>
              
              <div className="flex-1">
                <motion.h3 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl font-bold text-gray-900"
                >
                  你说的 "<span className="text-blue-600">{text}</span>" 是指...?
                </motion.h3>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-gray-600 mt-2"
                >
                  选择最准确的职业分类
                </motion.p>
              </div>
            </div>

            {/* Candidate cards (Duolingo style) */}
            <div className="space-y-3">
              {result.candidates.map((candidate, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.06 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCandidateSelect(candidate)}
                  className={cn(
                    "w-full p-5 rounded-2xl border-3 text-left transition-all relative overflow-hidden group",
                    "bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50",
                    "border-gray-200 hover:border-blue-400 hover:shadow-lg"
                  )}
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-indigo-400/0 to-purple-400/0 group-hover:from-blue-400/10 group-hover:via-indigo-400/10 group-hover:to-purple-400/10 transition-all duration-300" />
                  
                  <div className="relative flex items-start gap-4">
                    {/* Icon with bounce animation */}
                    <motion.div 
                      whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ duration: 0.5 }}
                      className="shrink-0"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                        <Briefcase className="h-7 w-7 text-white" />
                      </div>
                    </motion.div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="font-bold text-lg text-gray-900 mb-1 flex items-center gap-2 flex-wrap">
                        {candidate.occupationName || candidate.segment.label}
                        <Badge 
                          variant="secondary" 
                          className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5"
                        >
                          {candidate.category.label}
                        </Badge>
                      </div>
                      
                      {/* Breadcrumb */}
                      <div className="text-sm text-gray-500 mb-2 flex items-center gap-1 flex-wrap">
                        <span>{candidate.category.label}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{candidate.segment.label}</span>
                        {candidate.niche && (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            <span>{candidate.niche.label}</span>
                          </>
                        )}
                      </div>
                      
                      {/* Match reason */}
                      {candidate.reasoning && (
                        <div className="flex items-center gap-2 mt-2">
                          <Sparkles className="h-4 w-4 text-amber-500" />
                          <span className="text-xs text-gray-600 font-medium">
                            {candidate.reasoning}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Confidence badge */}
                    <div className="shrink-0">
                      <div className={cn(
                        "px-3 py-1.5 rounded-full font-bold text-sm shadow-sm",
                        candidate.confidence >= 0.8 
                          ? "bg-green-100 text-green-700" 
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {Math.round(candidate.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
              
              {/* "None of these" option (Duolingo style) */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + result.candidates.length * 0.06 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNoneMatch}
                className="w-full p-5 rounded-2xl border-3 border-dashed border-gray-300 text-left transition-all bg-white hover:bg-gray-50 hover:border-gray-400 flex items-center gap-4 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <X className="h-7 w-7 text-gray-500" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-700 group-hover:text-gray-900 transition-colors">
                    都不太对
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    使用小悦的智能推测
                  </div>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced AI Interpretation Display */}
      {result && !isConfirmed && !showCandidateSelection && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "space-y-4 p-5 border-2 rounded-2xl",
            selectedCandidate 
              ? "border-green-300 bg-gradient-to-br from-green-50 to-emerald-50" 
              : result.confidence < 0.5
                ? "border-orange-200 bg-gradient-to-br from-orange-50 to-yellow-50"
                : "border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50"
          )}
        >
          {/* Selected candidate banner (Duolingo style) */}
          {selectedCandidate && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-white rounded-xl border-2 border-green-300 shadow-sm"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900">
                  已选择：{selectedCandidate.occupationName}
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {selectedCandidate.category.label} → {selectedCandidate.segment.label}
                  {selectedCandidate.niche && ` → ${selectedCandidate.niche.label}`}
                </p>
              </div>
            </motion.div>
          )}
          
          {/* Low confidence warning (Duolingo style) */}
          {!selectedCandidate && result.confidence < 0.5 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl border-2 border-orange-200"
            >
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-orange-900">
                  小悦不太确定分类
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  {result.reasoning}
                </p>
                <div className="mt-3 p-3 bg-white rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-800">
                    <strong>💡 提示：</strong>确认后会保存你的原始输入 "<strong>{text}</strong>"，
                    系统将继续学习以提高准确度
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Header with badges */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <span className="font-semibold">小悦的理解</span>
            </div>
            {/* Confidence + Source badges */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <Badge variant="outline" className={cn("text-xs", getConfidenceColor(result.confidence))}>
                {getConfidenceBadgeText(result.confidence)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getSourceLabel(result.source)}
              </Badge>
            </div>
          </div>

          {/* Hierarchical Industry Display - Duolingo-style Tree */}
          <div className="space-y-0 bg-white/60 rounded-xl p-4 border border-purple-200 dark:bg-gray-900/50">
            {/* L1: Category - Root Level */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-purple-400 uppercase tracking-wide">
                  Level 1 · 行业大类
                </div>
                <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                  {result.category.label}
                </div>
              </div>
            </motion.div>

            {/* Connecting Line L1→L2 */}
            <div className="ml-6 h-4 w-0.5 bg-gradient-to-b from-purple-400 to-purple-300" />

            {/* L2: Segment - Sub Level */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 ml-4"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center shadow-md">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-purple-400/80 uppercase tracking-wide">
                  Level 2 · 细分领域
                </div>
                <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  {result.segment.label}
                </div>
              </div>
            </motion.div>

            {/* L3: Niche (if exists) */}
            {result.niche && (
              <>
                {/* Connecting Line L2→L3 */}
                <div className="ml-9 h-4 w-0.5 bg-gradient-to-b from-purple-300 to-pink-400" />

                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-3 ml-8"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center shadow">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-pink-400/80 uppercase tracking-wide">
                      Level 3 · 具体赛道
                    </div>
                    <div className="text-base font-semibold text-pink-600 dark:text-pink-400">
                      {result.niche.label}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {/* AI Reasoning */}
          {result.reasoning && (
            <div className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="shrink-0 mt-0.5">💡</div>
              <p className="text-sm text-purple-900 italic">{result.reasoning}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleConfirm} 
              size="lg" 
              className={cn(
                "flex-1 font-bold text-lg py-6 rounded-2xl shadow-lg transition-all",
                selectedCandidate
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              )}
              data-testid="btn-confirm-classification"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {selectedCandidate ? "确认选择" : "准确，继续"}
            </Button>
            <Button 
              onClick={handleRetry} 
              size="lg" 
              variant="outline"
              className="px-6 py-6 rounded-2xl border-2 font-bold hover:bg-gray-50"
              data-testid="btn-retry-classification"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
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
