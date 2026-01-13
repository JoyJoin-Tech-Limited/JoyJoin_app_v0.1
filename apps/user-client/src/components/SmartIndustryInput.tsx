import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { IndustryOption } from "@shared/constants";
type Suggestion = { value: IndustryOption["value"]; label: string; confidence?: number };

interface SmartIndustryInputProps {
  options: readonly IndustryOption[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  mascotPrompt?: string;
  debounceMs?: number;
  className?: string;
}

export function SmartIndustryInput({
  options,
  value,
  onSelect,
  placeholder = "例：我做医疗AI / 我做可持续时尚设计",
  mascotPrompt = "小月在听：你主要做什么工作？",
  debounceMs = 500,
  className,
}: SmartIndustryInputProps) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [primary, setPrimary] = useState<Suggestion | null>(null);
  const [alts, setAlts] = useState<Suggestion[]>([]);

  const { mutate: inferIndustry, isPending } = useMutation({
    mutationFn: async (body: { text: string }) => {
      const res = await apiRequest("POST", "/api/inference/parse-industry", body);
      return (await res.json()) as { primary?: Suggestion; alternatives?: Suggestion[] };
    },
    onError: () => {
      toast({ description: "识别失败，请稍后再试或手动选择", variant: "destructive" });
    },
    onSuccess: (resp) => {
      if (resp?.primary) setPrimary(resp.primary);
      setAlts(resp?.alternatives ?? []);
    },
  });

  const { mutate: classifyWithAI, isPending: isAiClassifying } = useMutation({
    mutationFn: async (body: { description: string }) => {
      const res = await apiRequest("POST", "/api/inference/classify-industry", body);
      return (await res.json()) as { 
        industry: string; 
        confidence: number; 
        reasoning: string; 
        source: string;
      };
    },
    onError: () => {
      toast({ 
        description: "分类失败，请手动选择最接近的行业", 
        variant: "destructive" 
      });
    },
    onSuccess: (result) => {
      const industry = options.find(o => o.value === result.industry);
      
      if (result.confidence > 0.6 && industry) {
        onSelect(result.industry);
        toast({ 
          description: `已将"${text}"归类为"${industry.label}"${result.reasoning ? `：${result.reasoning}` : ''}` 
        });
      } else if (industry) {
        onSelect(result.industry);
        toast({ 
          description: `暂时归类为"${industry.label}"，我们会继续优化分类`,
          variant: "default"
        });
      }
    },
  });

  useEffect(() => {
    if (!text?.trim()) {
      setPrimary(null);
      setAlts([]);
      return;
    }
    const handle = setTimeout(() => inferIndustry({ text }), debounceMs);
    return () => clearTimeout(handle);
  }, [text, debounceMs, inferIndustry]);

  const normalize = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return (s?: Suggestion | null) => (s && map.has(s.value) ? s : null);
  }, [options]);

  const primaryNorm = normalize(primary);
  const altsNorm = alts.map(normalize).filter(Boolean) as Suggestion[];

  const confidence = (c?: number) => (c ? `置信度${Math.round(c * 100)}%` : "");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="text-base text-muted-foreground font-medium">{mascotPrompt}</div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        inputMode="text"
        className="h-14 text-lg rounded-2xl"
        data-testid="input-industry-smart"
      />
      {isPending && (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> 正在为你匹配行业…
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {primaryNorm && (
          <Button
            size="lg"
            variant={value === primaryNorm.value ? "default" : "outline"}
            onClick={() => onSelect(primaryNorm.value)}
            className="text-base font-semibold"
            data-testid="chip-industry-primary"
          >
            <Sparkles className="mr-1.5 h-5 w-5" />
            {primaryNorm.label}
            {primaryNorm.confidence ? (
              <span className={cn(
                "ml-2 text-sm font-medium whitespace-nowrap px-2 py-0.5 rounded-full",
                value === primaryNorm.value 
                  ? "bg-white/20 text-white" 
                  : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
              )}>
                {confidence(primaryNorm.confidence)}
              </span>
            ) : null}
          </Button>
        )}
        {altsNorm.map((s) => (
          <Button
            key={s.value}
            size="default"
            variant={value === s.value ? "default" : "secondary"}
            onClick={() => onSelect(s.value)}
            className="text-base"
            data-testid={`chip-industry-${s.value}`}
          >
            {s.label}
            {s.confidence ? (
              <span className={cn(
                "ml-2 text-sm font-medium whitespace-nowrap px-2 py-0.5 rounded-full",
                value === s.value 
                  ? "bg-white/20 text-white" 
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              )}>
                {confidence(s.confidence)}
              </span>
            ) : null}
          </Button>
        ))}
      </div>
      
      {/* AI Classification Fallback */}
      {!primaryNorm && !isPending && !isAiClassifying && text.trim().length > 3 && (
        <div className="p-4 border border-dashed rounded-lg bg-amber-50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
            🤔 没找到合适的行业？
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
            告诉我们你的具体工作，我们会智能分类
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => classifyWithAI({ description: text })}
            className="w-full"
          >
            让AI帮我分类
          </Button>
        </div>
      )}
      
      {isAiClassifying && (
        <div className="flex items-center gap-2 text-base text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> AI正在分析你的行业…
        </div>
      )}
    </div>
  );
}
