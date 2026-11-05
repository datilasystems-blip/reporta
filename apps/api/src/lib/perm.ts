// RBAC middleware — server-enforced permission checks
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { hasPermission, type Permission } from "./rbac.js";

export function requirePerm(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: "forbidden", message: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}

// Any staff role
export const requireStaff: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  if (req.user.role === "reporter") {
    res.status(403).json({ error: "forbidden", message: "Staff access only." });
    return;
  }
  next();
};
