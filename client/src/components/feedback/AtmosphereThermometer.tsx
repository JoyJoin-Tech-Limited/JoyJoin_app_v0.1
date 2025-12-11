import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { ThermometerSun, Frown, Meh, Smile, Heart } from "lucide-react";

interface AtmosphereThermometerProps {
  initialScore?: number;
  initialNote?: string;
  onNext: (data: { atmosphereScore: number; atmosphereNote?: string }) => void;
}

const ATMOSPHERE_LABELS = [
  { value: 1, Icon: Frown, label: "尴尬", description: "气氛不太好", color: "text-destructive" },
  { value: 2, Icon: Meh, label: "平淡", description: "感觉还行", color: "text-warning" },
  { value: 3, Icon: Smile, label: "舒适", description: "挺愉快的", color: "text-primary" },
  { value: 4, Icon: Heart, label: "热烈", description: "非常开心", color: "text-primary" },
  { value: 5, Icon: ThermometerSun, label: "完美", description: "太棒了！", color: "text-primary" },
];

export default function AtmosphereThermometer({ 
  initialScore = 3, 
  initialNote = "", 
  onNext 
}: AtmosphereThermometerProps) {
  const [score, setScore] = useState(initialScore);
  const [note, setNote] = useState(initialNote);

  const currentLabel = ATMOSPHERE_LABELS.find(l => l.value === score) || ATMOSPHERE_LABELS[2];

  // Calculate thermometer fill percentage (0-100%)
  const fillPercentage = ((score - 1) / 4) * 100;

  // Get color based on score
  const getColor = (value: number) => {
    if (value <= 2) return "hsl(var(--destructive))";
    if (value === 3) return "hsl(var(--warning))";
    return "hsl(var(--primary))";
  };

  const handleSubmit = () => {
    onNext({ 
      atmosphereScore: score, 
      atmosphereNote: note.trim() || undefined 
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              key={score}
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, ease: "backOut" }}
              className="flex justify-center"
            >
              <currentLabel.Icon className={`h-8 w-8 ${currentLabel.color}`} />
            </motion.div>
            <motion.h2 
              className="text-xl font-bold"
              key={`${score}-label`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              现场氛围如何？
            </motion.h2>
            <motion.p 
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              滑动描述你的感受
            </motion.p>
          </div>

          {/* Thermometer Visualization */}
          <div className="space-y-4">
            {/* Thermometer Bar */}
            <div className="relative h-12 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{ backgroundColor: getColor(score) }}
                initial={{ width: "0%" }}
                animate={{ width: `${fillPercentage}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-foreground mix-blend-difference">
                  {currentLabel.label}
                </span>
              </div>
            </div>

            {/* Slider */}
            <Slider
              value={[score]}
              onValueChange={(values) => setScore(values[0])}
              min={1}
              max={5}
              step={1}
              className="w-full"
              data-testid="slider-atmosphere"
            />

            {/* Labels */}
            <div className="flex justify-between text-xs px-2">
              {ATMOSPHERE_LABELS.map((label) => (
                <div key={label.value} className="text-center">
                  <label.Icon className={`h-4 w-4 mx-auto mb-1 ${score === label.value ? label.color : 'text-muted-foreground'}`} />
                  <span className={score === label.value ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                    {label.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Current Selection Display */}
          <motion.div
            key={score}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="text-center p-4 rounded-lg bg-primary/5 border border-primary/10"
          >
            <p className="text-sm font-medium text-primary">
              {currentLabel.description}
            </p>
          </motion.div>

          {/* Optional Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              补充说明（可选）
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="有什么特别想说的吗？"
              rows={3}
              maxLength={200}
              className="resize-none"
              data-testid="textarea-atmosphere-note"
            />
            <p className="text-xs text-muted-foreground text-right">
              {note.length}/200
            </p>
          </div>

          {/* Next Button */}
          <Button 
            onClick={handleSubmit} 
            size="lg" 
            className="w-full"
            data-testid="button-next-atmosphere"
          >
            下一步
          </Button>
        </CardContent>
      </Card>

      {/* Insight Card */}
      {score >= 4 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground"
        >
          💡 {((score / 5) * 100).toFixed(0)}% 用户同感
        </motion.div>
      )}
    </div>
  );
}
