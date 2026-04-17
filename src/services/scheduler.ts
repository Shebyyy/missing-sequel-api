import { getDb } from '../db/connection.js';
import { checkUserMediaStatus } from './statusTracker.js';
import { sendWebhook, WebhookPayload } from './webhook.js';
import { formatISO, hoursFromNow } from '../utils/dateUtils.js';
import { verifyAniListToken, AniListError } from './anilist.js';

export function startScheduler(): void {
  console.log('⏰ Status tracker scheduler started');

  // Run every minute
  setInterval(async () => {
    try {
      await processDueChecks();
    } catch (err: unknown) {
      console.error('Scheduler error:', err instanceof Error ? err.message : err);
    }
  }, 60_000);

  // Also run once immediately
  setTimeout(() => processDueChecks(), 5000);
}

async function processDueChecks(): Promise<void> {
  const db = getDb();
  const now = formatISO(new Date());

  const dueRegistrations = db.prepare(`
    SELECT * FROM status_tracking
    WHERE is_active = 1 AND next_check_at <= ?
    ORDER BY last_notification_at ASC NULLS FIRST
    LIMIT 10
  `).all(now) as Array<any>;

  if (dueRegistrations.length === 0) return;

  console.log(`📊 Processing ${dueRegistrations.length} status checks`);

  for (const reg of dueRegistrations) {
    try {
      // Verify token is still valid
      if (reg.platform === 'anilist') {
        try {
          await verifyAniListToken(reg.token);
        } catch {
          db.prepare('UPDATE status_tracking SET is_active = 0 WHERE tracking_id = ?').run(reg.tracking_id);
          console.log(`⚠️ Token expired for ${reg.tracking_id}, deactivated`);
          continue;
        }
      }

      // Run status check
      const result = await checkUserMediaStatus({
        platform: reg.platform,
        user_id: reg.user_id,
        token: reg.token,
        media_type: reg.media_type,
      });

      // Update check stats
      db.prepare(`
        UPDATE status_tracking
        SET last_check_at = ?,
            next_check_at = ?,
            total_checks = total_checks + 1,
            updated_at = datetime('now')
        WHERE tracking_id = ?
      `).run(
        now,
        formatISO(hoursFromNow(reg.check_interval_hours)),
        reg.tracking_id,
      );

      // Send webhook notifications
      if (reg.webhook_url && result.results.length > 0) {
        // Check for recent notifications to avoid duplicates
        const recentNotifs = db.prepare(`
          SELECT media_id FROM notification_log
          WHERE tracking_id = ? AND created_at > datetime('now', '-1 day')
        `).all(reg.tracking_id) as Array<{ media_id: number }>;

        const recentMediaIds = new Set(recentNotifs.map(n => n.media_id));

        for (const item of result.results) {
          if (recentMediaIds.has(item.media.id)) continue;

          const payload: WebhookPayload = {
            tracking_id: reg.tracking_id,
            platform: reg.platform,
            user_id: reg.user_id,
            timestamp: now,
            media: item.media,
            user_list_status: item.user_list_status,
            user_status: item.user_status,
            total_items: item.total_items,
            remaining: item.remaining,
          };

          const webhookResult = await sendWebhook(reg.webhook_url, payload);

          // Log the notification
          db.prepare(`
            INSERT INTO notification_log (tracking_id, platform, user_id, media_id, media_title, media_type, webhook_url, webhook_sent, webhook_status, webhook_response)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            reg.tracking_id,
            reg.platform,
            reg.user_id,
            item.media.id,
            item.media.title.preferred,
            item.media.type,
            reg.webhook_url,
            webhookResult.success ? 1 : 0,
            webhookResult.status || null,
            webhookResult.error || null,
          );

          // Update notification count
          if (webhookResult.success) {
            db.prepare(`
              UPDATE status_tracking
              SET total_notifications_sent = total_notifications_sent + 1,
                  last_notification_at = datetime('now')
              WHERE tracking_id = ?
            `).run(reg.tracking_id);
          }
        }
      }
    } catch (err: unknown) {
      console.error(`Error checking ${reg.tracking_id}:`, err instanceof Error ? err.message : err);
    }
  }
}
