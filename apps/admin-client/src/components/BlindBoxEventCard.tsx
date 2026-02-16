// /Users/felixg/projects/JoyJoin3/client/src/components/BlindBoxEventCard.tsx

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Sparkles, Users } from "lucide-react";
import BlindBoxInfoSheet from "./BlindBoxInfoSheet";
import JoinEventPoolSheet from "./event-pool-registration/JoinEventPoolSheet";
import { getArchetypeImage } from "@/lib/archetypeImages";

type PriceTier = "150以下" | "150-200" | "200-300" | "300-500";

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
  poolId?: string;
  registrationCount?: number;
  sampleArchetypes?: string[];
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
  registrationCount = 0,
  sampleArchetypes = [],
}: BlindBoxEventCardProps) {
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);

  const handleJoinClick = () => {
    console.log("[BlindBoxEventCard] opening JoinEventPoolSheet with poolId:", poolId);
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
              <h3 className="font-brand font-bold text-lg text-muted-foreground/60 mb-2">
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>4-6人</span>
              <span className="text-xs">
                • {isGirlsNight ? "仅限女生" : "尽量保持男女比例平衡"}
              </span>
            </div>
            
            {/* 社交证明：报名人数 + 原型头像叠合 */}
            {registrationCount > 0 && (
              <div className="flex items-center gap-1.5" data-testid={`social-proof-${id}`}>
                <div className="flex -space-x-2">
                  {sampleArchetypes.slice(0, 3).map((archetype, index) => {
                    const imgSrc = getArchetypeImage(archetype);
                    return imgSrc ? (
                      <div
                        key={index}
                        className="w-6 h-6 rounded-full border-2 border-background bg-muted overflow-hidden"
                        style={{ zIndex: 3 - index }}
                      >
                        <img 
                          src={imgSrc} 
                          alt={archetype}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null;
                  })}
                </div>
                <span className="text-xs text-muted-foreground font-medium">
                  {registrationCount}人已报名
                </span>
              </div>
            )}
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

      {poolId && joinSheetOpen && (
        <JoinEventPoolSheet
          open={joinSheetOpen}
          onOpenChange={setJoinSheetOpen}
          poolData={{
            poolId,
            title: mysteryTitle,
            date: `${date} ${time}`,
            area,
            city: city ?? "深圳",
            eventType,
            registrationCount,
          }}
        />
      )}
    </>
  );
}