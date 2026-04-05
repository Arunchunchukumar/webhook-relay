/**
 * Shared type definitions for Webhook Relay.
 */

/** Supported webhook source identifiers. */
export type WebhookSource = "github" | "stripe" | "slack" | "custom";

/** Supported notification destination types. */
export type DestinationType = "slack" | "discord" | "email";

/** Incoming webhook payload (after parsing). */
export interface WebhookEvent {
  id: string;
  source: WebhookSource;
  timestamp: Date;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** A notification to be delivered. */
export interface Notification {
  destination: DestinationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Result of a delivery attempt. */
export interface DeliveryResult {
  success: boolean;
  destination: DestinationType;
  statusCode?: number;
  error?: string;
  attemptNumber: number;
}

/** Queue job wrapping a notification for retry logic. */
export interface QueueJob {
  id: string;
  notification: Notification;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  createdAt: Date;
  lastError?: string;
}

/** Health check response shape. */
export interface HealthStatus {
  status: "ok" | "degraded";
  uptime: number;
  queue: {
    pending: number;
    failed: number;
    delivered: number;
  };
}
