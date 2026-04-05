/**
 * HMAC Signature Verification Middleware
 *
 * Validates webhook authenticity by checking signatures from known sources:
 * - GitHub: X-Hub-Signature-256 header (HMAC-SHA256)
 * - Stripe: Stripe-Signature header (HMAC-SHA256 with timestamp)
 * - Custom: X-Webhook-Signature header (HMAC-SHA256)
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Create middleware that verifies HMAC signatures.
 * Skips verification if no secret is configured (development mode).
 */
export function createAuthMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip verification if no secret configured
    if (!secret) {
      next();
      return;
    }

    const source = req.params.source ?? "custom";
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!rawBody) {
      res.status(400).json({ error: "Missing raw body for signature verification" });
      return;
    }

    let isValid = false;

    try {
      switch (source) {
        case "github":
          isValid = verifyGitHub(secret, rawBody, req.headers);
          break;
        case "stripe":
          isValid = verifyStripe(secret, rawBody, req.headers);
          break;
        default:
          isValid = verifyCustom(secret, rawBody, req.headers);
          break;
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Source-specific verification
// ---------------------------------------------------------------------------

function verifyGitHub(
  secret: string,
  body: Buffer,
  headers: Record<string, any>
): boolean {
  const signature = headers["x-hub-signature-256"] as string | undefined;
  if (!signature) return false;

  const expected = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function verifyStripe(
  secret: string,
  body: Buffer,
  headers: Record<string, any>
): boolean {
  const sigHeader = headers["stripe-signature"] as string | undefined;
  if (!sigHeader) return false;

  // Parse Stripe signature: t=timestamp,v1=signature
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [key, val] = p.split("=");
      return [key, val];
    })
  );

  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;

  const payload = `${timestamp}.${body.toString()}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

function verifyCustom(
  secret: string,
  body: Buffer,
  headers: Record<string, any>
): boolean {
  const signature = headers["x-webhook-signature"] as string | undefined;
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
