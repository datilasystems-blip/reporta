// Rate limiting middleware using a persistent Postgres-backed store so
// limits survive multi-instance deployments and process restarts.
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "@reporta/database";

type Bucket = { key: string; windowStart: Date };

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn: (req: Request) => string;
  message?: string;
  standardHeaders?: boolean;
}

function bucketStart(windowMs: number): Date {
  const now = Date.now();
  return new Date(Math.floor(now / windowMs) * windowMs);
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  return (req, res, next) => {
    const key = opts.keyFn(req);
    const windowStart = bucketStart(opts.windowMs);
    void (async () => {
      try {
        const hit = await db.rateLimitHit.upsert({
          where: { key_windowStart: { key, windowStart } },
          create: { key, windowStart, count: 1 },
          update: { count: { increment: 1 } },
        });
        const remaining = Math.max(0, opts.max - hit.count);
        res.setHeader("X-RateLimit-Limit", String(opts.max));
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        const resetAt = windowStart.getTime() + opts.windowMs;
        res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
        if (hit.count > opts.max) {
          const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
          res.setHeader("Retry-After", String(retryAfter));
          res.status(429).json({
            error: "rate_limited",
            message: opts.message ?? "Too many requests. Please try again later.",
            retryAfterSeconds: retryAfter,
          });
          return;
        }
        next();
      } catch (err) {
        // Fail-open on storage errors so availability isn't destroyed by the limiter
        console.error("rate limit error", err);
        next();
      }
    })();
  };
}

export function clientIp(req: Request): string {
  const xf = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xf || req.ip || req.socket.remoteAddress || "unknown";
}
