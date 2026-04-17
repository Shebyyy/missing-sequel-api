# Architecture

How Missing Sequel API works internally.

---

## Overview

```
AnymeX App → HTTPS → VPS:3002 → Hono Router → Services → External APIs
                                    ↓
                              SQLite DB (volume)
```

---

## Request Flow

### `/api/check` (Main Endpoint)

```
1. Auth middleware validates X-API-Key
2. Validator checks request body (Zod)
3. If AniList + token → verify token matches user_id
4. Processor:
   a. Fetch user's anime/manga list from MAL or AniList
   b. Extract IDs of completed/watching entries
   c. For each ID → fetch relations from MAL API (/v2/anime/{id})
      - 50 concurrent requests
      - 10s timeout per request
      - 2 retries on failure
   d. Compare user's list against related media
   e. Separate: missing vs upcoming
5. Return unified response
```

---

## Service Layer

### `processor.ts` — Main Orchestrator

Coordinates the entire check flow:
- Fetches user list via MAL or AniList service
- Calls `jikan.ts` to get relations for each entry
- Filters and sorts results
- Returns unified response

### `jikan.ts` — MAL Relations Fetcher

Despite the filename, this uses **MAL's own API** (not Jikan.moe):
- Endpoint: `https://api.myanimelist.net/v2/anime/{id}?fields=related_anime,related_manga`
- Auth: `X-MAL-CLIENT-ID` header
- Concurrency: 50 parallel requests
- Timeout: 10 seconds per request
- Retries: 2 with exponential backoff

### `mal.ts` — MAL User List Fetcher

- Fetches user's anime/manga list via MAL API
- Paginated (handles large lists)
- Returns formatted entries with status, score, progress

### `anilist.ts` — AniList GraphQL Client

- Queries AniList GraphQL API (`https://graphql.anilist.co`)
- Supports user tokens for private lists (passed through from client)
- Fetches user lists and individual media details
- Used for franchise endpoint

### `cache.ts` — LRU Cache

- In-memory LRU cache for API responses
- Avoids re-fetching the same media relations
- TTL-based expiration

---

## Database Schema

SQLite database stored at `/app/data/sequel-api.db` (Docker volume `sequel-api-data`).

### `apps` table

Stores registered apps and their API keys.

```sql
CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  rate_limit_per_min INTEGER DEFAULT 120,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### `status_tracking` table

Stores user registrations for periodic status notifications.

```sql
CREATE TABLE IF NOT EXISTS status_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token TEXT,
  media_type TEXT DEFAULT 'ALL',
  webhook_url TEXT,
  check_interval_hours INTEGER DEFAULT 6,
  is_active INTEGER DEFAULT 1,
  last_check_at TEXT,
  next_check_at TEXT,
  total_checks INTEGER DEFAULT 0,
  total_notifications_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, user_id)
);
```

### `notification_log` table

Log of sent notifications.

```sql
CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT NOT NULL,
  media_id INTEGER,
  media_title TEXT,
  media_type TEXT,
  user_status TEXT,
  remaining INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## Authentication Flow

```
Client Request
     ↓
authMiddleware
     ├── Check X-API-Key header → 401 if missing
     ├── Look up key in appKeys map
     │    ├── Loaded from DB (apps table)
     │    └── Fallback: process.env.API_KEY (if DB empty)
     └── Store app_id + rate_limit in context
     ↓
Route Handler
```

---

## Concurrency Model

```
User list: [anime_1, anime_2, ..., anime_1625]
                ↓
          Split into batches of 50
                ↓
  ┌─────────────────────────────────┐
  │  Batch 1: 50 parallel requests  │ → results
  │  Batch 2: 50 parallel requests  │ → results
  │  Batch 3: 50 parallel requests  │ → results
  │  ...                            │
  └─────────────────────────────────┘
                ↓
          Merge all results
                ↓
          Filter & sort
```

- Each batch of 50 runs in parallel via `Promise.all`
- Batches run sequentially (to avoid connection resets)
- Failed requests retry up to 2 times
- ~177 items/second throughput

---

## Docker Setup

```
┌─────────────────────────────────────────────┐
│  Docker Host (VPS)                          │
│                                             │
│  ┌──────────────┐  ┌────────────────────┐   │
│  │  Supabase    │  │  Missing Sequel    │   │
│  │  Port: 3001  │  │  API Port: 3002    │   │
│  │  Network:    │  │  Network:          │   │
│  │  supabase_*  │  │  sequel-net        │   │
│  └──────────────┘  └────────────────────┘   │
│                           │                  │
│                    ┌──────┴──────┐           │
│                    │ sequel-api  │           │
│                    │ -data (vol) │           │
│                    │ sequel.db   │           │
│                    └─────────────┘           │
└─────────────────────────────────────────────┘
```

- Multi-stage Dockerfile (builder → slim runtime)
- `dumb-init` for proper signal handling
- Health check every 30s
- Auto-migration on startup (`bun run src/db/migrate.ts`)
- Log rotation (10MB × 3 files)
