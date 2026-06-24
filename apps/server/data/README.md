# QQwry IP Geolocation Data

This directory holds the self-hosted QQwry (纯真IP库) database used by the
privacy-safe IP geolocation service.

## File

- `qqwry.dat` — QQwry IPv4-to-location database.

## Placement

Place the current `qqwry.dat` file in this directory. The server loads it
automatically at:

```
apps/server/src/services/ipGeolocationService.ts
```

You can override the path with the environment variable:

```bash
QQWRY_DAT_PATH=/path/to/qqwry.dat
```

## Obtaining the data file

QQwry is a community-maintained mainland-China IP database. JoyJoin does not
redistribute the `.dat` file because its upstream licensing is unclear.

Common update sources (verify legality for your use case):

1. **qqwry-lite-data npm package**
   ```bash
   npm install qqwry-lite-data
   # The dat file is inside node_modules/qqwry-lite-data/
   cp node_modules/qqwry-lite-data/qqwry.dat apps/server/data/qqwry.dat
   ```

2. **Community mirrors**
   Search for "纯真IP库 qqwry.dat download". Only use sources you trust.

3. **Commercial alternatives**
   If QQwry licensing is unacceptable, replace `ipGeolocationService.ts` with
   an adapter for a licensed provider (e.g. IPIP.net, MaxMind GeoLite2).

## Update cadence

- Update monthly for production.
- The file is loaded once at first lookup and cached in memory; restart the
  server after replacing the file.
- Log line on startup confirms load success:
  `[IpGeolocation] QQwry data file loaded`.

## Privacy note

No raw IP addresses are stored. The service zeroes the last IPv4 octet and
hashes the anonymized address with a daily salt before persistence.
