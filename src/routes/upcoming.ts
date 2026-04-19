import { Hono } from 'hono';
import { processCheck, ProcessorError } from '../services/processor.js';
import { validateRequest, checkRequestSchema } from '../middleware/validator.js';
import { verifyAniListToken } from '../services/anilist.js';
import { verifyMalToken } from '../services/mal.js';

const upcoming = new Hono();

upcoming.post('/', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(checkRequestSchema, body);

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
    const result = await processCheck({
      platform,
      user_id,
      token,
      media_type: media_type ?? 'ALL',
      include_upcoming: true,
      include_adaptations: false,
      sort_by: 'release_date',
    });
    const responseTime = Date.now() - startTime;

    if (compact) {
      return c.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          platform: result.user.platform,
        },
        upcoming: result.upcoming.map(u => ({
          id: u.upcoming.id,
          id_mal: u.upcoming.id_mal,
          id_anilist: u.upcoming.id_anilist,
          title: u.upcoming.title.preferred,
          type: u.upcoming.type,
          format: u.upcoming.format,
          status: u.upcoming.status,
          cover_image: u.upcoming.cover_image?.extra_large || u.upcoming.cover_image?.large || u.upcoming.cover_image?.medium || null,
          episodes: u.upcoming.episodes,
          chapters: u.upcoming.chapters,
          average_score: u.upcoming.average_score,
          start_date: u.upcoming.start_date,
          relation: u.relation_type,
          from_title: u.watched.title.preferred,
        })),
        total_upcoming: result.upcoming.length,
        response_time_ms: responseTime,
      });
    }

    return c.json({
      success: true,
      user: result.user,
      upcoming: result.upcoming,
      total_upcoming: result.upcoming.length,
      response_time_ms: responseTime,
    });
  } catch (err: unknown) {
    if (err instanceof ProcessorError) {
      return c.json({
        success: false,
        error: err.code,
        message: err.message,
        code: err.status,
      }, err.status as 400);
    }

    return c.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
      code: 500,
    }, 500);
  }
});

export default upcoming;
