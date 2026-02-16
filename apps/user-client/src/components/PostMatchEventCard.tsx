import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MeetYourTable from "./MeetYourTable";
import WhyThisTable from "./WhyThisTable";
import { Users } from "lucide-react";
import type { AttendeeData, UserContext } from "@/lib/attendeeAnalytics";

interface PostMatchEventCardProps {
  matchedAttendees?: AttendeeData[];
  matchExplanation?: string;
  currentUser: UserContext;
}

export default function PostMatchEventCard({ 
  matchedAttendees, 
  matchExplanation,
  currentUser,
}: PostMatchEventCardProps) {
  if (!matchedAttendees || matchedAttendees.length === 0) {
    return null;
  }
  
  return (
    <Card className="border shadow-sm" data-testid="card-post-match-preview">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          活动预览
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <MeetYourTable 
          attendees={matchedAttendees} 
          currentUser={currentUser}
        />
        {matchExplanation && <WhyThisTable explanation={matchExplanation} />}
      </CardContent>
    </Card>
  );
}
