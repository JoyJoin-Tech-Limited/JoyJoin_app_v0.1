/**
 * GPS城市定位工具
 * 用于检测用户当前所在城市（粤港澳大湾区）
 * 使用本地边界框检测，无需外部API
 */

export interface GeoLocationResult {
  success: boolean;
  city?: "深圳" | "香港";
  cluster?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
}

interface CityBoundary {
  name: "深圳" | "香港";
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface ClusterBoundary {
  id: string;
  name: string;
  city: "深圳" | "香港";
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const cityBoundaries: CityBoundary[] = [
  {
    name: "深圳",
    minLat: 22.4,
    maxLat: 22.85,
    minLng: 113.75,
    maxLng: 114.65,
  },
  {
    name: "香港",
    minLat: 22.15,
    maxLat: 22.56,
    minLng: 113.82,
    maxLng: 114.45,
  },
];

const clusterBoundaries: ClusterBoundary[] = [
  {
    id: "nanshan",
    name: "南山区",
    city: "深圳",
    minLat: 22.47,
    maxLat: 22.58,
    minLng: 113.88,
    maxLng: 114.05,
  },
  {
    id: "futian",
    name: "福田区",
    city: "深圳",
    minLat: 22.51,
    maxLat: 22.57,
    minLng: 114.02,
    maxLng: 114.12,
  },
];

function detectCity(lat: number, lng: number): "深圳" | "香港" | null {
  for (const city of cityBoundaries) {
    if (
      lat >= city.minLat &&
      lat <= city.maxLat &&
      lng >= city.minLng &&
      lng <= city.maxLng
    ) {
      return city.name;
    }
  }
  return null;
}

function detectCluster(lat: number, lng: number): string | undefined {
  for (const cluster of clusterBoundaries) {
    if (
      lat >= cluster.minLat &&
      lat <= cluster.maxLat &&
      lng >= cluster.minLng &&
      lng <= cluster.maxLng
    ) {
      return cluster.id;
    }
  }
  return undefined;
}

export async function getCurrentLocation(): Promise<GeoLocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        success: false,
        error: "浏览器不支持定位功能",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const city = detectCity(latitude, longitude);
        const cluster = detectCluster(latitude, longitude);

        if (city) {
          resolve({
            success: true,
            city,
            cluster,
            latitude,
            longitude,
          });
        } else {
          resolve({
            success: false,
            error: "当前位置不在服务区域内（仅支持深圳/香港）",
            latitude,
            longitude,
          });
        }
      },
      (error) => {
        let errorMessage = "定位失败";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "请允许定位权限后重试";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "定位信息不可用";
            break;
          case error.TIMEOUT:
            errorMessage = "定位请求超时";
            break;
        }
        resolve({
          success: false,
          error: errorMessage,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  });
}
