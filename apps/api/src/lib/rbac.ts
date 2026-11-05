// Role-based access control & permission policy (server-enforced).
// A hidden route, frontend flag, or client-supplied role name is not security:
// every route must call requireRole / requirePerm on the SERVER.
export const ROLES = ["super_admin", "admin", "reviewer", "officer", "auditor", "reporter"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = ["super_admin", "admin", "reviewer", "officer", "auditor"];
export const ADMIN_ROLES: Role[] = ["super_admin", "admin"];
export const CASE_MGMT_ROLES: Role[] = ["super_admin", "admin", "reviewer"];
export const OFFICER_ONLY: Role[] = ["officer"];

// Capabilities: what each role may do
export const PERMISSIONS = {
  // Officer management (admin portal)
  "officers.create": ADMIN_ROLES,
  "officers.read": ADMIN_ROLES,
  "officers.suspend": ADMIN_ROLES,
  "officers.reactivate": ADMIN_ROLES,
  "officers.reset": ADMIN_ROLES,
  "officers.revoke_sessions": ADMIN_ROLES,
  // Case management
  "cases.view_all": ADMIN_ROLES.concat(["reviewer", "auditor"]),
  "cases.review": ADMIN_ROLES.concat(["reviewer"]),
  "cases.assign": ADMIN_ROLES.concat(["reviewer"]),
  "cases.reassign": ADMIN_ROLES.concat(["reviewer"]),
  "cases.close": ADMIN_ROLES.concat(["reviewer"]),
  "cases.reopen": ADMIN_ROLES,
  "cases.priority": ADMIN_ROLES.concat(["reviewer"]),
  "cases.request_info": ADMIN_ROLES.concat(["reviewer"]),
  "cases.note_internal": ADMIN_ROLES.concat(["reviewer", "officer"]),
  "cases.status_public_update": ADMIN_ROLES.concat(["reviewer"]),
  // Officer self-service
  "officer.my_cases": OFFICER_ONLY,
  "officer.update_case": OFFICER_ONLY,
  "officer.acknowledge": OFFICER_ONLY,
  "officer.submit_findings": OFFICER_ONLY,
  "officer.request_reassign": OFFICER_ONLY,
  // Evidence
  "evidence.view": ADMIN_ROLES.concat(["reviewer", "officer", "auditor"]),
  "evidence.download": ADMIN_ROLES.concat(["reviewer", "officer"]),
  "evidence.delete": ADMIN_ROLES,
  // Administration
  "users.manage": ADMIN_ROLES,
  "settings.manage": ["super_admin"],
  "audit.view": ADMIN_ROLES.concat(["auditor"]),
  "exports.run": ADMIN_ROLES.concat(["auditor"]),
  "dashboard.metrics": ADMIN_ROLES.concat(["reviewer", "auditor"]),
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: string, permission: Permission): boolean {
  const allowed = (PERMISSIONS as Record<string, readonly string[]>)[permission];
  return allowed ? allowed.includes(role) : false;
}

export function isStaff(role: string): boolean {
  return STAFF_ROLES.includes(role as Role);
}

export function isAdminLevel(role: string): boolean {
  return ADMIN_ROLES.includes(role as Role);
}
