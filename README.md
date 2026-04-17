# Missing Sequel API

A high-performance API for [AnymeX](https://github.com/LalithJ959/AnymeX) that scans anime/manga lists and finds missing sequels, prequels, spin-offs, and adaptations.

Built with **Bun + Hono**, deployed via **Docker** with **GitHub Actions CI/CD**.

---

## Features

- **Missing Media Detection** — Finds sequels, prequels, spin-offs, summaries the user hasn't seen
- **Upcoming Sequels** — Lists upcoming releases related to the user's list
- **Franchise Timeline** — Full franchise view for any media
- **User Profiles** — Fetch user stats from AniList or MAL
- **Status Tracking** — Track when media finishes airing/ publishing
- **Dual Platform** — Supports both AniList and MAL
- **MAL Native API** — Uses MAL's own API (`/v2/anime/{id}`) for relations with 50-concurrent worker pool (~177 items/sec)
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

```bash
curl https://your-vps-ip:3002/api/health
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

---

## API Endpoints

### Public

#### `GET /api/health`

Health check endpoint.

```json
{
  "success": true,
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 12345.678
}
```

---

### Protected (require `X-API-Key` header)

#### `POST /api/check`

Scan a user's list for missing sequels, prequels, spin-offs.

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Body:**
```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-anilist-token-for-private-lists",
  "media_type": "ALL",
  "include_upcoming": true,
  "include_adaptations": false,
  "sort_by": "relation_priority"
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `platform` | `anilist` / `mal` | Yes | — | Platform to fetch list from |
| `user_id` | `number` / `string` | Yes | — | User ID (AniList = number, MAL = username string) |
| `token` | `string` | No | — | AniList/MAL token for private lists |
| `media_type` | `ANIME` / `MANGA` / `ALL` | No | `ALL` | Which media type to scan |
| `include_upcoming` | `boolean` | No | `true` | Include upcoming releases |
| `include_adaptations` | `boolean` | No | `false` | Include anime↔manga adaptations |
| `sort_by` | `relation_priority` / `release_date` / `popularity` / `score` | No | `relation_priority` | Sort order for results |

---

#### `POST /api/upcoming`

Get upcoming sequels only (shortcut for `/api/check` with `include_upcoming: true`).

**Body:** Same as `/api/check` (minus `include_upcoming` and `sort_by` which are forced).

---

#### `POST /api/franchise`

Get full franchise timeline for a specific media.

**Body:**
```json
{
  "platform": "anilist",
  "media_id": 16498,
  "include_full_info": true
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `platform` | `anilist` / `mal` | Yes | Platform |
| `media_id` | `number` | Yes | AniList media ID |
| `mal_id` | `number` | No | MAL media ID (alternative lookup) |
| `include_full_info` | `boolean` | No | Include full media details (default: `true`) |

---

#### `POST /api/user`

Get user profile with list statistics.

**Body:**
```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token-for-private-lists"
}
```

---

#### `POST /api/status-check`

Check media in the user's list that have finished airing/publishing but the user hasn't completed.

**Body:**
```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token",
  "media_type": "ANIME"
}
```

---

#### `POST /api/status-track/register`

Register for periodic status notifications.

**Body:**
```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "user-anilist-token",
  "media_type": "ANIME",
  "webhook_url": "https://example.com/webhook",
  "check_interval_hours": 6
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `token` | `string` | **Yes** | — | User's AniList/MAL token |
| `webhook_url` | `string` | No | — | URL to send notifications |
| `check_interval_hours` | `number` | No | `6` | Check interval (1–168 hours) |

---

#### `POST /api/status-track/status`

Get tracking status and recent notifications.

**Body:**
```json
{
  "platform": "anilist",
  "user_id": 12345
}
```

---

#### `POST /api/status-track/unregister`

Stop status tracking for a user.

**Body:**
```json
{
  "platform": "anilist",
  "user_id": 12345
}
```

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

## Deployment

### Architecture

```
GitHub Push → GitHub Actions → SCP files to VPS → SSH → docker compose up -d --build
```

### Port Mapping

| Service | Port |
|---|---|
| Supabase (existing) | 3001 |
| Missing Sequel API | **3002** |

They are completely independent — different containers, different networks, different volumes.

### Docker Details

- **Image:** `oven/bun:1-slim`
- **Volume:** `sequel-api-data` → `/app/data/` (SQLite database persists)
- **Health check:** `GET http://localhost:3002/api/health` every 30s
- **Restart policy:** `unless-stopped`
- **Logs:** Rotated (10MB max, 3 files)

---

## Performance

| Metric | Value |
|---|---|
| List fetch (1625 anime) | ~9 seconds |
| Relations enrichment (1863 media) | ~101 seconds |
| Total processing time | ~110 seconds |
| Throughput | ~177 items/second |
| Concurrency | 50 parallel requests |
| API used | MAL `/v2/anime/{id}` (native, no rate limit) |

---

## License

Private — Built for AnymeX.
