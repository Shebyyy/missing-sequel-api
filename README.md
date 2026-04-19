# Missing Sequel API

A high-performance API for [AnymeX](https://github.com/LalithJ959/AnymeX) that scans anime/manga lists and finds missing sequels, prequels, spin-offs, and adaptations.

Built with **Bun + Hono**, deployed via **Docker** with **GitHub Actions CI/CD**.

**Live URL:** `http://anymex.duckdns.org:3002`

---

## Features

- **Missing Media Detection** — Finds sequels, prequels, spin-offs, summaries the user hasn't seen
- **Upcoming Sequels** — Lists upcoming releases related to the user's list
- **Franchise Timeline** — Full franchise view for any media
- **User Profiles** — Fetch user stats from AniList or MAL
- **Status Tracking** — Track when media finishes airing/publishing
- **Dual Platform** — Supports both AniList and MAL
- **MAL Native API** — Uses MAL's own API (`/v2/anime/{id}`) for relations with 50-concurrent worker pool (~177 items/sec)
- **Compact Mode** — All endpoints return lightweight responses by default (IDs, titles, covers). Set `compact: false` for full data
- **SQLite + Volume** — Data persisted across container restarts
- **API Key Auth** — Protected endpoints with `X-API-Key` header

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Bun |
| Framework | Hono |
| Database | SQLite (better-sqlite3) |
| Validation | Zod |
| Deployment | Docker + GitHub Actions |
| Port | **3002** |

---

## Quick Start

### 1. GitHub Secrets

Go to **Settings > Secrets and variables > Actions** and add:

| Secret | Value |
|---|---|
| `SERVER_IP` | Your VPS IP address |
| `SSH_PASSWORD` | Your VPS root SSH password |
| `MAL_CLIENT_ID` | Your MAL API Client ID |
| `API_KEY` | Any strong string (used by clients as `X-API-Key`) |

### 2. Push & Deploy

Push to `main` branch — GitHub Actions auto-deploys to your VPS:

```
git push origin main
```

Or trigger manually from **GitHub > Actions > Deploy Missing Sequel API > Run workflow**.

### 3. Verify

```
http://anymex.duckdns.org:3002/api/health
```

---

## Environment Variables

All env vars are injected at runtime via `docker-compose.yml`. The `.env` file on the server is auto-created by GitHub Actions from your secrets.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NODE_ENV` | No | `production` | Environment mode |
| `HOST` | No | `0.0.0.0` | Listen address |
| `PORT` | No | `3002` | Server port |
| `DB_PATH` | No | `/app/data/sequel-api.db` | SQLite database path (inside container) |
| `MAL_CLIENT_ID` | **Yes** | — | MAL API Client ID from [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig) |
| `API_KEY` | **Yes** | `dev-key` | API key for client authentication |
| `APP_ID` | No | `anymex` | App identifier for rate limiting |
| `GEMINI_API_KEY` | No* | — | Google AI Studio API key for AI advisor (free) |
| `GROQ_API_KEY` | No* | — | Groq API key for AI advisor fallback (free) |

*\* At least one AI key (`GEMINI_API_KEY` or `GROQ_API_KEY`) is required for the `/api/advise` endpoint.*

---

## API Endpoints

All protected endpoints accept `compact` (default: `true`) for lightweight responses.

### Public

#### `GET /api/health`

Health check — no auth required.

### Protected (require `X-API-Key` header)

#### `POST /api/check`

Scan a user's list for missing sequels, prequels, spin-offs.

#### `POST /api/upcoming`

Get upcoming sequels only.

#### `POST /api/franchise`

Get full franchise timeline for a specific media.

#### `POST /api/user`

Get user profile with list statistics.

#### `POST /api/status-check`

Find media that finished airing/publishing but the user hasn't completed.

#### `POST /api/status-track/register`

Register for periodic status notifications.

#### `POST /api/status-track/status`

Get tracking status and recent notifications.

#### `POST /api/status-track/unregister`

Stop status tracking for a user.

Full docs: [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md)

---

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `AUTH_REQUIRED` | 401 | Missing `X-API-Key` header |
| `INVALID_API_KEY` | 401 | Wrong API key |
| `INVALID_TOKEN` | 401 | AniList/MAL token invalid or expired |
| `TOKEN_MISMATCH` | 403 | Token belongs to a different user |
| `LIST_PRIVATE` | 403 | User's list is private |
| `USER_NOT_FOUND` | 404 | User not found |
| `INVALID_REQUEST` | 400 | Invalid request body |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Project Structure

```
missing-sequel-api/
├── .github/workflows/
│   └── deploy-missing-sequel.yml   # GitHub Actions CI/CD
├── src/
│   ├── index.ts                    # Entry point (Hono server)
│   ├── db/
│   │   ├── connection.ts           # SQLite connection
│   │   ├── migrate.ts              # Auto migration runner
│   │   └── schema.sql              # Database schema
│   ├── routes/
│   │   ├── health.ts               # GET /api/health
│   │   ├── check.ts                # POST /api/check
│   │   ├── upcoming.ts             # POST /api/upcoming
│   │   ├── franchise.ts            # POST /api/franchise
│   │   ├── user.ts                 # POST /api/user
│   │   ├── status-check.ts         # POST /api/status-check
│   │   └── status-track.ts         # POST /api/status-track/*
│   ├── services/
│   │   ├── processor.ts            # Main check processor
│   │   ├── jikan.ts                # MAL API relations fetcher (50-concurrent)
│   │   ├── mal.ts                  # MAL user list fetcher
│   │   ├── anilist.ts              # AniList GraphQL client
│   │   ├── cache.ts                # LRU cache
│   │   ├── statusTracker.ts        # Status tracking logic
│   │   └── scheduler.ts            # Cron scheduler
│   ├── middleware/
│   │   ├── auth.ts                 # API key authentication
│   │   ├── validator.ts            # Zod request validation
│   │   ├── logger.ts               # Request logging
│   │   └── rateLimit.ts            # Rate limiting
│   ├── utils/
│   │   ├── mediaFormatter.ts       # Unified media format
│   │   ├── franchiseBuilder.ts     # Franchise timeline builder
│   │   ├── idMapper.ts             # AniList ↔ MAL ID mapping
│   │   ├── relationPriority.ts     # Relation type priority
│   │   └── dateUtils.ts            # Date helpers
│   └── types/
│       ├── api.ts                  # API response types
│       ├── media.ts                # Unified media types
│       ├── mal.ts                  # MAL API types
│       └── anilist.ts              # AniList types
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── tsconfig.json
```

---

## License

Private — Built for AnymeX.
