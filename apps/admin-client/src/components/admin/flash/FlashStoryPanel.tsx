import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Eye, Film, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/ui/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type StoryEpisode = {
  id: string;
  code: string;
  phase: number;
  sortOrder: number;
  title: string;
  objectCode: string;
  contentVersion: number;
  reviewStatus: "draft" | "reviewed";
  isActive: boolean;
  content: {
    opening: string;
    action: string;
    discovery: string;
    question: { id: string; prompt: string; options: Array<{ id: string; label: string; tags: string[] }> };
    responseByOption: Record<string, string>;
    effectsByOption?: Record<string, Array<{ dimension: "trust" | "attachment" | "intervention" | "truth"; delta: number; flag?: string }>>;
    echoByFlag?: Record<string, string>;
    personalizedFallbackByOption?: Record<string, string>;
    closing: string;
  };
  motion: { ambient: "none" | "breathe" | "drift"; blinkAssetUrl?: string; blinkIntervalSeconds?: number };
};

type StoryAdminResponse = {
  seasons: Array<{ id: string; title: string; premise: string; status: "draft" | "published" | "archived" }>;
  episodes: Array<{ episode: StoryEpisode; npcName: string; npcSlug: string }>;
  fragments: Array<{ id: string; episodeId: string; category: "object" | "past" | "relationship" | "key"; title: string; fact: string; assetUrl: string | null }>;
};

export function FlashStoryPanel({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const query = useQuery<StoryAdminResponse>({ queryKey: ["/api/admin/alang/story"] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => query.data?.episodes.find((item) => item.episode.id === selectedId) ?? query.data?.episodes[0] ?? null,
    [query.data, selectedId],
  );
  const [draft, setDraft] = useState<StoryEpisode | null>(null);
  const [fragmentDraft, setFragmentDraft] = useState<StoryAdminResponse["fragments"][number] | null>(null);
  const editing = draft?.id === selected?.episode.id ? draft : selected?.episode ?? null;
  const selectedFragment = fragmentDraft?.episodeId === selected?.episode.id
    ? fragmentDraft
    : query.data?.fragments.find((fragment) => fragment.episodeId === selected?.episode.id) ?? null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/story"] });
  const saveMutation = useMutation({
    mutationFn: async ({ episode, fragment }: { episode: StoryEpisode; fragment: StoryAdminResponse["fragments"][number] | null }) => {
      const response = await apiRequest("PATCH", `/api/admin/alang/story/episodes/${episode.id}`, {
        expectedVersion: episode.contentVersion,
        title: episode.title,
        content: episode.content,
        motion: episode.motion,
        isActive: episode.isActive,
        fragment: fragment ? {
          category: fragment.category,
          title: fragment.title,
          fact: fragment.fact,
          assetUrl: fragment.assetUrl,
        } : undefined,
      });
      return response.json();
    },
    onSuccess: async () => { setDraft(null); setFragmentDraft(null); await refresh(); toast({ title: "故事单元已保存", description: "内容已回到待审核状态。" }); },
    onError: (error: Error) => toast({ title: "保存失败", description: error.message, variant: "destructive" }),
  });
  const reviewMutation = useMutation({
    mutationFn: async (episode: StoryEpisode) => {
      const response = await apiRequest("POST", `/api/admin/alang/story/episodes/${episode.id}/review`, { expectedVersion: episode.contentVersion });
      return response.json();
    },
    onSuccess: async () => { await refresh(); toast({ title: "审核完成" }); },
  });
  const publishMutation = useMutation({
    mutationFn: async (seasonId: string) => {
      const response = await apiRequest("POST", `/api/admin/alang/story/seasons/${seasonId}/publish`, {});
      return response.json();
    },
    onSuccess: async () => { await refresh(); toast({ title: "第一季已发布", description: "新的相遇将进入故事链路。" }); },
    onError: (error: Error) => toast({ title: "无法发布", description: error.message, variant: "destructive" }),
  });

  if (query.isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">正在读取故事链路…</CardContent></Card>;
  if (!query.data?.seasons.length) return <Card><CardContent className="p-6 text-sm text-muted-foreground">请先执行故事季迁移，再回到这里审核。</CardContent></Card>;

  const season = query.data.seasons[0];
  const reviewed = query.data.episodes.filter((item) => item.episode.reviewStatus === "reviewed" && item.episode.isActive).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold">{season.title}</h2><Badge variant={season.status === "published" ? "default" : "secondary"}>{season.status === "published" ? "已发布" : "草稿"}</Badge></div>
            <p className="mt-2 text-sm text-muted-foreground">{season.premise}</p>
            <p className="mt-2 text-sm font-medium">审核进度 {reviewed}/15</p>
          </div>
          <Button disabled={!canWrite || reviewed !== 15 || publishMutation.isPending} onClick={() => publishMutation.mutate(season.id)}>发布完整第一季</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">15 个故事单元</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {query.data.episodes.map((item) => (
              <button key={item.episode.id} type="button" onClick={() => { setSelectedId(item.episode.id); setDraft(null); setFragmentDraft(null); }} className={`w-full rounded-lg border p-3 text-left transition-colors ${selected?.episode.id === item.episode.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{item.episode.sortOrder}. {item.npcName}</span>{item.episode.reviewStatus === "reviewed" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Badge variant="outline">待审核</Badge>}</div>
                <p className="mt-1 text-xs text-muted-foreground">第 {item.episode.phase} 幕 · {item.episode.title}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {editing && selected ? (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Film className="h-4 w-4" />{selected.npcName} · {editing.title}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2"><div><Label>标题</Label><Input disabled={!canWrite} value={editing.title} onChange={(event) => setDraft({ ...editing, title: event.target.value })} /></div><div><Label>角色动作动画</Label><Select disabled={!canWrite} value={editing.motion.ambient} onValueChange={(ambient: "none" | "breathe" | "drift") => setDraft({ ...editing, motion: { ...editing.motion, ambient } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">关闭</SelectItem><SelectItem value="breathe">轻微呼吸</SelectItem><SelectItem value="drift">轻微漂移</SelectItem></SelectContent></Select></div></div>
              {(["opening", "action", "discovery", "closing"] as const).map((field) => <div key={field}><Label>{{ opening: "开场", action: "正在做什么", discovery: "本次发现", closing: "结尾推进" }[field]}</Label><Textarea disabled={!canWrite} rows={3} value={editing.content[field]} onChange={(event) => setDraft({ ...editing, content: { ...editing.content, [field]: event.target.value } })} /></div>)}
              <div><Label>互动问题</Label><Input disabled={!canWrite} value={editing.content.question.prompt} onChange={(event) => setDraft({ ...editing, content: { ...editing.content, question: { ...editing.content.question, prompt: event.target.value } } })} /></div>
              <div className="grid gap-3 md:grid-cols-3">
                {editing.content.question.options.map((option, index) => (
                  <div key={option.id}><Label>选项 {index + 1}</Label><Input disabled={!canWrite} value={option.label} onChange={(event) => {
                    const options = editing.content.question.options.map((item) => item.id === option.id ? { ...item, label: event.target.value } : item);
                    setDraft({ ...editing, content: { ...editing.content, question: { ...editing.content.question, options } } });
                  }} /></div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {editing.content.question.options.map((option, index) => {
                  const effect = editing.content.effectsByOption?.[option.id]?.[0] ?? { dimension: (["intervention", "truth", "trust"] as const)[index] ?? "trust", delta: 2 };
                  return <div key={option.id} className="space-y-2 rounded-lg border p-3"><Label>选项 {index + 1} 的宇宙影响</Label><Select disabled={!canWrite} value={effect.dimension} onValueChange={(dimension: typeof effect.dimension) => setDraft({ ...editing, content: { ...editing.content, effectsByOption: { ...editing.content.effectsByOption, [option.id]: [{ ...effect, dimension }] } } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trust">信任</SelectItem><SelectItem value="attachment">留恋</SelectItem><SelectItem value="intervention">介入</SelectItem><SelectItem value="truth">求真</SelectItem></SelectContent></Select><Input disabled={!canWrite} type="number" min={-3} max={3} value={effect.delta} onChange={(event) => setDraft({ ...editing, content: { ...editing.content, effectsByOption: { ...editing.content.effectsByOption, [option.id]: [{ ...effect, delta: Number(event.target.value) }] } } })} /><Label>专属模式审核回退</Label><Textarea disabled={!canWrite} rows={3} value={editing.content.personalizedFallbackByOption?.[option.id] ?? editing.content.responseByOption[option.id] ?? ""} onChange={(event) => setDraft({ ...editing, content: { ...editing.content, personalizedFallbackByOption: { ...editing.content.personalizedFallbackByOption, [option.id]: event.target.value } } })} /></div>;
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {editing.content.question.options.map((option, index) => (
                  <div key={option.id}><Label>选项 {index + 1} 后的回应</Label><Textarea disabled={!canWrite} rows={3} value={editing.content.responseByOption[option.id] ?? ""} onChange={(event) => setDraft({ ...editing, content: { ...editing.content, responseByOption: { ...editing.content.responseByOption, [option.id]: event.target.value } } })} /></div>
                ))}
              </div>
              {selectedFragment ? <div className="rounded-lg border p-4 space-y-3"><Label>完成后解锁的故事碎片</Label><div className="grid gap-3 md:grid-cols-2"><Select disabled={!canWrite} value={selectedFragment.category} onValueChange={(category: "object" | "past" | "relationship" | "key") => setFragmentDraft({ ...selectedFragment, category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="object">物件</SelectItem><SelectItem value="past">过去</SelectItem><SelectItem value="relationship">关系</SelectItem><SelectItem value="key">钥匙</SelectItem></SelectContent></Select><Input disabled={!canWrite} value={selectedFragment.title} onChange={(event) => setFragmentDraft({ ...selectedFragment, title: event.target.value })} /></div><Textarea disabled={!canWrite} rows={3} value={selectedFragment.fact} onChange={(event) => setFragmentDraft({ ...selectedFragment, fact: event.target.value })} /><Input disabled={!canWrite} placeholder="碎片图片地址（可空）" value={selectedFragment.assetUrl ?? ""} onChange={(event) => setFragmentDraft({ ...selectedFragment, assetUrl: event.target.value || null })} /></div> : null}
              <div className="grid gap-4 md:grid-cols-2"><div><Label>眨眼帧地址（可空）</Label><Input disabled={!canWrite} placeholder="必须是审核后的透明图片帧" value={editing.motion.blinkAssetUrl ?? ""} onChange={(event) => setDraft({ ...editing, motion: { ...editing.motion, blinkAssetUrl: event.target.value || undefined } })} /></div><div><Label>眨眼间隔（秒）</Label><Input disabled={!canWrite || !editing.motion.blinkAssetUrl} type="number" min={3} max={20} value={editing.motion.blinkIntervalSeconds ?? 6} onChange={(event) => setDraft({ ...editing, motion: { ...editing.motion, blinkIntervalSeconds: Number(event.target.value) } })} /></div></div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm"><div className="flex items-center gap-2 font-medium"><Eye className="h-4 w-4" />动画规则</div><p className="mt-1 text-muted-foreground">呼吸与漂移只使用位移和透明度。未上传正式眨眼帧时不会合成假眼皮；用户开启“减少动态效果”后全部静止。</p></div>
              <div className="rounded-xl border bg-background p-4" data-testid="flash-story-preview"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-primary">小程序内容预览</span><Badge variant="outline">第 {editing.phase} 幕</Badge></div><p className="mt-3 text-lg font-semibold">{editing.title}</p><p className="mt-2 text-sm text-muted-foreground">{editing.content.opening}</p><p className="mt-3 text-sm">{editing.content.discovery}</p><div className="mt-3 space-y-2">{editing.content.question.options.map((option) => <div key={option.id} className="rounded-lg bg-muted px-3 py-2 text-sm">{option.label}</div>)}</div>{selectedFragment ? <div className="mt-4 rounded-lg bg-primary/5 p-3"><p className="text-xs font-semibold text-primary">新故事碎片</p><p className="mt-1 font-medium">{selectedFragment.title}</p><p className="mt-1 text-sm text-muted-foreground">{selectedFragment.fact}</p></div> : null}</div>
              <div className="flex flex-wrap gap-2"><Button disabled={!canWrite || (!draft && !fragmentDraft) || saveMutation.isPending} onClick={() => saveMutation.mutate({ episode: editing, fragment: selectedFragment })}><Save className="mr-2 h-4 w-4" />保存并重新送审</Button><Button variant="outline" disabled={!canWrite || Boolean(draft || fragmentDraft) || editing.reviewStatus === "reviewed" || reviewMutation.isPending} onClick={() => reviewMutation.mutate(editing)}><CheckCircle2 className="mr-2 h-4 w-4" />审核通过</Button></div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
