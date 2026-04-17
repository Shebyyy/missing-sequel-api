import { Hono } from 'hono';
import { processCheck, ProcessorError } from '../services/processor.js';
import { validateRequest, checkRequestSchema } from '../middleware/validator.js';

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

  const { platform, user_id, token, media_type } = validation.data;

  try {
    const startTime = Date.now();
    const result = await processCheck({
      platform,
      user_id,
      token,
      media_type,
      include_upcoming: true,
      include_adaptations: false,
      sort_by: 'release_date',
    });
    const responseTime = Date.now() - startTime;

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
