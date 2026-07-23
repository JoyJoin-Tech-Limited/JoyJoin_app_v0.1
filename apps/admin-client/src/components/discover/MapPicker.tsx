import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/ui/use-toast';

interface MapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (location: { address: string; lat: number; lng: number }) => void;
  initialCenter?: { lat: number; lng: number };
}

export default function MapPicker({ open, onOpenChange, onSelect, initialCenter }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const placeSearchRef = useRef<any>(null);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const { toast } = useToast();

  const defaultCenter = initialCenter || { lat: 22.5431, lng: 114.0579 };

  useEffect(() => {
    if (!open) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setApiKey(null);
    setSelectedLocation(null);
    setSearchResults([]);

    fetch('/api/config/map', { credentials: 'include' })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error('请先登录管理员账号');
          }
          if (res.status === 503) {
            throw new Error('地图配置未设置，请配置 TENCENT_MAP_JS_KEY');
          }
          throw new Error(data?.message || data?.error || '无法加载地图配置');
        }
        return data;
      })
      .then(data => {
        if (cancelled) return;
        if (data?.error || !data?.apiKey) {
          setError(data?.message || data?.error || '地图配置不可用，请联系管理员');
          setIsLoading(false);
        } else {
          setApiKey(data.apiKey);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || '无法加载地图配置');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !apiKey || !mapRef.current) return;

    setIsLoading(true);
    setError(null);

    const scriptId = 'tencent-map-sdk';
    const existing = document.getElementById(scriptId);

    const initMap = () => {
      try {
        const TMap = (window as any).TMap;
        if (!TMap) {
          throw new Error('地图 SDK 未加载完成');
        }

        const map = new TMap.Map(mapRef.current, {
          center: new TMap.LatLng(defaultCenter.lat, defaultCenter.lng),
          zoom: 15,
          mapStyleId: 'style1',
        });

        mapInstance.current = map;

        const marker = new TMap.MultiMarker({
          map,
          geometries: [{
            id: 'selected-location',
            position: new TMap.LatLng(defaultCenter.lat, defaultCenter.lng),
          }],
        });

        markerRef.current = marker;

        const search = new TMap.service.PlaceSearch({
          pageSize: 10,
          pageIndex: 1,
          boundary: new TMap.service.Boundary({ city: '深圳' }),
        });

        placeSearchRef.current = search;

        map.on('click', (e: any) => {
          const { lat, lng } = e.latLng;
          marker.updateGeometries([{
            id: 'selected-location',
            position: new TMap.LatLng(lat, lng),
          }]);

          reverseGeocode(lat, lng).then(address => {
            setSelectedLocation({ lng, lat, address });
          });
        });

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '地图初始化失败');
        setIsLoading(false);
      }
    };

    const loadScript = () => {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${apiKey}`;
      script.onload = () => {
        initMap();
      };
      script.onerror = () => {
        setError('地图 SDK 加载失败');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    if (existing) {
      existing.remove();
      loadScript();
    } else {
      loadScript();
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, [open, apiKey]);

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const TMap = (window as any).TMap;
      const geocoder = new TMap.service.Geocoder();
      const result = await geocoder.getAddress({ location: new TMap.LatLng(lat, lng) });
      return result?.result?.address || `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
    } catch {
      return `${lng.toFixed(6)}, ${lat.toFixed(6)}`;
    }
  };

  const handleSearch = () => {
    if (!searchKeyword.trim() || !placeSearchRef.current) return;

    setIsSearching(true);
    placeSearchRef.current.search(searchKeyword).then((result: any) => {
      setIsSearching(false);
      const pois = result?.data || [];
      if (pois.length > 0) {
        setSearchResults(pois.slice(0, 5));
      } else {
        setSearchResults([]);
        toast({ title: '未找到结果', description: '请尝试其他关键词' });
      }
    }).catch(() => {
      setIsSearching(false);
      setSearchResults([]);
      toast({ title: '搜索失败', description: '请重试' });
    });
  };

  const handleSelectResult = (poi: any) => {
    if (!mapInstance.current || !markerRef.current) return;

    const location = poi.location;
    const lat = location.lat;
    const lng = location.lng;

    markerRef.current.updateGeometries([{
      id: 'selected-location',
      position: new (window as any).TMap.LatLng(lat, lng),
    }]);
    mapInstance.current.setCenter(new (window as any).TMap.LatLng(lat, lng));
    mapInstance.current.setZoom(16);

    setSelectedLocation({
      lng,
      lat,
      address: poi.address || poi.title,
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
                  <div className="font-medium text-sm">{poi.title}</div>
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
              data-testid="tencent-map-container"
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
