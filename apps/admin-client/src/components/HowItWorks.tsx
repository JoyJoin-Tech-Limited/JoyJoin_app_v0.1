import { Card, CardContent } from "@/components/ui/card";
import { UserCircle, Sparkles, Calendar, MessageCircle } from "lucide-react";

const steps = [
  {
    icon: UserCircle,
    title: "Create Your Vibe Profile",
    description: "Take a quick 3-5 minute quiz about your personality, interests, and social preferences."
  },
  {
    icon: Sparkles,
    title: "Get AI-Matched",
    description: "Our algorithm finds events and people that align with your energy and interests."
  },
  {
    icon: Calendar,
    title: "Attend Small Events",
    description: "Join curated gatherings with 5-10 like-minded people in safe, welcoming spaces."
  },
  {
    icon: MessageCircle,
    title: "Build Connections",
    description: "Make meaningful friendships and discover your local community."
  }
];

export default function HowItWorks() {
  return (
    <section className="py-16" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Four simple steps to finding your community
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <Card key={i} className="relative border-0 bg-card/50">
                <CardContent className="pt-6">
                  <div className="absolute -top-4 left-6 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 mt-2">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
