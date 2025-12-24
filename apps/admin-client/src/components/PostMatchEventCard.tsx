import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MeetYourTable from "./MeetYourTable";
import WhyThisTable from "./WhyThisTable";
import { Users } from "lucide-react";
import type { AttendeeData } from "@/lib/attendeeAnalytics";

interface PostMatchEventCardProps {
  matchedAttendees?: AttendeeData[];
  matchExplanation?: string;
  userInterests?: string[];
  userEducationLevel?: string;
  userIndustry?: string;
  userAge?: number;
  userGender?: string;
  userRelationshipStatus?: string;
  userChildren?: string;
  userStudyLocale?: string;
  userOverseasRegions?: string[];
  userSeniority?: string;
  userFieldOfStudy?: string;
  userLanguages?: string[];
  userHometownCountry?: string;
  userHometownRegionCity?: string;
  userHometownAffinityOptin?: boolean;
}

export default function PostMatchEventCard({ 
  matchedAttendees, 
  matchExplanation,
  userInterests = [],
  userEducationLevel,
  userIndustry,
  userAge,
  userGender,
  userRelationshipStatus,
  userChildren,
  userStudyLocale,
  userOverseasRegions,
  userSeniority,
  userFieldOfStudy,
  userLanguages,
  userHometownCountry,
  userHometownRegionCity,
  userHometownAffinityOptin,
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
          userInterests={userInterests}
          userEducationLevel={userEducationLevel}
          userIndustry={userIndustry}
          userAge={userAge}
          userGender={userGender}
          userRelationshipStatus={userRelationshipStatus}
          userChildren={userChildren}
          userStudyLocale={userStudyLocale}
          userOverseasRegions={userOverseasRegions}
          userSeniority={userSeniority}
          userFieldOfStudy={userFieldOfStudy}
          userLanguages={userLanguages}
          userHometownCountry={userHometownCountry}
          userHometownRegionCity={userHometownRegionCity}
          userHometownAffinityOptin={userHometownAffinityOptin}
        />
        {matchExplanation && <WhyThisTable explanation={matchExplanation} />}
      </CardContent>
    </Card>
  );
}
