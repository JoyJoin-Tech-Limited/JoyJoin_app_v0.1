import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NoMatchRecommendation {
  id: string;
  title: string;
  eventType: "饭局" | "酒局";
  district: string;
  dateTime: string;
  registrationCount: number;
}

interface NoMatchRecommendationsProps {
  items: NoMatchRecommendation[];
  originalBudget?: string | null;
  onJoin: (poolId: string) => void;
}

function formatDate(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    return "时间待定";
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function NoMatchRecommendations({
  items,
  originalBudget,
  onJoin,
}: NoMatchRecommendationsProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-6 w-full max-w-sm space-y-3">
      <div className="rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h3 className="font-semibold">小悦帮你找了几个新局</h3>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          {originalBudget
            ? `这些活动和你刚才的口味接近，预算 ${originalBudget} 的偏好也会一起带过去。`
            : "这些活动和你刚才的 vibe 接近，点一下就能继续。"}
        </p>
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-[24px] border border-white/10 bg-black/20 p-4 backdrop-blur-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <div className="mt-2 space-y-1 text-xs text-white/55">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {item.eventType} · {formatDate(item.dateTime)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{item.district}</span>
                </div>
              </div>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/65">
              {item.registrationCount} 人关注
            </div>
          </div>

          <Button onClick={() => onJoin(item.id)} className="mt-4 h-11 w-full">
            一键加入这场新局
          </Button>
        </div>
      ))}
    </div>
  );
}
