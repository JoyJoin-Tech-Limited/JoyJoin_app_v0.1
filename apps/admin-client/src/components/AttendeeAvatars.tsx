import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Attendee {
  name: string;
  initials: string;
}

interface AttendeeAvatarsProps {
  attendees: Attendee[];
  maxDisplay?: number;
}

export default function AttendeeAvatars({ attendees, maxDisplay = 4 }: AttendeeAvatarsProps) {
  const displayedAttendees = attendees.slice(0, maxDisplay);
  const remainingCount = attendees.length - maxDisplay;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displayedAttendees.map((attendee, i) => (
          <Avatar key={i} className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {attendee.initials}
            </AvatarFallback>
          </Avatar>
        ))}
        {remainingCount > 0 && (
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
