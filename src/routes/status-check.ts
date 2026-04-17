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

  const { platform, user_id, token, media_type } = validation.data;

  try {
    const startTime = Date.now();
    const result = await checkUserMediaStatus({
      platform,
      user_id,
      token,
      media_type,
    });
    const responseTime = Date.now() - startTime;

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
