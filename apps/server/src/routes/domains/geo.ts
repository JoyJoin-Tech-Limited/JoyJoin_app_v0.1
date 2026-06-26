import { logger } from "../../lib/logger";
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

      const apiKey = process.env.TENCENT_MAP_KEY;

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

      if (!apiKey) {
        const district = detectDistrictFromCoords(lat, lng);
        return res.json({
          success: !!district,
          city: district ? "深圳" : undefined,
          district: district,
          source: "local"
        });
      }

      // Call Tencent Maps reverse geocoding API
      const tencentUrl = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat.toFixed(6)},${lng.toFixed(6)}&key=${apiKey}&get_poi=0`;

      const response = await fetch(tencentUrl);
      const data: any = await response.json();

      if (data.status === 0 && data.result) {
        const addrComp = data.result.address_component;
        const city = addrComp.city || addrComp.province;
        const district = addrComp.district;

        res.json({
          success: true,
          city: city === "深圳市" ? "深圳" : city,
          district: district,
          source: "tencent"
        });
      } else {
        const district = detectDistrictFromCoords(lat, lng);
        res.json({
          success: !!district,
          city: district ? "深圳" : undefined,
          district: district,
          source: "local",
          tencentError: data.message
        });
      }
    } catch (error) {
      logger.error("Reverse geocode error", { error: String(error) });
      res.status(500).json({
        success: false,
        error: "定位服务暂时不可用"
      });
    }
  });

  app.post('/api/geo/ip-locate', async (req, res) => {
    try {
      const apiKey = process.env.TENCENT_MAP_KEY;

      if (!apiKey) {
        return res.json({ success: false, source: 'no_key' });
      }

      // Get client IP from request
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim() || req.socket.remoteAddress || '';

      const url = `https://apis.map.qq.com/ws/location/v1/ip?key=${apiKey}${clientIp ? `&ip=${encodeURIComponent(clientIp)}` : ''}`;
      const response = await fetch(url);
      const data: any = await response.json();

      if (data.status === 0 && data.result) {
        const city = data.result.city || data.result.adcode;
        res.json({
          success: true,
          city: city === "深圳市" ? "深圳" : city?.replace(/市$/, ''),
          province: data.result.province,
          source: 'tencent_ip',
        });
      } else {
        res.json({ success: false, source: 'tencent_ip', error: data.message });
      }
    } catch (error) {
      logger.error("IP locate error", { error: String(error) });
      res.json({ success: false, source: 'error' });
    }
  });
}
