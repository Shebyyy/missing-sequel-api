-- Registered apps
CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT UNIQUE NOT NULL,
  app_name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  rate_limit_per_min INTEGER DEFAULT 60,
  created_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1
);

-- Status tracking registrations
CREATE TABLE IF NOT EXISTS status_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('anilist', 'mal')),
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('ANIME', 'MANGA', 'ALL')),
  webhook_url TEXT,
  check_interval_hours INTEGER DEFAULT 6,
  app_id TEXT,
  is_active INTEGER DEFAULT 1,
  last_check_at TEXT,
  next_check_at TEXT,
  total_checks INTEGER DEFAULT 0,
  total_notifications_sent INTEGER DEFAULT 0,
  last_notification_at TEXT,
  registered_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, user_id)
);

-- Notification log
CREATE TABLE IF NOT EXISTS notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  media_id INTEGER NOT NULL,
  media_title TEXT NOT NULL,
  media_type TEXT NOT NULL,
  webhook_url TEXT,
  webhook_sent INTEGER DEFAULT 0,
  webhook_status INTEGER,
  webhook_response TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (tracking_id) REFERENCES status_tracking(tracking_id)
);

-- Per-check logs
CREATE TABLE IF NOT EXISTS check_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT,
  platform TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  missing_count INTEGER DEFAULT 0,
  upcoming_count INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,
  cache_hit INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Daily aggregated stats
CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  platform TEXT NOT NULL,
  total_checks INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  unique_apps INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  total_status_notifications INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(date, platform)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_status_tracking_active ON status_tracking(is_active, next_check_at);
CREATE INDEX IF NOT EXISTS idx_status_tracking_user ON status_tracking(platform, user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_tracking ON notification_log(tracking_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_log_media ON notification_log(tracking_id, media_id);
CREATE INDEX IF NOT EXISTS idx_check_logs_created ON check_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date, platform);
