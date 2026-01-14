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
import { Loader2, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ClassificationResult {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  confidence: number;
  reasoning?: string;
  source: "seed" | "ontology" | "ai" | "fallback";
  processingTimeMs: number;
}

interface SmartIndustryClassifierProps {
  onClassified: (result: ClassificationResult & { rawInput: string }) => void;
  onManualSelect?: () => void;
  placeholder?: string;
  mascotPrompt?: string;
  debounceMs?: number;
  className?: string;
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
    onClassified({
      ...result,
      rawInput: text,
    });
  };

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

  const getSourceLabel = (source: string) => {
    const labels = {
      seed: "精确匹配",
      ontology: "模糊匹配",
      ai: "AI推理",
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

      {/* 输入框 */}
      <div className="relative">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          inputMode="text"
          className="h-14 text-lg rounded-2xl pr-12"
          disabled={isConfirmed}
          data-testid="input-industry-smart"
        />
        {isPending && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* 加载状态 */}
      {isPending && (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          正在智能识别...
        </div>
      )}

      {/* 分类结果展示 */}
      {result && !isConfirmed && (
        <div className="space-y-3 p-4 border-2 border-primary/20 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent">
          {/* 结果标题 */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <span className="font-semibold text-base">识别结果</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cn("text-xs", getConfidenceColor(result.confidence))}>
                置信度 {Math.round(result.confidence * 100)}%
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {getSourceLabel(result.source)}
              </Badge>
            </div>
          </div>

          {/* 三层分类路径 */}
          <div className="space-y-2">
            <div className="text-lg font-bold text-foreground">
              {getFullPath()}
            </div>
            
            {/* 分层显示 */}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="default" className="font-normal">
                {result.category.label}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="secondary" className="font-normal">
                {result.segment.label}
              </Badge>
              {result.niche && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="font-normal">
                    {result.niche.label}
                  </Badge>
                </>
              )}
            </div>
          </div>

          {/* AI推理说明 */}
          {result.reasoning && (
            <div className="text-sm text-muted-foreground italic">
              💡 {result.reasoning}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleConfirm}
              size="lg"
              className="flex-1 gap-2"
              data-testid="btn-confirm-classification"
            >
              <CheckCircle2 className="h-4 w-4" />
              准确，就是这个
            </Button>
            <Button
              onClick={handleRetry}
              size="lg"
              variant="outline"
              className="gap-2"
              data-testid="btn-retry-classification"
            >
              <RotateCcw className="h-4 w-4" />
              重新识别
            </Button>
          </div>

          {/* 低置信度提示 */}
          {result.confidence < 0.7 && onManualSelect && (
            <div className="text-sm text-center text-muted-foreground">
              识别不太确定？
              <button
                onClick={onManualSelect}
                className="text-primary hover:underline ml-1 font-medium"
              >
                手动选择
              </button>
            </div>
          )}
        </div>
      )}

      {/* 已确认状态 */}
      {result && isConfirmed && (
        <div className="p-4 border-2 border-green-500/30 rounded-2xl bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="font-medium">已确认：{getFullPath()}</span>
          </div>
        </div>
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
