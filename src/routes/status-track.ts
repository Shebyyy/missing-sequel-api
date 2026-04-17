import { Hono } from 'hono';
import { getDb } from '../db/connection.js';
import { validateRequest, statusTrackRegisterSchema, statusTrackStatusSchema, statusTrackUnregisterSchema } from '../middleware/validator.js';
import { hoursFromNow, formatISO } from '../utils/dateUtils.js';

const statusTrack = new Hono();

// Register for periodic notifications
statusTrack.post('/register', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(statusTrackRegisterSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      code: 400,
    }, 400);
  }

  const { platform, user_id, token, media_type, webhook_url, check_interval_hours } = validation.data;

  try {
    const db = getDb();
    const trackingId = `trk_${platform}_${user_id}`;

    // Upsert
    db.prepare(`
      INSERT INTO status_tracking (tracking_id, platform, user_id, token, media_type, webhook_url, check_interval_hours, next_check_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform, user_id) DO UPDATE SET
        token = excluded.token,
        media_type = excluded.media_type,
        webhook_url = excluded.webhook_url,
        check_interval_hours = excluded.check_interval_hours,
        is_active = 1,
        next_check_at = excluded.next_check_at,
        updated_at = datetime('now')
    `).run(trackingId, platform, user_id, token, media_type, webhook_url, check_interval_hours, formatISO(hoursFromNow(check_interval_hours)));

    return c.json({
      success: true,
      tracking_id: trackingId,
      platform,
      user_id,
      media_type,
      check_interval_hours,
      next_check_at: formatISO(hoursFromNow(check_interval_hours)),
      registered_at: new Date().toISOString(),
      message: `User registered for status tracking. Next check in ${check_interval_hours} hours.`,
    });
  } catch (err: unknown) {
    return c.json({
      success: false,
      error: 'DB_ERROR',
      message: err instanceof Error ? err.message : 'Failed to register',
      code: 500,
    }, 500);
  }
});

// Get tracking status
statusTrack.post('/status', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(statusTrackStatusSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      code: 400,
    }, 400);
  }

  const { platform, user_id } = validation.data;

  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT * FROM status_tracking WHERE platform = ? AND user_id = ?
    `).get(platform, user_id) as any;

    if (!row) {
      return c.json({
        success: false,
        error: 'NOT_REGISTERED',
        message: 'User is not registered for status tracking',
        code: 404,
      }, 404);
    }

    const recentNotifs = db.prepare(`
      SELECT * FROM notification_log WHERE tracking_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(row.tracking_id) as Array<any>;

    return c.json({
      success: true,
      tracking: {
        tracking_id: row.tracking_id,
        platform: row.platform,
        user_id: row.user_id,
        media_type: row.media_type,
        is_active: row.is_active === 1,
        check_interval_hours: row.check_interval_hours,
        last_check_at: row.last_check_at,
        next_check_at: row.next_check_at,
        total_checks: row.total_checks,
        total_notifications_sent: row.total_notifications_sent,
        registered_at: row.registered_at,
      },
      recent_notifications: recentNotifs.map(n => ({
        sent_at: n.created_at,
        media_id: n.media_id,
        media_title: n.media_title,
        media_type: n.media_type,
        user_status: n.user_status,
        remaining: n.remaining,
      })),
    });
  } catch (err: unknown) {
    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      code: 500,
    }, 500);
  }
});

// Unregister
statusTrack.post('/unregister', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(statusTrackUnregisterSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      code: 400,
    }, 400);
  }

  const { platform, user_id } = validation.data;

  try {
    const db = getDb();
    const result = db.prepare(`
      UPDATE status_tracking SET is_active = 0, updated_at = datetime('now')
      WHERE platform = ? AND user_id = ?
    `).run(platform, user_id);

    if (result.changes === 0) {
      return c.json({
        success: false,
        error: 'NOT_REGISTERED',
        message: 'User is not registered for status tracking',
        code: 404,
      }, 404);
    }

    return c.json({
      success: true,
      message: `Tracking stopped for user ${user_id} on ${platform}`,
    });
  } catch (err: unknown) {
    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      code: 500,
    }, 500);
  }
});

export default statusTrack;
