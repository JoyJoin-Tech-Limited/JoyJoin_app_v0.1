import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Briefcase } from "lucide-react";
import { type AttendeeData, type UserContext } from "@/lib/attendeeAnalytics";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { getInterestLabel } from "@shared/interests";

interface AttendeeProfileSheetProps {
  attendee: AttendeeData;
  currentUser: UserContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const rarityColors: Record<string, string> = {
  epic: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
  rare: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700",
  common: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600",
};

const rarityOrder: Record<string, number> = { epic: 0, rare: 1, common: 2 };

export default function AttendeeProfileSheet({
  attendee,
  currentUser,
  open,
  onOpenChange,
}: AttendeeProfileSheetProps) {
  const sparks: { text: string; rarity: 'common' | 'rare' | 'epic' }[] = [];

  const archetypeImage = attendee.archetype ? getArchetypeImage(attendee.archetype) : null;

  const sharedInterests = (attendee.topInterests ?? []).filter((i) =>
    (currentUser.interests ?? []).includes(i)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="sr-only">
            {attendee.displayName} 的契合点
          </SheetTitle>
        </SheetHeader>

        {/* Attendee header */}
        <div className="flex items-center gap-3 mb-5">
          <Avatar className="h-14 w-14 border-2 border-primary/20">
            {archetypeImage ? (
              <img src={archetypeImage} alt={attendee.archetype} className="h-full w-full object-cover" />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-600 text-white text-xl font-bold">
                {attendee.displayName.charAt(0)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-lg">{attendee.displayName}</p>
            {attendee.archetype && (
              <Badge variant="secondary" className="text-xs">
                {attendee.archetype}
              </Badge>
            )}
            {attendee.industryVisible && attendee.industry && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                <span>{attendee.industry}</span>
              </div>
            )}
          </div>
        </div>

        {/* 契合点 section */}
        {sparks.length > 0 && (
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">你们的契合点</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {sparks.map((spark, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={`text-xs border ${rarityColors[spark.rarity] ?? rarityColors.common}`}
                  data-testid={`badge-spark-sheet-${attendee.userId}-${idx}`}
                >
                  {spark.rarity === "epic" ? "✨ " : spark.rarity === "rare" ? "💎 " : ""}
                  {spark.text}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Shared interests */}
        {sharedInterests.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">共同兴趣</h3>
            <div className="flex flex-wrap gap-2">
              {sharedInterests.map((interest, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {getInterestLabel(interest)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {sparks.length === 0 && sharedInterests.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            见面后才能发现更多契合点 ✨
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
