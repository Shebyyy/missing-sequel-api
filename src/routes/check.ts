import { Hono } from 'hono';
import { processCheck, ProcessorError } from '../services/processor.js';
import { validateRequest, checkRequestSchema } from '../middleware/validator.js';
import { verifyAniListToken } from '../services/anilist.js';
import { fetchMalProfile } from '../services/mal.js';

const check = new Hono();

check.post('/', async (c) => {
  const body = await c.req.json();
  const validation = validateRequest(checkRequestSchema, body);

  if (!validation.success) {
    return c.json({
      success: false,
      error: 'INVALID_REQUEST',
      message: 'Invalid request body',
      details: validation.errors.errors.map(e => e.message),
      code: 400,
    }, 400);
  }

  const { platform, user_id, token, media_type, include_upcoming, include_adaptations, sort_by, compact } = validation.data;

  try {
    // Verify token if provided
    if (token) {
      if (platform === 'anilist') {
        try {
          const viewer = await verifyAniListToken(token);
          if (viewer.id !== user_id) {
            return c.json({
              success: false,
              error: 'TOKEN_MISMATCH',
              message: `Token belongs to a different user. Token user: ${viewer.id}, requested user_id: ${user_id}`,
              code: 403,
            }, 403);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return c.json({
            success: false,
            error: 'INVALID_TOKEN',
            message: 'Token is invalid or has expired',
            platform,
            code: 401,
          }, 401);
        }
      }
    }

    const startTime = Date.now();
    const result = await processCheck({
      platform,
      user_id,
      token,
      media_type,
      include_upcoming,
      include_adaptations,
      sort_by,
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
        total_entries: result.summary.total_missing,
        total_upcoming: result.upcoming.length,
        missing: result.missing.map(m => ({
          from: {
            id: m.watched.id,
            title: m.watched.title.preferred,
            type: m.watched.type,
            format: m.watched.format,
            status: m.watched.user_list_entry?.status,
          },
          missing: {
            id: m.missing.id,
            id_mal: m.missing.id_mal,
            id_anilist: m.missing.id_anilist,
            title: m.missing.title.preferred,
            type: m.missing.type,
            format: m.missing.format,
            status: m.missing.status,
            cover_image: m.missing.cover_image?.extra_large || m.missing.cover_image?.large || m.missing.cover_image?.medium || null,
            episodes: m.missing.episodes,
            chapters: m.missing.chapters,
            average_score: m.missing.average_score,
            start_date: m.missing.start_date,
          },
          relation: m.relation_type,
        })),
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
          start_date: u.upcoming.start_date,
          relation: u.relation_type,
          from_title: u.watched.title.preferred,
        })),
        response_time_ms: responseTime,
      });
    }

    return c.json({
      success: true,
      ...result,
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

export default check;
