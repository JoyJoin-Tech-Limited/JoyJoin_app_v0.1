import EventCard from "./EventCard";
import { Coffee, Music, Gamepad2, Palette, BookOpen, Dumbbell } from "lucide-react";

//todo: remove mock functionality
const mockEvents = [
  {
    title: "Sunday Coffee & Conversations",
    date: "Oct 15",
    time: "10:00 AM",
    location: "Bean & Brew Cafe, Downtown",
    vibes: [
      { label: "Chill Vibes", icon: Coffee },
      { label: "Deep Talks" },
      { label: "Introverts Welcome" }
    ],
    attendees: [
      { name: "Sarah J", initials: "SJ" },
      { name: "Mike C", initials: "MC" },
      { name: "Emma D", initials: "ED" },
      { name: "Alex R", initials: "AR" }
    ],
    spotsLeft: 3,
    matchScore: 92,
    matchReason: "Love coffee chats + introverted energy + weekend mornings",
    imageGradient: "from-amber-400 via-orange-500 to-pink-500"
  },
  {
    title: "Indie Music Night",
    date: "Oct 18",
    time: "7:30 PM",
    location: "The Velvet Room",
    vibes: [
      { label: "Music Lovers", icon: Music },
      { label: "Creative Vibes" },
      { label: "Night Owls" }
    ],
    attendees: [
      { name: "Jordan K", initials: "JK" },
      { name: "Sam P", initials: "SP" },
      { name: "Casey L", initials: "CL" },
      { name: "Riley M", initials: "RM" },
      { name: "Morgan F", initials: "MF" }
    ],
    spotsLeft: 2,
    matchScore: 88,
    matchReason: "Indie music fan + evening availability + creative energy",
    imageGradient: "from-violet-500 via-purple-500 to-fuchsia-500"
  },
  {
    title: "Board Game Brunch",
    date: "Oct 20",
    time: "11:00 AM",
    location: "Game Haven Cafe",
    vibes: [
      { label: "Board Games", icon: Gamepad2 },
      { label: "Casual Fun" },
      { label: "Foodie Friendly" }
    ],
    attendees: [
      { name: "Taylor W", initials: "TW" },
      { name: "Jamie H", initials: "JH" },
      { name: "Quinn R", initials: "QR" }
    ],
    spotsLeft: 4,
    matchScore: 85,
    matchReason: "Strategy games + brunch lover + balanced social energy",
    imageGradient: "from-emerald-400 via-teal-500 to-cyan-500"
  },
  {
    title: "Art Gallery Walking Tour",
    date: "Oct 22",
    time: "2:00 PM",
    location: "Downtown Arts District",
    vibes: [
      { label: "Art & Culture", icon: Palette },
      { label: "Thoughtful Minds" },
      { label: "Afternoon Vibes" }
    ],
    attendees: [
      { name: "Avery B", initials: "AB" },
      { name: "Blake N", initials: "BN" },
      { name: "Drew S", initials: "DS" },
      { name: "Finley T", initials: "FT" }
    ],
    spotsLeft: 3,
    matchScore: 90,
    matchReason: "Art appreciation + curious mindset + weekend afternoons",
    imageGradient: "from-rose-400 via-pink-500 to-purple-500"
  },
  {
    title: "Book Club & Tea",
    date: "Oct 24",
    time: "4:00 PM",
    location: "Cozy Corner Bookshop",
    vibes: [
      { label: "Book Lovers", icon: BookOpen },
      { label: "Quiet Gathering" },
      { label: "Tea Enthusiasts" }
    ],
    attendees: [
      { name: "Harper L", initials: "HL" },
      { name: "Sage M", initials: "SM" },
      { name: "River P", initials: "RP" }
    ],
    spotsLeft: 5,
    matchScore: 87,
    matchReason: "Fiction reader + cozy settings + intellectual conversations",
    imageGradient: "from-amber-300 via-yellow-400 to-orange-400"
  },
  {
    title: "Morning Yoga & Smoothies",
    date: "Oct 25",
    time: "8:00 AM",
    location: "Sunrise Wellness Studio",
    vibes: [
      { label: "Fitness", icon: Dumbbell },
      { label: "Wellness" },
      { label: "Early Birds" }
    ],
    attendees: [
      { name: "Phoenix K", initials: "PK" },
      { name: "Skylar J", initials: "SJ" },
      { name: "Rowan D", initials: "RD" },
      { name: "Kai W", initials: "KW" }
    ],
    spotsLeft: 2,
    matchScore: 83,
    matchReason: "Wellness focus + morning person + balanced lifestyle",
    imageGradient: "from-lime-400 via-green-500 to-emerald-500"
  }
];

export default function EventFeed() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              Events Picked Just for You
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our AI analyzed your vibe profile and found these perfect matches
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockEvents.map((event, i) => (
              <EventCard key={i} {...event} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
