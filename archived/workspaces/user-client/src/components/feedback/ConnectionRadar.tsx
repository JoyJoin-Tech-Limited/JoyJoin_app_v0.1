import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface RadarData {
  topicResonance: number;
  personalityMatch: number;
  backgroundDiversity: number;
  overallFit: number;
}

interface ConnectionRadarProps {
  initialRadar?: RadarData;
  initialHasConnections?: boolean;
  initialConnectionStatus?: string;
  onNext: (data: {
    connectionRadar: RadarData;
    hasNewConnections?: boolean;
    connectionStatus?: string;
  }) => void;
}

const DEFAULT_RADAR: RadarData = {
  topicResonance: 3,
  personalityMatch: 3,
  backgroundDiversity: 3,
  overallFit: 3,
};

const RADAR_DIMENSIONS = [
  { key: "topicResonance" as keyof RadarData, label: "话题共鸣度", emoji: "💬" },
  { key: "personalityMatch" as keyof RadarData, label: "性格匹配度", emoji: "🎭" },
  { key: "backgroundDiversity" as keyof RadarData, label: "背景多样性", emoji: "🌍" },
  { key: "overallFit" as keyof RadarData, label: "整体契合感", emoji: "✨" },
];

const CONNECTION_OPTIONS = [
  { value: "已交换联系方式", label: "有，已交换联系方式", emoji: "📱" },
  { value: "有但还没联系", label: "有，但还没联系", emoji: "👋" },
  { value: "没有但很愉快", label: "没有，但很愉快", emoji: "😊" },
  { value: "没有不太合适", label: "没有，不太合适", emoji: "🤔" },
];

export default function ConnectionRadar({
  initialRadar = DEFAULT_RADAR,
  initialHasConnections,
  initialConnectionStatus,
  onNext,
}: ConnectionRadarProps) {
  const [radar, setRadar] = useState<RadarData>(initialRadar);
  const [connectionStatus, setConnectionStatus] = useState<string | undefined>(initialConnectionStatus);

  const updateDimension = (key: keyof RadarData, value: number) => {
    setRadar(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const hasConnections = connectionStatus === "已交换联系方式" || connectionStatus === "有但还没联系";
    
    onNext({
      connectionRadar: radar,
      hasNewConnections: hasConnections,
      connectionStatus,
    });
  };

  const averageScore = (
    (radar.topicResonance + radar.personalityMatch + radar.backgroundDiversity + radar.overallFit) / 4
  ).toFixed(1);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-4xl">📡</div>
            <h2 className="text-xl font-bold">社交连接度</h2>
            <p className="text-sm text-muted-foreground">这桌伙伴的匹配度如何？</p>
          </div>

          {/* Radar Dimensions */}
          <div className="space-y-6">
            {RADAR_DIMENSIONS.map((dimension) => (
              <div key={dimension.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{dimension.emoji}</span>
                    <span className="text-sm font-medium">{dimension.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(radar[dimension.key])].map((_, i) => (
                      <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                    ))}
                    <span className="text-sm text-muted-foreground ml-1">
                      {radar[dimension.key]}/5
                    </span>
                  </div>
                </div>

                {/* Star Rating */}
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => updateDimension(dimension.key, value)}
                      className="flex-1 h-10 rounded-lg border hover-elevate active-elevate-2 transition-all"
                      data-testid={`star-${dimension.key}-${value}`}
                    >
                      <Star
                        className={`h-5 w-5 mx-auto ${
                          value <= radar[dimension.key]
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Average Score Display */}
          <motion.div
            key={averageScore}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center"
          >
            <p className="text-sm text-muted-foreground mb-1">平均评分</p>
            <p className="text-3xl font-bold text-primary">{averageScore}</p>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[...Array(Math.round(parseFloat(averageScore)))].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-primary text-primary" />
              ))}
            </div>
          </motion.div>

          {/* Connection Status */}
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm font-medium">请选择希望继续保持联系的人</p>
            <RadioGroup 
              value={connectionStatus} 
              onValueChange={setConnectionStatus}
              data-testid="radio-connection-status"
            >
              {CONNECTION_OPTIONS.map((option) => (
                <div 
                  key={option.value} 
                  className="flex items-center gap-3 p-3 rounded-lg border hover-elevate active-elevate-2 transition-all cursor-pointer"
                  onClick={() => setConnectionStatus(option.value)}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span>{option.emoji}</span>
                      <span className="text-sm">{option.label}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Next Button */}
          <Button 
            onClick={handleSubmit} 
            size="lg" 
            className="w-full"
            disabled={!connectionStatus}
            data-testid="button-next-radar"
          >
            下一步
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
