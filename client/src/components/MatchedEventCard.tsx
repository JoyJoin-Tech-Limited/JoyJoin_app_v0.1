import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, DollarSign, Users, Navigation, Share2 } from "lucide-react";
import type { BlindBoxEvent } from "@shared/schema";
import { getCurrencySymbol } from "@/lib/currency";
import { useLocation } from "wouter";

interface MatchedEventCardProps {
  event: BlindBoxEvent;
}

export default function MatchedEventCard({ event }: MatchedEventCardProps) {
  const [, setLocation] = useLocation();
  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");

  const formatDate = (dateTime: Date) => {
    const date = new Date(dateTime);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${weekday} ${hours}:${minutes}`;
  };

  const getCountdown = (dateTime: Date) => {
    const now = new Date();
    const eventDate = new Date(dateTime);
    const diff = eventDate.getTime() - now.getTime();
    
    if (diff <= 0) return "活动进行中";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `还剩 ${days}天 ${hours}小时`;
    } else {
      return `还剩 ${hours}小时`;
    }
  };

  const getParticipantInfo = () => {
    if (event.isGirlsNight) {
      return `${event.totalParticipants}人 Girls Night`;
    }
    if (event.maleCount && event.femaleCount) {
      return `${event.totalParticipants}人（${event.maleCount}男${event.femaleCount}女）`;
    }
    return `${event.totalParticipants}人`;
  };

  const handleNavigation = () => {
    if (event.restaurantLat && event.restaurantLng) {
      const restaurantName = encodeURIComponent(event.restaurantName || '目的地');
      
      // 深圳使用高德地图，香港使用Google Maps
      if (event.city === '深圳') {
        window.open(`https://uri.amap.com/navigation?to=${event.restaurantLng},${event.restaurantLat},${restaurantName}&mode=car&coordinate=gaode`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.restaurantLat},${event.restaurantLng}`, '_blank');
      }
    }
  };

  return (
    <Card 
      className="border shadow-sm hover-elevate active-elevate-2 cursor-pointer" 
      onClick={() => setLocation(`/blind-box-events/${event.id}`)}
      data-testid={`card-matched-${event.id}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* 标题和倒计时 */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold flex-1">{formatDate(event.dateTime)} · {event.eventType}</h3>
            {event.isGirlsNight && (
              <Badge className="text-xs bg-pink-500 hover:bg-pink-600">
                👭 Girls Night
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">{getCountdown(event.dateTime)}</span>
          </div>
        </div>

        {/* 人数与性别 */}
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{getParticipantInfo()}</span>
        </div>

        {/* 地点 */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{event.restaurantName}</span>
          </div>
          <div className="text-xs text-muted-foreground pl-6">
            {event.city}•{event.district}
          </div>
        </div>

        {/* 预算档 */}
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span>{currencySymbol}{event.budgetTier}</span>
        </div>

        {/* 菜式标签 */}
        {event.cuisineTags && event.cuisineTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.cuisineTags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              setLocation(`/blind-box-events/${event.id}`);
            }}
            data-testid={`button-view-details-${event.id}`}
          >
            查看详情
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleNavigation();
            }}
            data-testid={`button-navigation-${event.id}`}
          >
            <Navigation className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
