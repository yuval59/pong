# pong

A multiplayer Pong game: a REST API for browsing/creating game rooms, a
socket.io server that runs the authoritative gameplay, and a Next.js frontend.

## Structure

```
.
├── server/   # Node.js + Express + socket.io backend
├── client/   # Next.js + TypeScript frontend
└── common/   # Shared TypeScript types/constants/socket contract (@pong/common)
```

This is an npm workspaces monorepo, so a single `npm install` at the root installs
dependencies for all three packages and links `@pong/common` into `server` and `client`.

## Getting started

```bash
npm install
npm run build:common   # compile shared types (re-run after editing common/src)
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:3000
```

Open two browser windows against `http://localhost:3000` to play against yourself.

## How it works

**Lobby** — the client polls `GET /api/rooms` and lists rooms with their name,
player count, and status. Creating a room (`POST /api/rooms`) returns a room id;
the client then navigates to `/room/[id]`, which is where joining actually happens
(over the socket, so seat assignment is tied to a live connection).

**Gameplay** — once a room's socket connection is established, the client emits
`room:join`. The server assigns the first free seat (`left`/`right`), and once both
seats are filled the match starts automatically. From then on:
- Each client sends its desired paddle Y position via `paddle:move` (from keyboard
  or mouse input — see below).
- The server owns the ball simulation: it moves the ball, bounces it off the top/bottom
  walls and paddles, and speeds it up by 5% (`BALL_SPEEDUP_FACTOR`) on every paddle hit,
  up to `BALL_MAX_SPEED`. It broadcasts `game:state` ~30 times/sec.
- First to `WIN_SCORE` (11) wins. Disconnecting mid-game forfeits the match to the
  opponent.

**Controls** — both keyboard (Arrow Up/Down or W/S, held) and mouse (cursor Y over
the canvas) control the paddle; whichever you use most recently takes effect.

## REST API (`server`)

- `GET /api/rooms` — list rooms (`{ rooms: RoomSummary[] }`).
- `POST /api/rooms` `{ name }` — create a room (`{ room: RoomSummary }`).
- `GET /api/rooms/:id` — fetch a single room, 404 if it doesn't exist.
- `GET /health` — liveness check.

## socket.io events (`common/src/events.ts`)

Client → server: `room:join(roomId, ack)`, `room:leave()`, `paddle:move(y)`.
Server → client: `game:state(state)`, `room:updated(room)`, `game:started()`,
`game:finished(winner)`, `player:left(side)`.

## Building for production

```bash
npm run build
```

Builds `common`, then `server`, then `client` in order.

## Packages

- **`common`** (`@pong/common`) — room/game types, the socket.io event contract
  (`ClientToServerEvents`/`ServerToClientEvents`), and shared constants (court size,
  tick/broadcast rates, ball speed, win score).
- **`server`** (`@pong/server`) — Express REST API for rooms plus a socket.io server
  (`rooms.ts` seat management, `game.ts` per-room simulation loop, `sockets.ts` event
  wiring). State is in-memory (no database).
- **`client`** — Next.js (App Router) app: `/` is the lobby, `/room/[id]` is the game,
  rendered on `<canvas>` from state pushed over socket.io.
