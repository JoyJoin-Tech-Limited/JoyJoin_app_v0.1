import EventCard from '../EventCard';
import { Coffee, Music, Heart } from 'lucide-react';

export default function EventCardExample() {
  return (
    <div className="max-w-sm">
      <EventCard
        title="Sunday Coffee & Conversations"
        date="Oct 15"
        time="10:00 AM"
        location="Bean & Brew Cafe, Downtown"
        vibes={[
          { label: "Chill Vibes", icon: Coffee },
          { label: "Deep Talks", icon: Heart },
          { label: "Creative Minds", icon: Music }
        ]}
        attendees={[
          { name: "Sarah J", initials: "SJ" },
          { name: "Mike C", initials: "MC" },
          { name: "Emma D", initials: "ED" },
          { name: "Alex R", initials: "AR" }
        ]}
        spotsLeft={3}
        matchScore={92}
        matchReason="Love coffee chats + introverted energy + weekend mornings"
        imageGradient="from-amber-400 via-orange-500 to-pink-500"
      />
    </div>
  );
}
