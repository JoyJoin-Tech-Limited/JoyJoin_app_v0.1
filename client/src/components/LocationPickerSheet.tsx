import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Navigation, Clock, X } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LocationPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCity: "香港" | "深圳";
  selectedArea?: string;
  onSave: (city: "香港" | "深圳", area: string) => void;
}

const cities = [
  { name: "深圳", label: "试点城市" },
  { name: "香港", label: "特别行政区" }
];

const areas = {
  "深圳": [
    { name: "南山区", hot: true },
    { name: "福田区", hot: true },
    { name: "罗湖区", hot: false },
    { name: "宝安区", hot: false },
    { name: "龙岗区", hot: false }
  ],
  "香港": [
    { name: "中西区", hot: true },
    { name: "湾仔区", hot: true },
    { name: "东区", hot: false },
    { name: "南区", hot: false },
    { name: "油尖旺区", hot: true }
  ]
};

export default function LocationPickerSheet({ 
  open, 
  onOpenChange, 
  selectedCity,
  selectedArea,
  onSave 
}: LocationPickerSheetProps) {
  const [tempCity, setTempCity] = useState<"香港" | "深圳">(selectedCity);
  const [tempArea, setTempArea] = useState(selectedArea || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentLocations] = useState([
    { city: "深圳", area: "南山区" },
    { city: "深圳", area: "福田区" },
    { city: "香港", area: "中西区" }
  ]);

  const handleSave = () => {
    onSave(tempCity, tempArea);
    onOpenChange(false);
  };

  const filteredAreas = areas[tempCity].filter(area =>
    area.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content 
          className="bg-background flex flex-col rounded-t-[20px] h-[85vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none"
          data-testid="drawer-location-picker"
        >
          {/* 拖拽指示器 */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-4" />
          
          {/* 标题栏 */}
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

          {/* 可滚动内容 */}
          <div className="overflow-y-auto flex-1 px-4 py-4 space-y-6">
            
            {/* 当前位置 */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-medium">当前位置</div>
                  <div className="text-xs text-muted-foreground">
                    {tempCity} · {tempArea || areas[tempCity][0].name}
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

            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索商圈..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-area"
              />
            </div>

            {/* 标签页 */}
            <Tabs value={tempCity} onValueChange={(v) => setTempCity(v as "香港" | "深圳")}>
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="深圳" data-testid="tab-shenzhen">
                  深圳
                </TabsTrigger>
                <TabsTrigger value="香港" data-testid="tab-hongkong">
                  香港
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tempCity} className="mt-4 space-y-4">
                {/* 最近使用 */}
                {recentLocations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>最近使用</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentLocations
                        .filter(loc => loc.city === tempCity)
                        .slice(0, 3)
                        .map((loc, idx) => (
                          <button
                            key={idx}
                            onClick={() => setTempArea(loc.area)}
                            className={`px-3 py-1.5 rounded-full text-sm border transition-all hover-elevate ${
                              tempArea === loc.area
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background hover:bg-muted border-border'
                            }`}
                            data-testid={`chip-recent-${idx}`}
                          >
                            {loc.area}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* 推荐商圈 */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    推荐商圈
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredAreas.map((area) => (
                      <button
                        key={area.name}
                        onClick={() => setTempArea(area.name)}
                        className={`p-3 rounded-lg text-left border transition-all hover-elevate ${
                          tempArea === area.name
                            ? 'bg-primary/10 border-primary'
                            : 'bg-background hover:bg-muted border-border'
                        }`}
                        data-testid={`area-${area.name}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{area.name}</span>
                          {area.hot && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                              热门
                            </Badge>
                          )}
                        </div>
                        {tempArea === area.name && (
                          <div className="text-xs text-primary">✓ 已选择</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredAreas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    未找到匹配的商圈
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* 提示 */}
            <div className="text-xs text-center text-muted-foreground py-2">
              💡 换个商圈看看，成局更快
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="border-t p-4 flex gap-2 flex-shrink-0 bg-background">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setTempArea("");
              }}
              data-testid="button-reset"
            >
              重置为全城
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleSave}
              disabled={!tempArea}
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
