import AttendeeAvatars from '../AttendeeAvatars';

export default function AttendeeAvatarsExample() {
  const attendees = [
    { name: "Sarah Johnson", initials: "SJ" },
    { name: "Michael Chen", initials: "MC" },
    { name: "Emma Davis", initials: "ED" },
    { name: "Alex Rivera", initials: "AR" },
    { name: "Jamie Lee", initials: "JL" },
    { name: "Taylor Kim", initials: "TK" }
  ];

  return <AttendeeAvatars attendees={attendees} maxDisplay={4} />;
}
