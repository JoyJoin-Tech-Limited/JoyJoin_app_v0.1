import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type IndustryOption = { value: string; label: string };
type Suggestion = { value: string; label: string; confidence?: number };

interface SmartIndustryInputProps {
  options: IndustryOption[];
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

  const mutation = useMutation({
    mutationFn: async (body: { text: string }) => {
      const res = await apiRequest("POST", "/api/inference/parse-industry", body);
      return (await res.json()) as { primary?: Suggestion; alternatives?: Suggestion[] };
    },
    onError: () => {
      toast({ description: "识别失败，请稍后再试或手动选择", variant: "destructive" });
    },
    onSuccess: (data) => {
      if (data?.primary) setPrimary(data.primary);
      setAlts(data?.alternatives ?? []);
    },
  });

  useEffect(() => {
    if (!text?.trim()) {
      setPrimary(null);
      setAlts([]);
      return;
    }
    const handle = setTimeout(() => mutation.mutate({ text }), debounceMs);
    return () => clearTimeout(handle);
  }, [text, debounceMs, mutation]);

  const normalize = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return (s?: Suggestion | null) => (s && map.has(s.value) ? s : null);
  }, [options]);

  const primaryNorm = normalize(primary);
  const altsNorm = alts.map(normalize).filter(Boolean) as Suggestion[];

  const confidence = (c?: number) => (c ? ` · 置信度${Math.round(c * 100)}%` : "");

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-sm text-muted-foreground">{mascotPrompt}</div>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        inputMode="text"
        data-testid="input-industry-smart"
      />
      {mutation.isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在为你匹配行业…
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {primaryNorm && (
          <Button
            size="sm"
            variant={value === primaryNorm.value ? "default" : "outline"}
            onClick={() => onSelect(primaryNorm.value)}
            data-testid="chip-industry-primary"
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {primaryNorm.label}
            {confidence(primaryNorm.confidence)}
          </Button>
        )}
        {altsNorm.map((s) => (
          <Button
            key={s.value}
            size="sm"
            variant={value === s.value ? "default" : "secondary"}
            onClick={() => onSelect(s.value)}
            data-testid={`chip-industry-${s.value}`}
          >
            {s.label}
            {confidence(s.confidence)}
          </Button>
        ))}
      </div>
    </div>
  );
}
