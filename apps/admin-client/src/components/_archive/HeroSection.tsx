import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Heart, Sparkles } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10" />
      
      <div className="container mx-auto px-4 py-24 md:py-32 relative">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            AI-Powered Matchmaking
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight">
            Find Your People,
            <br />
            <span className="text-primary">One Vibe at a Time</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Join curated micro-events with 5-10 like-minded locals. Our AI matches you with people who share your energy, interests, and social vibe.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="text-base px-8" data-testid="button-hero-get-started">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-hero-how-it-works">
              How It Works
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">5-10 People</div>
                <div className="text-muted-foreground">Perfect group size</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">AI Matching</div>
                <div className="text-muted-foreground">Find your vibe</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Safe & Inclusive</div>
                <div className="text-muted-foreground">Curated experiences</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
