/**
 * Application configuration.
 *
 * Loads environment variables and provides typed config objects
 * for the webhook server, notification channels, and routing rules.
 */

import 'dotenv/config';

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(env('PORT', '3000'), 10),
  nodeEnv: env('NODE_ENV', 'development'),

  // Webhook signature secrets
  github: {
    webhookSecret: env('GITHUB_WEBHOOK_SECRET', ''),
  },
  slack: {
    signingSecret: env('SLACK_SIGNING_SECRET', ''),
    botToken: env('SLACK_BOT_TOKEN', ''),
  },
  stripe: {
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
  },

  // Notification destinations
  discord: {
    webhookUrl: env('DISCORD_WEBHOOK_URL', ''),
  },
  email: {
    host: env('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(env('SMTP_PORT', '587'), 10),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
    from: env('EMAIL_FROM', ''),
  },

  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
  },
} as const;

export type Config = typeof config;
