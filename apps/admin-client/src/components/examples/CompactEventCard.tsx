import CompactEventCard from '../CompactEventCard';

export default function CompactEventCardExample() {
  return (
    <div className="max-w-md p-4">
      <CompactEventCard
        title="Sunday Coffee & Conversations"
        date="Oct 15"
        time="10:00 AM"
        location="Bean & Brew Cafe, Downtown"
        attendees={[
          { name: "Sarah J", initials: "SJ" },
          { name: "Mike C", initials: "MC" },
          { name: "Emma D", initials: "ED" }
        ]}
        spotsLeft={3}
        matchScore={92}
        imageGradient="from-amber-400 via-orange-500 to-pink-500"
      />
    </div>
  );
}
