import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, Heart, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { archetypeConfig } from "@/lib/archetypes";
import { 
  getGenderDisplay, 
  formatAge, 
  getEducationDisplay
} from "@/lib/userFieldMappings";

interface Attendee {
  userId: string;
  displayName: string;
  archetype?: string;
  gender?: string;
  age?: number;
  educationLevel?: string;
  industry?: string;
  relationshipStatus?: string;
}

interface SelectConnectionsStepProps {
  attendees: Attendee[];
  initialConnections?: string[];
  onNext: (data: { connections: string[] }) => void;
}


export default function SelectConnectionsStep({
  attendees,
  initialConnections = [],
  onNext,
}: SelectConnectionsStepProps) {
  const [selectedConnections, setSelectedConnections] = useState<string[]>(initialConnections);

  const toggleSelection = (userId: string) => {
    setSelectedConnections(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSubmit = () => {
    onNext({ connections: selectedConnections });
  };

  const selectionCount = selectedConnections.length;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div 
              className="flex justify-center"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Heart className="h-8 w-8 text-primary fill-primary" />
            </motion.div>
            <motion.h2 
              className="text-xl font-bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              选择想继续联系的人
            </motion.h2>
            <motion.p 
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              只有双方互选才会解锁1对1私聊，保护你的隐私
            </motion.p>
          </div>

          {/* Info Banner */}
          <motion.div 
            className="bg-primary/5 border border-primary/20 rounded-lg p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-start gap-3">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Lock className="h-5 w-5 text-primary mt-0.5" />
              </motion.div>
              <div className="flex-1 text-sm">
                <p className="font-medium text-primary mb-1">隐私保护机制</p>
                <p className="text-muted-foreground leading-relaxed">
                  对方不会知道你选了Ta，除非Ta也选了你。只有双向匹配才解锁私聊，避免尴尬和骚扰。
                </p>
              </div>
            </div>
          </motion.div>

          {/* Attendee Selection */}
          <div className="space-y-3">
            {attendees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">没有其他参与者</p>
              </div>
            ) : (
              attendees.map((attendee) => {
                const isSelected = selectedConnections.includes(attendee.userId);
                const archetypeData = attendee.archetype && archetypeConfig[attendee.archetype]
                  ? archetypeConfig[attendee.archetype]
                  : { icon: "✨", bgColor: "bg-muted" };

                // Build info chips
                const infoChips: string[] = [];
                if (attendee.gender && attendee.age) {
                  infoChips.push(`${getGenderDisplay(attendee.gender)} · ${formatAge(attendee.age)}`);
                } else if (attendee.gender) {
                  infoChips.push(getGenderDisplay(attendee.gender));
                } else if (attendee.age) {
                  infoChips.push(formatAge(attendee.age));
                }
                
                if (attendee.educationLevel) {
                  infoChips.push(getEducationDisplay(attendee.educationLevel));
                }
                
                if (attendee.industry) {
                  infoChips.push(attendee.industry);
                }

                return (
                  <motion.button
                    key={attendee.userId}
                    onClick={() => toggleSelection(attendee.userId)}
                    className={`w-full border-2 rounded-lg p-4 transition-all hover-elevate active-elevate-2 ${
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border"
                    }`}
                    whileTap={{ scale: 0.98 }}
                    data-testid={`select-connection-${attendee.userId}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar with Archetype Icon */}
                      <div className="relative flex-shrink-0">
                        <div className={`h-14 w-14 rounded-full ${archetypeData.bgColor} flex items-center justify-center text-2xl`}>
                          {archetypeData.icon}
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full flex items-center justify-center"
                          >
                            <Check className="h-3 w-3 text-white" />
                          </motion.div>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-medium truncate">
                          {attendee.displayName || "参与者"}
                        </div>
                        
                        {attendee.archetype && (
                          <div className="mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {attendee.archetype}
                            </Badge>
                          </div>
                        )}
                        
                        {infoChips.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {infoChips.map((chip, idx) => (
                              <span 
                                key={idx} 
                                className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Selection Indicator */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                        isSelected 
                          ? "border-primary bg-primary" 
                          : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="h-4 w-4 text-white" />}
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Selection Counter */}
          {selectionCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Badge variant="secondary" className="text-sm px-4 py-1.5">
                已选择 {selectionCount} 位参与者
              </Badge>
            </motion.div>
          )}

          {/* Helpful Tip */}
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              💡 小贴士：可以选择多位参与者，也可以一个都不选。双向匹配成功后会收到通知～
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Next Button */}
      <Button
        onClick={handleSubmit}
        className="w-full"
        size="lg"
        data-testid="button-next-connections"
      >
        {selectionCount > 0 ? `继续（已选${selectionCount}位）` : "跳过此步"}
      </Button>
    </div>
  );
}
