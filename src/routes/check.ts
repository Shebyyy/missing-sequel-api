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

  const { platform, user_id, token, media_type, include_upcoming, include_adaptations, sort_by } = validation.data;

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
