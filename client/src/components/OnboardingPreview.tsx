import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const interests = [
  "Coffee Chats", "Board Games", "Hiking", "Art & Culture", 
  "Food & Drinks", "Tech & Startups", "Fitness", "Music"
];

export default function OnboardingPreview() {
  const [energyLevel, setEnergyLevel] = useState([50]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Step 1 of 5</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(step => (
              <div 
                key={step}
                className={`h-1.5 w-8 rounded-full ${step === 1 ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>
        <CardTitle className="text-2xl font-display">What's your vibe?</CardTitle>
        <p className="text-muted-foreground">Help us understand your social energy and interests</p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base">Energy Level</Label>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Introvert</span>
            <Slider
              value={energyLevel}
              onValueChange={setEnergyLevel}
              max={100}
              step={1}
              className="flex-1"
              data-testid="slider-energy-level"
            />
            <span className="text-sm text-muted-foreground">Extrovert</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-base">Interests (Select all that apply)</Label>
          <div className="flex flex-wrap gap-2">
            {interests.map(interest => (
              <Badge
                key={interest}
                variant={selectedInterests.includes(interest) ? "default" : "outline"}
                className="cursor-pointer hover-elevate active-elevate-2 px-4 py-2"
                onClick={() => toggleInterest(interest)}
                data-testid={`badge-interest-${interest.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {interest}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" data-testid="button-onboarding-back">
            Back
          </Button>
          <Button className="flex-1" data-testid="button-onboarding-next">
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
