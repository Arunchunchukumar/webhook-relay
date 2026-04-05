/**
 * Webhook ingestion route.
 *
 * POST /webhooks/:source — Receives a webhook, routes it through the relay
 * service, and enqueues notifications for delivery.
 */

import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import type { RelayService } from "../services/relay.js";
import type { RetryQueue } from "../services/queue.js";
import type { WebhookEvent, WebhookSource } from "../types/index.js";

const VALID_SOURCES: Set<string> = new Set(["github", "stripe", "slack", "custom"]);

export function createWebhookRouter(relay: RelayService, queue: RetryQueue): Router {
  const router = Router();

  router.post("/:source", async (req: Request, res: Response) => {
    const source = req.params.source;

    // Validate source
    if (!VALID_SOURCES.has(source)) {
      res.status(400).json({
        error: `Invalid webhook source: '${source}'. Valid: ${[...VALID_SOURCES].join(", ")}`,
      });
      return;
    }

    // Build event
    const event: WebhookEvent = {
      id: randomUUID(),
      source: source as WebhookSource,
      timestamp: new Date(),
      headers: req.headers as Record<string, string>,
      body: req.body ?? {},
    };

    // Route to notifications
    const notifications = relay.routeEvent(event);

    if (notifications.length === 0) {
      res.status(200).json({
        eventId: event.id,
        message: "Webhook received but no destinations configured.",
        delivered: 0,
      });
      return;
    }

    // Enqueue all notifications
    const jobIds: string[] = [];
    for (const notification of notifications) {
      const jobId = queue.enqueue(notification);
      jobIds.push(jobId);
    }

    res.status(202).json({
      eventId: event.id,
      message: `Webhook accepted. ${notifications.length} notification(s) queued.`,
      jobs: jobIds,
    });
  });

  return router;
}
