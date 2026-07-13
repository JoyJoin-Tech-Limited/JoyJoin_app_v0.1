import type { ApiTransport } from './core.js'

/** Stable errors exposed by the JoyJoin geo proxy. */
export type GeoMapErrorCode =
  | 'MAP_INVALID_REQUEST'
  | 'MAP_NOT_CONFIGURED'
  | 'MAP_UPSTREAM_TIMEOUT'
  | 'MAP_UPSTREAM_ERROR'
  | 'MAP_NO_ROUTE'

/** All coordinates in the geo API contract use GCJ-02. */
export interface GeoCoordinate {
  latitude: number
  longitude: number
}

export interface GeoPlace {
  id: string
  name: string
  address?: string
  category?: string
  distanceMeters?: number
  location: GeoCoordinate
}

export interface ReverseGeocodeResponse {
  success: boolean
  city?: string
  district?: string
  name?: string
  address?: string
  adcode?: string
  poi?: GeoPlace
  source?: 'tencent' | 'local'
  code?: GeoMapErrorCode
  error?: string
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
  source?: 'tencent_ip' | 'no_key' | 'error'
  code?: GeoMapErrorCode
  error?: string
}

export function ipLocate(
  api: ApiTransport
): Promise<IpLocateResponse> {
  return api<IpLocateResponse>({
    path: '/api/geo/ip-locate',
    method: 'POST',
  })
}

export interface SuggestGeoPlacesRequest {
  keyword: string
  region?: '深圳'
  location?: GeoCoordinate
  limit?: number
}

export interface SearchNearbyGeoPlacesRequest {
  keyword: string
  location: GeoCoordinate
  radiusMeters?: number
  limit?: number
}

export interface GeoPlacesResponse {
  success: boolean
  places: GeoPlace[]
  source?: 'tencent'
  code?: GeoMapErrorCode
  error?: string
}

export function suggestGeoPlaces(
  api: ApiTransport,
  request: SuggestGeoPlacesRequest
): Promise<GeoPlacesResponse> {
  return api<GeoPlacesResponse>({
    path: '/api/geo/places/suggest',
    method: 'POST',
    data: request,
  })
}

export function searchNearbyGeoPlaces(
  api: ApiTransport,
  request: SearchNearbyGeoPlacesRequest
): Promise<GeoPlacesResponse> {
  return api<GeoPlacesResponse>({
    path: '/api/geo/places/search',
    method: 'POST',
    data: request,
  })
}

export interface WalkingRouteRequest {
  from: GeoCoordinate
  to: GeoCoordinate
}

export interface WalkingRouteSuccessResponse {
  success: true
  distanceMeters: number
  durationSeconds: number
  polyline: GeoCoordinate[]
  source: 'tencent'
}

export interface WalkingRouteFailureResponse {
  success: false
  code: GeoMapErrorCode
  error?: string
}

export type WalkingRouteResponse =
  | WalkingRouteSuccessResponse
  | WalkingRouteFailureResponse

export function getWalkingRoute(
  api: ApiTransport,
  request: WalkingRouteRequest
): Promise<WalkingRouteResponse> {
  return api<WalkingRouteResponse>({
    path: '/api/geo/walking-route',
    method: 'POST',
    data: request,
  })
}
