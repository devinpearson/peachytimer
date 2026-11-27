# Peachy Timer

A live timing light for Toastmasters meetings. The timekeeper runs the clock on one device; the speaker sees a
full-screen green, amber or red light on any other (a phone, a laptop, a projector).

- **Rooms.** The timekeeper starts a room and gets a 5-character code (no look-alike characters). Anyone can open
  `/room/CODE` to show the light; only the timekeeper's device, or someone given the control link, can run it.
- **Automatic light.** Choose a timing (Table Topics 1–2 min, Evaluation 2–3, Ice Breaker 4–6, speech 5–7, 8–10,
  General Evaluation 5–7) or enter custom times. Green shows at the minimum, red at the maximum, amber halfway.
- **Manual override.** Force any light (or off) at any time, as the old app's four buttons did.
- **Speech log.** Each "Stop & reset" records the speaker, time and whether they were within time (30 seconds
  either side of the minimum and maximum).

This replaces the original Laravel 7 + Pusher version.

## Layout

| Folder | Stack | Modelled on |
|---|---|---|
| [`api/`](api) | Bun, Express 5, TypeScript, zod, `ws`, winston; Biome, knip, Jest | tm-scrapper |
| [`web/`](web) | Next.js 15, React 19, Tailwind 4; ESLint, Vitest, Playwright | tm-dashboard-js |

The API keeps rooms in memory (a timing session lasts one meeting) and removes rooms that have been idle for
`ROOM_TTL_HOURS`. Restarting the API ends every room.

### API

| Method | Path | |
|---|---|---|
| `GET` | `/api/health/live`, `/api/health/ready` | Health checks |
| `GET` | `/api/presets` | Built-in timings |
| `POST` | `/api/rooms` | Create a room: `{ presetId? }` → `{ room, controlToken, serverTime }` |
| `GET` | `/api/rooms/:code` | Current state |
| `POST` | `/api/rooms/:code/commands` | `Authorization: Bearer <controlToken>`; body is one of `start`, `pause`, `reset`, `set-preset`, `set-thresholds`, `set-light`, `set-speaker` (see `api/src/domain/timer.ts`) |
| WS | `/ws?room=CODE` | Read-only feed: a `snapshot` on connect and after every change; closes with 4404 for an unknown or expired room |

Snapshots carry the start time rather than ticking every second, so every screen computes the same clock from
the server's time.

## Running it

With Docker:

```bash
docker compose up --build
```

Then open http://localhost:3000.

For development, run each app in its own terminal:

```bash
cd api && bun install && bun run dev
```

```bash
cd web && npm install && npm run dev
```

Copy `api/example.env` to `api/.env` and `web/example.env` to `web/.env.local` to change ports or origins.

## Checks

```bash
cd api && NODE_ENV=test bun run verify
```

```bash
cd web && npm run verify
```

The web end-to-end tests start the real API from `../api`, so install both apps first.
