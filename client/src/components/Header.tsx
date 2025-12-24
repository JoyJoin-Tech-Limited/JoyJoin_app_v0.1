import { Button } from "@/components/ui/button";
import ThemeToggle from "./ThemeToggle";
import { Sparkles } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-xl font-display font-bold">Vibe</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          <a href="#events" className="text-sm font-medium hover-elevate px-3 py-2 rounded-md transition-colors" data-testid="link-events">
            Events
          </a>
          <a href="#how-it-works" className="text-sm font-medium hover-elevate px-3 py-2 rounded-md transition-colors" data-testid="link-how-it-works">
            How It Works
          </a>
          <a href="#community" className="text-sm font-medium hover-elevate px-3 py-2 rounded-md transition-colors" data-testid="link-community">
            Community
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" className="hidden md:inline-flex" data-testid="button-login">
            Log In
          </Button>
          <Button data-testid="button-get-started">Get Started</Button>
        </div>
      </div>
    </header>
  );
}
