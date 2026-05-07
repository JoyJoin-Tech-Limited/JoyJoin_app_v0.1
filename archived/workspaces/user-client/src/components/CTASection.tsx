import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-br from-primary/10 via-primary/5 to-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-5xl font-display font-bold">
            Ready to Find Your Tribe?
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of people who've discovered meaningful connections through Vibe.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button size="lg" className="text-base px-8" data-testid="button-cta-start">
              Start Your Journey
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" data-testid="button-cta-learn">
              Learn More
            </Button>
          </div>
          <p className="text-sm text-muted-foreground pt-4">
            Free to join • No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </section>
  );
}
