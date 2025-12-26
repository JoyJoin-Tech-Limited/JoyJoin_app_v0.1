import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AmapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (location: { address: string; lat: number; lng: number }) => void;
  initialCenter?: { lat: number; lng: number };
}

interface AmapConfig {
  apiKey: string;
  securityKey: string;
}

export default function AmapPicker({ open, onOpenChange, onSelect, initialCenter }: AmapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const placeSearchRef = useRef<any>(null);
  
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [config, setConfig] = useState<AmapConfig | null>(null);
  
  const { toast } = useToast();

  const defaultCenter = initialCenter || { lat: 22.5431, lng: 114.0579 };

  useEffect(() => {
    if (open) {
      fetch('/api/config/amap', { credentials: 'include' })
        .then(res => {
          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              throw new Error('请先登录管理员账号');
            }
            throw new Error('无法加载地图配置');
          }
          return res.json();
        })
        .then(data => {
          if (data.error) {
            setError('地图配置不可用，请联系管理员');
          } else {
            setConfig(data);
          }
        })
        .catch((err) => {
          setError(err.message || '无法加载地图配置');
        });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !config || !mapRef.current) return;

    setIsLoading(true);
    setError(null);

    (window as any)._AMapSecurityConfig = {
      securityJsCode: config.securityKey
    };

    AMapLoader.load({
      key: config.apiKey,
      version: '2.0',
      plugins: ['AMap.Geocoder', 'AMap.PlaceSearch']
    }).then((AMap) => {
      const map = new AMap.Map(mapRef.current, {
        viewMode: '2D',
        zoom: 15,
        center: [defaultCenter.lng, defaultCenter.lat]
      });
      
      mapInstance.current = map;

      const marker = new AMap.Marker({
        position: [defaultCenter.lng, defaultCenter.lat],
        draggable: true
      });
      
      map.add(marker);
      markerRef.current = marker;

      const geocoder = new AMap.Geocoder();
      geocoderRef.current = geocoder;

      const placeSearch = new AMap.PlaceSearch({
        pageSize: 10,
        city: '深圳'
      });
      placeSearchRef.current = placeSearch;

      map.on('click', (e: any) => {
        const { lng, lat } = e.lnglat;
        marker.setPosition([lng, lat]);
        
        geocoder.getAddress([lng, lat], (status: string, result: any) => {
          if (status === 'complete' && result.info === 'OK') {
            const address = result.regeocode.formattedAddress;
            setSelectedLocation({ lng, lat, address });
          }
        });
      });

      marker.on('dragend', (e: any) => {
        const position = marker.getPosition();
        const lng = position.lng;
        const lat = position.lat;
        
        geocoder.getAddress([lng, lat], (status: string, result: any) => {
          if (status === 'complete' && result.info === 'OK') {
            const address = result.regeocode.formattedAddress;
            setSelectedLocation({ lng, lat, address });
          }
        });
      });

      setIsLoading(false);

    }).catch((e) => {
      console.error('地图加载失败:', e);
      setError('地图加载失败，请检查API配置');
      setIsLoading(false);
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, [open, config]);

  const handleSearch = () => {
    if (!searchKeyword.trim() || !placeSearchRef.current) return;
    
    setIsSearching(true);
    placeSearchRef.current.search(searchKeyword, (status: string, result: any) => {
      setIsSearching(false);
      if (status === 'complete' && result.poiList?.pois) {
        setSearchResults(result.poiList.pois.slice(0, 5));
      } else {
        setSearchResults([]);
        toast({ title: '未找到结果', description: '请尝试其他关键词' });
      }
    });
  };

  const handleSelectResult = (poi: any) => {
    if (!mapInstance.current || !markerRef.current) return;
    
    const location = poi.location;
    const lng = location.lng;
    const lat = location.lat;
    
    markerRef.current.setPosition([lng, lat]);
    mapInstance.current.setCenter([lng, lat]);
    mapInstance.current.setZoom(16);
    
    setSelectedLocation({
      lng,
      lat,
      address: poi.address || poi.name
    });
    setSearchResults([]);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation);
      onOpenChange(false);
      setSelectedLocation(null);
      setSearchKeyword('');
      setSearchResults([]);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedLocation(null);
    setSearchKeyword('');
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            选择场地位置
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="搜索地点名称或地址..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              data-testid="input-map-search"
            />
            <Button onClick={handleSearch} disabled={isSearching} data-testid="button-map-search">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
              {searchResults.map((poi, index) => (
                <button
                  key={poi.id || index}
                  className="w-full text-left p-2 hover:bg-muted transition-colors"
                  onClick={() => handleSelectResult(poi)}
                  data-testid={`search-result-${index}`}
                >
                  <div className="font-medium text-sm">{poi.name}</div>
                  <div className="text-xs text-muted-foreground">{poi.address}</div>
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-md">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-md">
                <div className="text-center text-destructive">
                  <p>{error}</p>
                </div>
              </div>
            )}
            <div 
              ref={mapRef} 
              className="w-full h-[400px] rounded-md border"
              data-testid="amap-container"
            />
          </div>

          {selectedLocation && (
            <div className="p-3 bg-muted rounded-md space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium">已选位置</span>
              </div>
              <p className="text-sm text-muted-foreground">{selectedLocation.address}</p>
              <p className="text-xs text-muted-foreground">
                坐标: {selectedLocation.lng.toFixed(6)}, {selectedLocation.lat.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-map-cancel">
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedLocation} data-testid="button-map-confirm">
            确认选择
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
