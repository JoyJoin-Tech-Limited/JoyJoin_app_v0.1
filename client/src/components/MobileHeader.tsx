import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import JoyJoinLogo from "./JoyJoinLogo";

interface MobileHeaderProps {
  title?: string;
  showLogo?: boolean;
  showSettings?: boolean;
  action?: React.ReactNode;
}

export default function MobileHeader({ 
  title,
  showLogo = false,
  showSettings = false,
  action
}: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b">
      <div className="flex items-center justify-between h-14 px-4">
        {showLogo ? (
          <JoyJoinLogo size="sm" />
        ) : (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
        <div className="flex items-center gap-2">
          {action}
          {showSettings && (
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
