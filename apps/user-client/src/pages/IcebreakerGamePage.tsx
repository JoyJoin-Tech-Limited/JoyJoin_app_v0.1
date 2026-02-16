import { useLocation, useRoute } from "wouter";
import { useEffect } from "react";
import IcebreakerCardGame from "@/components/icebreaker/IcebreakerCardGame";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function IcebreakerGamePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/icebreaker-game");
  
  // Get query parameters
  const searchParams = new URLSearchParams(window.location.search);
  const eventId = searchParams.get("eventId");
  const groupId = searchParams.get("groupId");
  const sessionId = searchParams.get("sessionId");

  useEffect(() => {
    // Redirect if no valid params
    if (!eventId && !groupId && !sessionId) {
      console.warn("[IcebreakerGamePage] No event/group/session ID provided, redirecting");
      setLocation("/");
    }
  }, [eventId, groupId, sessionId, setLocation]);

  const handleClose = () => {
    if (eventId) {
      setLocation(`/blind-box-events/${eventId}`);
    } else if (groupId) {
      setLocation(`/pool-groups/${groupId}`);
    } else {
      setLocation("/");
    }
  };

  return (
    <div className="relative">
      <IcebreakerCardGame
        sessionId={sessionId || undefined}
        eventId={eventId || undefined}
        groupId={groupId || undefined}
        onClose={handleClose}
      />
    </div>
  );
}
