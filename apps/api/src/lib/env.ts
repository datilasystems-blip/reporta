// ============================================================
// REPORTA API — configuration loaded from environment
// Never hardcode secrets. All production values come from env.
// ============================================================
import dotenv from "dotenv";
dotenv.config();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_URL: req("DATABASE_URL", "file:./prisma/dev.db"),

  JWT_ACCESS_SECRET: req("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: req("JWT_REFRESH_SECRET"),
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? "15m",
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),

  // CORS: comma-separated list of allowed browser origins
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",

  // Public base URLs used in emails & OAuth redirects
  PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL ?? "http://localhost:5173",
  PUBLIC_ADMIN_URL: process.env.PUBLIC_ADMIN_URL ?? "http://localhost:5174",
  PUBLIC_OFFICER_URL: process.env.PUBLIC_OFFICER_URL ?? "http://localhost:5175",
  API_PUBLIC_URL: process.env.API_PUBLIC_URL ?? "http://localhost:4000",

  // Google OAuth (optional until configured)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_REDIRECT_PATH: process.env.GOOGLE_REDIRECT_PATH ?? "/api/auth/google/callback",

  // Gmail API / SMTP email (optional until configured)
  EMAIL_MODE: (process.env.EMAIL_MODE ?? "log") as "log" | "gmail" | "smtp",
  GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN ?? "",
  GMAIL_SENDER: process.env.GMAIL_SENDER ?? "",
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASS: process.env.SMTP_PASS ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "REPORTA <no-reply@reporta.gov.gh>",

  // Admin notification recipients (comma-separated)
  ADMIN_NOTIFY_EMAILS: process.env.ADMIN_NOTIFY_EMAILS ?? "",

  // Admin seed
  REPORTA_ADMIN_EMAIL: process.env.REPORTA_ADMIN_EMAIL ?? "",
  REPORTA_ADMIN_INITIAL_PASSWORD: process.env.REPORTA_ADMIN_INITIAL_PASSWORD ?? "",

  // Evidence vault: directory outside webroot
  EVIDENCE_DIR: process.env.EVIDENCE_DIR ?? "./evidence-vault",

  // Optional malware scanning (ClamAV via clamscan). If unset, evidence is
  // quarantined until scanned. Documented in docs/EVIDENCE-SECURITY.md
  CLAMAV_HOST: process.env.CLAMAV_HOST ?? "",
  CLAMAV_PORT: Number(process.env.CLAMAV_PORT ?? 3310),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 300),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20),
  REPORT_RATE_LIMIT_MAX: Number(process.env.REPORT_RATE_LIMIT_MAX ?? 10),

  // Retention (days) for closed-case evidence, 0 = keep until manual purge
  EVIDENCE_RETENTION_DAYS: Number(process.env.EVIDENCE_RETENTION_DAYS ?? 0),

  IS_PRODUCTION: (process.env.NODE_ENV ?? "development") === "production",
};
