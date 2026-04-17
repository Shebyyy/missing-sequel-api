import { Hono } from 'hono';
import { checkUserMediaStatus } from '../services/statusTracker.js';
import { validateRequest, statusCheckRequestSchema } from '../middleware/validator.js';

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

  const { platform, user_id, token, media_type, compact } = validation.data;

  try {
    const startTime = Date.now();
    const result = await checkUserMediaStatus({
      platform,
      user_id,
      token,
      media_type,
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
          cover_image: r.media.cover_image?.medium || r.media.cover_image?.large || null,
          episodes: r.media.episodes,
          chapters: r.media.chapters,
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
