# Geo Services — Agent Context

> Extracted from AGENTS.md §6 (2026-07-31). Load when working on location APIs, geocoding, or POI search.

**Geo Services (2026-06-26; expanded 2026-07-13):** Server endpoints in `apps/server/src/routes/domains/geo.ts` reuse Tencent Maps WebService API (`TENCENT_MAP_KEY`):
- `POST /api/geo/reverse-geocode` — converts GCJ-02 coordinates to city/district/name/address/POI (bounds-based fallback when API unreachable)
- `POST /api/geo/ip-locate` — city-level location from client IP, used as fallback when mini-program GPS denied/timed out
- `POST /api/geo/places/suggest` and `/places/search` — Shenzhen POI suggestion/nearby search
- `POST /api/geo/walking-route` — walking distance, ETA, and decoded polyline
All public Geo DTOs use `latitude/longitude`; Tencent calls have a 4s timeout, bounded TTL/LRU cache, and stable `MAP_*` failure codes. Metered POI/route proxies require authentication and per-user rate limiting. Do not add another map provider/SDK/key or expose `TENCENT_MAP_KEY` to clients.
Admin portal MapPicker uses Tencent Maps JavaScript API (`TENCENT_MAP_JS_KEY`) via `/api/config/map`. Two keys required because Tencent Maps does not allow IP白名单 + 域名白名单 on the same key.
