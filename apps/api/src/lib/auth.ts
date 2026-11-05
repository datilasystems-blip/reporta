// Authentication & authorization middleware (server-enforced RBAC)
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "./crypto.js";
import { db } from "@reporta/database";

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  staffCode?: string | null;
  status: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

const STAFF_ROLES = ["officer", "reviewer", "admin", "super_admin", "auditor"];

export function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = (req as any).cookies?.["reporta_at"];
  return cookie ?? null;
}

// Session expiry guard for access tokens
export const ACCESS_COOKIE = "reporta_at";

// Must change password gate: blocks sensitive actions until password reset
export function requirePasswordChanged(req: Request, res: Response, next: NextFunction): void {
  if ((req as any).mustChangePassword) {
    res.status(403).json({ error: "password_change_required", message: "Change your password before continuing." });
    return;
  }
  next();
}

export function requireStaffHandler(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !STAFF_ROLES.includes(req.user.role)) {
    res.status(403).json({ error: "forbidden", message: "Staff access only." });
    return;
  }
  next();
}

export const requireStaff = requireStaffHandler;

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthenticated", message: "Sign in required." });
    return;
  }
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: "invalid_token", message: "Session expired. Sign in again." });
    return;
  }
  try {
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "active") {
      res.status(401).json({ error: "account_inactive", message: "Account is not active." });
      return;
    }
    req.user = { id: user.id, role: user.role, email: user.email, staffCode: user.staffCode, status: user.status };
    next();
  } catch (err) {
    next(err);
  }
};

// Role-based authorization. Staff roles can always see their own data.
export function requireRole(...roles: string[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", message: "You do not have permission for this action." });
      return;
    }
    next();
  };
}

export function isStaff(role: string): boolean {
  return STAFF_ROLES.includes(role);
}

export function isAdminLevel(role: string): boolean {
  return role === "admin" || role === "super_admin";
}
