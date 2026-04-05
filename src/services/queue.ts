/**
 * In-memory retry queue with exponential backoff.
 *
 * Failed notification deliveries are enqueued here and retried up to
 * `maxAttempts` times with increasing delay between attempts.
 */

import { randomUUID } from "node:crypto";
import type { Notification, QueueJob, DeliveryResult } from "../types/index.js";

type DeliveryFn = (notification: Notification) => Promise<DeliveryResult>;

export class RetryQueue {
  private jobs: Map<string, QueueJob> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private deliveryFn: DeliveryFn;
  private stats = { delivered: 0, failed: 0 };

  constructor(deliveryFn: DeliveryFn) {
    this.deliveryFn = deliveryFn;
  }

  /** Start the queue processor. Checks for retryable jobs every 5 seconds. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.processJobs(), 5_000);
    this.timer.unref(); // Don't prevent process exit
  }

  /** Stop the queue processor. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Enqueue a notification for delivery with retry support. */
  enqueue(notification: Notification, maxAttempts: number = 3): string {
    const id = randomUUID();
    const job: QueueJob = {
      id,
      notification,
      attempts: 0,
      maxAttempts,
      nextRetryAt: new Date(), // Deliver immediately on first attempt
      createdAt: new Date(),
    };
    this.jobs.set(id, job);
    return id;
  }

  /** Get current queue statistics. */
  getStats() {
    const pending = [...this.jobs.values()].filter(
      (j) => j.attempts < j.maxAttempts
    ).length;
    return {
      pending,
      failed: this.stats.failed,
      delivered: this.stats.delivered,
    };
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private async processJobs(): Promise<void> {
    const now = new Date();

    for (const [id, job] of this.jobs) {
      if (job.nextRetryAt > now) continue;
      if (job.attempts >= job.maxAttempts) continue;

      job.attempts++;

      try {
        const result = await this.deliveryFn(job.notification);

        if (result.success) {
          this.jobs.delete(id);
          this.stats.delivered++;
        } else {
          job.lastError = result.error ?? "Delivery failed";
          this.scheduleRetry(job);
        }
      } catch (err: any) {
        job.lastError = err.message ?? "Unknown error";
        this.scheduleRetry(job);
      }
    }

    // Clean up exhausted jobs
    for (const [id, job] of this.jobs) {
      if (job.attempts >= job.maxAttempts) {
        this.jobs.delete(id);
        this.stats.failed++;
      }
    }
  }

  private scheduleRetry(job: QueueJob): void {
    // Exponential backoff: 5s, 25s, 125s, ...
    const delayMs = Math.pow(5, job.attempts) * 1000;
    job.nextRetryAt = new Date(Date.now() + delayMs);
  }
}
