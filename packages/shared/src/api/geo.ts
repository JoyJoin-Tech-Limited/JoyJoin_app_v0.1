import type { ApiTransport } from './core.js'

export interface ReverseGeocodeResponse {
  success: boolean
  city?: string
  district?: string
  source?: string
}

export function reverseGeocode(
  api: ApiTransport,
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResponse> {
  return api<ReverseGeocodeResponse>({
    path: '/api/geo/reverse-geocode',
    method: 'POST',
    data: { latitude, longitude },
  })
}

export interface IpLocateResponse {
  success: boolean
  city?: string
  province?: string
  source?: string
}

export function ipLocate(
  api: ApiTransport
): Promise<IpLocateResponse> {
  return api<IpLocateResponse>({
    path: '/api/geo/ip-locate',
    method: 'POST',
  })
}
