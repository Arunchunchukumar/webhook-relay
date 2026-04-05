/**
 * Webhook Relay - Entry point.
 *
 * Starts a Fastify HTTP server that receives webhooks from various
 * sources and routes notifications to configured destinations.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { webhookRoutes } from './routes/webhook.js';

const app = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    transport:
      config.nodeEnv !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// Plugins
await app.register(cors, { origin: true });

// Health check
app.get('/health', async () => ({
  status: 'ok',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// Webhook routes
await app.register(webhookRoutes, { prefix: '/webhooks' });

// Start server
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Webhook Relay listening on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
