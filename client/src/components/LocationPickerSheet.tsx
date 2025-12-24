import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  shenzhenClusters, 
  heatConfig,
  type District,
  getAllDistricts 
} from "@/lib/districts";

interface LocationPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCity: "香港" | "深圳";
  selectedArea?: string;
  onSave: (city: "香港" | "深圳", area: string) => void;
}

const hongkongDistricts = [
  { id: 'central', name: '中西区', heat: 'hot' as const },
  { id: 'wanchai', name: '湾仔', heat: 'hot' as const },
  { id: 'causeway', name: '铜锣湾', heat: 'active' as const },
  { id: 'tsimshatsui', name: '尖沙咀', heat: 'hot' as const },
  { id: 'mongkok', name: '旺角', heat: 'active' as const },
];

export default function LocationPickerSheet({ 
  open, 
  onOpenChange, 
  selectedCity,
  selectedArea,
  onSave 
}: LocationPickerSheetProps) {
  const [tempCity, setTempCity] = useState<"香港" | "深圳">(selectedCity);
  const [tempDistrictId, setTempDistrictId] = useState<string>("");
  const [activeCluster, setActiveCluster] = useState(shenzhenClusters[0]?.id || '');

  useEffect(() => {
    if (selectedArea) {
      const district = getAllDistricts().find(d => d.name === selectedArea || d.id === selectedArea);
      if (district) {
        setTempDistrictId(district.id);
        setActiveCluster(district.clusterId);
      }
    }
  }, [selectedArea]);

  const handleSave = () => {
    const allDistricts = tempCity === "深圳" 
      ? getAllDistricts() 
      : hongkongDistricts.map(d => ({ ...d, clusterId: 'hk' }));
    const district = allDistricts.find(d => d.id === tempDistrictId);
    onSave(tempCity, district?.name || "");
    onOpenChange(false);
  };

  const handleSelectDistrict = (district: District | typeof hongkongDistricts[0]) => {
    setTempDistrictId(district.id);
  };

  const currentCluster = shenzhenClusters.find(c => c.id === activeCluster);
  const selectedDistrictName = tempCity === "深圳"
    ? getAllDistricts().find(d => d.id === tempDistrictId)?.name
    : hongkongDistricts.find(d => d.id === tempDistrictId)?.name;

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
              选择商圈
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
                    {tempCity} · {selectedDistrictName || "未选择"}
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="gap-1"
                data-testid="button-use-current-location"
              >
                <Navigation className="h-4 w-4" />
                定位
              </Button>
            </div>

            <Tabs value={tempCity} onValueChange={(v) => {
              setTempCity(v as "香港" | "深圳");
              setTempDistrictId("");
            }}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="深圳" data-testid="tab-shenzhen">
                  深圳
                </TabsTrigger>
                <TabsTrigger value="香港" data-testid="tab-hongkong">
                  香港
                </TabsTrigger>
              </TabsList>

              <TabsContent value="深圳" className="mt-4 space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {shenzhenClusters.map(cluster => (
                    <button
                      key={cluster.id}
                      onClick={() => setActiveCluster(cluster.id)}
                      className={`
                        px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                        transition-all border-2
                        ${activeCluster === cluster.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover-elevate'
                        }
                      `}
                      data-testid={`tab-cluster-${cluster.id}`}
                    >
                      {cluster.name}
                    </button>
                  ))}
                </div>

                {currentCluster && (
                  <div className="flex flex-wrap gap-2">
                    {currentCluster.districts.map(district => {
                      const heat = heatConfig[district.heat];
                      return (
                        <button
                          key={district.id}
                          onClick={() => handleSelectDistrict(district)}
                          className={`
                            inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium
                            transition-all border-2
                            ${tempDistrictId === district.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover-elevate'
                            }
                          `}
                          data-testid={`chip-district-${district.id}`}
                        >
                          <span>{district.name}</span>
                          {heat.icon && (
                            <span>{heat.icon}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="香港" className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {hongkongDistricts.map(district => {
                    const heat = heatConfig[district.heat];
                    return (
                      <button
                        key={district.id}
                        onClick={() => handleSelectDistrict(district)}
                        className={`
                          inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium
                          transition-all border-2
                          ${tempDistrictId === district.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover-elevate'
                          }
                        `}
                        data-testid={`chip-district-${district.id}`}
                      >
                        <span>{district.name}</span>
                        {heat.icon && (
                          <span>{heat.icon}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  香港更多商圈即将开放
                </p>
              </TabsContent>
            </Tabs>

            <div className="text-xs text-center text-muted-foreground py-2">
              💡 换个商圈看看，成局更快
            </div>
          </div>

          <div className="border-t p-4 flex gap-2 flex-shrink-0 bg-background">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setTempDistrictId("")}
              data-testid="button-reset"
            >
              重置为全城
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSave}
              disabled={!tempDistrictId}
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
