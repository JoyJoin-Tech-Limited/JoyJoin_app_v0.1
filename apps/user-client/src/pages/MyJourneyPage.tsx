import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { Sparkles } from "lucide-react";

/**
 * Empty state page shown when user has no active events or pending matches
 * Displayed when user taps center button but has no current activity
 */
export default function MyJourneyPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  const archetypeAvatar = user?.archetype 
    ? getArchetypeAvatar(user.archetype) 
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Ambient glow effects */}
      <div 
        className="fixed top-0 left-0 w-[300px] h-[300px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(224, 170, 255, 0.4) 0%, transparent 70%)",
          transform: "translate(-100px, -100px)",
        }}
      />
      <div 
        className="fixed bottom-0 right-0 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(123, 44, 191, 0.1) 0%, transparent 70%)",
          transform: "translate(100px, 150px)",
        }}
      />

      <div className="relative max-w-md w-full text-center space-y-6 z-10">
        {/* Mascot graphic */}
        <div className="flex justify-center mb-4">
          {archetypeAvatar ? (
            <img 
              src={archetypeAvatar} 
              alt="你的人格原型" 
              className="h-40 w-40 object-contain"
            />
          ) : (
            <div className="h-40 w-40 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Sparkles className="h-20 w-20 text-primary" />
            </div>
          )}
        </div>

        {/* Empty state text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">
            你还没有参加活动哦！
          </h1>
          <p className="text-sm font-medium text-muted-foreground">
            点击下方开始你的第一场盲盒社交冒险 🎁
          </p>
        </div>

        {/* CTA button */}
        <Button
          onClick={() => setLocation("/")}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          <Sparkles className="h-5 w-5 mr-2" />
          立即探索活动
        </Button>

        {/* Sub-text */}
        <p className="text-xs text-muted-foreground">
          加入盲盒活动，遇见有趣的灵魂
        </p>
      </div>
    </div>
  );
}
