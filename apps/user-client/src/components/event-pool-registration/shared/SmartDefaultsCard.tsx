import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface SmartDefaultsCardProps {
  districts: string[];
  languages: string[];
  eventSpecificDefaults: string[];
  onCustomize: () => void;
}

export default function SmartDefaultsCard({ 
  districts, 
  languages, 
  eventSpecificDefaults,
  onCustomize 
}: SmartDefaultsCardProps) {
  const allDefaults = [...districts, ...languages, ...eventSpecificDefaults];
  const displayDefaults = allDefaults.slice(0, 5);
  const hasMore = allDefaults.length > 5;

  return (
    <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-xl p-4 border border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">智能推荐</h3>
      </div>
      
      <p className="text-xs text-muted-foreground mb-3">
        根据活动位置和您的偏好，已为您预选以下选项
      </p>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {displayDefaults.map((item, index) => (
          <Badge 
            key={index} 
            variant="secondary"
            className="bg-primary/10 text-primary border-primary/20"
          >
            {item}
          </Badge>
        ))}
        {hasMore && (
          <Badge variant="outline" className="text-muted-foreground">
            +{allDefaults.length - 5} 更多
          </Badge>
        )}
      </div>
      
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCustomize}
        className="w-full"
      >
        自定义偏好
      </Button>
    </div>
  );
}
