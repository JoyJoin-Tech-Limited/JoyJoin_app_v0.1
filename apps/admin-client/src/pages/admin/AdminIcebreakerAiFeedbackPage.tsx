import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface SummaryResponse {
  days: number;
  since: string;
  generatedAt: string;
  totals: { helpful: number; neutral: number; awkward: number; rows: number };
  byPhase: Array<{ phase: string; helpful: number; neutral: number; awkward: number }>;
  byPromptVersion: Array<{
    promptVersion: string;
    helpful: number;
    neutral: number;
    awkward: number;
  }>;
}

export default function AdminIcebreakerAiFeedbackPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading, error } = useQuery<SummaryResponse>({
    queryKey: ["/api/admin/icebreaker-ai-feedback/summary", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/icebreaker-ai-feedback/summary?days=${days}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            破冰 AI 反馈
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            人类评分（有帮助 / 一般 / 略尴尬），按阶段与 prompt 版本聚合。详见 docs/ops/icebreaker-ai-quality-protocol.md
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="时间范围" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>加载失败</CardTitle>
            <CardDescription>{String(error)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>汇总</CardTitle>
              <CardDescription>
                自 {new Date(data.since).toLocaleString()} — 共 {data.totals.rows} 条
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">有帮助</p>
                <p className="text-2xl font-bold text-emerald-600">{data.totals.helpful}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">一般</p>
                <p className="text-2xl font-bold">{data.totals.neutral}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">略尴尬</p>
                <p className="text-2xl font-bold text-rose-600">{data.totals.awkward}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>按阶段</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byPhase.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.byPhase.map((row) => (
                    <li key={row.phase} className="flex justify-between border-b pb-2">
                      <span className="font-mono">{row.phase}</span>
                      <span>
                        ↑{row.helpful} · ~{row.neutral} · ↓{row.awkward}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>按 prompt 版本</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byPromptVersion.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无数据</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.byPromptVersion.map((row) => (
                    <li key={row.promptVersion} className="flex justify-between border-b pb-2">
                      <span className="font-mono text-xs break-all">{row.promptVersion}</span>
                      <span className="shrink-0">
                        ↑{row.helpful} · ~{row.neutral} · ↓{row.awkward}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
