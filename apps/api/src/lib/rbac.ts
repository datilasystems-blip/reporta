// Role-based access control & permission policy.
// All permissions are enforced by the API, never by frontend role selectors.

export const ROLES = [
  "super_admin",
  "admin",
  "officer",
  "reporter",
] as const;

export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = [
  "super_admin",
  "admin",
  "officer",
];

export const ADMIN_ROLES: Role[] = ["super_admin"];
export const CASE_MGMT_ROLES: Role[] = ["super_admin"];
export const OFFICER_ONLY: Role[] = ["officer"];

// Static permissions. Admin permissions are checked separately
// against AdminPermissionGrant records in the database.
export const PERMISSIONS = {
  // Officer management
  "officers.create": ["super_admin"],
  "officers.read": ["super_admin"],
  "officers.suspend": ["super_admin"],
  "officers.reactivate": ["super_admin"],
  "officers.reset": ["super_admin"],
  "officers.revoke_sessions": ["super_admin"],

  // Case management
  "cases.view_all": ["super_admin"],
  "cases.review": ["super_admin"],
  "cases.assign": ["super_admin"],
  "cases.reassign": ["super_admin"],
  "cases.close": ["super_admin"],
  "cases.reopen": ["super_admin"],
  "cases.priority": ["super_admin"],
  "cases.request_info": ["super_admin"],
  "cases.note_internal": ["super_admin", "officer"],
  "cases.status_public_update": ["super_admin"],

  // Officer self-service: never delegated to Admin
  "officer.my_cases": OFFICER_ONLY,
  "officer.update_case": OFFICER_ONLY,
  "officer.acknowledge": OFFICER_ONLY,
  "officer.submit_findings": OFFICER_ONLY,
  "officer.request_reassign": OFFICER_ONLY,

  // Evidence
  "evidence.view": ["super_admin", "officer"],
  "evidence.download": ["super_admin", "officer"],
  "evidence.delete": ["super_admin"],

  // Administration
  "users.manage": ["super_admin"],
  "settings.manage": ["super_admin"],
  "audit.view": ["super_admin"],
  "exports.run": ["super_admin"],
  "dashboard.metrics": ["super_admin"],

  // Officer applications
  "applications.view": ["super_admin"],
  "applications.review": ["super_admin"],
  "applications.documents.view": ["super_admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// These permissions may be individually granted to an Admin by Super Admin.
// A database grant is required; being an Admin alone grants none of them.
export const ADMIN_GRANTABLE_PERMISSIONS = [
  "officers.create",
  "officers.read",
  "officers.suspend",
  "officers.reactivate",
  "officers.reset",
  "officers.revoke_sessions",

  "cases.view_all",
  "cases.review",
  "cases.assign",
  "cases.reassign",
  "cases.close",
  "cases.reopen",
  "cases.priority",
  "cases.request_info",
  "cases.note_internal",
  "cases.status_public_update",

  "evidence.view",
  "evidence.download",

  "users.manage",
  "audit.view",
  "dashboard.metrics",

  "applications.view",
  "applications.review",
  "applications.documents.view",
] as const satisfies readonly Permission[];

export function isAdminGrantablePermission(
  permission: Permission,
): boolean {
  return (ADMIN_GRANTABLE_PERMISSIONS as readonly string[]).includes(
    permission,
  );
}

// This function handles fixed role permissions only.
// Database-backed Admin grants are checked by requirePerm.
export function hasPermission(
  role: string,
  permission: Permission,
): boolean {
  const allowed = (PERMISSIONS as Record<string, readonly string[]>)[
    permission
  ];

  return allowed ? allowed.includes(role) : false;
}

export function isStaff(role: string): boolean {
  return STAFF_ROLES.includes(role as Role);
}

export function isAdminLevel(role: string): boolean {
  return ADMIN_ROLES.includes(role as Role);
}