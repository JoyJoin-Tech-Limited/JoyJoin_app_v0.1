import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface LocationSelectorProps {
  selectedCity: "香港" | "深圳";
  onCityChange: (city: "香港" | "深圳") => void;
}

const cityConfig = {
  "深圳": {
    flag: "🏙️",
    label: "深圳 试点城市"
  },
  "香港": {
    flag: "🇭🇰",
    label: "香港 特别行政区"
  }
};

export default function LocationSelector({ selectedCity, onCityChange }: LocationSelectorProps) {
  const config = cityConfig[selectedCity];
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-1.5 px-3 h-8 hover-elevate active-elevate-2"
          data-testid="button-location-selector"
        >
          <span className="text-base">{config.flag}</span>
          <span className="text-sm font-medium text-primary">{selectedCity}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]" data-testid="menu-location-options">
        <DropdownMenuItem 
          onClick={() => onCityChange("深圳")}
          className="gap-2 cursor-pointer hover-elevate"
          data-testid="menu-item-shenzhen"
        >
          <span className="text-base">🏙️</span>
          <span className="flex-1 text-sm">{cityConfig["深圳"].label}</span>
          {selectedCity === "深圳" && (
            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
              当前
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onCityChange("香港")}
          className="gap-2 cursor-pointer hover-elevate"
          data-testid="menu-item-hongkong"
        >
          <span className="text-base">🇭🇰</span>
          <span className="flex-1 text-sm">{cityConfig["香港"].label}</span>
          {selectedCity === "香港" && (
            <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white text-xs">
              当前
            </Badge>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
