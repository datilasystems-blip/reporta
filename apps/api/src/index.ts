// ============================================================
// REPORTA API — entry point
// Public reporting + staff portals (admin / reviewer / officer)
// Security: helmet, CORS allow-list, JWT auth, server-side RBAC,
// rate limiting, audit logging, private evidence vault.
// ============================================================
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import multer from "multer";
import bcrypt from "bcryptjs";
import crypto, { createHmac } from "node:crypto";
import { z, ZodError } from "zod";
import { db } from "@reporta/database";
import { env } from "./lib/env.js";
import { requireAuth, requireRole, requireStaff } from "./lib/auth.js";
import { requirePerm } from "./lib/perm.js";
import { rateLimit, clientIp } from "./lib/rateLimit.js";
import { audit, redact } from "./lib/audit.js";
import {
  signAccessToken, newRefreshToken, hashRefresh, newReportReference, newCaseId,
  newTrackingCode, verifyTrackingCode, randomToken, hashIp, hashInvitation,
  sha256Hex, newInvitationToken, verifyAccessToken,
} from "./lib/crypto.js";
import { ensureVault, writeEvidence, readEvidence, detectContentKind, vaultPathFor } from "./lib/evidence.js";
import { queueNotification, adminRecipientEmails, retryFailedNotifications } from "./lib/notify.js";
import { applyStatusTransition, TransitionError } from "./lib/caseEngine.js";
import { publicReportView, evidenceMeta, assignmentView } from "./lib/serialize.js";
import { EVIDENCE_LIMITS, REPORT_CATEGORIES, REGIONS, publicStatusLabel } from "@reporta/shared";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const ALLOWED_ORIGINS = () =>
  env.FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS().includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

ensureVault();

// ============================================================
// Validation schemas
// ============================================================
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10).max(128),
  name: z.string().min(2).max(120),
  phone: z.string().max(20).optional(),
  region: z.string().max(80).optional(),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const reportCreateSchema = z.object({
  category: z.string().min(2).max(80),
  description: z.string().min(20).max(8000),
  incidentDate: z.string().max(40).optional(),
  incidentTime: z.string().max(40).optional(),
  locationRegion: z.string().max(80).optional(),
  locationTown: z.string().max(120).optional(),
  locationLandmark: z.string().max(200).optional(),
  ongoing: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true").default(false),
  urgency: z.enum(["low", "normal", "urgent", "emergency"]).default("normal"),
  perpetratorKnown: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true").default(false),
  perpetratorName: z.string().max(200).optional(),
  perpetratorDesc: z.string().max(2000).optional(),
  witnessInfo: z.string().max(2000).optional(),
  isAnonymous: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true").default(false),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(20).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  safeContactMethod: z.enum(["in_app", "phone", "email", "none"]).default("in_app"),
});

const assignSchema = z.object({
  officerId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

const statusChangeSchema = z.object({
  toStatus: z.string(),
  reason: z.string().max(500).optional(),
  makePublic: z.boolean().default(true),
});

// ============================================================
// Rate limiting
// ============================================================
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: env.AUTH_RATE_LIMIT_MAX,
  skip: (req) => process.env.NODE_ENV === "test",
  keyFn: (req) => `auth:${clientIp(req)}`,
  message: "Too many attempts. Please wait 15 minutes and try again.",
});
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: env.REPORT_RATE_LIMIT_MAX,
  skip: (req) => process.env.NODE_ENV === "test",
  keyFn: (req) => `report:${clientIp(req)}`,
  message: "Report limit reached for this hour. Please try again later.",
});
const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX,
  keyFn: (req) => `all:${clientIp(req)}`,
});
app.use(generalLimiter);

// ============================================================
// Helpers
// ============================================================
function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "validation_failed",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
        details: parsed.error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    (req as any).validated = parsed.data;
    next();
  };
}

function authFail(res: Response): void {
  res.status(401).json({ error: "invalid_credentials", message: "Incorrect email or password." });
}

function isStaffRole(role: string): boolean {
  return ["officer", "reviewer", "admin", "super_admin", "auditor"].includes(role);
}

function publicUser(u: {
  id: string; email: string; name: string; role: string;
  staffCode: string | null; status: string; mustChangePassword: boolean;
}) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role,
    staffCode: u.staffCode, status: u.status, mustChangePassword: u.mustChangePassword,
  };
}

function guessEvidenceKind(mime: string): "photo" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 8, fileSize: 10 * 1024 * 1024 },
});

async function issueSession(
  userId: string, req: Request, res: Response,
): Promise<{ accessToken: string }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const rt = newRefreshToken();
  await db.refreshToken.create({
    data: {
      tokenHash: rt.hash, userId, expiresAt: rt.expiresAt,
      userAgent: req.headers["user-agent"]?.slice(0, 200), ipHash: hashIp(clientIp(req)),
    },
  });
  res.cookie("reporta_rt", rt.raw, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? "none" : "lax",
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000,
    path: "/",
  });
  const accessToken = signAccessToken({ sub: user.id, role: user.role, email: user.email, staffCode: user.staffCode });
  return { accessToken };
}

function setAccessCookie(res: Response, token: string): void {
  res.cookie("reporta_at", token, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? "none" : "lax",
    maxAge: 24 * 3600 * 1000,
    path: "/",
  });
}

// Extract Bearer or cookie token (used by requireAuth)
function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookies = (req as any).cookies as Record<string, string> | undefined;
  return cookies?.["reporta_at"] ?? null;
}

// Wire requireAuth to use extractToken
void extractToken;

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

// ============================================================
// Health
// ============================================================
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "reporta-api", version: "1.0.0", timestamp: new Date().toISOString() });
});

app.get("/ready", async (_req: Request, res: Response) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ready", database: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", database: "unavailable" });
  }
});

// ============================================================
// AUTH
// ============================================================
app.post("/api/auth/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const body = (req as any).validated as z.infer<typeof registerSchema>;
    const email = body.email.toLowerCase();
    const exists = await db.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ error: "email_taken", message: "An account with this email already exists." });
    }
    // Public registration can NEVER create staff roles.
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await db.user.create({
      data: {
        email, passwordHash, name: body.name,
        phone: body.phone, region: body.region,
        role: "reporter", status: "active",
      },
    });
    const { accessToken } = await issueSession(user.id, req, res);
    setAccessCookie(res, accessToken);
    await audit({ actorId: user.id, actorRole: user.role, action: "auth.register", targetType: "user", targetId: user.id, req });
    res.status(201).json({ accessToken, user: publicUser(user) });
  } catch (e) { next(e); }
});

app.post("/api/auth/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const body = (req as any).validated as z.infer<typeof loginSchema>;
    const user = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user?.passwordHash) return authFail(res);
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return authFail(res);
    if (user.status !== "active") {
      return res.status(403).json({ error: "account_inactive", message: `This account is ${user.status}. Contact your administrator.` });
    }
    const { accessToken } = await issueSession(user.id, req, res);
    setAccessCookie(res, accessToken);
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ actorId: user.id, actorRole: user.role, action: "auth.login", targetType: "user", targetId: user.id, req });
    res.json({ accessToken, user: publicUser(user) });
  } catch (e) { next(e); }
});

app.post("/api/auth/refresh", async (req, res, next) => {
  try {
    const raw = (req as any).cookies?.["reporta_rt"] as string | undefined;
    if (!raw) return res.status(401).json({ error: "no_session" });
    const tokenHash = hashRefresh(raw);
    const stored = await db.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "invalid_session" });
    }
    if (stored.user.status !== "active") return res.status(401).json({ error: "account_inactive" });
    // Rotate
    const rt = newRefreshToken();
    await db.$transaction([
      db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
      db.refreshToken.create({
        data: { tokenHash: rt.hash, userId: stored.userId, expiresAt: rt.expiresAt, userAgent: req.headers["user-agent"]?.slice(0, 200), ipHash: hashIp(clientIp(req)) },
      }),
    ]);
    res.cookie("reporta_rt", rt.raw, {
      httpOnly: true, secure: env.IS_PRODUCTION,
      sameSite: env.IS_PRODUCTION ? "none" : "lax",
      maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 3600 * 1000, path: "/",
    });
    const accessToken = signAccessToken({ sub: stored.user.id, role: stored.user.role, email: stored.user.email, staffCode: stored.user.staffCode });
    setAccessCookie(res, accessToken);
    res.json({ accessToken, user: publicUser(stored.user) });
  } catch (e) { next(e); }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  const raw = (req as any).cookies?.["reporta_rt"] as string | undefined;
  if (raw) {
    await db.refreshToken.updateMany({ where: { tokenHash: hashRefresh(raw) }, data: { revokedAt: new Date() } });
  }
  res.clearCookie("reporta_rt", { path: "/" });
  res.clearCookie("reporta_at", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "not_found" });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  res.json({ user: publicUser(user), unreadNotifications: unread });
});

app.post("/api/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) });
    const body = schema.parse(req.body);
    const user = await db.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.passwordHash) {
      return res.status(400).json({ error: "no_password", message: "This account has no local password." });
    }
    const ok = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "wrong_password" });
    const passwordHash = await bcrypt.hash(body.newPassword, 12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await audit({ actorId: user.id, actorRole: user.role, action: "auth.password_changed", targetType: "user", targetId: user.id, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post("/api/auth/forgot-password", authLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const raw = randomToken(24);
      await db.passwordResetToken.create({
        data: { tokenHash: hashInvitation(raw), userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      });
      const link = `${env.PUBLIC_WEB_URL}/#/reset-password?token=${raw}`;
      await queueNotification({
        userId: user.id, kind: "password_reset", title: "REPORTA password reset",
        body: `Reset your password using this link (valid 1 hour): ${link}`,
        linkPath: link, email: user.email,
        idempotencyKey: `pwreset:${user.id}:${Math.floor(Date.now() / 3600000)}`,
      });
    }
    // Always 200 — never reveal whether the account exists.
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (e) { next(e); }
});

app.post("/api/auth/reset-password", authLimiter, async (req, res, next) => {
  try {
    const { token, password } = z.object({ token: z.string().min(10), password: z.string().min(10).max(128) }).parse(req.body);
    const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashInvitation(token) }, include: { user: true } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return res.status(400).json({ error: "invalid_token", message: "This reset link is invalid or has expired." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      db.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      db.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit({ actorId: row.userId, action: "auth.password_reset", targetType: "user", targetId: row.userId, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ============================================================
// GOOGLE OAUTH (state + code exchange, account must pre-exist)
// ============================================================
const OAUTH_STATE_COOKIE = "reporta_oauth_state";

app.get("/api/auth/google/status", (_req: Request, res: Response) => {
  res.json({ enabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) });
});

app.get("/api/auth/google/url", (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({ error: "not_configured", message: "Google sign-in is not configured on this server." });
  }
  const state = randomToken(16);
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true, secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? "none" : "lax", maxAge: 10 * 60 * 1000, path: "/",
  });
  const redirectUri = new URL(env.GOOGLE_REDIRECT_PATH, env.API_PUBLIC_URL).toString();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  res.json({ url });
});

app.get("/api/auth/google/callback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as { code?: string; state?: string; error?: string };
    if (q.error || !q.code || !q.state) {
      return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=oauth_failed`);
    }
    const cookieState = (req as any).cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });
    if (!cookieState || cookieState !== q.state) {
      return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=oauth_state`);
    }
    // Exchange code for tokens
    const redirectUri = new URL(env.GOOGLE_REDIRECT_PATH, env.API_PUBLIC_URL).toString();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: q.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=oauth_exchange`);
    }
    const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    // Verify id_token via Google tokeninfo (validates audience + issuer)
    const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token ?? ""}`);
    if (!infoRes.ok) return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=oauth_verify`);
    const info = (await infoRes.json()) as {
      aud?: string; email?: string; email_verified?: string; name?: string; sub?: string; picture?: string;
    };
    if (info.aud !== env.GOOGLE_CLIENT_ID || !info.email || info.email_verified !== "true") {
      return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=oauth_audience`);
    }
    const email = info.email.toLowerCase();
    // Only an existing, provisioned account may sign in with Google.
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=google_not_registered`);
    }
    if (user.status !== "active") {
      return res.redirect(`${env.PUBLIC_WEB_URL}/#/signin?error=account_inactive`);
    }
    // Link identity (idempotent)
    await db.oAuthIdentity.upsert({
      where: { userId: user.id },
      create: { userId: user.id, email, providerUid: info.sub ?? "" },
      update: { providerUid: info.sub ?? "" },
    });
    const { accessToken } = await issueSession(user.id, req, res);
    setAccessCookie(res, accessToken);
    await audit({ actorId: user.id, actorRole: user.role, action: "auth.google_login", targetType: "user", targetId: user.id, req });
    const dest = isStaffRole(user.role) ? env.PUBLIC_ADMIN_URL : env.PUBLIC_WEB_URL;
    res.redirect(`${dest}/#/oauth-complete?token=${encodeURIComponent(accessToken)}`);
  } catch (e) { next(e); }
});

// ============================================================
// REPORTS — create (public; anonymous or confidential)
// ============================================================
app.post("/api/reports", reportLimiter, evidenceUpload.array("evidence", 8), validate(reportCreateSchema), async (req, res, next) => {
  try {
    const body = (req as any).validated as z.infer<typeof reportCreateSchema>;
    const files = (req as any).files as Express.Multer.File[] | undefined;
    const reporter = (req as any).user as { id: string; role: string } | undefined; // optionalAuth may have set it

    // Validate evidence kinds, sizes, and content
    const prepared: { kind: string; buffer: Buffer; mime: string; ext: string; size: number }[] = [];
    for (const f of files ?? []) {
      const kind = guessEvidenceKind(f.mimetype);
      const limits = (EVIDENCE_LIMITS as any)[kind];
      if (!limits) {
        return res.status(415).json({ error: "unsupported_type", message: `Unsupported file type: ${f.mimetype}` });
      }
      if (f.size > limits.maxBytes) {
        return res.status(413).json({ error: "file_too_large", message: `${f.originalname} exceeds the ${Math.round(limits.maxBytes / 1024 / 1024)} MB limit for ${kind}s.` });
      }
      const sniff = detectContentKind(f.buffer);
      if (!sniff) {
        return res.status(415).json({ error: "unreadable_file", message: `${f.originalname} could not be verified as a safe file.` });
      }
      prepared.push({ kind, buffer: f.buffer, mime: sniff.mime, ext: sniff.ext, size: f.size });
    }

    const ref = newReportReference();
    const tracking = body.isAnonymous ? newTrackingCode() : null;
    const caseSeq = (await db.report.count()) + 1;
    const caseId = newCaseId(caseSeq);

    // Anonymous reports never link a user account.
    const reporterUserId = body.isAnonymous ? null : reporter?.id ?? null;

    const report = await db.report.create({
      data: {
        reference: ref,
        trackingCode: tracking?.hash ?? null,
        caseId,
        category: body.category,
        description: body.description,
        incidentDate: body.incidentDate ? new Date(body.incidentDate) : null,
        incidentTime: body.incidentTime,
        region: body.locationRegion,
        town: body.locationTown,
        landmark: body.locationLandmark,
        ongoing: body.ongoing,
        urgency: body.urgency,
        perpetratorKnown: body.perpetratorKnown,
        perpetratorName: body.perpetratorName,
        perpetratorDesc: body.perpetratorDesc,
        witnessInfo: body.witnessInfo,
        isAnonymous: body.isAnonymous,
        reporterUserId,
        contactName: body.isAnonymous ? null : body.contactName,
        contactPhone: body.isAnonymous ? null : body.contactPhone,
        contactEmail: body.isAnonymous ? null : body.contactEmail || undefined,
        safeContactMethod: body.isAnonymous ? "none" : body.safeContactMethod,
        ipHash: hashIp(clientIp(req)),
        status: "received",
      },
    });

    // Persist evidence to the private vault
    for (const p of prepared) {
      const key = `${report.id}/${p.kind}-${randomToken(8)}.${p.ext}`;
      writeEvidence(key, p.buffer);
      await db.evidence.create({
        data: {
          reportId: report.id, kind: p.kind, storageKey: key,
          originalName: (files?.[0]?.originalname ?? "file").slice(0, 200),
          mimeType: p.mime, sizeBytes: p.size,
          checksumSha256: sha256Hex(p.buffer),
          scanStatus: env.CLAMAV_HOST ? "pending" : "unavailable",
          scanDetail: env.CLAMAV_HOST ? null : "malware scanning not configured; file quarantined pending scan policy",
          uploadedBy: reporterUserId,
        },
      });
    }

    // System timeline entry
    await db.caseStatusChange.create({
      data: {
        reportId: report.id, fromStatus: "submitted", toStatus: "received",
        actorId: reporterUserId, actorRole: reporter ? "reporter" : "anonymous",
        visibility: "public", publicLabel: "Report submitted",
      },
    });

    // Notify admins (in-app) + email queue (minimal info + portal link)
    const admins = await db.user.findMany({
      where: { role: { in: ["admin", "super_admin", "reviewer"] }, status: "active" },
      select: { id: true },
    });
    const urgent = body.urgency === "urgent" || body.urgency === "emergency";
    for (const a of admins) {
      await db.notification.create({
        data: {
          userId: a.id, reportId: report.id, channel: "in_app",
          kind: urgent ? "report_urgent" : "report_received",
          title: `${urgent ? "URGENT: " : ""}New report ${ref}`,
          body: `${body.category} — ${body.locationTown ?? body.locationRegion ?? "location not specified"}`,
          linkPath: `/admin/reports/${report.id}`,
        },
      }).catch(() => {});
    }
    const recipients = adminRecipientEmails();
    if (recipients.length > 0) {
      await queueNotification({
        reportId: report.id, kind: "report_received",
        title: `${urgent ? "[URGENT] " : ""}REPORTA new report ${ref}`,
        body: `A new ${body.category} report (${body.urgency} urgency) has been submitted. Reference: ${ref}. Open the admin portal to review it.`,
        linkPath: `${env.PUBLIC_ADMIN_URL}/#/admin/reports/${report.id}`,
        email: recipients[0],
        idempotencyKey: `admin_email:${report.id}`,
      });
    }

    await audit({ actorId: reporterUserId, actorRole: reporter ? "reporter" : "anonymous", action: "report.created", targetType: "report", targetId: report.id, req });

    res.status(201).json({
      reference: ref,
      trackingCode: tracking?.raw ?? null, // shown ONCE to anonymous reporters
      caseId,
      createdAt: report.createdAt.toISOString(),
    });
  } catch (e) { next(e); }
});

// ============================================================
// REPORT TRACKING (reference + tracking secret for anonymous)
// ============================================================
app.get("/api/reports/track/:reference", async (req, res, next) => {
  try {
    const { reference } = req.params;
    const trackingSecret = String(req.query.t ?? "");
    const report = await db.report.findUnique({
      where: { reference },
      include: {
        statusHistory: { where: { visibility: "public" }, orderBy: { createdAt: "asc" } },
        updates: { where: { visibility: "public" }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
        infoRequest: true,
      },
    });
    if (!report) {
      return res.status(404).json({ error: "not_found", message: "No report found with this reference. Check the reference number and try again." });
    }
    // Verification: signed-in owner OR correct tracking secret (anonymous).
    const isOwner = !!((req as any).user && report.reporterUserId === (req as any).user.id);
    if (!isOwner) {
      if (!report.trackingCode || !trackingSecret || !verifyTrackingCode(trackingSecret, report.trackingCode)) {
        return res.status(403).json({ error: "verification_required", message: "Enter the tracking code you were given when you submitted this report." });
      }
    }
    const view = publicReportView(report, report.statusHistory, report.updates, report.infoRequest);
    res.json({ report: view });
  } catch (e) { next(e); }
});

// ============================================================
// REPORTER-OWNED REPORT LIST
// ============================================================
app.get("/api/reports/mine", requireAuth, async (req, res, next) => {
  try {
    const reports = await db.report.findMany({
      where: { reporterUserId: req.user!.id, isAnonymous: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, reference: true, caseId: true, category: true, status: true,
        urgency: true, createdAt: true, updatedAt: true, publicStatus: true,
        town: true, region: true,
      },
    });
    res.json({ reports });
  } catch (e) { next(e); }
});

// Submit additional info requested by a reviewer
app.post("/api/reports/:reference/provide-info", reportLimiter, async (req, res, next) => {
  try {
    const { message } = z.object({ message: z.string().min(5).max(4000) }).parse(req.body);
    const report = await db.report.findUnique({ where: { reference: req.params.reference } });
    if (!report) return res.status(404).json({ error: "not_found" });
    const isOwner = !!((req as any).user && report.reporterUserId === (req as any).user.id);
    const trackingSecret = String(req.query.t ?? "");
    if (!isOwner) {
      if (!report.trackingCode || !verifyTrackingCode(trackingSecret, report.trackingCode)) {
        return res.status(403).json({ error: "verification_required" });
      }
    }
    if (report.status !== "awaiting_reporter_input") {
      return res.status(409).json({ error: "not_awaiting_input", message: "This report is not currently awaiting reporter input." });
    }
    await db.caseStatusChange.create({
      data: {
        reportId: report.id, fromStatus: report.status, toStatus: report.status,
        actorId: report.reporterUserId, actorRole: "reporter",
        visibility: "public", publicLabel: "Reporter provided additional information",
      },
    });
    await db.caseStatusChange.create({
      data: {
        reportId: report.id, fromStatus: report.status, toStatus: "review",
        actorId: report.reporterUserId, actorRole: "reporter",
        visibility: "public", publicLabel: "Under review — awaiting triage",
      },
    });
    await db.report.update({ where: { id: report.id }, data: { status: "review" } });
    await audit({ actorId: report.reporterUserId, actorRole: "reporter", action: "report.info_provided", targetType: "report", targetId: report.id, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ============================================================
// PUBLIC METADATA
// ============================================================
app.get("/api/meta", generalLimiter, (_req: Request, res: Response) => {
  res.json({
    categories: REPORT_CATEGORIES,
    regions: REGIONS,
    urgencyLevels: ["low", "normal", "urgent", "emergency"],
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  });
});

app.get("/api/public/stats", generalLimiter, async (_req: Request, res: Response) => {
  try {
    const [total, resolvedThisMonth, avgDaysRow] = await Promise.all([
      db.report.count(),
      db.report.count({ where: { status: "closed", resolvedAt: { gte: new Date(new Date().setDate(1)) } } }),
      db.report.aggregate({ _avg: { resolutionDays: true } }),
    ]);
    res.json({
      totalReports: total,
      resolvedThisMonth,
      avgResolutionDays: avgDaysRow._avg.resolutionDays ? Math.round(avgDaysRow._avg.resolutionDays) : null,
    });
  } catch {
    res.json({ totalReports: 0, resolvedThisMonth: 0, avgResolutionDays: null });
  }
});

app.get("/api/public/statuses", generalLimiter, (_req: Request, res: Response) => {
  res.json({
    statuses: ["received", "review", "awaiting_reporter_input", "assigned", "investigation", "closed", "rejected"].map((s) => ({
      key: s, label: publicStatusLabel(s),
    })),
  });
});

// ============================================================
// ADMIN: report queue, review, assignment, status engine
// ============================================================
const staffGuard = [requireAuth, requireStaff] as const;

app.get("/api/admin/overview", ...staffGuard, requirePerm("dashboard.metrics"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekAgo = new Date(now.getTime() - 7 * 86400 * 1000);

    const [
      total, received, review, awaitingReporter, assigned, investigation, closed, rejected,
      urgent, todayCount, weekCount, monthCount,
      overdue,
    ] = await Promise.all([
      db.report.count(),
      db.report.count({ where: { status: "received" } }),
      db.report.count({ where: { status: "review" } }),
      db.report.count({ where: { status: "awaiting_reporter_input" } }),
      db.report.count({ where: { status: "assigned" } }),
      db.report.count({ where: { status: "investigation" } }),
      db.report.count({ where: { status: "closed" } }),
      db.report.count({ where: { status: "rejected" } }),
      db.report.count({ where: { priority: "critical", status: { not: "closed" } } }),
      db.report.count({ where: { createdAt: { gte: startOfToday } } }),
      db.report.count({ where: { createdAt: { gte: weekAgo } } }),
      db.report.count({ where: { createdAt: { gte: startOfMonth } } }),
      db.report.count({
        where: { status: { not: "closed" }, createdAt: { lt: new Date(now.getTime() - 14 * 86400 * 1000) } },
      }),
    ]);

    const byCategory = await db.report.groupBy({ by: ["category"], _count: { _all: true } });
    const byStatus = await db.report.groupBy({ by: ["status"], _count: { _all: true } });
    const byRegion = await db.report.groupBy({ by: ["region"], _count: { _all: true }, where: { region: { not: null } } });

    const recent = await db.report.findMany({
      orderBy: { createdAt: "desc" }, take: 8,
      select: {
        id: true, reference: true, category: true, status: true, priority: true,
        region: true, town: true, createdAt: true, reporterName: true, isAnonymous: true,
      },
    });

    const officerWorkload = await db.caseAssignment.groupBy({
      by: ["officerId"],
      where: { state: "active" },
      _count: { _all: true },
    });
    const officerIds = officerWorkload.map((o) => o.officerId);
    const officers = officerIds.length
      ? await db.user.findMany({ where: { id: { in: officerIds } }, select: { id: true, name: true, staffCode: true, role: true } })
      : [];
    const workload = officerWorkload.map((w) => ({
      officerId: w.officerId,
      name: officers.find((o) => o.id === w.officerId)?.name ?? "Unknown",
      staffCode: officers.find((o) => o.id === w.officerId)?.staffCode ?? null,
      activeCases: w._count._all,
    }));

    res.json({
      metrics: {
        total, received, review, awaitingReporter, assigned, investigation, closed, rejected,
        urgent, todayCount, weekCount, monthCount, overdue,
        byCategory: byCategory.map((c) => ({ category: c.category, count: c._count._all })),
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
        byRegion: byRegion.map((r) => ({ region: r.region ?? "Unknown", count: r._count._all })),
        officerWorkload: workload,
      },
      recentReports: recent,
    });
  } catch (e) { next(e); }
});

app.get("/api/admin/reports", ...staffGuard, requirePerm("cases.view_all"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize ?? 25)));
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;
    if (q.region) where.region = q.region;
    if (q.priority) where.priority = q.priority;
    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { reference: { contains: s } },
        { description: { contains: s } },
        { reporterName: { contains: s } },
      ];
    }
    const orderBy = q.sort === "oldest" ? { createdAt: "asc" as const } : { createdAt: "desc" as const };
    const [total, reports] = await Promise.all([
      db.report.count({ where }),
      db.report.findMany({
        where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
        include: {
          evidence: { select: { id: true, kind: true } },
          assignments: { where: { state: "active" }, include: { officer: { select: { id: true, name: true, staffCode: true } } } },
        },
      }),
    ]);
    res.json({
      reports: reports.map((r) => ({
        id: r.id, reference: r.reference, caseId: r.caseId, category: r.category,
        description: r.description.length > 180 ? r.description.slice(0, 180) + "…" : r.description,
        status: r.status, priority: r.priority, urgency: r.urgency, ongoing: r.ongoing,
        region: r.region, town: r.town, incidentDate: r.incidentDate?.toISOString() ?? null,
        reporterName: r.isAnonymous ? "Anonymous" : r.reporterName,
        isAnonymous: r.isAnonymous,
        evidenceCount: r.evidence.length,
        evidenceKinds: r.evidence.map((e) => e.kind),
        assignedOfficers: r.assignments.map((a) => ({ id: a.officer.id, name: a.officer.name, staffCode: a.officer.staffCode })),
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (e) { next(e); }
});

app.get("/api/admin/reports/:id", ...staffGuard, requirePerm("cases.view_all"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await db.report.findUnique({
      where: { id: req.params.id },
      include: {
        evidence: true,
        statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
        updates: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, role: true } } } },
        internalNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true, role: true } } } },
        assignments: { orderBy: { createdAt: "desc" }, include: { officer: { select: { id: true, name: true, staffCode: true } } } },
        infoRequest: true,
      },
    });
    if (!r) return res.status(404).json({ error: "not_found" });
    res.json({
      report: {
        id: r.id, reference: r.reference, caseId: r.caseId, category: r.category,
        description: r.description, incidentDate: r.incidentDate?.toISOString() ?? null,
        incidentTime: r.incidentTime, region: r.region, town: r.town, landmark: r.landmark,
        ongoing: r.ongoing, urgency: r.urgency, priority: r.priority, status: r.status,
        isAnonymous: r.isAnonymous,
        reporter: r.isAnonymous ? null : {
          name: r.reporterName, phone: r.reporterPhone, email: r.reporterEmail,
          userId: r.reporterUserId, safeContactMethod: r.safeContactMethod,
        },
        perpetrator: r.perpetratorName || r.perpetratorDesc ? { name: r.perpetratorName, description: r.perpetratorDesc } : null,
        witness: r.witnessInfo ? { info: r.witnessInfo } : null,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        closedAt: r.closedAt?.toISOString() ?? null, closeReason: r.closeReason,
        evidence: r.evidence.map((e) => ({
          id: e.id, kind: e.kind, mimeType: e.mimeType, sizeBytes: e.sizeBytes,
          originalName: e.originalName, createdAt: e.createdAt.toISOString(), scanStatus: e.scanStatus,
        })),
        statusHistory: r.statusHistory.map((s) => ({
          id: s.id, from: s.fromStatus, to: s.toStatus, at: s.createdAt.toISOString(),
          actorName: s.actor?.name ?? (s.actorRole === "system" ? "System" : "Unknown"),
          actorRole: s.actorRole, reason: s.reason, visibility: s.visibility,
          publicLabel: s.publicLabel,
        })),
        updates: r.updates.map((u) => ({
          id: u.id, kind: u.kind, body: u.body, visibility: u.visibility,
          authorName: u.author?.name ?? "System", authorRole: u.authorRole,
          at: u.createdAt.toISOString(),
        })),
        internalNotes: r.internalNotes.map((n) => ({
          id: n.id, body: n.body, authorName: n.author?.name ?? "Staff", authorRole: n.authorRole,
          at: n.createdAt.toISOString(),
        })),
        assignments: r.assignments.map((a) => ({
          id: a.id, officerId: a.officer.id, officerName: a.officer.name, officerCode: a.officer.staffCode,
          state: a.state, acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
          at: a.createdAt.toISOString(), note: a.note,
        })),
        infoRequest: r.infoRequest ? {
          id: r.infoRequest.id, message: r.infoRequest.message,
          response: r.infoRequest.response, respondedAt: r.infoRequest.respondedAt?.toISOString() ?? null,
          createdAt: r.infoRequest.createdAt.toISOString(),
        } : null,
      },
    });
  } catch (e) { next(e); }
});

// Status change (validated server-side transitions)
app.post("/api/admin/reports/:id/status", ...staffGuard, requirePerm("cases.review"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { toStatus, reason } = z.object({
      toStatus: z.string().min(2).max(40),
      reason: z.string().max(1000).optional(),
    }).parse(req.body);
    const report = await db.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "not_found" });
    const updated = await applyStatusTransition({
      reportId: report.id, toStatus, actorId: req.user!.id, actorRole: req.user!.role,
      reason, makePublic: true,
    });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "case.status_changed", targetType: "report", targetId: report.id, detail: { from: report.status, to: toStatus, reason }, req });
    res.json({ ok: true, status: updated.status });
  } catch (e) {
    if (e instanceof TransitionError) {
      return res.status(409).json({ error: "invalid_transition", message: e.message });
    }
    next(e);
  }
});

// Set priority
app.post("/api/admin/reports/:id/priority", ...staffGuard, requirePerm("cases.review"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { priority } = z.object({ priority: z.enum(["low", "normal", "high", "critical"]) }).parse(req.body);
    await db.report.update({ where: { id: req.params.id }, data: { priority } });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "case.priority_set", targetType: "report", targetId: req.params.id, detail: { priority }, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Internal note (restricted — never public)
app.post("/api/admin/reports/:id/notes", ...staffGuard, requirePerm("cases.note_internal"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body } = z.object({ body: z.string().min(2).max(4000) }).parse(req.body);
    await db.internalNote.create({ data: { reportId: req.params.id, authorId: req.user!.id, authorRole: req.user!.role, body } });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "case.note_added", targetType: "report", targetId: req.params.id, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Public update (visible on reporter timeline)
app.post("/api/admin/reports/:id/updates", ...staffGuard, requirePerm("cases.status_public_update"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kind, body } = z.object({
      kind: z.enum(["progress", "finding", "recommendation", "info"]),
      body: z.string().min(5).max(4000),
    }).parse(req.body);
    const report = await db.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "not_found" });
    await db.caseUpdate.create({
      data: { reportId: report.id, authorId: req.user!.id, authorRole: req.user!.role, kind, body, visibility: "public" },
    });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "case.update_posted", targetType: "report", targetId: report.id, req });
    if (report.reporterUserId) {
      await queueNotification({
        userId: report.reporterUserId, reportId: report.id, kind: "case_update",
        title: `Update on your report ${report.reference}`,
        body: body.slice(0, 200), linkPath: `/track/${report.reference}`, channel: "in_app",
      });
    }
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Request information from reporter
app.post("/api/admin/reports/:id/request-info", ...staffGuard, requirePerm("cases.request_info"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = z.object({ message: z.string().min(5).max(2000) }).parse(req.body);
    const report = await db.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: "not_found" });
    await db.infoRequest.create({ data: { reportId: report.id, message } });
    await applyStatusTransition({
      reportId: report.id, toStatus: "awaiting_reporter_input",
      actorId: req.user!.id, actorRole: req.user!.role,
      reason: message.slice(0, 200), makePublic: true,
    });
    if (report.reporterUserId) {
      await queueNotification({
        userId: report.reporterUserId, reportId: report.id, kind: "info_requested",
        title: `More information needed on report ${report.reference}`,
        body: message, linkPath: `/track/${report.reference}`, channel: "in_app",
      });
    }
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "case.info_requested", targetType: "report", targetId: report.id, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Assign / reassign officer
app.post("/api/admin/reports/:id/assign", ...staffGuard, requirePerm("cases.assign"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { officerId, note } = z.object({
      officerId: z.string().uuid(), note: z.string().max(1000).optional(),
    }).parse(req.body);
    const officer = await db.user.findUnique({ where: { id: officerId } });
    if (!officer || officer.role !== "officer" || officer.status !== "active") {
      return res.status(400).json({ error: "bad_officer", message: "The selected account must be an active officer." });
    }
    const report = await db.report.findUnique({ where: { id: req.params.id }, include: { assignments: { where: { state: "active" } } } });
    if (!report) return res.status(404).json({ error: "not_found" });
    if (report.assignments.some((a) => a.officerId === officerId)) {
      return res.status(409).json({ error: "already_assigned", message: "This case is already assigned to that officer." });
    }
    await db.$transaction(async (tx) => {
      await tx.caseAssignment.updateMany({
        where: { reportId: report.id, state: "active" },
        data: { state: "superseded" },
      });
      await tx.caseAssignment.create({
        data: { reportId: report.id, officerId, assignedById: req.user!.id, note },
      });
      if (report.status !== "investigation" && report.status !== "closed") {
        await tx.report.update({ where: { id: report.id }, data: { status: "assigned" } });
        await tx.caseStatusChange.create({
          data: {
            reportId: report.id, fromStatus: report.status, toStatus: "assigned",
            actorId: req.user!.id, actorRole: req.user!.role,
            visibility: "public", publicLabel: "Assigned for follow-up",
          },
        });
      }
    });
    await queueNotification({
      userId: officerId, reportId: report.id, kind: "case_assigned",
      title: `New case assigned: ${report.reference}`,
      body: note ?? "Please acknowledge this assignment in your officer portal.",
      linkPath: `/cases/${report.id}`, channel: "in_app",
    });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "case.assigned", targetType: "report", targetId: report.id, detail: { officerId }, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ============================================================
// EVIDENCE access (authorised staff only; short-lived signed URL)
// ============================================================
app.get("/api/evidence/:id/url", ...staffGuard, requirePerm("evidence.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ev = await db.evidence.findUnique({ where: { id: req.params.id }, include: { report: { include: { assignments: true } } } });
    if (!ev) return res.status(404).json({ error: "not_found" });
    // Officers may only access evidence on cases assigned to them.
    if (req.user!.role === "officer") {
      const assigned = ev.report.assignments.some((a) => a.officerId === req.user!.id && a.state === "active");
      if (!assigned) return res.status(403).json({ error: "forbidden", message: "This evidence belongs to a case not assigned to you." });
    }
    const url = newSignedEvidenceUrl(ev.id, 10 * 60 * 1000); // 10 minutes
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "evidence.view_requested", targetType: "evidence", targetId: ev.id, req });
    res.json({ url, expiresInMs: 600000, kind: ev.kind, mimeType: ev.mimeType });
  } catch (e) { next(e); }
});

// Evidence streaming endpoint (validates signature)
app.get("/api/evidence/:id/stream", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sig = String(req.query.sig ?? "");
    const exp = Number(req.query.exp ?? 0);
    const ev = await db.evidence.findUnique({ where: { id: req.params.id } });
    if (!ev) return res.status(404).json({ error: "not_found" });
    if (!verifyEvidenceSignature(ev.id, sig, exp)) {
      return res.status(403).json({ error: "invalid_signature" });
    }
    const data = readEvidence(ev.storageKey);
    res.setHeader("Content-Type", ev.mimeType);
    res.setHeader("Content-Length", String(data.length));
    res.setHeader("Content-Disposition", `inline; filename="${ev.originalName.replace(/[^\w.\-]/g, "_")}"`);
    res.send(data);
  } catch (e) { next(e); }
});

// ============================================================
// OFFICER MANAGEMENT (admin portal)
// ============================================================
app.get("/api/admin/officers", ...staffGuard, requirePerm("officers.read"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const officers = await db.user.findMany({
      where: { role: { in: ["officer", "reviewer", "admin"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, name: true, role: true, staffCode: true,
        staffOffice: true, status: true, createdAt: true, lastLoginAt: true,
      },
    });
    const ids = officers.map((o) => o.id);
    const counts = ids.length
      ? await db.caseAssignment.groupBy({ by: ["officerId"], where: { officerId: { in: ids }, state: "active" }, _count: { _all: true } })
      : [];
    res.json({
      officers: officers.map((o) => ({
        id: o.id, email: o.email, name: o.name, role: o.role, staffCode: o.staffCode,
        office: o.staffOffice, status: o.status, createdAt: o.createdAt.toISOString(),
        lastLoginAt: o.lastLoginAt?.toISOString() ?? null,
        activeCases: counts.find((c) => c.officerId === o.id)?._count._all ?? 0,
      })),
    });
  } catch (e) { next(e); }
});

app.post("/api/admin/officers/invite", ...staffGuard, requirePerm("officers.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = z.object({
      email: z.string().email(),
      name: z.string().min(2).max(120),
      role: z.enum(["officer", "reviewer", "admin"]),
      office: z.string().max(120).optional(),
      staffCode: z.string().max(40).optional(),
    }).parse(req.body);
    const email = input.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.status === "active") {
      return res.status(409).json({ error: "email_exists", message: "An active account with this email already exists." });
    }
    // Super-admin role cannot be granted via invitation (seed-only)
    if ((input.role as string) === "super_admin") {
      return res.status(403).json({ error: "forbidden", message: "Super administrator accounts can only be created by the seed process." });
    }
    const token = newInvitationToken();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72h
    const inv = await db.officerInvitation.create({
      data: {
        email, name: input.name, role: input.role, office: input.office, staffCode: input.staffCode,
        tokenHash: token.hash, expiresAt, invitedById: req.user!.id,
      },
    });
    if (!existing) {
      await db.user.create({
        data: {
          email, name: input.name, role: input.role,
          staffCode: input.staffCode, staffOffice: input.office,
          status: "invited", mustChangePassword: true,
        },
      });
    } else {
      await db.user.update({
        where: { email },
        data: { role: input.role, staffCode: input.staffCode, staffOffice: input.office, status: "invited", mustChangePassword: true },
      });
    }
    const acceptUrl = `${env.PUBLIC_OFFICER_URL}/#/activate?token=${token.raw}`;
    await queueNotification({
      kind: "officer_invitation", title: "REPORTA account invitation",
      body: `You have been invited as ${input.role}. Accept within 72 hours: ${acceptUrl}`,
      linkPath: acceptUrl, email, idempotencyKey: `invite:${inv.id}`,
    });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "officer.invited", targetType: "user", targetId: email, detail: { role: input.role, office: input.office }, req });
    res.status(201).json({
      ok: true,
      expiresAt: expiresAt.toISOString(),
      // Development convenience: when email isn't configured, the caller needs
      // this URL to complete setup. Never returned in production once email works.
      acceptUrl: env.EMAIL_MODE === "log" ? acceptUrl : undefined,
    });
  } catch (e) { next(e); }
});

app.post("/api/auth/activate", authLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password } = z.object({ token: z.string().min(20), password: z.string().min(10).max(128) }).parse(req.body);
    const tokenHash = hashInvitation(token);
    const inv = await db.officerInvitation.findUnique({ where: { tokenHash } });
    if (!inv || inv.usedAt || inv.expiresAt < new Date()) {
      return res.status(400).json({ error: "invalid_token", message: "This invitation link is invalid or has expired." });
    }
    const user = await db.user.findUnique({ where: { email: inv.email } });
    if (!user) return res.status(404).json({ error: "user_missing", message: "The invited account no longer exists." });
    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, status: "active", mustChangePassword: false },
      }),
      db.officerInvitation.update({ where: { id: inv.id }, data: { usedAt: new Date() } }),
    ]);
    const { accessToken } = await issueSession(user.id, req, res);
    setAccessCookie(res, accessToken);
    await audit({ actorId: user.id, actorRole: user.role, action: "officer.activated", targetType: "user", targetId: user.id, req });
    res.json({ accessToken, user: publicUser(user) });
  } catch (e) { next(e); }
});

// Suspend / reactivate / deactivate an officer
app.post("/api/admin/officers/:id/status", ...staffGuard, requirePerm("officers.suspend"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, reason } = z.object({
      status: z.enum(["active", "suspended", "deactivated"]),
      reason: z.string().max(500).optional(),
    }).parse(req.body);
    const officer = await db.user.findUnique({ where: { id: req.params.id } });
    if (!officer) return res.status(404).json({ error: "not_found" });
    if (officer.id === req.user!.id) {
      return res.status(409).json({ error: "self_action", message: "You cannot change your own account status." });
    }
    if (officer.role === "super_admin") {
      return res.status(403).json({ error: "protected", message: "Super administrator accounts cannot be suspended here." });
    }
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: officer.id }, data: { status } });
      if (status !== "active") {
        // Revoke sessions immediately
        await tx.refreshToken.updateMany({ where: { userId: officer.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: `officer.${status}`, targetType: "user", targetId: officer.id, detail: { reason }, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Revoke all sessions for an officer (forced logout)
app.post("/api/admin/officers/:id/revoke-sessions", ...staffGuard, requirePerm("officers.revoke_sessions"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const officer = await db.user.findUnique({ where: { id: req.params.id } });
    if (!officer) return res.status(404).json({ error: "not_found" });
    const result = await db.refreshToken.updateMany({
      where: { userId: officer.id, revokedAt: null }, data: { revokedAt: new Date() },
    });
    await audit({ actorId: req.user!.id, actorRole: req.user!.role, action: "officer.sessions_revoked", targetType: "user", targetId: officer.id, detail: { revoked: result.count }, req });
    res.json({ ok: true, revoked: result.count });
  } catch (e) { next(e); }
});

// ============================================================
// OFFICER PORTAL
// ============================================================
app.get("/api/officer/cases", requireAuth, requireRole("officer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignments = await db.caseAssignment.findMany({
      where: { officerId: req.user!.id, state: "active" },
      orderBy: { createdAt: "desc" },
      include: { report: { include: { evidence: { select: { id: true, kind: true } } } } },
    });
    res.json({
      cases: assignments.map((a) => ({
        assignmentId: a.id,
        acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
        report: {
          id: a.report.id, reference: a.report.reference, caseId: a.report.caseId,
          category: a.report.category, status: a.report.status, priority: a.report.priority,
          urgency: a.report.urgency, region: a.report.region, town: a.report.town,
          description: a.report.description.length > 240 ? a.report.description.slice(0, 240) + "…" : a.report.description,
          isAnonymous: a.report.isAnonymous,
          evidenceCount: a.report.evidence.length,
          createdAt: a.report.createdAt.toISOString(), updatedAt: a.report.updatedAt.toISOString(),
        },
      })),
    });
  } catch (e) { next(e); }
});

app.get("/api/officer/cases/:reportId", requireAuth, requireRole("officer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await db.caseAssignment.findFirst({
      where: { reportId: req.params.reportId, officerId: req.user!.id, state: "active" },
      include: {
        report: {
          include: {
            evidence: true,
            statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
            updates: { where: { visibility: "public" }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
            assignments: { include: { officer: { select: { name: true, staffCode: true } } }, orderBy: { createdAt: "desc" } },
            infoRequest: true,
          },
        },
      },
    });
    if (!a) {
      return res.status(403).json({ error: "forbidden", message: "This case is not assigned to you." });
    }
    const r = a.report;
    res.json({
      assignmentId: a.id, acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      report: {
        id: r.id, reference: r.reference, caseId: r.caseId, category: r.category,
        description: r.description, incidentDate: r.incidentDate?.toISOString() ?? null,
        incidentTime: r.incidentTime, region: r.region, town: r.town, landmark: r.landmark,
        ongoing: r.ongoing, urgency: r.urgency, status: r.status, priority: r.priority,
        isAnonymous: r.isAnonymous,
        reporter: r.isAnonymous ? null : { name: r.reporterName, phone: r.reporterPhone, email: r.reporterEmail },
        perpetrator: r.perpetratorName || r.perpetratorDesc ? { name: r.perpetratorName, description: r.perpetratorDesc } : null,
        witness: r.witnessInfo ? { info: r.witnessInfo } : null,
        createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        evidence: r.evidence.map((e) => ({
          id: e.id, kind: e.kind, mimeType: e.mimeType, sizeBytes: e.sizeBytes,
          originalName: e.originalName, scanStatus: e.scanStatus,
          createdAt: e.createdAt.toISOString(),
        })),
        statusHistory: r.statusHistory.map((s) => ({
          id: s.id, from: s.fromStatus, to: s.toStatus, at: s.createdAt.toISOString(),
          actorName: s.actor?.name ?? "System", actorRole: s.actorRole, reason: s.reason,
        })),
        updates: r.updates.map((u) => ({
          id: u.id, kind: u.kind, body: u.body, at: u.createdAt.toISOString(), authorName: u.author?.name ?? "Staff",
        })),
        assignments: r.assignments.map((x) => ({
          id: x.id, officerName: x.officer.name, officerCode: x.officer.staffCode, state: x.state,
          acknowledgedAt: x.acknowledgedAt?.toISOString() ?? null, at: x.createdAt.toISOString(),
        })),
        infoRequest: r.infoRequest ? {
          id: r.infoRequest.id, message: r.infoRequest.message,
          response: r.infoRequest.response, respondedAt: r.infoRequest.respondedAt?.toISOString() ?? null,
        } : null,
      },
    });
  } catch (e) { next(e); }
});

// Officer acknowledges an assignment
app.post("/api/officer/assignments/:id/acknowledge", requireAuth, requireRole("officer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const a = await db.caseAssignment.findUnique({ where: { id: req.params.id }, include: { report: true } });
    if (!a || a.officerId !== req.user!.id) {
      return res.status(404).json({ error: "not_found", message: "Assignment not found." });
    }
    if (a.acknowledgedAt) return res.json({ ok: true, alreadyAcknowledged: true });
    await db.caseAssignment.update({ where: { id: a.id }, data: { acknowledgedAt: new Date() } });
    if (!a.report.acknowledgedAt) {
      await db.report.update({ where: { id: a.reportId }, data: { acknowledgedAt: new Date(), acknowledgedById: req.user!.id } });
    }
    await audit({ actorId: req.user!.id, actorRole: "officer", action: "case.acknowledged", targetType: "report", targetId: a.reportId, req });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Officer progress update (progress / finding / recommendation)
app.post("/api/officer/cases/:reportId/update", requireAuth, requireRole("officer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kind, body, visibility } = z.object({
      kind: z.enum(["progress", "finding", "recommendation"]),
      body: z.string().min(5).max(4000),
      visibility: z.enum(["internal", "public"]).default("internal"),
    }).parse(req.body);
    const a = await db.caseAssignment.findFirst({ where: { reportId: req.params.reportId, officerId: req.user!.id, state: "active" } });
    if (!a) return res.status(403).json({ error: "forbidden", message: "This case is not assigned to you." });
    await db.caseUpdate.create({
      data: { reportId: a.reportId, authorId: req.user!.id, authorRole: "officer", kind, body, visibility },
    });
    await audit({ actorId: req.user!.id, actorRole: "officer", action: "case.update_posted", targetType: "report", targetId: a.reportId, detail: { kind, visibility }, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Officer flags a case (urgent / conflict / unable to handle / risk)
app.post("/api/officer/cases/:reportId/flag", requireAuth, requireRole("officer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { flag, note } = z.object({
      flag: z.enum(["urgent", "conflict_of_interest", "unable_to_handle", "risk"]),
      note: z.string().max(1000).optional(),
    }).parse(req.body);
    const a = await db.caseAssignment.findFirst({ where: { reportId: req.params.reportId, officerId: req.user!.id, state: "active" } });
    if (!a) return res.status(403).json({ error: "forbidden", message: "This case is not assigned to you." });
    await db.escalation.create({
      data: { reportId: a.reportId, raisedById: req.user!.id, kind: flag, note },
    });
    const admins = await db.user.findMany({
      where: { role: { in: ["admin", "super_admin", "reviewer"] }, status: "active" },
      select: { id: true },
    });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id, reportId: a.reportId, kind: "case_flagged", channel: "in_app",
          title: `Case flagged: ${flag}`,
          body: note ?? `Officer flagged a case (${flag}).`,
          linkPath: `/admin/reports/${a.reportId}`,
        },
      }).catch(() => {});
    }
    await audit({ actorId: req.user!.id, actorRole: "officer", action: "case.flagged", targetType: "report", targetId: a.reportId, detail: { flag }, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Officer requests reassignment
app.post("/api/officer/cases/:reportId/request-reassign", requireAuth, requireRole("officer"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(10).max(1000) }).parse(req.body);
    const a = await db.caseAssignment.findFirst({ where: { reportId: req.params.reportId, officerId: req.user!.id, state: "active" } });
    if (!a) return res.status(403).json({ error: "forbidden", message: "This case is not assigned to you." });
    const admins = await db.user.findMany({
      where: { role: { in: ["admin", "super_admin", "reviewer"] }, status: "active" },
      select: { id: true },
    });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id, reportId: a.reportId, kind: "reassign_requested", channel: "in_app",
          title: "Reassignment requested",
          body: reason, linkPath: `/admin/reports/${a.reportId}`,
        },
      }).catch(() => {});
    }
    await audit({ actorId: req.user!.id, actorRole: "officer", action: "case.reassign_requested", targetType: "report", targetId: a.reportId, detail: { reason }, req });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// ============================================================
// Audit log access (admin + auditor)
// ============================================================
app.get("/api/admin/audit", ...staffGuard, requirePerm("audit.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(100, Number(q.pageSize ?? 50));
    const where: any = {};
    if (q.action) where.action = { contains: q.action };
    if (q.targetType) where.targetType = q.targetType;
    const [total, events] = await Promise.all([
      db.auditEvent.count({ where }),
      db.auditEvent.findMany({
        where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);
    res.json({
      total, page, pageSize,
      events: events.map((e) => ({
        id: e.id, action: e.action, actorName: e.actor?.name ?? "System",
        actorEmail: e.actor?.email ?? null, actorRole: e.actorRole,
        targetType: e.targetType, targetId: e.targetId,
        detail: e.detail ? safeJson(e.detail as string) : null,
        at: e.createdAt.toISOString(),
      })),
    });
  } catch (e) { next(e); }
});

// Retry failed email notifications (admin action)
app.post("/api/admin/notifications/retry", ...staffGuard, requirePerm("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const retried = await retryFailedNotifications();
    res.json({ ok: true, retried });
  } catch (e) { next(e); }
});

// ============================================================
// Middleware: optionalAuth (attaches req.user if a valid token exists)
// ============================================================
app.use(optionalAuth);

async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
    const cookieToken = (req as any).cookies?.["reporta_at"] as string | undefined;
    const token = bearer ?? cookieToken;
    if (token) {
      const payload = verifyAccessToken(token);
      if (payload) {
        const user = await db.user.findUnique({ where: { id: payload.sub } });
        if (user && user.status === "active") {
          (req as any).user = user;
        }
      }
    }
  } catch {
    /* anonymous */
  }
  next();
}

// ============================================================
// Error handling
// ============================================================
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "validation_failed",
      message: err.errors[0]?.message ?? "Invalid input",
      details: err.errors,
    });
  }
  if (err?.code === "P2002") {
    return res.status(409).json({ error: "conflict", message: "A record with this value already exists." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "too_large", message: "File too large." });
  }
  console.error("[API ERROR]", redact(err?.message ?? err));
  res.status(500).json({ error: "internal", message: "Something went wrong. Please try again." });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "not_found", message: "Endpoint not found." });
});

// ============================================================
// Signed evidence URLs (HMAC + expiry)
// ============================================================
function newSignedEvidenceUrl(evidenceId: string, ttlMs: number): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`${evidenceId}:${exp}`).digest("hex");
  return `/api/evidence/${evidenceId}/stream?sig=${sig}&exp=${exp}`;
}

function verifyEvidenceSignature(evidenceId: string, sig: string, exp: number): boolean {
  if (Date.now() > exp) return false;
  const expected = createHmac("sha256", env.JWT_ACCESS_SECRET).update(`${evidenceId}:${exp}`).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ============================================================
// Start
// ============================================================
const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`[REPORTA API] listening on :${PORT} (${env.NODE_ENV})`);
});

export default app;
