// /Users/felixg/projects/JoyJoin3/client/src/components/BlindBoxEventCard.tsx

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Sparkles, Users } from "lucide-react";
import BlindBoxInfoSheet from "./BlindBoxInfoSheet";
import JoinBlindBoxSheet from "./JoinBlindBoxSheet";

type PriceTier = "100元以下" | "100-200" | "200-300" | "300-500" | "500+";

interface BlindBoxEventCardProps {
  id: string;
  date: string;
  time: string;
  eventType: "饭局" | "酒局";
  area: string;
  mysteryTitle: string;
  priceTier?: PriceTier;
  isAA?: boolean;
  city?: "香港" | "深圳";
  isGirlsNight?: boolean;
  poolId?: string; // <-- add this line
}

export default function BlindBoxEventCard({
  id,
  date,
  time,
  eventType,
  area,
  mysteryTitle,
  priceTier,
  isAA,
  city,
  isGirlsNight,
  poolId,
}: BlindBoxEventCardProps) {
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);

  const handleJoinClick = () => {
    console.log("[BlindBoxEventCard] opening JoinBlindBoxSheet with poolId:", poolId);
    // 不再跳转到 /event-pool/...，而是打开盲盒报名弹窗
    setJoinSheetOpen(true);
  };

  return (
    <>
      <Card
        className="hover-elevate active-elevate-2 transition-all border shadow-sm"
        data-testid={`card-blindbox-${id}`}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-display font-bold text-lg text-muted-foreground/60 mb-2">
                {mysteryTitle}
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>
                    {date} {time}
                  </span>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs px-2 py-0.5 rounded-md"
                  data-testid={`badge-event-type-${eventType}`}
                >
                  {eventType}
                </Badge>
                {isGirlsNight && (
                  <Badge
                    variant="default"
                    className="text-xs px-2 py-0.5 rounded-md bg-pink-500 hover:bg-pink-600"
                    data-testid="badge-girls-night"
                  >
                    👭 Girls Night
                  </Badge>
                )}
              </div>
            </div>

            <Sparkles className="h-5 w-5 text-primary" />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{area}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>4-6人</span>
            <span className="text-xs">
              • {isGirlsNight ? "仅限女生" : "尽量保持男女比例平衡"}
            </span>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              size="default"
              onClick={handleJoinClick}
              data-testid={`button-join-${id}`}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              立即参与
            </Button>
            <Button
              variant="outline"
              size="default"
              onClick={() => setInfoSheetOpen(true)}
              data-testid={`button-learn-more-${id}`}
            >
              了解更多
            </Button>
          </div>
        </div>
      </Card>

      {/* 活动介绍弹窗 */}
      <BlindBoxInfoSheet
        open={infoSheetOpen}
        onOpenChange={setInfoSheetOpen}
        eventData={{
          date,
          time,
          eventType,
          area,
          priceTier,
          isAA,
          city,
        }}
      />

      {/* 报名 / 预算 / 偏好弹窗 */}
      <JoinBlindBoxSheet
        open={joinSheetOpen}
        onOpenChange={setJoinSheetOpen}
        eventData={{
          poolId: poolId ?? null,
          date,
          time,
          eventType,
          area,
          priceTier,
          isAA,
          isGirlsNight,
          city,
        }}
      />
    </>
  );
}