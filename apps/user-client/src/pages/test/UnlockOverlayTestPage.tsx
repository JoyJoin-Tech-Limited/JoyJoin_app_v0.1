/**
 * Visual test for UnlockOverlay component
 * Run: npm run dev:user and navigate to /test/unlock-overlay
 */

import { useState } from "react";
import { UnlockOverlay } from "@/components/UnlockOverlay";
import { getArchetypeColorHSL } from "@/components/slot-machine/archetypeData";
import { Button } from "@/components/ui/button";

const ARCHETYPES = [
  "开心柯基",
  "太阳鸡",
  "夸夸豚",
  "机智狐",
  "淡定海豚",
  "织网蛛",
  "暖心熊",
  "灵感章鱼",
  "沉思猫头鹰",
  "定心大象",
  "稳如龟",
  "隐身猫",
];

export default function UnlockOverlayTestPage() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [currentArchetype, setCurrentArchetype] = useState(ARCHETYPES[0]);

  const handleTest = (archetype: string) => {
    setCurrentArchetype(archetype);
    setShowOverlay(true);
  };

  const handleComplete = () => {
    setShowOverlay(false);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">UnlockOverlay Test Page</h1>
          <p className="text-muted-foreground">
            Click on any archetype to test the unlock overlay animation
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ARCHETYPES.map((archetype) => (
            <Button
              key={archetype}
              variant="outline"
              className="h-auto py-4"
              onClick={() => handleTest(archetype)}
            >
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {archetype}
                </div>
                <div className="text-xs text-muted-foreground">
                  Click to test
                </div>
              </div>
            </Button>
          ))}
        </div>

        <div className="border rounded-lg p-6 bg-muted/30">
          <h2 className="text-lg font-semibold mb-4">Animation Info</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Duration:</strong> 2.5 seconds</p>
            <p><strong>Avatar animation:</strong> Scale 0→1, Rotate -180°→0°</p>
            <p><strong>Text reveal:</strong> 300ms delay, fade in from bottom</p>
            <p><strong>Particle burst:</strong> 40 particles with explosion effect</p>
            <p><strong>Glow effects:</strong> Radial gradient with shimmer</p>
          </div>
        </div>
      </div>

      {showOverlay && (
        <UnlockOverlay
          archetype={currentArchetype}
          accentColor={getArchetypeColorHSL(currentArchetype)}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
