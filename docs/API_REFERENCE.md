# API Reference

Complete endpoint documentation for Missing Sequel API.

**Base URL:** `http://anymex.duckdns.org:3002`

---

## Authentication

All endpoints except `/api/health` require an API key:

```
X-API-Key: your-api-key
X-App-ID: anymex (optional, for rate limiting per app)
```

## Compact Mode

All endpoints that return media data support `compact` parameter (default: `true`).

| `compact` | Response |
|---|---|
| `true` (default) | Lightweight — IDs, titles, covers, scores, dates |
| `false` | Full — covers, banners, descriptions, genres, tags, studios, external links, relations |

---

## Endpoints

### `GET /api/health`

Public health check. No auth required.

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

### `POST /api/check`

Scan a user's list for missing sequels, prequels, spin-offs.

**Body:**

```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token-for-private-lists",
  "media_type": "ALL",
  "include_upcoming": true,
  "include_adaptations": false,
  "sort_by": "relation_priority",
  "compact": true
}
```

**Parameters:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `platform` | `anilist` \| `mal` | Yes | — | Platform to fetch list from |
| `user_id` | `number` \| `string` | Yes | — | AniList user ID (number) or MAL username (string) |
| `token` | `string` | No | — | User's AniList/MAL token (for private lists) |
| `media_type` | `ANIME` \| `MANGA` \| `ALL` | No | `ALL` | Media type to scan |
| `include_upcoming` | `boolean` | No | `true` | Include upcoming/not-yet-aired media |
| `include_adaptations` | `boolean` | No | `false` | Include cross-type adaptations (anime↔manga) |
| `sort_by` | `relation_priority` \| `release_date` \| `popularity` \| `score` | No | `relation_priority` | How to sort missing media |
| `compact` | `boolean` | No | `true` | Lightweight response. Set `false` for full data |

**Response (compact=true):**

```json
{
  "success": true,
  "user": { "id": 12345, "username": "example", "platform": "anilist" },
  "total_entries": 1771,
  "total_upcoming": 92,
  "missing": [
    {
      "from": { "id": 16498, "title": "Demon Slayer", "type": "ANIME", "format": "TV", "status": "COMPLETED" },
      "missing": { "id": 11757, "id_mal": 29951, "id_anilist": 11757, "title": "Mugen Train", "type": "ANIME", "format": "MOVIE", "status": "FINISHED", "cover_image": "https://...", "episodes": 1, "average_score": 87, "start_date": { "year": 2021, "month": 1, "day": 1 } },
      "relation": "SEQUEL"
    }
  ],
  "upcoming": [
    { "id": 143562, "id_mal": 53540, "id_anilist": 143562, "title": "...", "type": "ANIME", "format": "TV", "status": "NOT_YET_RELEASED", "cover_image": "https://...", "episodes": null, "start_date": null, "relation": "SEQUEL", "from_title": "..." }
  ],
  "response_time_ms": 110000
}
```

**Errors:** `INVALID_REQUEST` (400), `USER_NOT_FOUND` (404), `LIST_PRIVATE` (403), `INVALID_TOKEN` (401), `TOKEN_MISMATCH` (403)

---

### `POST /api/upcoming`

Get upcoming sequels only. Shorthand for `/api/check` with `include_upcoming: true` and `sort_by: release_date` forced.

**Body:** Same as `/api/check` (minus `include_upcoming` and `sort_by`).

**Response (compact=true):**

```json
{
  "success": true,
  "user": { "id": 12345, "username": "example", "platform": "anilist" },
  "upcoming": [
    { "id": 143562, "title": "...", "type": "ANIME", "format": "TV", "status": "NOT_YET_RELEASED", "cover_image": "https://...", "episodes": null, "start_date": null, "relation": "SEQUEL", "from_title": "..." }
  ],
  "total_upcoming": 92,
  "response_time_ms": 110000
}
```

---

### `POST /api/franchise`

Get complete franchise timeline for a specific media.

**Body:**

```json
{
  "platform": "anilist",
  "media_id": 16498,
  "compact": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `platform` | `anilist` \| `mal` | Yes | — | Platform |
| `media_id` | `number` | Yes | — | AniList media ID |
| `mal_id` | `number` | No | — | MAL media ID (alternative) |
| `compact` | `boolean` | No | `true` | Lightweight response. Set `false` for full data |

**Response (compact=true):**

```json
{
  "success": true,
  "franchise": {
    "id": "franchise_16498",
    "name": "Kimetsu no Yaiba",
    "entries": [
      { "id": 16498, "id_mal": 32281, "id_anilist": 16498, "title": { "preferred": "Kimetsu no Yaiba" }, "type": "ANIME", "format": "TV", "status": "FINISHED", "episodes": 26, "chapters": null, "average_score": 84, "cover_image": "https://...", "start_date": { "year": 2019, "month": 4, "day": 6 } }
    ],
    "total_entries": 8
  }
}
```

---

### `POST /api/user`

Get user profile with list statistics. Already lightweight — no `compact` needed.

**Body:**

```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": 12345,
    "id_mal": null,
    "id_anilist": 12345,
    "username": "example",
    "platform": "anilist",
    "avatar": { "large": "https://...", "medium": "https://..." },
    "banner": "https://...",
    "options": { "title_language": "romaji", "display_adult_content": false, "profile_color": "#2d3436" },
    "stats": {
      "anime": { "total": 500, "watching": 10, "completed": 400, "on_hold": 30, "dropped": 20, "plan_to_watch": 40, "total_episodes_watched": 8000, "mean_score": 7.5 },
      "manga": { "total": 100, "reading": 5, "completed": 80, "on_hold": 5, "dropped": 5, "plan_to_read": 5, "total_chapters_read": 3000, "mean_score": 7.2 }
    }
  }
}
```

---

### `POST /api/status-check`

Find media that finished airing/publishing but user hasn't marked as completed.

**Body:**

```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token",
  "media_type": "ANIME",
  "compact": true
}
```

**Response (compact=true):**

```json
{
  "success": true,
  "user_id": 12345,
  "platform": "anilist",
  "summary": { "total_in_list": 500, "finished_not_completed": 15 },
  "finished_not_completed": [
    { "id": 16498, "id_mal": 32281, "id_anilist": 16498, "title": "Kimetsu no Yaiba", "type": "ANIME", "format": "TV", "status": "FINISHED", "cover_image": "https://...", "episodes": 26, "chapters": null, "user_status": "WATCHING", "progress": 20, "remaining": 6 }
  ],
  "total": 15,
  "response_time_ms": 5000
}
```

---

### `POST /api/status-track/register`

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
| `token` | `string` | **Yes** | — | User's platform token |
| `webhook_url` | `string` | No | — | Webhook URL for notifications |
| `check_interval_hours` | `number` | No | `6` | Interval in hours (1–168) |

**Response:**

```json
{
  "success": true,
  "tracking_id": "trk_anilist_12345",
  "platform": "anilist",
  "user_id": 12345,
  "media_type": "ANIME",
  "check_interval_hours": 6,
  "next_check_at": "2025-01-01T06:00:00.000Z",
  "registered_at": "2025-01-01T00:00:00.000Z",
  "message": "User registered for status tracking. Next check in 6 hours."
}
```

---

### `POST /api/status-track/status`

Get tracking status and recent notifications.

**Body:**

```json
{
  "platform": "anilist",
  "user_id": 12345
}
```

**Response:**

```json
{
  "success": true,
  "tracking": {
    "tracking_id": "trk_anilist_12345",
    "platform": "anilist",
    "user_id": 12345,
    "media_type": "ANIME",
    "is_active": true,
    "check_interval_hours": 6,
    "last_check_at": "2025-01-01T06:00:00.000Z",
    "next_check_at": "2025-01-01T12:00:00.000Z",
    "total_checks": 42,
    "total_notifications_sent": 5,
    "registered_at": "2025-01-01T00:00:00.000Z"
  },
  "recent_notifications": [
    { "sent_at": "2025-01-01T06:00:00.000Z", "media_id": 16498, "media_title": "Kimetsu no Yaiba", "media_type": "ANIME", "user_status": "WATCHING", "remaining": 6 }
  ]
}
```

---

### `POST /api/status-track/unregister`

Stop tracking a user.

**Body:**

```json
{
  "platform": "anilist",
  "user_id": 12345
}
```

**Response:** `404 NOT_REGISTERED` if user wasn't being tracked.

```json
{
  "success": true,
  "message": "Tracking stopped for user 12345 on anilist"
}
```
