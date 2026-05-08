# Name That Snippet

A multiplayer music guessing game built on Spotify. Sign in, host or join a room, and race friends to name the song from a snippet — title and artist, fastest fingers wins. Inspired by the *Trackstar* show but built around the songs **you and your friends** actually listen to.

**Live:** [name-that-snippet.vercel.app](https://name-that-snippet.vercel.app)

---

## What it does

- Sign in with Spotify and pull each player's top + saved tracks at join time
- Build a song pool from the **intersection** of everyone's libraries, with a fairness pass that guarantees each player's library is represented
- Host configures the room — game mode, playback mode, rounds, snippet length — and shares a 4-letter code
- Three game modes:
  - **Race** — first to title + artist wins the round, speed bonus on completion
  - **Speed** — everyone keeps scoring, points scale with how fast you got the hit
  - **Turn-based** — one player at a time, host scores them
- Two playback modes:
  - **Everyone plays** — each device streams the snippet via Spotify's Web Playback SDK
  - **Host plays on speaker** — for IRL rooms; only the host's device produces audio
- Per-account song memory — finished games' tracks get written to each player's history so future games don't repeat songs anyone has heard
- Live opponent progress on the scoreboard — title/artist badges flip as players hit them
- Solo mode — single-player against the clock, no lobby, jumps straight into round 1
- iOS fallback — Spotify's Web Playback SDK doesn't work on iOS Safari (Apple/Spotify limitation), so the app detects iOS and falls back to playing 30s preview MP3s via a regular `<audio>` element

## Tech stack

- **Next.js 16** (App Router, RSC, Server Actions)
- **TypeScript** end-to-end
- **Tailwind CSS** — design tokens via `@theme inline`, dark theme, mobile-first
- **Auth.js v5** with the Spotify OAuth provider (custom JWT callbacks for token refresh)
- **Upstash Redis** (via Vercel Marketplace) — durable room state + per-user song history
- **Server-Sent Events** for real-time room updates with a Redis-poll fallback for cross-instance event delivery
- **Spotify Web API** + **Web Playback SDK**
- **Vitest** — 98 tests covering matching, song pool, game flow, store, room transitions
- **Vercel** — hosted on Fluid Compute, GitHub-connected for auto-deploys

## Interesting bits

A few decisions worth pointing out:

### Fuzzy guess matching without an LLM

The judge needs to be lenient — typos, missing articles, "feat." annotations, parenthetical alt-titles like "What If You Fly (Sweet Disposition)" — but tight enough to reject coincidences like "nine to five" matching "25 or 6 to 4" (both share the word "to"). The matcher does:

1. Normalize: strip parentheticals, "feat./with/ft.", remaster/remix/live noise, smart quotes, diacritics
2. Filter stopwords (`the/a/an/to/of/and/or/in/on/for/at/by/is`) so filler words can't drive false positives
3. Token-cover similarity at a 0.65 threshold, with substring matching for tokens ≥3 chars and Levenshtein distance for typos (1 typo allowed for 4–6 char tokens, 2 for 7+)
4. Also try each parenthetical as an alt-title — songs often have the recognizable name in parens

Found in `src/lib/match.ts`. 17 tests against real-world song titles in `match.test.ts`.

### Cross-instance event fanout on serverless

Vercel Functions route requests across multiple instances; an in-process pub/sub doesn't reach a subscriber on a different instance. Three-layer fix:

- In-process pub/sub for instant updates within a single instance
- SSE handler polls Redis every 2s for `updatedAt` changes and pushes deltas
- Client-side `refreshRoom()` after host actions so the actor sees their action's result immediately regardless of routing

### Web Playback SDK reliability

The SDK has known issues — silent failures on iOS, slow startup, occasional stuck-on-loading. Mitigations:

- Initialize the player in `RoomClient` (not `GameView`) so the SDK warms up during the lobby — round 1 audio starts immediately
- iOS detection short-circuits to the preview-MP3 engine
- 12-second safety net falls back to preview engine if the SDK never reaches "ready"
- Tap-to-play button surfaces fresh user gestures when browser autoplay policy intervenes
- Hard cutoff timer pauses audio at snippet expiry (the SDK happily plays the full track otherwise)

### Per-player fairness in the song pool

Instead of an unweighted `common × 0.8 + unique × 0.2` mix (which leaves players with no overlap underrepresented), a round-robin pass guarantees each player gets at least `floor(rounds / numPlayers)` of their own tracks. Common tracks are preferred within each player's allotment for more interesting trivia.

## Architecture

```
src/
  app/
    api/                  Spotify OAuth, room CRUD, game actions, SSE
    room/[code]/          Lobby + GameView + FinalScoreboard
    host/                 Create-room flow
    auth/error/           Custom auth error page
    page.tsx              Landing
  lib/
    match.ts              Fuzzy guess matching
    song-pool.ts          Library intersection + fairness
    game.ts               Round lifecycle, scoring, restart
    room.ts               Room CRUD + public-room redaction
    store.ts              Redis (Upstash) + in-memory fallback
    spotify.ts            Web API helpers
    session-token.ts      Server-side session+token guard
  components/
    usePlayback.ts        SDK + preview-MP3 engine, tap-to-play handling
```

Game state is fully server-authoritative — clients receive a redacted `PublicRoom` shape that hides the upcoming song pool and current round's title/artist until the reveal.

## Local development

You'll need a Spotify Developer app and Premium account.

```bash
git clone https://github.com/sidharths00/name-that-snippet
cd name-that-snippet
pnpm install
cp .env.example .env.local
# Fill in SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, AUTH_SECRET (run: openssl rand -base64 32)
pnpm dev
```

Open http://127.0.0.1:3000 (Spotify rejects `localhost` as a redirect URI — use the loopback IP).

```bash
pnpm test         # vitest
pnpm test:watch
pnpm build        # next build
```

## Deployment

Connected to Vercel via GitHub — pushes to `main` auto-deploy. Upstash Redis is provisioned through the Vercel Marketplace, which auto-injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` env vars. Production env vars (Spotify client ID/secret, `AUTH_SECRET`, `AUTH_URL`) are set on the Vercel project.

## Spotify limitations to know

As of 2026, Spotify's Development Mode caps apps at 5 authorized users beyond the developer. The "Extended Quota Mode" pathway was removed for new requests, leaving only the commercial partner program (which isn't available to hobby projects). Practical effect: the live deployment is friends-only.

## Why I built this

I love playing the *Trackstar*-style guessing game with friends in person — but only the music nerd of the group has a phone full of mutually-known songs. This solves that: pull from *everyone's* library, mash them together, and let the algorithm pick the songs we'd all recognize. The remote-play mode means it works on a road trip or over FaceTime too.
