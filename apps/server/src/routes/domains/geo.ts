import type { Express } from "express";

export function registerGeoRoutes(app: Express): void {
  app.post('/api/geo/reverse-geocode', async (req, res) => {
    try {
      const { latitude, longitude } = req.body;

      // Validate inputs are numbers
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({
          success: false,
          error: "经纬度参数格式错误"
        });
      }

      // Validate coordinate ranges (Shenzhen/Hong Kong area roughly)
      if (lat < 20 || lat > 25 || lng < 112 || lng > 116) {
        return res.status(400).json({
          success: false,
          error: "坐标超出服务范围"
        });
      }

      const apiKey = process.env.AMAP_API_KEY;

      // Helper function to detect district from coordinates using bounding boxes
      const detectDistrictFromCoords = (lat: number, lng: number): string | null => {
        const districts = [
          { name: "南山区", minLat: 22.45, maxLat: 22.60, minLng: 113.85, maxLng: 114.05 },
          { name: "福田区", minLat: 22.50, maxLat: 22.58, minLng: 114.00, maxLng: 114.15 },
          { name: "罗湖区", minLat: 22.52, maxLat: 22.60, minLng: 114.10, maxLng: 114.20 },
          { name: "宝安区", minLat: 22.52, maxLat: 22.85, minLng: 113.75, maxLng: 113.95 },
          { name: "龙岗区", minLat: 22.55, maxLat: 22.80, minLng: 114.15, maxLng: 114.45 },
        ];

        for (const d of districts) {
          if (lat >= d.minLat && lat <= d.maxLat && lng >= d.minLng && lng <= d.maxLng) {
            return d.name;
          }
        }
        return null;
      };

      // Helper function to normalize district names
      const normalizeDistrictName = (district: string): string => {
        if (!district) return "";
        return district.replace(/市辖区$/, "").replace(/区区$/, "区");
      };

      if (!apiKey) {
        // Fallback to local boundary detection (use parsed numeric values)
        const district = detectDistrictFromCoords(lat, lng);
        return res.json({
          success: !!district,
          city: district ? "深圳" : undefined,
          district: district,
          source: "local"
        });
      }

      // Call Amap reverse geocoding API with encoded coordinates
      const encodedLocation = encodeURIComponent(`${lng.toFixed(6)},${lat.toFixed(6)}`);
      const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${encodedLocation}&extensions=base`;

      const response = await fetch(amapUrl);
      const data: any = await response.json();

      if (data.status === "1" && data.regeocode) {
        const addressComponent = data.regeocode.addressComponent;
        const city = addressComponent.city || addressComponent.province;
        const district = addressComponent.district;

        // Normalize district name to match our clusters
        const normalizedDistrict = normalizeDistrictName(district);

        res.json({
          success: true,
          city: city === "深圳市" ? "深圳" : city,
          district: normalizedDistrict,
          rawDistrict: district,
          source: "amap"
        });
      } else {
        // Fallback to local detection (use parsed numeric values)
        const district = detectDistrictFromCoords(lat, lng);
        res.json({
          success: !!district,
          city: district ? "深圳" : undefined,
          district: district,
          source: "local",
          amapError: data.info
        });
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      res.status(500).json({
        success: false,
        error: "定位服务暂时不可用"
      });
    }
  });
}
