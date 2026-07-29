# play-css.com

A web server browser for Counter-Strike: Source. It displays the online, non-blacklisted servers returned by a separate Source server API and lets players filter the list, inspect current players, download a CS:S blacklist, and connect through Steam.

The frontend is built with Next.js, React, TypeScript, Tailwind CSS, and Bun.

## Features

- Server list with player, bot, map, address, and country information
- Background refresh every 30 seconds
- Sorting by server name, map, player count, address, or country
- Filters for server status, map, name, address, bots, and Russian servers
- Optional country preference that keeps matching servers first
- Opt-in, on-device country detection with no automatic location prompt
- Optional cleanup of decorative characters in server and map names
- Server details with current player names, scores, and connection times
- `steam://connect` links for joining servers
- Client-side favorites with offline visibility
- VIP server highlighting
- Downloadable Counter-Strike: Source server blacklist
- Authenticated admin tools for adding, banning, unbanning, and recovering servers
- Enforcement observations, durable ban details, and legacy audit summaries
- Responsive dark layout styled after the Source engine HUD

## Architecture

This repository contains the Next.js web application and its API proxy routes. It does not contain the server scanner, database, or Source-query backend.

The initial server list is fetched by Next.js during server rendering. Backend warm-up is represented by `/status`, so an unavailable initial snapshot renders progress instead of failing the page or presenting an authoritative empty list. Browser refreshes, status polling, server details, blacklist downloads, and admin actions go through route handlers under `/api`, which forward requests to the upstream service configured by `API_URL`.

The required backend contract is documented in [`swagger.json`](./swagger.json). A compatible backend must be running before this application can load server data.

Admin mutations are proxied without rewriting their response bodies. The frontend creates one lowercase UUID idempotency key for each user action and reuses it only when the backend says that the result is uncertain. This preserves operation details such as `operation_id`, `replayed`, `publication_status`, and `retry_same_key`.

## Country preference

The upstream API provides a country code for each server, but no coordinates or latency measurement. Users can choose a country manually or select **Use my location** to identify their current country.

Location access is requested only after that button is selected. The coordinate-to-country lookup runs in the browser, coordinates are discarded immediately, and the preference is kept only in memory until the page reloads. Matching servers appear first while the selected table sorting still applies within both groups.

The country preference is not a distance or ping measurement.

## Favorites

Players can star servers to save them as favorites. Favorites are stored only in the browser's localStorage — nothing is sent to any server and no account exists. A favorites panel above the list shows saved servers with live data when they are online, keeps them visible with their last-known name when they are offline, and still offers direct Steam connect attempts while the backend itself is unavailable.

## Local development

### Requirements

- [Bun](https://bun.sh/)
- A compatible Source server API running separately

Clone the repository and install dependencies:

```bash
git clone https://github.com/nikooo777/play-css.com.git
cd play-css.com
bun install
```

Create `.env.local` in the project root:

```env
API_URL=http://localhost:8888
VIP_IPS=
```

Start the separate backend, then run the web application:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `API_URL` | Yes | Server-side base URL of the separate Source server API, for example `http://localhost:8888`. |
| `VIP_IPS` | No | Comma-separated server IP addresses to highlight as VIP. Use bare IPs without ports. Read at runtime by the frontend server. |

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server with Turbopack. |
| `bun run build` | Create a production build. |
| `bun run start` | Run the production build. |
| `bun run lint` | Run ESLint. |
| `bun run test` | Run the Bun test suite. |

## Container deployment

The production Compose stack builds this frontend and the backend from adjacent repositories:

```text
parent-directory/
├── play-css.com/
└── source-engine-server-list/
```

The frontend is the only published service. It binds to `127.0.0.1:3000` by default so a host-level reverse proxy can terminate TLS and forward traffic to it. The backend is reachable only from the frontend network and connects to the existing host MySQL service through `host.docker.internal`. The downloaded GeoIP database uses a named volume.

The application network uses `172.29.77.0/24` by default. The host firewall must permit that subnet to reach only MySQL port 3306. Change `APPLICATION_SUBNET` if it conflicts with an existing route or Docker network.

Copy the environment template and replace every placeholder:

```bash
cp .env.example .env
docker compose --env-file .env config
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

`PLAY_CSS_WHITELIST` must be present. Leave it blank for an authoritative empty whitelist, or provide a comma-separated list of bare IP addresses. Treat changes to that value as enforcement changes.

`MAXMIND_KEY` is required to download and refresh the GeoLite database. A database already persisted in the named volume remains usable without it, including for newly discovered IPs, but it cannot be refreshed. Before restoring the public snapshot or starting monitoring, the backend completes a best-effort reconciliation of stored country codes. It reconciles and checks GeoLite data every 25 hours, refreshing it once it is at least 24 hours old.

`PLAY_CSS_FETCHER_STEAM_API_KEY` is optional when serving the existing database. Without it, the backend continues monitoring persisted servers but skips startup discovery.

The backend applies database migrations during startup. Back up the existing database before replacing the backend because the upgraded schema cannot be used by older binaries after migration.

For a server that pulls prebuilt images, set `BACKEND_IMAGE` and `FRONTEND_IMAGE`, then disable the local build definitions with the production override:

```bash
docker compose -f compose.yaml -f compose.production.yaml --env-file .env pull
docker compose -f compose.yaml -f compose.production.yaml --env-file .env up -d
```

After updating either repository, rebuild and replace the affected containers:

```bash
docker compose --env-file .env up -d --build --remove-orphans
```

Check container health and recent output with:

```bash
docker compose --env-file .env ps
docker compose --env-file .env logs --tail=100 backend frontend
```

The backend container health check is process liveness, not public-data
readiness. Verify the rollout contract separately:

```bash
docker compose --env-file .env exec -T backend wget -qO- http://127.0.0.1:8888/health/live
docker compose --env-file .env exec -T backend wget -qO- http://127.0.0.1:8888/health/ready
docker compose --env-file .env exec -T backend wget -qO- http://127.0.0.1:8888/status
docker compose --env-file .env exec -T backend wget -qO- http://127.0.0.1:8888/servers
```
