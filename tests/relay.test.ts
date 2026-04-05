/**
 * Tests for the Relay Service and Queue.
 */

import { describe, it, expect, vi } from "vitest";
import type { AppConfig } from "../src/config/index.js";
import type { Notification, WebhookEvent } from "../src/types/index.js";
import { RelayService } from "../src/services/relay.js";
import { RetryQueue } from "../src/services/queue.js";

// Mock config with all destinations
const mockConfig: AppConfig = {
  port: 3001,
  webhookSecret: "test-secret",
  slack: { webhookUrl: "https://hooks.slack.com/test" },
  discord: { webhookUrl: "https://discord.com/api/webhooks/test" },
  email: null,
  rateLimit: { max: 100, windowMs: 60000 },
};

describe("RelayService", () => {
  it("should route to all configured destinations", () => {
    const relay = new RelayService(mockConfig);
    const event: WebhookEvent = {
      id: "test-1",
      source: "github",
      timestamp: new Date(),
      headers: {},
      body: {
        action: "opened",
        pull_request: {
          number: 42,
          title: "Fix bug",
          user: { login: "dev" },
          html_url: "https://github.com/test/repo/pull/42",
          additions: 10,
          deletions: 5,
        },
        repository: { full_name: "test/repo" },
      },
    };

    const notifications = relay.routeEvent(event);

    // Should route to Slack and Discord (email is null)
    expect(notifications).toHaveLength(2);
    expect(notifications[0].destination).toBe("slack");
    expect(notifications[1].destination).toBe("discord");
    expect(notifications[0].title).toContain("PR opened");
    expect(notifications[0].title).toContain("#42");
  });

  it("should handle unknown source gracefully", () => {
    const relay = new RelayService(mockConfig);
    const event: WebhookEvent = {
      id: "test-2",
      source: "custom",
      timestamp: new Date(),
      headers: {},
      body: { foo: "bar" },
    };

    const notifications = relay.routeEvent(event);
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0].title).toContain("custom");
  });

  it("should return no notifications if no destinations configured", () => {
    const emptyConfig: AppConfig = {
      ...mockConfig,
      slack: null,
      discord: null,
      email: null,
    };
    const relay = new RelayService(emptyConfig);
    const event: WebhookEvent = {
      id: "test-3",
      source: "github",
      timestamp: new Date(),
      headers: {},
      body: {},
    };

    const notifications = relay.routeEvent(event);
    expect(notifications).toHaveLength(0);
  });
});

describe("RetryQueue", () => {
  it("should enqueue and track jobs", () => {
    const deliverFn = vi.fn().mockResolvedValue({ success: true, destination: "slack", attemptNumber: 1 });
    const queue = new RetryQueue(deliverFn);

    const notification: Notification = {
      destination: "slack",
      title: "Test",
      message: "Hello",
    };

    const jobId = queue.enqueue(notification);
    expect(jobId).toBeTruthy();

    const stats = queue.getStats();
    expect(stats.pending).toBe(1);
    expect(stats.delivered).toBe(0);
  });

  it("should report stats correctly", () => {
    const deliverFn = vi.fn();
    const queue = new RetryQueue(deliverFn);
    const stats = queue.getStats();

    expect(stats).toEqual({
      pending: 0,
      failed: 0,
      delivered: 0,
    });
  });
});
