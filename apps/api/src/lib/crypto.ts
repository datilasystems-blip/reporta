// Crypto & token utilities — hashing, JWT, reference generation
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function hashToken(token: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

export function compareDigest(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function newReportReference(): string {
  // RPT-XXXX-XXXX (Crockford base32 alphabet, no I/L/O)
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const pick = (n: number) =>
    Array.from(crypto.randomBytes(n)).map((b) => alphabet[b % alphabet.length]).join("");
  return `RPT-${pick(4)}-${pick(4)}`;
}

export function newCaseId(seq: number): string {
  const year = new Date().getFullYear();
  return `CASE-${year}-${String(seq).padStart(5, "0")}`;
}

// HMAC-SHA256 webhook signing (timing-safe verification)
export function hmacSign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function hmacVerify(payload: string, secret: string, signature: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  try {
    const given = Buffer.from(signature, "hex");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  } catch {
    return false;
  }
}

export interface AccessPayload {
  sub: string;
  role: string;
  email: string;
  staffCode?: string | null;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as any,
    issuer: "reporta",
  });
}

export function signAccessTokenWithTtl(payload: AccessPayload, ttlSeconds: number): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ttlSeconds,
    issuer: "reporta",
  });
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: "reporta" }) as any;
    if (!decoded?.sub || !decoded?.role) return null;
    return decoded as AccessPayload;
  } catch {
    return null;
  }
}

export function newRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomToken(48);
  return {
    raw,
    hash: hashToken(raw, env.JWT_REFRESH_SECRET),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function hashRefresh(raw: string): string {
  return hashToken(raw, env.JWT_REFRESH_SECRET);
}

export function newInvitationToken(): { raw: string; hash: string } {
  const raw = randomToken(32);
  return { raw, hash: sha256Hex(raw) };
}

export function hashInvitation(raw: string): string {
  return sha256Hex(raw);
}

// Deterministic hashing for IPs (privacy: never store raw IPs)
export function hashIp(ip: string): string {
  return sha256Hex(`${ip}|${env.JWT_ACCESS_SECRET}`).slice(0, 32);
}

export function newTrackingCode(): { raw: string; hash: string } {
  // 16-char code used as the anonymous reporter's secret
  const alphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = crypto.randomBytes(16);
  const raw = Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join("");
  return { raw, hash: hashToken(raw, env.JWT_ACCESS_SECRET) };
}

export function verifyTrackingCode(raw: string, storedHash: string): boolean {
  return compareDigest(hashToken(raw, env.JWT_ACCESS_SECRET), storedHash);
}
