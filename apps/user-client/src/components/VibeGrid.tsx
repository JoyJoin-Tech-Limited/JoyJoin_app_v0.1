import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type MacroSeed = { value: string; label: string; x: number; y: number; micro: string[] };

const macroSeeds: MacroSeed[] = [
  { value: "sports", label: "运动健身", x: 0.9, y: 0.2, micro: ["飞盘", "夜跑", "城市骑行"] },
  { value: "travel", label: "旅行户外", x: 0.75, y: 0.35, micro: ["City Walk", "周末露营"] },
  { value: "games", label: "桌游电竞", x: 0.35, y: 0.45, micro: ["桌游德扑", "剧本杀"] },
  { value: "reading", label: "读书分享", x: 0.1, y: 0.85, micro: ["书店下午茶", "主题读书会"] },
  { value: "tech", label: "科技数码", x: 0.55, y: 0.55, micro: ["机械键盘", "3D 打印"] },
  { value: "music", label: "音乐演出", x: 0.45, y: 0.35, micro: ["小型 Live", "即兴 Jam"] },
  { value: "art", label: "艺术展览", x: 0.25, y: 0.6, micro: ["独立画展", "手作市集"] },
  { value: "movies", label: "电影戏剧", x: 0.4, y: 0.55, micro: ["小众放映", "剧场体验"] },
  { value: "food", label: "美食探店", x: 0.6, y: 0.4, micro: ["深夜食堂", "街巷小店"] },
  { value: "photography", label: "摄影创作", x: 0.3, y: 0.7, micro: ["人像扫街", "胶片体验"] },
  { value: "pets", label: "萌宠爱好", x: 0.5, y: 0.65, micro: ["撸猫咖", "宠物聚会"] },
  { value: "investment", label: "理财投资", x: 0.65, y: 0.6, micro: ["理财读书会", "指数分享"] },
];

function nearestMacro(p: { x: number; y: number }) {
  return macroSeeds.reduce(
    (best, curr) => {
      const d = Math.hypot(curr.x - p.x, curr.y - p.y);
      return d < best.dist ? { seed: curr, dist: d } : best;
    },
    { seed: macroSeeds[0], dist: Infinity },
  ).seed;
}

function pickMicro(seed: MacroSeed) {
  return seed.micro[Math.floor(Math.random() * seed.micro.length)] || seed.label;
}

interface VibeGridProps {
  onPick: (macro: string, micro: string) => void;
  selectedMacros: string[];
}

export function VibeGrid({ onPick, selectedMacros }: VibeGridProps) {
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-2">
      <div className="relative aspect-square rounded-2xl bg-muted p-3 select-none" data-testid="vibe-grid">
        <div className="absolute left-2 top-1 text-[11px] text-muted-foreground">社交</div>
        <div className="absolute right-2 bottom-1 text-[11px] text-muted-foreground">独处</div>
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[11px] text-muted-foreground">动感</div>
        <div className="absolute left-1/2 bottom-1 -translate-x-1/2 text-[11px] text-muted-foreground">松弛</div>

        <div className="grid h-full w-full grid-cols-4 grid-rows-4" ref={gridRef}>
          {[...Array(16)].map((_, idx) => {
            const row = Math.floor(idx / 4) + 1;
            const col = (idx % 4) + 1;
            return (
              <button
                key={idx}
                type="button"
                className="border-[0.5px] border-muted-foreground/15 active:bg-primary/10"
                aria-label={`兴趣格子 第 ${row} 行第 ${col} 列`}
                onClick={(e) => {
                  const parent = gridRef.current;
                  if (!parent) return;
                  const rect = parent.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  const seed = nearestMacro({ x, y });
                  const micro = pickMicro(seed);
                  setTap({ x, y });
                  onPick(seed.value, micro);
                }}
              />
            );
          })}
        </div>

        {tap && (
          <div
            className="pointer-events-none absolute h-3 w-3 rounded-full bg-primary/80 shadow-sm transition-transform"
            style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%`, transform: "translate(-50%, -50%)" }}
          />
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        轻点格子即可获取灵感，系统会帮你匹配最近的兴趣并给出微兴趣建议
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedMacros.map((v) => {
          const seed = macroSeeds.find((s) => s.value === v);
          return (
            <span
              key={v}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                "border-primary/30 bg-primary/10 text-primary",
              )}
            >
              {seed?.label ?? v}
            </span>
          );
        })}
      </div>
    </div>
  );
}
