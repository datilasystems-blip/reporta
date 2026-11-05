// Audit logging — append-only, redacted.
import { db } from "@reporta/database";
import type { Request } from "express";
import { hashIp } from "./crypto.js";

const REDACT_KEYS = /password|secret|token|code|authorization|cookie/i;

export function redact(value: unknown): string {
  try {
    if (typeof value === "string") return value.length > 500 ? value.slice(0, 500) : value;
    const json = JSON.stringify(value ?? null, (key, v) => {
      if (REDACT_KEYS.test(key)) return "[REDACTED]";
      if (typeof v === "string" && v.length > 500) return v.slice(0, 500) + "…";
      return v;
    });
    return json?.slice(0, 1000) ?? "";
  } catch {
    return "";
  }
}

export async function audit(opts: {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: unknown;
  req?: Request;
}): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorId: opts.actorId ?? null,
        actorRole: opts.actorRole ?? null,
        action: opts.action,
        targetType: opts.targetType,
        targetId: opts.targetId,
        detail: opts.detail !== undefined ? redact(opts.detail) : null,
        ipHash: opts.req ? hashIp(clientIpOf(opts.req)) : null,
      },
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}

function clientIpOf(req: Request): string {
  const xf = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xf || req.ip || req.socket.remoteAddress || "unknown";
}
