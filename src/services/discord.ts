/**
 * Discord notification service.
 *
 * Sends messages to Discord channels via incoming webhooks.
 * No bot token required - just a webhook URL.
 */

import { config } from '../config.js';

/**
 * Send a message to a Discord channel via webhook.
 *
 * @param content - Message text (supports Discord markdown)
 * @param username - Optional bot username override
 */
export async function sendDiscordMessage(
  content: string,
  username = 'Webhook Relay',
): Promise<void> {
  if (!config.discord.webhookUrl) {
    console.warn('Discord webhook URL not configured, skipping notification');
    return;
  }

  const response = await fetch(config.discord.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: content.slice(0, 2000), // Discord message limit
      username,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Discord webhook error: ${response.status} ${text}`);
    throw new Error(`Failed to send Discord message: ${response.status}`);
  }
}
