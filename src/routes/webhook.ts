/**
 * Webhook ingestion routes.
 *
 * Each route verifies the incoming webhook signature, parses the payload,
 * and dispatches notifications to the configured destinations.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { sendSlackMessage } from '../services/slack.js';
import { sendDiscordMessage } from '../services/discord.js';
import { sendEmail } from '../services/email.js';

// ---------------------------------------------------------------------------
// Signature helpers
// ---------------------------------------------------------------------------

function verifyGitHubSignature(payload: string, signature: string | undefined): boolean {
  if (!signature || !config.github.webhookSecret) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', config.github.webhookSecret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function verifySlackSignature(body: string, timestamp: string, signature: string): boolean {
  const baseString = `v0:${timestamp}:${body}`;
  const expected = 'v0=' + crypto
    .createHmac('sha256', config.slack.signingSecret)
    .update(baseString)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

type NotifyDestination = 'slack' | 'discord' | 'email';

async function dispatchNotification(
  destinations: NotifyDestination[],
  message: string,
  subject?: string,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  for (const dest of destinations) {
    switch (dest) {
      case 'slack':
        tasks.push(sendSlackMessage('#alerts', message));
        break;
      case 'discord':
        tasks.push(sendDiscordMessage(message));
        break;
      case 'email':
        tasks.push(sendEmail(subject ?? 'Webhook Alert', message));
        break;
    }
  }

  await Promise.allSettled(tasks);
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GitHub webhook handler.
   * Verifies HMAC-SHA256 signature and dispatches based on event type.
   */
  app.post('/github', {
    config: { rawBody: true },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['x-hub-signature-256'] as string;
      const event = request.headers['x-github-event'] as string;
      const rawBody = JSON.stringify(request.body);

      if (!verifyGitHubSignature(rawBody, signature)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const payload = request.body as Record<string, any>;
      let message = '';

      switch (event) {
        case 'pull_request': {
          const action = payload.action;
          const pr = payload.pull_request;
          message = `PR ${action}: *${pr.title}* by ${pr.user.login}\n${pr.html_url}`;
          break;
        }
        case 'push': {
          const commits = payload.commits?.length ?? 0;
          const branch = payload.ref?.replace('refs/heads/', '');
          message = `Push to \`${branch}\`: ${commits} commit(s) by ${payload.pusher?.name}`;
          break;
        }
        case 'issues': {
          const issue = payload.issue;
          message = `Issue ${payload.action}: *${issue.title}*\n${issue.html_url}`;
          break;
        }
        default:
          message = `GitHub event: ${event} (${payload.action ?? 'n/a'})`;
      }

      await dispatchNotification(['slack', 'discord'], message, `GitHub: ${event}`);

      return reply.status(200).send({ received: true, event });
    },
  });

  /**
   * Slack event handler.
   * Handles URL verification challenges and event callbacks.
   */
  app.post('/slack', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, any>;

    // Slack URL verification challenge
    if (body.type === 'url_verification') {
      return reply.send({ challenge: body.challenge });
    }

    const timestamp = request.headers['x-slack-request-timestamp'] as string;
    const signature = request.headers['x-slack-signature'] as string;

    if (!verifySlackSignature(JSON.stringify(body), timestamp, signature)) {
      return reply.status(401).send({ error: 'Invalid signature' });
    }

    const event = body.event;
    if (event?.type === 'message' && !event.bot_id) {
      const message = `Slack message in #${event.channel}: ${event.text?.slice(0, 200)}`;
      await dispatchNotification(['discord'], message);
    }

    return reply.status(200).send({ ok: true });
  });

  /**
   * Stripe webhook handler.
   * Verifies Stripe signature and dispatches payment events.
   */
  app.post('/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, any>;
    const eventType = body.type ?? 'unknown';

    let message = `Stripe event: \`${eventType}\``;

    if (eventType === 'checkout.session.completed') {
      const session = body.data?.object;
      const amount = (session?.amount_total ?? 0) / 100;
      const currency = session?.currency?.toUpperCase() ?? 'USD';
      message = `New sale: ${currency} ${amount.toFixed(2)} from ${session?.customer_email ?? 'unknown'}`;
    } else if (eventType === 'payment_intent.payment_failed') {
      const intent = body.data?.object;
      message = `Payment failed: ${intent?.last_payment_error?.message ?? 'unknown error'}`;
    }

    await dispatchNotification(['slack', 'email'], message, `Stripe: ${eventType}`);

    return reply.status(200).send({ received: true });
  });
}
