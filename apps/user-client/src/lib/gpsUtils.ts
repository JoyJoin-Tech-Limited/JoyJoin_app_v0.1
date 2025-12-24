/**
 * GPS城市定位工具
 * 用于检测用户当前所在城市（粤港澳大湾区）
 * 优先使用高德地图逆地理编码API，备用本地边界框检测
 */

export interface GeoLocationResult {
  success: boolean;
  city?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
  source?: string;
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
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const response = await fetch("/api/geo/reverse-geocode", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ latitude, longitude }),
          });
          
          if (!response.ok) {
            throw new Error("API请求失败");
          }
          
          const data = await response.json();
          
          if (data.success) {
            resolve({
              success: true,
              city: data.city,
              latitude,
              longitude,
              source: data.source,
            });
          } else {
            resolve({
              success: false,
              error: data.error || "定位失败",
              latitude,
              longitude,
            });
          }
        } catch {
          resolve({
            success: false,
            error: "网络请求失败，请重试",
            latitude,
            longitude,
          });
        }
      },
      (error) => {
        let errorMessage = "定位失败";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "用户拒绝定位权限";
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
