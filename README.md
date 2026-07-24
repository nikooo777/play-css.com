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
- VIP server highlighting
- Downloadable Counter-Strike: Source server blacklist
- Authenticated admin tools for adding and blacklisting servers
- Responsive layout with light and dark color schemes

## Architecture

This repository contains the Next.js web application and its API proxy routes. It does not contain the server scanner, database, or Source-query backend.

The initial server list is fetched by Next.js during server rendering. Browser refreshes, server details, blacklist downloads, and admin actions go through route handlers under `/api`, which forward requests to the upstream service configured by `API_URL`.

The required backend contract is documented in [`swagger.json`](./swagger.json). A compatible backend must be running before this application can load server data.

## Country preference

The upstream API provides a country code for each server, but no coordinates or latency measurement. Users can choose a country manually or select **Use my location** to identify their current country.

Location access is requested only after that button is selected. The coordinate-to-country lookup runs in the browser, coordinates are discarded immediately, and the preference is kept only in memory until the page reloads. Matching servers appear first while the selected table sorting still applies within both groups.

The country preference is not a distance or ping measurement.

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
NEXT_PUBLIC_VIP_IPS=
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
| `NEXT_PUBLIC_VIP_IPS` | No | Comma-separated server IP addresses to highlight as VIP. Use bare IPs without ports. |

`NEXT_PUBLIC_VIP_IPS` is included in the browser bundle. Rebuild the application after changing it in a production deployment.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the development server with Turbopack. |
| `bun run build` | Create a production build. |
| `bun run start` | Run the production build. |
| `bun run lint` | Run ESLint. |
| `bun run test` | Run the Bun test suite. |

## Production

Set the environment variables, then build and start the application:

```bash
bun run build
bun run start
```
