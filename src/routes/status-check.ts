import { Hono } from 'hono';
import { checkUserMediaStatus } from '../services/statusTracker.js';
import { validateRequest, statusCheckRequestSchema } from '../middleware/validator.js';
import { verifyAniListToken } from '../services/anilist.js';
import { verifyMalToken } from '../services/mal.js';

const statusCheck = new Hono();

statusCheck.post('/', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(statusCheckRequestSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      code: 400,
    }, 400);
  }

  let { platform, user_id, token, media_type, compact } = validation.data;

  try {
    if (token) {
      if (platform === 'anilist') {
        try {
          const viewer = await verifyAniListToken(token);
          if (!user_id) {
            user_id = viewer.id;
          }
        } catch {
          return c.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: 'Token is invalid or has expired',
            platform,
            code: 401,
          }, 401);
        }
      } else if (platform === 'mal') {
        try {
          const malUser = await verifyMalToken(token!);
          if (!user_id) {
            user_id = malUser.name;
          }
        } catch {
          return c.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: 'MAL token is invalid or has expired',
            platform,
            code: 401,
          }, 401);
        }
      }
    }

    if (!user_id) {
      return c.json({
        success: false,
        error: 'MISSING_USER_ID',
        message: 'Could not resolve user_id. Provide user_id or a valid token.',
        code: 400,
      }, 400);
    }

    const startTime = Date.now();
    const result = await checkUserMediaStatus({
      platform,
      user_id,
      token: token!,
      media_type: media_type ?? 'ALL',
    });
    const responseTime = Date.now() - startTime;

    if (compact) {
      return c.json({
        success: true,
        user_id,
        platform,
        summary: result.summary,
        finished_not_completed: result.results.map(r => ({
          id: r.media.id,
          id_mal: r.media.id_mal,
          id_anilist: r.media.id_anilist,
          title: r.media.title.preferred,
          type: r.media.type,
          format: r.media.format,
          status: r.media.status,
          cover_image: r.media.cover_image?.extra_large || r.media.cover_image?.large || r.media.cover_image?.medium || null,
          episodes: r.media.episodes,
          chapters: r.media.chapters,
          average_score: r.media.average_score,
          start_date: r.media.start_date,
          user_status: r.user_status,
          progress: r.progress,
          remaining: r.remaining,
        })),
        total: result.results.length,
        response_time_ms: responseTime,
      });
    }

    return c.json({
      success: true,
      user_id,
      platform,
      ...result,
      response_time_ms: responseTime,
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

export default statusCheck;
