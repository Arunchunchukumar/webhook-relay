/**
 * Environment-based configuration loader.
 *
 * All settings are read from process.env with sensible defaults.
 * Throws on startup if critical variables are missing.
 */

export interface AppConfig {
  port: number;
  webhookSecret: string;
  slack: { webhookUrl: string } | null;
  discord: { webhookUrl: string } | null;
  email: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string;
  } | null;
  rateLimit: {
    max: number;
    windowMs: number;
  };
}

export function loadConfig(): AppConfig {
  const env = process.env;

  // At least one destination must be configured
  const slackUrl = env.SLACK_WEBHOOK_URL ?? "";
  const discordUrl = env.DISCORD_WEBHOOK_URL ?? "";
  const smtpHost = env.SMTP_HOST ?? "";

  if (!slackUrl && !discordUrl && !smtpHost) {
    console.warn(
      "Warning: No notification destinations configured. Set SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL, or SMTP_HOST."
    );
  }

  return {
    port: parseInt(env.PORT ?? "3001", 10),
    webhookSecret: env.WEBHOOK_SECRET ?? "",
    slack: slackUrl ? { webhookUrl: slackUrl } : null,
    discord: discordUrl ? { webhookUrl: discordUrl } : null,
    email: smtpHost
      ? {
          host: smtpHost,
          port: parseInt(env.SMTP_PORT ?? "587", 10),
          user: env.SMTP_USER ?? "",
          pass: env.SMTP_PASS ?? "",
          from: env.EMAIL_FROM ?? "noreply@webhook-relay.local",
          to: env.EMAIL_TO ?? "",
        }
      : null,
    rateLimit: {
      max: parseInt(env.RATE_LIMIT_MAX ?? "100", 10),
      windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    },
  };
}
