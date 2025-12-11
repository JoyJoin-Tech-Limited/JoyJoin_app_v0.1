import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

//todo: remove mock functionality
const matches = [
  {
    name: "Sarah Johnson",
    initials: "SJ",
    matchScore: 94,
    sharedVibes: ["Coffee Chats", "Introvert", "Creative"],
    mutualEvents: 2
  },
  {
    name: "Michael Chen",
    initials: "MC",
    matchScore: 89,
    sharedVibes: ["Book Lover", "Tech", "Weekend Vibes"],
    mutualEvents: 1
  },
  {
    name: "Emma Davis",
    initials: "ED",
    matchScore: 86,
    sharedVibes: ["Art", "Music", "Chill"],
    mutualEvents: 3
  }
];

export default function MatchesPage() {
  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader title="Matches" />
      
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          People you've connected with at events
        </p>

        {matches.map((match, i) => (
          <Card key={i} className="hover-elevate active-elevate-2 transition-all" data-testid={`card-match-${match.initials.toLowerCase()}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {match.initials}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{match.name}</h3>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      {match.matchScore}%
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    {match.sharedVibes.slice(0, 3).map((vibe, j) => (
                      <Badge key={j} variant="outline" className="text-[10px] h-5 px-2">
                        {vibe}
                      </Badge>
                    ))}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {match.mutualEvents} mutual event{match.mutualEvents !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}
