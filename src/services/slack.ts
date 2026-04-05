/**
 * Slack notification service.
 *
 * Sends messages to Slack channels using the Web API (chat.postMessage).
 * Requires a bot token with chat:write scope.
 */

import { config } from '../config.js';

interface SlackResponse {
  ok: boolean;
  error?: string;
}

/**
 * Send a message to a Slack channel.
 *
 * @param channel - Channel name (e.g., '#alerts') or channel ID
 * @param text - Message text (supports mrkdwn formatting)
 */
export async function sendSlackMessage(channel: string, text: string): Promise<void> {
  if (!config.slack.botToken) {
    console.warn('Slack bot token not configured, skipping notification');
    return;
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.slack.botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
    }),
  });

  const data: SlackResponse = await response.json();

  if (!data.ok) {
    console.error(`Slack API error: ${data.error}`);
    throw new Error(`Failed to send Slack message: ${data.error}`);
  }
}
