# ─── Build stage ────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production=false

COPY tsconfig.json ./
COPY src/ ./src/

# ─── Runtime stage ──────────────────────────────────────────────────
FROM oven/bun:1-slim
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/package.json ./
# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
ENV DB_PATH=/app/data/sequel-api.db

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

# Run migrations (reads schema.sql from src/db/) then start
CMD ["sh", "-c", "bun run src/db/migrate.ts && exec dumb-init bun src/index.ts"]
