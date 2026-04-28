import { useState } from "react";
import ArchetypeOrbit from "@/components/ArchetypeOrbit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestArchetypeOrbit() {
  const [animated, setAnimated] = useState(false);
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");
  const [showRevealOverlay, setShowRevealOverlay] = useState(false);
  
  const testArchetypes = [
    "corgi",
    "fox",
    "koala",
    "spider",
    "hamster_praise",
    "rooster"
  ];
  
  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <h1 className="text-2xl font-bold">ArchetypeOrbit Component Test</h1>
      
      <div className="flex gap-4">
        <Button 
          onClick={() => setAnimated(!animated)}
          variant={animated ? "default" : "outline"}
        >
          {animated ? "Animated" : "Static"}
        </Button>
        
        <Button 
          onClick={() => setSize("small")}
          variant={size === "small" ? "default" : "outline"}
        >
          Small
        </Button>
        
        <Button 
          onClick={() => setSize("medium")}
          variant={size === "medium" ? "default" : "outline"}
        >
          Medium
        </Button>
        
        <Button 
          onClick={() => setSize("large")}
          variant={size === "large" ? "default" : "outline"}
        >
          Large
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>6 Archetypes</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center bg-muted/20 rounded-lg">
          <ArchetypeOrbit
            archetypes={testArchetypes}
            size={size}
            animated={animated}
            onAnimationComplete={() => console.log("Animation complete!")}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>4 Archetypes</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center bg-muted/20 rounded-lg">
          <ArchetypeOrbit
            archetypes={testArchetypes.slice(0, 4)}
            size={size}
            animated={animated}
          />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Reveal Animation (Click to Trigger)</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => setShowRevealOverlay(true)}
            className="w-full"
          >
            Show Reveal Overlay
          </Button>
          
          {showRevealOverlay && (
            <div 
              className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 cursor-pointer"
              onClick={() => setShowRevealOverlay(false)}
            >
              <div className="text-center space-y-8 max-w-md w-full">
                <h2 className="text-2xl font-bold animate-fadeIn">
                  🎉 匹配成功！
                </h2>
                
                <ArchetypeOrbit
                  archetypes={testArchetypes}
                  size="large"
                  animated={true}
                  onAnimationComplete={() => console.log("Reveal complete!")}
                />
                
                <p className="text-sm text-muted-foreground animate-fadeIn">
                  点击任意位置继续
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
