import FeatureCard from '../FeatureCard';
import { Sparkles, Users, Shield } from 'lucide-react';

export default function FeatureCardExample() {
  return (
    <div className="grid md:grid-cols-3 gap-6 max-w-5xl">
      <FeatureCard
        icon={Sparkles}
        title="AI-Powered Matching"
        description="Our algorithm analyzes your vibe profile to connect you with compatible people and events."
      />
      <FeatureCard
        icon={Users}
        title="Micro Events"
        description="Small groups of 5-10 people create intimate, meaningful connections."
      />
      <FeatureCard
        icon={Shield}
        title="Safe & Verified"
        description="All members are verified and events are hosted by trained facilitators."
      />
    </div>
  );
}
