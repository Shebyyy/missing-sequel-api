import { Hono } from 'hono';

const health = new Hono();

health.get('/', (c) => {
  return c.json({
    success: true,
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default health;
