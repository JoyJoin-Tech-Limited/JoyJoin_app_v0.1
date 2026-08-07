# Shenzhen Flash boundary data

The Flash runtime uses `shenzhen-boundary-gcj02.json` only on the server to
fail closed when a user is outside Shenzhen. Raw user coordinates are never
persisted or logged by this boundary check.

## Provenance

- Upstream repository: `zhChuXiao/ChinaGeoJson`
- Upstream file: `citys/深圳市.json`
- Pinned commit: `ad4d584bb975d7ab76fb9d22ae23ccdbfacef790`
- Upstream blob SHA: `7b39f4817e461ada99465dd077c7eae90c0b7ab9`
- Vendored file SHA-256: `e346a6cb0d5c482bf52fd0b845d0cda8c03a6ab666ce310afd3292a4d1899fa8`
- Runtime semantic SHA-256: `b691faa581d9330e6dc738dcd11421958ca2d4ddea271b656a56237f9fa6fb0b`
- Upstream source stated by the repository: Alibaba Cloud DataV.GeoAtlas
- Coordinate system: GCJ-02. Alibaba Cloud documents that DataV map
  components and GeoAtlas administrative boundaries primarily use GCJ-02.
- DataV coordinate-system documentation:
  <https://help.aliyun.com/zh/datav/datav-7-0/user-guide/map-data-format-1>
- Retrieved: 2026-07-20

Do not replace this file with a hand-drawn approximation. Any update must stay
server-only, pin a source revision, retain the license notice, and rerun the
Shenzhen boundary regression tests. Update the runtime semantic SHA-256 only
after a human has reviewed the new pinned boundary. The upstream repository's
MIT notice does not by itself settle every upstream map-data right. Keep
`FLASH_SHENZHEN_BOUNDARY_APPROVED_SHA256` unset or on its placeholder until
legal/operations has approved private server use of this exact pinned asset;
then set it to the runtime semantic SHA-256 above. This binds approval to the
reviewed revision. Do not expose the file through an API or bundle it into a
client.

## MIT License

Copyright (c) 2024 ChuXiao

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
