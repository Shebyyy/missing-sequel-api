import { createMiddleware } from 'hono/factory';
import { getDb } from '../db/connection.js';

// Simple in-memory API key store (loaded from DB on startup)
const appKeys = new Map<string, { app_id: string; rate_limit: number }>();

export function loadApiKeys(): void {
  try {
    const db = getDb();
    const apps = db.prepare('SELECT app_id, api_key, rate_limit_per_min FROM apps WHERE is_active = 1').all() as Array<{ app_id: string; api_key: string; rate_limit_per_min: number }>;
    for (const app of apps) {
      appKeys.set(app.api_key, { app_id: app.app_id, rate_limit: app.rate_limit_per_min });
    }
    console.log(`🔑 Loaded ${appKeys.size} app API keys from DB`);
  } catch {
    console.log('⚠️ Could not load API keys from DB, using env fallback');
  }

  // Always add env/API_KEY fallback if no keys loaded from DB
  if (appKeys.size === 0) {
    const apiKey = process.env.API_KEY || 'dev-key';
    const appId = process.env.APP_ID || 'anymex';
    appKeys.set(apiKey, { app_id: appId, rate_limit: 120 });
    console.log(`🔑 Using fallback API key: ${apiKey}`);
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const apiKey = c.req.header('X-API-Key');
  const appId = c.req.header('X-App-ID');

  if (!apiKey) {
    return c.json({
      success: false,
      error: 'AUTH_REQUIRED',
      message: 'X-API-Key header is required',
      code: 401,
    }, 401);
  }

  const keyData = appKeys.get(apiKey);
  if (!keyData) {
    return c.json({
      success: false,
      error: 'INVALID_API_KEY',
      message: 'Invalid API key',
      code: 401,
    }, 401);
  }

  // Store app info in context
  c.set('app_id', keyData.app_id);
  c.set('rate_limit', keyData.rate_limit);

  await next();
});
