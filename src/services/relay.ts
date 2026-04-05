/**
 * Relay Service — Routes notifications to configured destinations.
 *
 * Supports Slack (incoming webhook), Discord (webhook), and Email (SMTP).
 * Each destination handler formats the message appropriately for the platform.
 */

import { createTransport, type Transporter } from "nodemailer";
import type { AppConfig } from "../config/index.js";
import type { Notification, DeliveryResult, WebhookEvent } from "../types/index.js";

export class RelayService {
  private config: AppConfig;
  private mailer: Transporter | null = null;

  constructor(config: AppConfig) {
    this.config = config;

    // Initialize SMTP transport if configured
    if (config.email) {
      this.mailer = createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    }
  }

  /**
   * Transform a raw webhook event into notifications based on routing rules.
   */
  routeEvent(event: WebhookEvent): Notification[] {
    const notifications: Notification[] = [];
    const summary = this.summarizeEvent(event);

    // Route to all configured destinations
    if (this.config.slack) {
      notifications.push({
        destination: "slack",
        title: summary.title,
        message: summary.message,
        metadata: { source: event.source },
      });
    }

    if (this.config.discord) {
      notifications.push({
        destination: "discord",
        title: summary.title,
        message: summary.message,
        metadata: { source: event.source },
      });
    }

    if (this.config.email) {
      notifications.push({
        destination: "email",
        title: summary.title,
        message: summary.message,
        metadata: { source: event.source },
      });
    }

    return notifications;
  }

  /**
   * Deliver a single notification to its destination.
   */
  async deliver(notification: Notification, attempt: number = 1): Promise<DeliveryResult> {
    try {
      switch (notification.destination) {
        case "slack":
          return await this.deliverToSlack(notification, attempt);
        case "discord":
          return await this.deliverToDiscord(notification, attempt);
        case "email":
          return await this.deliverToEmail(notification, attempt);
        default:
          return {
            success: false,
            destination: notification.destination,
            error: `Unknown destination: ${notification.destination}`,
            attemptNumber: attempt,
          };
      }
    } catch (err: any) {
      return {
        success: false,
        destination: notification.destination,
        error: err.message ?? "Unknown delivery error",
        attemptNumber: attempt,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Destination handlers
  // -----------------------------------------------------------------------

  private async deliverToSlack(
    notification: Notification,
    attempt: number
  ): Promise<DeliveryResult> {
    if (!this.config.slack) {
      return { success: false, destination: "slack", error: "Slack not configured", attemptNumber: attempt };
    }

    const payload = {
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: notification.title, emoji: true },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: notification.message },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Source: *${notification.metadata?.source ?? "unknown"}* | Delivered by Webhook Relay`,
            },
          ],
        },
      ],
    };

    const resp = await fetch(this.config.slack.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      success: resp.ok,
      destination: "slack",
      statusCode: resp.status,
      error: resp.ok ? undefined : `Slack returned ${resp.status}`,
      attemptNumber: attempt,
    };
  }

  private async deliverToDiscord(
    notification: Notification,
    attempt: number
  ): Promise<DeliveryResult> {
    if (!this.config.discord) {
      return { success: false, destination: "discord", error: "Discord not configured", attemptNumber: attempt };
    }

    const payload = {
      embeds: [
        {
          title: notification.title,
          description: notification.message,
          color: 0x5865f2, // Discord blurple
          footer: {
            text: `Source: ${notification.metadata?.source ?? "unknown"} | Webhook Relay`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const resp = await fetch(this.config.discord.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      success: resp.ok || resp.status === 204,
      destination: "discord",
      statusCode: resp.status,
      error: resp.ok || resp.status === 204 ? undefined : `Discord returned ${resp.status}`,
      attemptNumber: attempt,
    };
  }

  private async deliverToEmail(
    notification: Notification,
    attempt: number
  ): Promise<DeliveryResult> {
    if (!this.mailer || !this.config.email) {
      return { success: false, destination: "email", error: "Email not configured", attemptNumber: attempt };
    }

    await this.mailer.sendMail({
      from: this.config.email.from,
      to: this.config.email.to,
      subject: `[Webhook Relay] ${notification.title}`,
      text: notification.message,
      html: `<h2>${notification.title}</h2><p>${notification.message}</p><hr><small>Source: ${notification.metadata?.source ?? "unknown"}</small>`,
    });

    return {
      success: true,
      destination: "email",
      attemptNumber: attempt,
    };
  }

  // -----------------------------------------------------------------------
  // Event summarization
  // -----------------------------------------------------------------------

  private summarizeEvent(event: WebhookEvent): { title: string; message: string } {
    const body = event.body as Record<string, any>;

    switch (event.source) {
      case "github":
        return this.summarizeGitHub(body);
      case "stripe":
        return this.summarizeStripe(body);
      default:
        return {
          title: `Webhook received from ${event.source}`,
          message: `Payload keys: ${Object.keys(body).join(", ")}`,
        };
    }
  }

  private summarizeGitHub(body: Record<string, any>): { title: string; message: string } {
    const action = body.action ?? "unknown";
    const repo = body.repository?.full_name ?? "unknown";

    if (body.pull_request) {
      const pr = body.pull_request;
      return {
        title: `PR ${action}: #${pr.number} in ${repo}`,
        message: `*${pr.title}*\nBy ${pr.user?.login ?? "unknown"} | +${pr.additions ?? 0} -${pr.deletions ?? 0}\n${pr.html_url ?? ""}`,
      };
    }

    if (body.issue) {
      return {
        title: `Issue ${action}: #${body.issue.number} in ${repo}`,
        message: `*${body.issue.title}*\nBy ${body.issue.user?.login ?? "unknown"}\n${body.issue.html_url ?? ""}`,
      };
    }

    return {
      title: `GitHub event: ${action} in ${repo}`,
      message: `Action: ${action}\nRepository: ${repo}`,
    };
  }

  private summarizeStripe(body: Record<string, any>): { title: string; message: string } {
    const type = body.type ?? "unknown";
    const obj = body.data?.object ?? {};
    return {
      title: `Stripe: ${type}`,
      message: `ID: ${obj.id ?? "N/A"}\nAmount: ${obj.amount ? `$${(obj.amount / 100).toFixed(2)}` : "N/A"}\nStatus: ${obj.status ?? "N/A"}`,
    };
  }
}
