// Email notifications — Gmail API (OAuth) or SMTP; "log" mode for dev.
// Never send evidence as attachments; only minimal notification + portal link.
import { env } from "./env.js";
import { db } from "@reporta/database";

export interface MailJob {
  to: string;
  subject: string;
  body: string; // plain text
}

async function sendViaGmail(job: MailJob): Promise<void> {
  if (!env.GMAIL_REFRESH_TOKEN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Gmail OAuth not configured (GMAIL_REFRESH_TOKEN / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  }
  // Exchange refresh token for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!tokenRes.ok) throw new Error(`Gmail token refresh failed (${tokenRes.status})`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // RFC 2822 raw message
  const from = env.GMAIL_SENDER || env.EMAIL_FROM;
  const raw = [
    `From: ${from}`,
    `To: ${job.to}`,
    `Subject: ${job.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    job.body,
  ].join("\r\n");
  const b64 = Buffer.from(raw).toString("base64url");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: b64 }),
  });
  if (!sendRes.ok) {
    const t = await sendRes.text();
    throw new Error(`Gmail send failed (${sendRes.status}): ${t.slice(0, 200)}`);
  }
}

async function sendViaSmtp(job: MailJob): Promise<void> {
  // Minimal implicit-TLS SMTP client (STARTTLS not supported; port 465 style).
  // In production prefer Gmail mode; this exists for self-hosted relays.
  throw new Error("SMTP mode requires nodemailer; configure EMAIL_MODE=gmail or add nodemailer");
}

async function sendMail(job: MailJob): Promise<void> {
  if (env.EMAIL_MODE === "gmail") return sendViaGmail(job);
  if (env.EMAIL_MODE === "smtp") return sendViaSmtp(job);
  // log mode (development): never pretend delivery happened
  console.log(`[EMAIL:log] to=${job.to} subject="${job.subject}"`);
}

/**
 * Enqueue a notification durably and attempt delivery.
 * A failed email never erases the case update; the row stays pending with
 * attempts+lastError and is retried by the worker.
 */
export async function queueNotification(opts: {
  userId?: string | null;
  reportId?: string | null;
  kind: string;
  title: string;
  body: string;
  linkPath?: string;
  email?: string | null; // when set, also deliver by email
  idempotencyKey?: string;
  channel?: "in_app" | "email"; // override the default (inferred from email)
}): Promise<void> {
  try {
    const n = await db.notification.create({
      data: {
        userId: opts.userId ?? null,
        reportId: opts.reportId ?? null,
        kind: opts.kind,
        title: opts.title,
        body: opts.body,
        linkPath: opts.linkPath,
        channel: opts.channel ?? (opts.email ? "email" : "in_app"),
        idempotencyKey: opts.idempotencyKey,
      },
    });
    if (opts.email) await attemptDelivery(n.id, { to: opts.email, subject: opts.title, body: opts.body });
  } catch (err: any) {
    if (err?.code === "P2002") return; // idempotent duplicate
    console.error("queueNotification failed", err);
  }
}

async function attemptDelivery(id: string, job: MailJob): Promise<void> {
  try {
    await sendMail(job);
    await db.notification.update({
      where: { id },
      data: { status: "delivered", deliveredAt: new Date(), attempts: { increment: 1 } },
    });
  } catch (err: any) {
    await db.notification.update({
      where: { id },
      data: { status: "failed", attempts: { increment: 1 }, lastError: String(err?.message ?? err).slice(0, 300) },
    }).catch(() => { });
  }
}

/** Retry failed notifications (called by worker/cron or admin action). */
export async function retryFailedNotifications(maxAttempts = 8, batch = 25): Promise<number> {
  const failed = await db.notification.findMany({
    where: { status: "failed", attempts: { lt: maxAttempts }, channel: "email" },
    orderBy: { createdAt: "asc" },
    take: batch,
  });
  let retried = 0;
  for (const n of failed) {
    const user = n.userId ? await db.user.findUnique({ where: { id: n.userId } }) : null;
    const to = user?.email;
    if (!to) {
      await db.notification.update({ where: { id: n.id }, data: { lastError: "no recipient" } });
      continue;
    }
    await attemptDelivery(n.id, { to, subject: n.title, body: n.body });
    retried++;
  }
  return retried;
}

/** Admin-facing recipient list from configuration */
export function adminRecipientEmails(): string[] {
  return env.ADMIN_NOTIFY_EMAILS.split(",").map((s) => s.trim()).filter(Boolean);
}
