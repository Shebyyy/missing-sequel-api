# API Reference

Complete endpoint documentation for Missing Sequel API.

---

## Base URL

```
http://your-vps-ip:3002
```

## Authentication

All endpoints except `/api/health` require an API key sent via header:

```
X-API-Key: your-api-key
X-App-ID: anymex (optional, for rate limiting per app)
```

---

## Endpoints

### `GET /api/health`

Public health check.

**Request:**
```
GET /api/health
```

**Response:** `200 OK`
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

Scan a user's list for missing sequels, prequels, spin-offs, and other related media.

**Request:**
```
POST /api/check
X-API-Key: your-api-key
Content-Type: application/json
```

```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-anilist-token",
  "media_type": "ALL",
  "include_upcoming": true,
  "include_adaptations": false,
  "sort_by": "relation_priority"
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

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": 12345,
    "username": "example",
    "platform": "anilist",
    "avatar": { "large": "https://...", "medium": "https://..." }
  },
  "total_entries": 1625,
  "entries_with_relations": 1265,
  "total_missing": 1771,
  "missing": [
    {
      "from_media": {
        "id": "anilist_16498",
        "id_anilist": 16498,
        "id_mal": 32281,
        "title": { "preferred": "Kimetsu no Yaiba", "english": "Demon Slayer", "romaji": "Kimetsu no Yaiba", "native": "鬼滅の刃" },
        "type": "ANIME",
        "format": "TV",
        "status": "FINISHED",
        "episodes": 26,
        "average_score": 84,
        "cover_image": "https://...",
        "user_status": "COMPLETED"
      },
      "missing_media": [
        {
          "id": "anilist_11757",
          "id_anilist": 11757,
          "id_mal": 29951,
          "title": { "preferred": "Kimetsu no Yaiba: Mugen Train-hen" },
          "type": "ANIME",
          "format": "MOVIE",
          "status": "FINISHED",
          "episodes": 1,
          "average_score": 87,
          "cover_image": "https://...",
          "relation_type": "SEQUEL",
          "relation_priority": 1
        }
      ]
    }
  ],
  "upcoming": [
    {
      "id": "anilist_143562",
      "id_anilist": 143562,
      "title": { "preferred": "Kimetsu no Yaiba: Infinity Castle-hen" },
      "type": "ANIME",
      "format": "TV",
      "status": "NOT_YET_RELEASED",
      "episodes": null,
      "average_score": null,
      "cover_image": "https://...",
      "relation_type": "SEQUEL",
      "from_media_title": "Kimetsu no Yaiba: Hashira Training-hen"
    }
  ],
  "response_time_ms": 110000
}
```

**Error Responses:**

| Code | Status | When |
|---|---|---|
| `INVALID_REQUEST` | 400 | Missing or invalid fields |
| `USER_NOT_FOUND` | 404 | User doesn't exist |
| `LIST_PRIVATE` | 403 | Private list without token |
| `INVALID_TOKEN` | 401 | Token expired or wrong |
| `TOKEN_MISMATCH` | 403 | Token belongs to different user |

---

### `POST /api/upcoming`

Get upcoming sequels only. Shorthand for `/api/check` with forced settings.

**Request:** Same body as `/api/check` (without `include_upcoming` and `sort_by`).

**Response:** `200 OK`
```json
{
  "success": true,
  "user": { "...": "..." },
  "upcoming": [ "..." ],
  "total_upcoming": 92,
  "response_time_ms": 110000
}
```

---

### `POST /api/franchise`

Get complete franchise timeline for a specific media.

**Request:**
```json
{
  "platform": "anilist",
  "media_id": 16498,
  "include_full_info": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `platform` | `anilist` \| `mal` | Yes | — | Platform |
| `media_id` | `number` | Yes | — | AniList media ID |
| `mal_id` | `number` | No | — | MAL media ID (alternative) |
| `include_full_info` | `boolean` | No | `true` | Return full media details or summary |

**Response:** `200 OK`
```json
{
  "success": true,
  "franchise": {
    "id": "franchise_16498",
    "name": "Kimetsu no Yaiba",
    "entries": [
      {
        "id": "anilist_16498",
        "title": { "preferred": "Kimetsu no Yaiba" },
        "type": "ANIME",
        "format": "TV",
        "status": "FINISHED",
        "episodes": 26,
        "start_date": { "year": 2019, "month": 4, "day": 6 },
        "average_score": 84,
        "relations": [ "..." ]
      }
    ],
    "total_entries": 8
  }
}
```

---

### `POST /api/user`

Get user profile with statistics.

**Request:**
```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token"
}
```

**Response:** `200 OK`
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
    "options": {
      "title_language": "romaji",
      "display_adult_content": false,
      "profile_color": "#2d3436"
    },
    "stats": {
      "anime": {
        "total": 500,
        "watching": 10,
        "completed": 400,
        "on_hold": 30,
        "dropped": 20,
        "plan_to_watch": 40,
        "total_episodes_watched": 8000,
        "mean_score": 7.5
      },
      "manga": { "..." }
    }
  }
}
```

---

### `POST /api/status-check`

Find media that finished airing/publishing but user hasn't marked as completed.

**Request:**
```json
{
  "platform": "anilist",
  "user_id": 12345,
  "token": "optional-token",
  "media_type": "ANIME"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "user_id": 12345,
  "platform": "anilist",
  "finished_not_completed": [
    {
      "media_id": 16498,
      "title": "Kimetsu no Yaiba",
      "type": "ANIME",
      "format": "TV",
      "episodes": 26,
      "user_progress": 20,
      "remaining": 6,
      "user_status": "WATCHING",
      "media_status": "FINISHED",
      "end_date": { "year": 2019, "month": 6, "day": 30 }
    }
  ],
  "total": 15,
  "response_time_ms": 5000
}
```

---

### `POST /api/status-track/register`

Register for periodic status notifications.

**Request:**
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

**Response:** `200 OK`
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

**Request:**
```json
{
  "platform": "anilist",
  "user_id": 12345
}
```

**Response:** `200 OK`
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
    {
      "sent_at": "2025-01-01T06:00:00.000Z",
      "media_id": 16498,
      "media_title": "Kimetsu no Yaiba",
      "media_type": "ANIME",
      "user_status": "WATCHING",
      "remaining": 6
    }
  ]
}
```

---

### `POST /api/status-track/unregister`

Stop tracking a user.

**Request:**
```json
{
  "platform": "anilist",
  "user_id": 12345
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Tracking stopped for user 12345 on anilist"
}
```

**Error:** `404 NOT_REGISTERED` if user wasn't being tracked.
