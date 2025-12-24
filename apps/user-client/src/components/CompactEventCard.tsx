import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Sparkles } from "lucide-react";
import AttendeeAvatars from "./AttendeeAvatars";

interface CompactEventCardProps {
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: Array<{ name: string; initials: string }>;
  spotsLeft: number;
  matchScore: number;
  imageGradient?: string;
}

export default function CompactEventCard({
  title,
  date,
  time,
  location,
  attendees,
  spotsLeft,
  matchScore,
  imageGradient = "from-purple-500 to-pink-500"
}: CompactEventCardProps) {
  return (
    <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all" data-testid={`card-event-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex gap-3 p-3">
        <div className={`w-20 h-20 rounded-lg bg-gradient-to-br ${imageGradient} flex-shrink-0 relative`}>
          <Badge className="absolute -top-1 -right-1 h-5 px-1.5 text-[10px] bg-background/90 backdrop-blur-sm text-foreground border-0">
            <Sparkles className="h-2.5 w-2.5 mr-0.5" />
            {matchScore}%
          </Badge>
        </div>
        
        <CardContent className="flex-1 p-0 space-y-1.5">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
          
          <div className="flex items-center text-xs text-muted-foreground gap-1">
            <Calendar className="h-3 w-3" />
            <span>{date}, {time}</span>
          </div>
          
          <div className="flex items-center text-xs text-muted-foreground gap-1">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">{location}</span>
          </div>
          
          <div className="flex items-center justify-between pt-1">
            <AttendeeAvatars attendees={attendees} maxDisplay={3} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>{spotsLeft} left</span>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
