import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';

// Routes
import health from './routes/health.js';
import check from './routes/check.js';
import upcoming from './routes/upcoming.js';
import franchise from './routes/franchise.js';
import user from './routes/user.js';
import statusCheck from './routes/status-check.js';
import statusTrack from './routes/status-track.js';
import advise from './routes/advise.js';

// Middleware
import { authMiddleware, loadApiKeys } from './middleware/auth.js';
import { loggerMiddleware } from './middleware/logger.js';

// Services
import { startScheduler } from './services/scheduler.js';
import { closeDb } from './db/connection.js';

const app = new Hono();

// Global middleware
app.use('*', cors());
app.use('*', loggerMiddleware);

// Public routes
app.route('/api/health', health);

// Protected routes (require API key)
const protectedRoutes = new Hono();
protectedRoutes.use('*', authMiddleware);
protectedRoutes.route('/check', check);
protectedRoutes.route('/upcoming', upcoming);
protectedRoutes.route('/franchise', franchise);
protectedRoutes.route('/user', user);
protectedRoutes.route('/status-check', statusCheck);
protectedRoutes.route('/status-track', statusTrack);
protectedRoutes.route('/advise', advise);

app.route('/api', protectedRoutes);

// Root
app.get('/', (c) => {
  return c.json({
    name: 'Missing Sequel API',
    version: '1.0.0',
    docs: '/api/health',
    endpoints: [
      'POST /api/check - Scan user list for missing sequels/prequels/spin-offs',
      'POST /api/upcoming - Get upcoming sequels only',
      'POST /api/franchise - Get full franchise timeline',
      'POST /api/user - Get user profile with list stats',
      'POST /api/status-check - Check media that finished but user has not completed',
      'POST /api/status-track/register - Register for periodic status notifications',
      'POST /api/status-track/status - Get tracking status',
      'POST /api/status-track/unregister - Stop tracking',
      'POST /api/advise - AI anime/manga advisor (Gemini + Groq)',
      'GET /api/health - API health check',
    ],
  });
});

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Initialize
loadApiKeys();
// startScheduler();  // TODO: debug later — startScheduler crashes Bun

console.log(`
╔══════════════════════════════════════╗
║     Missing Sequel API v1.0.0       ║
║     Starting on http://${HOST}:${PORT}   ║
╚══════════════════════════════════════╝
`);

    console.log(`\n🚀 Starting Missing Sequel API on port ${PORT}...`);

serve({
      fetch: app.fetch,
      port: PORT,
      hostname: HOST,
    });

    console.log(`✅ Server ready at http://${HOST}:${PORT}`);

// Catch unhandled errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});


