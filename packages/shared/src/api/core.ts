export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface ApiTransportRequest {
  path: string
  method?: ApiMethod
  data?: unknown
}

export type ApiTransport = <T>(request: ApiTransportRequest) => Promise<T>
