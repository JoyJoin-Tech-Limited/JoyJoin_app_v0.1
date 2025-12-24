import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { MapPin, X, Clock, Check, Flame, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  shenzhenClusters, 
  heatConfig,
  type DistrictCluster
} from "@shared/districts";

interface LocationPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCity: "香港" | "深圳";
  selectedArea?: string;
  onSave: (city: "香港" | "深圳", area: string) => void;
}

function HeatIcon({ iconName, className }: { iconName: 'flame' | 'zap' | 'none'; className?: string }) {
  if (iconName === 'flame') return <Flame className={`h-3 w-3 ${className}`} />;
  if (iconName === 'zap') return <Zap className={`h-3 w-3 ${className}`} />;
  return null;
}

// 香港片区
const hongkongClusters = [
  { id: 'hkisland', displayName: '港岛', heat: 'hot' as const },
  { id: 'kowloon', displayName: '九龙', heat: 'hot' as const },
];

// 最近使用的片区（可以后续从localStorage读取）
const recentClusters = ['nanshan', 'futian'];

export default function LocationPickerSheet({ 
  open, 
  onOpenChange, 
  selectedCity,
  selectedArea,
  onSave 
}: LocationPickerSheetProps) {
  const [tempCity, setTempCity] = useState<"香港" | "深圳">(selectedCity);
  const [tempClusterId, setTempClusterId] = useState<string>("");

  useEffect(() => {
    if (selectedArea) {
      // 根据 displayName 或 id 匹配片区
      const cluster = shenzhenClusters.find(c => 
        c.displayName === selectedArea || c.id === selectedArea
      );
      if (cluster) {
        setTempClusterId(cluster.id);
      }
    }
  }, [selectedArea]);

  const handleSave = () => {
    const cluster = shenzhenClusters.find(c => c.id === tempClusterId);
    // 保存片区的 displayName（如"南山区"）
    onSave(tempCity, cluster?.displayName || "");
    onOpenChange(false);
  };

  const handleSelectCluster = (clusterId: string) => {
    setTempClusterId(clusterId);
  };

  const selectedClusterName = shenzhenClusters.find(c => c.id === tempClusterId)?.displayName;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content 
          className="bg-background flex flex-col rounded-t-[20px] h-[70vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none"
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
            
            <Tabs value={tempCity} onValueChange={(v) => {
              setTempCity(v as "香港" | "深圳");
              setTempClusterId("");
            }}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="深圳" data-testid="tab-shenzhen">
                  深圳
                </TabsTrigger>
                <TabsTrigger value="香港" data-testid="tab-hongkong">
                  香港
                </TabsTrigger>
              </TabsList>

              <TabsContent value="深圳" className="mt-4 space-y-6">
                {/* 最近使用 */}
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Clock className="h-4 w-4" />
                    <span>最近使用</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentClusters.map(clusterId => {
                      const cluster = shenzhenClusters.find(c => c.id === clusterId);
                      if (!cluster) return null;
                      const isSelected = tempClusterId === cluster.id;
                      return (
                        <button
                          key={cluster.id}
                          onClick={() => handleSelectCluster(cluster.id)}
                          className={`
                            px-4 py-2 rounded-full text-sm font-medium
                            transition-all border-2
                            ${isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover-elevate'
                            }
                          `}
                          data-testid={`chip-recent-${cluster.id}`}
                        >
                          {cluster.displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 推荐商圈（片区卡片） */}
                <div>
                  <div className="text-sm text-muted-foreground mb-3">
                    推荐商圈
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {shenzhenClusters.map(cluster => {
                      const isSelected = tempClusterId === cluster.id;
                      const heat = cluster.id === 'nanshan' ? heatConfig.hot : heatConfig.hot;
                      return (
                        <button
                          key={cluster.id}
                          onClick={() => handleSelectCluster(cluster.id)}
                          className={`
                            relative p-4 rounded-xl text-left
                            transition-all border-2
                            ${isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover-elevate'
                            }
                          `}
                          data-testid={`card-cluster-${cluster.id}`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="font-medium text-base">{cluster.displayName}</span>
                            <span className={`
                              px-2 py-0.5 rounded text-xs font-medium
                              ${heat.iconName === 'flame' 
                                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' 
                                : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }
                            `}>
                              {heat.label}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-1 mt-2 text-primary text-sm">
                              <Check className="h-4 w-4" />
                              <span>已选择</span>
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* 更多片区（暂不开放） */}
                    <button
                      disabled
                      className="p-4 rounded-xl text-left border-2 border-dashed border-border bg-muted/30 opacity-60"
                      data-testid="card-cluster-luohu"
                    >
                      <span className="font-medium text-base text-muted-foreground">罗湖区</span>
                    </button>
                    <button
                      disabled
                      className="p-4 rounded-xl text-left border-2 border-dashed border-border bg-muted/30 opacity-60"
                      data-testid="card-cluster-baoan"
                    >
                      <span className="font-medium text-base text-muted-foreground">宝安区</span>
                    </button>
                    <button
                      disabled
                      className="p-4 rounded-xl text-left border-2 border-dashed border-border bg-muted/30 opacity-60"
                      data-testid="card-cluster-longgang"
                    >
                      <span className="font-medium text-base text-muted-foreground">龙岗区</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <MapPin className="h-4 w-4" />
                  <span>换个商圈看看，成局更快</span>
                </div>
              </TabsContent>

              <TabsContent value="香港" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {hongkongClusters.map(cluster => {
                    const heat = heatConfig[cluster.heat];
                    return (
                      <button
                        key={cluster.id}
                        disabled
                        className="p-4 rounded-xl text-left border-2 border-dashed border-border bg-muted/30 opacity-60"
                        data-testid={`card-cluster-${cluster.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-base text-muted-foreground">{cluster.displayName}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                            即将开放
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  香港区域即将开放
                </p>
              </TabsContent>
            </Tabs>
          </div>

          <div className="border-t p-4 flex gap-2 flex-shrink-0 bg-background">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setTempClusterId("")}
              data-testid="button-reset"
            >
              重置为全城
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSave}
              disabled={!tempClusterId}
              data-testid="button-save-location"
            >
              保存并刷新
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
