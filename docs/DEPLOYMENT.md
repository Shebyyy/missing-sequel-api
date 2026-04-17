# Deployment Guide

How to deploy Missing Sequel API to your VPS.

---

## Prerequisites

- VPS with Docker already installed (if you have Supabase running, you're good)
- GitHub repository with the project code
- MAL API Client ID from [myanimelist.net/apiconfig](https://myanimelist.net/apiconfig)

---

## GitHub Secrets Setup

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 4 secrets:

### `SERVER_IP`

Your VPS IP address.

```
123.45.67.89
```

### `SSH_PASSWORD`

Your VPS root user SSH password.

### `MAL_CLIENT_ID`

Your MAL API Client ID.

```
5372c21d7706e24a124e8ee1fecc5c93
```

### `API_KEY`

Any strong string — this is what clients (AnymeX) send in the `X-API-Key` header.

```
xK9mP2vL7nQ4wR8-anything-secure
```

---

## Deployment

### Automatic (Recommended)

Push to `main` branch:

```bash
git add .
git commit -m "deploy"
git push origin main
```

GitHub Actions will:
1. Copy source files to your VPS via SCP
2. SSH into VPS
3. Create `.env` from secrets (if not exists)
4. Build Docker image (`docker compose build --no-cache`)
5. Restart container (`docker compose down && docker compose up -d`)
6. Wait 15 seconds
7. Show container status, logs, and health check

### Manual Trigger

Go to **Actions** tab → **Deploy Missing Sequel API** → **Run workflow**

---

## Port Configuration

| Service | Port | Conflict? |
|---|---|---|
| Supabase | 3001 | No |
| Missing Sequel API | **3002** | No |

They run in completely separate Docker containers with separate networks and volumes. No conflict possible.

---

## First-Time Verification

After first deploy, check:

```bash
# Health check
curl http://YOUR_VPS_IP:3002/api/health

# Test with API key
curl -X POST http://YOUR_VPS_IP:3002/api/check \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"platform":"mal","user_id":"ASheby"}'
```

---

## Useful Docker Commands

On your VPS:

```bash
cd /root/missing-sequel-api

# View logs
docker compose logs -f

# View last 50 lines
docker compose logs --tail=50

# Restart
docker compose restart

# Rebuild and restart
docker compose up -d --build

# Stop
docker compose down

# Container status
docker compose ps

# View resource usage
docker stats missing-sequel-api
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs --tail=100
```

### Health check failing

```bash
# Check if port is in use
ss -tlnp | grep 3002

# Test from inside container
docker compose exec missing-sequel-api wget -qO- http://localhost:3002/api/health
```

### Rebuild from scratch

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database issues

The SQLite database is stored in a Docker volume (`sequel-api-data`) at `/app/data/sequel-api.db` inside the container. It persists across restarts but is deleted if you remove the volume:

```bash
# Reset database (WARNING: deletes all data)
docker compose down -v
docker compose up -d --build
```
