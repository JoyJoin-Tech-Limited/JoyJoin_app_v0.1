import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MapPin, Navigation, X, Loader2, Check, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { getCurrentLocation } from "@/lib/gpsUtils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shenzhenClusters } from "@/lib/districts";

interface LocationPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCity: "香港" | "深圳";
  selectedArea?: string;
  onSave: (city: "香港" | "深圳", area: string) => void;
}

export default function LocationPickerSheet({ 
  open, 
  onOpenChange, 
  selectedCity,
  selectedArea,
  onSave 
}: LocationPickerSheetProps) {
  const { toast } = useToast();
  const [tempCity, setTempCity] = useState<"香港" | "深圳">(selectedCity);
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (selectedArea) {
      const cluster = shenzhenClusters.find(c => 
        c.name === selectedArea || 
        c.displayName === selectedArea ||
        c.districts.some(d => d.name === selectedArea)
      );
      if (cluster) {
        setSelectedClusterId(cluster.id);
      }
    }
  }, [selectedArea]);

  const handleGetLocation = async () => {
    setIsLocating(true);
    const result = await getCurrentLocation();
    setIsLocating(false);

    if (result.success && result.city) {
      setTempCity(result.city);
      
      if (result.city === "深圳" && result.cluster) {
        setSelectedClusterId(result.cluster);
        const cluster = shenzhenClusters.find(c => c.id === result.cluster);
        toast({
          title: "定位成功",
          description: `已选择：${result.city} · ${cluster?.displayName || cluster?.name}`,
        });
        return;
      }
      
      toast({
        title: "定位成功",
        description: `当前位置：${result.city}，请选择片区`,
      });
    } else {
      toast({
        title: "定位失败",
        description: result.error || "无法获取当前位置",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    if (tempCity === "深圳") {
      const cluster = shenzhenClusters.find(c => c.id === selectedClusterId);
      onSave(tempCity, cluster?.displayName || cluster?.name || "");
    } else {
      onSave(tempCity, "");
    }
    onOpenChange(false);
  };

  const selectedCluster = shenzhenClusters.find(c => c.id === selectedClusterId);
  const selectedDisplayName = tempCity === "深圳" 
    ? (selectedCluster?.displayName || selectedCluster?.name || "未选择")
    : "香港";

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content 
          className="bg-background flex flex-col rounded-t-[20px] h-[75vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none"
          data-testid="drawer-location-picker"
        >
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-4" />
          
          <div className="flex items-center justify-between px-4 py-4 border-b">
            <Drawer.Title className="text-xl font-bold" data-testid="text-picker-title">
              选择城市
            </Drawer.Title>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              data-testid="button-close-picker"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-5">
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">当前选择</div>
                  <div className="text-xs text-muted-foreground">
                    {tempCity} · {selectedDisplayName}
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1"
                onClick={handleGetLocation}
                disabled={isLocating}
                data-testid="button-use-current-location"
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                {isLocating ? "定位中..." : "定位"}
              </Button>
            </div>

            <Tabs value={tempCity} onValueChange={(v) => {
              setTempCity(v as "香港" | "深圳");
              setSelectedClusterId("");
            }}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="深圳" data-testid="tab-shenzhen">
                  深圳
                </TabsTrigger>
                <TabsTrigger value="香港" data-testid="tab-hongkong">
                  香港
                </TabsTrigger>
              </TabsList>

              <TabsContent value="深圳" className="mt-4 space-y-3">
                {shenzhenClusters.map(cluster => {
                  const isSelected = selectedClusterId === cluster.id;
                  const hotCount = cluster.districts.filter(d => d.heat === 'hot').length;
                  
                  return (
                    <Card
                      key={cluster.id}
                      onClick={() => setSelectedClusterId(cluster.id)}
                      className={`
                        relative p-4 cursor-pointer transition-all
                        ${isSelected 
                          ? 'ring-2 ring-primary bg-primary/5' 
                          : 'hover-elevate'
                        }
                      `}
                      data-testid={`card-cluster-${cluster.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold">{cluster.displayName}</h3>
                            {hotCount > 0 && (
                              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                {hotCount}个热门商圈
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {cluster.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {cluster.districts.map(district => (
                              <Badge 
                                key={district.id} 
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {district.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className={`
                          flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center
                          ${isSelected 
                            ? 'bg-primary border-primary' 
                            : 'border-muted-foreground/30'
                          }
                        `}>
                          {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
                        </div>
                      </div>
                    </Card>
                  );
                })}

                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mt-4">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    更多片区（罗湖、龙岗、宝安...）即将开放
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="香港" className="mt-4">
                <Card className="p-6 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">香港</h3>
                      <p className="text-sm text-muted-foreground">
                        香港地区即将开放，敬请期待
                      </p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="border-t p-4 flex gap-2 flex-shrink-0 bg-background">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setSelectedClusterId("")}
              data-testid="button-reset"
            >
              重置
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSave}
              disabled={tempCity === "深圳" && !selectedClusterId}
              data-testid="button-save-location"
            >
              确认选择
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
